// Step 3 (phase1-build-plan.md) — the provider abstraction. One interface,
// four implementations (Anthropic cloud, Ollama local, OpenRouter — added
// 8/29/2026, Gemini — added 9/3/2026, both per user request), so B1 (the
// prompt/generation layer, Step 4+) never has to know which provider it's
// talking to.
//
// Scope discipline: this layer is deliberately generic — it takes a JSON
// Schema and a prompt, and returns raw text plus some metadata. It does NOT
// know about section types, envelopes, or the 5 content shapes in
// schema.ts. That knowledge belongs to whatever calls this (Step 4's B1
// prompts, and this step's own smoke-test harness) — keeping the provider
// layer itself section-agnostic is what makes "one interface" actually mean
// one interface, rather than five interfaces that happen to share a file.
//
// Reliability-ladder framing (pipeline-acceptance-criteria.md): requesting
// native schema-forced generation here is rung 1. It is NOT a substitute for
// rung 2 (the schema.ts + validators.ts layer built in Step 2) — a provider
// can still return syntactically valid JSON that fails a semantic rule, or
// a provider/model that doesn't support schema-forcing at all can return
// free text that merely looks like JSON. Every raw response from this layer
// MUST still be run through validateSectionResponse() before being trusted.

/**
 * A single request to generate structured JSON output from a model.
 * Provider-agnostic: does not assume Anthropic's or Ollama's specific
 * request shape.
 */
export interface StructuredGenerationRequest {
  /** Provider-specific model identifier (e.g. "claude-haiku-4-5-20251001", "llama3.2:1b"). */
  model: string;
  /** Optional system-level instructions, kept separate from user content per AC-S1
   * (content/instruction segregation) — even though this step doesn't build
   * the real B1 prompts yet, the interface shape should already support that
   * separation so Step 4 doesn't have to change it. */
  systemPrompt?: string;
  /** The user-turn content — for B1 this will eventually be resume facts +
   * task instructions; for this step's smoke test it's a minimal stand-in. */
  userPrompt: string;
  /** A JSON Schema (draft-2020-12-ish; both providers accept plain JSON
   * Schema objects) describing the exact shape the response must match. */
  jsonSchema: Record<string, unknown>;
  /** Optional cap on generated tokens. Providers apply their own defaults
   * if omitted. */
  maxTokens?: number;
  /** Optional sampling temperature. Defaults to 0 where the provider allows
   * it, since deterministic output matters more here than variety. */
  temperature?: number;
}

/**
 * What a provider call returns. `raw` is the provider's response text,
 * expected (but NOT guaranteed — see the reliability-ladder note above) to
 * be a JSON string matching `jsonSchema`. This layer does not parse or
 * validate it; that's the caller's job via validateSectionResponse().
 */
export interface StructuredGenerationResult {
  provider: "anthropic" | "ollama" | "openrouter" | "gemini";
  model: string;
  raw: string;
  /** Wall-clock time for the call, for the future logging step (Step 10). */
  elapsedMs: number;
  /** True if the provider was asked to schema-force the response natively
   * (rung 1 of the reliability ladder). False means the provider/request
   * fell back to an unconstrained call — still valid to attempt, but the
   * caller should weight that response as less trustworthy pre-validation. */
  schemaForced: boolean;
}

/**
 * One interface, implemented once per provider. Deliberately minimal: a
 * single method, because the only thing B1 needs from "a provider" is
 * "give me structured JSON back for this prompt." Provider-specific
 * concerns (auth, base URL, retries at the transport level) live inside
 * each implementation, not in this interface.
 */
export interface LLMProvider {
  readonly name: "anthropic" | "ollama" | "openrouter" | "gemini";
  generate(request: StructuredGenerationRequest): Promise<StructuredGenerationResult>;
}
