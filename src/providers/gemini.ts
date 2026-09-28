// Step 3 extension (9/3/2026) — Google Gemini implementation of LLMProvider,
// the 4th provider alongside Anthropic, Ollama, and OpenRouter.
//
// Per user decision (9/3/2026): build this provider and wire it into every
// place the other three are wired into (types, index/getDefaultProvider,
// smoke test, README, the wizard planning doc) but do NOT run the smoke
// test or attempt a live call this round — "assume it works." That mirrors
// the existing OpenRouter precedent (build-and-verify-later), except here
// the deferral is a direct instruction rather than a discovered network
// block, so treat this file as UNVERIFIED against a live response until
// someone actually runs `npm run test:providers` with a real GEMINI_API_KEY.
//
// Request/response shape verified against Google's current docs (9/3/2026),
// NOT against a live call:
//  - Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/
//    {model}:generateContent?key=$GEMINI_API_KEY — API key goes in the query
//    string, not an Authorization header (confirmed via ai.google.dev/api/generate-content).
//  - Structured output fields live under generationConfig: responseMimeType
//    ("application/json") and responseSchema (a JSON Schema object) —
//    camelCase, confirmed via the Firebase AI Logic docs' Web SDK example
//    (firebase.google.com/docs/ai-logic/generate-structured-output), which
//    maps 1:1 onto the REST body for this API family.
//  - System instructions are a separate top-level `systemInstruction` field
//    (a Content object), not folded into `contents` — matches this
//    project's existing systemPrompt/userPrompt separation (AC-S1) with no
//    translation needed beyond wrapping each in Gemini's { parts: [...] }
//    shape.
//  - Generated text lands at candidates[0].content.parts[0].text.
//
// One live, disclosed uncertainty worth flagging rather than hiding: Google
// is steering new integrations toward a newer "Interactions API"
// (ai.google.dev/gemini-api/docs/migrate-to-interactions), which explicitly
// states generateContent "remains fully supported." This provider
// deliberately targets generateContent, not Interactions — Interactions is
// a stateful, server-side-conversation, tool-use-oriented API, which is a
// mismatch for this project's single-shot, stateless
// StructuredGenerationRequest -> StructuredGenerationResult interface (the
// same reason Anthropic's/OpenRouter's providers use their equivalent
// single-call endpoints, not an agentic/session one). Revisit this choice
// if Google actually deprecates generateContent later.
//
// A second disclosed uncertainty, RESOLVED 2026-09-08 by a real live 400 —
// not assumed away after all. This project's canonical request-time schema
// (src/prompts/responseSchema.ts) expresses "nullable" fields using the
// OpenAI/Anthropic-strict-mode convention (`type: ["object", "null"]`) and
// forbids extras via `additionalProperties: false` — both of which work
// fine for Anthropic/OpenRouter/Ollama, but Gemini's real v1beta REST
// endpoint rejected them outright:
//   "Unknown name \"type\" at '...properties[3].value': Proto field is not
//    repeating, cannot start list."
//   "Unknown name \"additionalProperties\" at '...': Cannot find field."
// Cross-checked against the canonical proto source (googleapis/google/ai/
// generativelanguage/v1beta/content.proto's Schema message) rather than
// prose docs, which turned out to describe a different/newer schema dialect
// than what this REST endpoint actually enforces: Schema.type is a
// SINGULAR, required field (never a list), Schema has no
// "additional_properties" field at all, and nullability is instead a real,
// separate `bool nullable` field. `toGeminiSchema()` below converts this
// project's canonical schema into that dialect — applied only here, not in
// the shared responseSchema.ts, since the other 3 providers are already
// live-verified (or, for OpenRouter, docs-verified) against the original
// convention and shouldn't be touched for Gemini's sake.

import type { LLMProvider, StructuredGenerationRequest, StructuredGenerationResult } from "./types";

/**
 * Recursively rewrites a canonical JSON Schema (this project's shared
 * dialect — see the file header above) into the shape Gemini's real
 * `generationConfig.responseSchema` accepts:
 *   - `additionalProperties` is dropped everywhere (Gemini's Schema proto
 *     has no such field; the other 3 providers' calls are unaffected since
 *     they get the untouched canonical schema, not this converted copy).
 *   - `type: [X, "null"]` becomes `type: X` plus a sibling `nullable: true`
 *     (Gemini's real nullable mechanism), instead of the array-of-types
 *     union the other 3 providers accept.
 * Everything else (properties, items, required, enum, minLength, minItems,
 * etc.) passes through unchanged — those are already plain, supported
 * fields on Gemini's Schema (confirmed against content.proto).
 */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => toGeminiSchema(item));
  }
  if (schema === null || typeof schema !== "object") {
    return schema;
  }

  const input = schema as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  let nullable = false;

  for (const [key, value] of Object.entries(input)) {
    if (key === "additionalProperties") {
      continue; // No such field on Gemini's Schema — silently drop, never sent.
    }
    if (key === "type" && Array.isArray(value)) {
      const nonNullTypes = value.filter((t) => t !== "null");
      if (nonNullTypes.length !== value.length) nullable = true;
      // Gemini's `type` is singular — this project's canonical schemas
      // never mix more than one real type alongside "null", so taking the
      // one remaining type is safe (not a lossy guess).
      output.type = nonNullTypes[0];
      continue;
    }
    output[key] = toGeminiSchema(value);
  }

  if (nullable) output.nullable = true;
  return output;
}

export interface GeminiProviderConfig {
  apiKey?: string; // falls back to GEMINI_API_KEY env var
  baseUrl?: string;
}

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: { role?: string; parts?: GeminiPart[] };
  finishReason?: string;
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message: string; status?: string };
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini" as const;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: GeminiProviderConfig = {}) {
    const key = config.apiKey ?? process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GeminiProvider requires an API key (config.apiKey or GEMINI_API_KEY env var).");
    }
    this.apiKey = key;
    this.baseUrl = config.baseUrl ?? "https://generativelanguage.googleapis.com";
  }

  async generate(request: StructuredGenerationRequest): Promise<StructuredGenerationResult> {
    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(request.jsonSchema),
        temperature: request.temperature ?? 0,
        ...(request.maxTokens !== undefined ? { maxOutputTokens: request.maxTokens } : {}),
      },
    };
    if (request.systemPrompt) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }

    const url = `${this.baseUrl}/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${this.apiKey}`;

    const start = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const elapsedMs = Date.now() - start;

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "(could not read response body)");
      throw new Error(`Gemini generateContent returned HTTP ${res.status}: ${bodyText}`);
    }

    const data = (await res.json()) as GeminiGenerateContentResponse;
    if (data.error) {
      throw new Error(`Gemini returned an error payload: ${data.error.message} (status: ${data.error.status ?? "unknown"})`);
    }
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the prompt before generating: ${data.promptFeedback.blockReason}`);
    }

    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) {
      throw new Error(
        `Gemini response contained no candidates[0].content.parts[].text. ` +
          `finishReason=${candidate?.finishReason ?? "unknown"}. Full response keys: ${Object.keys(data).join(", ")}`
      );
    }

    return { provider: "gemini", model: request.model, raw: text, elapsedMs, schemaForced: true };
  }
}
