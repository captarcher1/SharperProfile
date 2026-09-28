// Step 3 — Anthropic implementation of LLMProvider.
//
// Verified against the live docs before writing this (not from memory —
// per this project's own standing rule about not inventing API syntax):
//   - https://platform.claude.com/docs/en/build-with-claude/structured-outputs
//   - the installed @anthropic-ai/sdk's own source (node_modules/@anthropic-ai/sdk),
//     since third-party writeups of a fast-moving API are themselves not
//     trustworthy as ground truth.
//
// What that verification found: native structured outputs use the
// `output_config: { format: { type: "json_schema", schema: <JSON Schema> } }`
// request parameter (NOT the older, now-unnecessary beta header
// `structured-outputs-2025-11-13` — the SDK accepts it for transition but
// new code shouldn't send it). Supported model families as of the docs
// pulled 8/27/2026: Opus 4.5–5, Sonnet 4.5–5, Haiku 4.5, Fable/Mythos 5+.
// A model outside that list will still accept the parameter but Anthropic's
// docs don't promise schema-forcing for it — this implementation sends
// output_config unconditionally and lets schemaForced reflect what was
// requested, not a per-model capability check (verifying a model's
// structured-output capability at request time would need the live Models
// API, out of scope for this smoke-test-sized step).

import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, StructuredGenerationRequest, StructuredGenerationResult } from "./types";

export interface AnthropicProviderConfig {
  apiKey?: string; // falls back to ANTHROPIC_API_KEY env var, same as the SDK's own default
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(config: AnthropicProviderConfig = {}) {
    // Anthropic() throws synchronously if no key is available anywhere
    // (config.apiKey or process.env.ANTHROPIC_API_KEY) — deliberately not
    // caught here, since "no credentials" is a setup error the caller
    // should see immediately, not something to paper over.
    this.client = new Anthropic(config.apiKey ? { apiKey: config.apiKey } : {});
  }

  async generate(request: StructuredGenerationRequest): Promise<StructuredGenerationResult> {
    const start = Date.now();
    const message = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
      output_config: {
        format: {
          type: "json_schema",
          schema: request.jsonSchema,
        },
      },
    });
    const elapsedMs = Date.now() - start;

    const textBlock = message.content.find((block): block is Anthropic.TextBlock => block.type === "text");
    if (!textBlock) {
      throw new Error(
        `Anthropic response contained no text block (stop_reason: ${message.stop_reason}). ` +
          `Full content block types: ${message.content.map((b) => b.type).join(", ")}`
      );
    }

    return {
      provider: "anthropic",
      model: request.model,
      raw: textBlock.text,
      elapsedMs,
      schemaForced: true,
    };
  }
}
