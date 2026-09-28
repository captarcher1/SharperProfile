// Step 3 extension (8/29/2026) — OpenRouter implementation of LLMProvider,
// added after the original Anthropic/Ollama pair per user request.
//
// Verified against the live docs before writing this (same standing rule
// as the other two providers — not from memory):
//   - https://openrouter.ai/docs/features/structured-outputs
//   - https://openrouter.ai/docs/api-reference/chat-completion
//
// What that verification found: OpenRouter's chat-completions endpoint is
// OpenAI-compatible. Structured/schema-forced output uses a
// `response_format: { type: "json_schema", json_schema: { name, strict, schema } }`
// request field (NOT Anthropic's `output_config` shape, and NOT Ollama's bare
// `format` field — genuinely a third shape, not a rename of either). The
// docs are explicit that `strict: true` is "recommended" but "enforcement
// varies by provider" underneath OpenRouter — OpenRouter fans a single
// request out to whichever upstream model/provider combination is
// configured, and not every one of those actually honors strict mode. Per
// the docs' own suggestion, this implementation also sends
// `provider: { require_parameters: true }`, which tells OpenRouter to only
// route the request to an upstream endpoint that can actually satisfy the
// parameters given (including response_format) rather than silently falling
// back to an endpoint that would ignore the schema.
//
// Response shape is the standard OpenAI-compatible one:
// `choices[0].message.content` — a JSON string, matching this project's
// raw-text contract in StructuredGenerationResult, same as the other two
// providers.
//
// `max_tokens` is called out in OpenRouter's own docs as deprecated in
// favor of `max_completion_tokens` — this implementation uses the current
// field, not the deprecated one.
//
// Model IDs on OpenRouter are provider-prefixed (e.g.
// "openai/gpt-4o-mini", "anthropic/claude-haiku-4.5") — a plain
// "claude-haiku-4-5-20251001"-style id (Anthropic's own naming) will not
// resolve here; the caller must pass an OpenRouter-recognized id.

import type { LLMProvider, StructuredGenerationRequest, StructuredGenerationResult } from "./types";

export interface OpenRouterProviderConfig {
  apiKey?: string; // falls back to OPENROUTER_API_KEY env var
  /** Defaults to OpenRouter's standard API base. Override only for testing against a mock. */
  baseUrl?: string;
}

interface OpenRouterChatResponse {
  id?: string;
  choices?: { message?: { role: string; content: string } }[];
  error?: { message: string; code?: number };
}

export class OpenRouterProvider implements LLMProvider {
  readonly name = "openrouter" as const;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OpenRouterProviderConfig = {}) {
    const key = config.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!key) {
      // Same philosophy as AnthropicProvider: "no credentials" is a setup
      // error the caller should see immediately at construction time, not
      // something discovered later as a confusing 401 mid-request.
      throw new Error("OpenRouterProvider requires an API key (config.apiKey or OPENROUTER_API_KEY env var).");
    }
    this.apiKey = key;
    this.baseUrl = config.baseUrl ?? "https://openrouter.ai/api/v1";
  }

  async generate(request: StructuredGenerationRequest): Promise<StructuredGenerationResult> {
    const messages = request.systemPrompt
      ? [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ]
      : [{ role: "user", content: request.userPrompt }];

    const start = Date.now();
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        temperature: request.temperature ?? 0,
        max_completion_tokens: request.maxTokens,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "structured_response",
            strict: true,
            schema: request.jsonSchema,
          },
        },
        // Route only to an upstream endpoint that can actually honor the
        // parameters given (including response_format) — per the docs'
        // own recommendation, rather than silently falling back to one
        // that would ignore schema-forcing.
        provider: { require_parameters: true },
      }),
    });
    const elapsedMs = Date.now() - start;

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "(could not read response body)");
      throw new Error(`OpenRouter /chat/completions returned HTTP ${res.status}: ${bodyText}`);
    }

    const data = (await res.json()) as OpenRouterChatResponse;
    if (data.error) {
      throw new Error(`OpenRouter returned an error payload: ${data.error.message} (code: ${data.error.code ?? "unknown"})`);
    }
    const content = data.choices?.[0]?.message?.content;
    if (content === undefined) {
      throw new Error(
        `OpenRouter response contained no choices[0].message.content. Full response keys: ${Object.keys(data).join(", ")}`
      );
    }

    return {
      provider: "openrouter",
      model: request.model,
      raw: content,
      elapsedMs,
      // Reflects that schema-forcing was requested (with require_parameters
      // routing to try to guarantee an endpoint that honors it) — not a
      // guarantee every possible upstream model actually complied, same
      // caveat as the other two providers' schemaForced field.
      schemaForced: true,
    };
  }
}
