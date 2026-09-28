// Step 3 — Ollama implementation of LLMProvider.
//
// Verified against the live docs before writing this:
//   - https://docs.ollama.com/capabilities/structured-outputs
//   - https://github.com/ollama/ollama/blob/main/docs/api.md (POST /api/chat)
//
// What that verification found: Ollama's REST API takes a `format` field in
// the /api/chat request body — either the literal string "json" for loose
// JSON mode, or a full JSON Schema object for schema-forced generation. This
// implementation always sends a JSON Schema object (never the loose "json"
// string), so schemaForced is unconditionally true for every response this
// class returns. Response text comes back at `message.content` as a JSON
// string (not a parsed object) — matching this project's raw-text contract
// in StructuredGenerationResult.
//
// Deliberately uses a plain `fetch()` call against the REST API rather than
// the official `ollama` npm package: this project's Ollama usage is a single
// endpoint (chat, non-streaming, schema-forced), so pulling in a whole
// client SDK for one call is more dependency than the job needs. Node 22's
// built-in global fetch (no import) is what's available in this project's
// runtime (see package.json's node engine / the cloud sandbox's Node
// version) — if this ever needs to run on an older Node, this is the one
// place that would need a fetch polyfill.
//
// 2026-09-07: fixed a real bug found via a live "ollama rejected the
// request: fetch failed" report. Root cause, confirmed with a standalone
// repro (a slow HTTP server + Node's own fetch), not guessed: Node's global
// `fetch` is undici under the hood, and undici's *default* dispatcher kills
// any request that hasn't received response headers within 300 seconds
// (`headersTimeout`) — throwing a `TypeError` whose `.message` is literally
// the generic string "fetch failed" (the real reason lives one level down,
// in `.cause`, which this project's routes weren't surfacing). A
// non-streaming `/api/chat` call only sends its response once generation is
// completely done, so any local model slow enough to take longer than 5
// minutes to finish (very plausible for a large model — e.g. a 27B-parameter
// one — running on CPU, exactly what this project's own testing guide
// warned "be patient" about) was being killed by this default regardless of
// how patient the user was. Fixed by giving this one call its own dispatcher
// with a much longer timeout — see `GENERATE_DISPATCHER` below — rather than
// changing Node's global default, so cloud providers' fetch calls (which
// have no reason to ever take this long) are unaffected.
import { Agent } from "undici";
import type { LLMProvider, StructuredGenerationRequest, StructuredGenerationResult } from "./types";

// 30 minutes: generous enough for a large local model on CPU-only inference,
// while still eventually giving up (rather than hanging forever) if Ollama
// itself is genuinely stuck. `bodyTimeout` matters too, even for a
// non-streaming response — it bounds gaps *within* receiving the body, not
// just the wait for headers.
const GENERATE_DISPATCHER = new Agent({ headersTimeout: 30 * 60 * 1000, bodyTimeout: 30 * 60 * 1000 });

export interface OllamaProviderConfig {
  /** Defaults to Ollama's standard local port. Override for a remote/non-default host. */
  baseUrl?: string;
}

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  done_reason?: string;
}

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama" as const;
  private baseUrl: string;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  }

  async generate(request: StructuredGenerationRequest): Promise<StructuredGenerationResult> {
    const messages = request.systemPrompt
      ? [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ]
      : [{ role: "user", content: request.userPrompt }];

    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          messages,
          stream: false,
          format: request.jsonSchema,
          // Reasoning ("thinking") models — Qwen3 among them — are on by
          // default in Ollama (confirmed via docs.ollama.com/capabilities/
          // thinking, 2026-09-08) and, on most served backends, draw their
          // reasoning trace from the SAME token budget as `num_predict`
          // below. This project's use case has no use for a reasoning trace
          // at all — only the final schema-forced JSON matters — so
          // explicitly disabling it removes a real, plausible cause of a
          // real bug found live: 4 of 5 AI-generated section types (the
          // more "compose something new" ones — cardGrid, processSteps,
          // topicGrid, textAndTimeline) failed with "didn't produce valid
          // content" against qwen3.8:27b, while the one needing the least
          // synthesis (chipGroups — just regrouping an already-extracted
          // skill list) succeeded — consistent with the model spending most
          // or all of a shared, small token budget thinking before ever
          // reaching the answer on the harder tasks. Not fully live-proven
          // (this project can't run a 17GB local model to confirm), so
          // logged here as the best-supported fix, alongside a raised
          // token budget (see generate/route.ts) and better diagnostics on
          // any future failure (see below) so the real cause is confirmable
          // next time rather than staying a black box either way.
          //
          // Disclosed uncertainty: `/api/chat`'s docs describe `think` as
          // "(for thinking models) should the model think before
          // responding?" — worded as scoping what it does, not as requiring
          // a thinking-capable model to be present, and every other
          // model-specific option this project already sends (e.g.
          // `temperature`) is a plain no-op for a model that doesn't use
          // it. Read together, sending `think: false` unconditionally
          // (including to this project's own non-thinking default,
          // llama3.2:1b) should be safe — but this project has no way to
          // run a real Ollama instance to confirm it live. If a future
          // error message ever names "think" specifically, that's the
          // signal this assumption was wrong and this needs to become
          // conditional on the model instead.
          think: false,
          options: {
            temperature: request.temperature ?? 0,
            num_predict: request.maxTokens, // Ollama's equivalent of max_tokens; undefined = provider default
          },
        }),
        // See the class-level comment above for why this needs its own
        // dispatcher rather than relying on undici's 5-minute default.
        dispatcher: GENERATE_DISPATCHER,
      } as RequestInit & { dispatcher: Agent });
    } catch (error) {
      // Node's fetch wraps every low-level network failure (connection
      // refused, DNS failure, a stalled/timed-out connection, ...) in a
      // generic `TypeError: fetch failed` and puts the actually useful
      // detail in `.cause` — which was being silently dropped before this
      // fix, so every failure here looked identical and undiagnosable from
      // the wizard's own UI. Surface it.
      const baseMessage = error instanceof Error ? error.message : String(error);
      const causeMessage = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
      throw new Error(
        `Could not reach Ollama at ${this.baseUrl}/api/chat: ${baseMessage}${causeMessage}. ` +
          `Check that Ollama is still running (\`ollama list\` in a terminal) — if you're generating with a ` +
          `large local model, this can also mean it's still working and the connection stalled; try again.`
      );
    }
    const elapsedMs = Date.now() - start;

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "(could not read response body)");
      throw new Error(`Ollama /api/chat returned HTTP ${res.status}: ${bodyText}`);
    }

    const data = (await res.json()) as OllamaChatResponse;
    if (!data.done) {
      throw new Error(`Ollama response reported done: false (unexpected for a non-streaming request)`);
    }

    return {
      provider: "ollama",
      model: request.model,
      raw: data.message.content,
      elapsedMs,
      schemaForced: true,
    };
  }
}
