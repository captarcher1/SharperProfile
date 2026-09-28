// Step 3 — public entry point for the provider abstraction.
// Extended 8/29/2026 with OpenRouter (3rd provider) and getDefaultProvider()
// (priority-ordered auto-selection); extended again 9/3/2026 with Gemini
// (4th provider) — see that function's own comment for what "order" means
// here and why it's a separate concept from Step 7's future
// fallback-chain/repair-loop work.

export type { LLMProvider, StructuredGenerationRequest, StructuredGenerationResult } from "./types";
export { AnthropicProvider, type AnthropicProviderConfig } from "./anthropic";
export { OllamaProvider, type OllamaProviderConfig } from "./ollama";
export { OpenRouterProvider, type OpenRouterProviderConfig } from "./openrouter";
export { GeminiProvider, type GeminiProviderConfig } from "./gemini";

import type { LLMProvider } from "./types";
import { AnthropicProvider, type AnthropicProviderConfig } from "./anthropic";
import { OllamaProvider, type OllamaProviderConfig } from "./ollama";
import { OpenRouterProvider, type OpenRouterProviderConfig } from "./openrouter";
import { GeminiProvider, type GeminiProviderConfig } from "./gemini";

export type ProviderName = "openrouter" | "ollama" | "anthropic" | "gemini";

export interface ProviderConfigMap {
  openrouter?: OpenRouterProviderConfig;
  ollama?: OllamaProviderConfig;
  anthropic?: AnthropicProviderConfig;
  gemini?: GeminiProviderConfig;
}

/**
 * Construct a provider by name. This is the one place that needs to know
 * all four provider classes exist — everything else in the app should
 * depend on the LLMProvider interface, not on AnthropicProvider/
 * OllamaProvider/OpenRouterProvider/GeminiProvider directly, so a fifth
 * provider can be added here later without touching call sites.
 */
export function getProvider(name: ProviderName, config: ProviderConfigMap = {}): LLMProvider {
  switch (name) {
    case "openrouter":
      return new OpenRouterProvider(config.openrouter);
    case "ollama":
      return new OllamaProvider(config.ollama);
    case "anthropic":
      return new AnthropicProvider(config.anthropic);
    case "gemini":
      return new GeminiProvider(config.gemini);
    default: {
      // Exhaustiveness check — if ProviderName grows a fifth member, this
      // is a compile error until the switch is updated.
      const _exhaustive: never = name;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

/**
 * The order getDefaultProvider() tries providers in — per user decision
 * (8/29/2026) for the first three. Gemini was appended at the end on
 * 9/3/2026 rather than inserted elsewhere: the user didn't specify where it
 * should rank, and appending is the lowest-risk default (it only gets tried
 * if openrouter/ollama/anthropic are all unavailable) — flagged here as an
 * assumption, not a stated requirement, in case a different rank was
 * intended.
 */
export const DEFAULT_PROVIDER_ORDER: ProviderName[] = ["openrouter", "ollama", "anthropic", "gemini"];

/**
 * "Is this provider usable right now, without actually spending a real
 * generation call to find out?" Deliberately asymmetric between providers,
 * matching how test/run-provider-smoke.ts already treats them:
 *  - openrouter/anthropic: both are cloud APIs gated by an API key. "Usable"
 *    means a key is present (config or the matching env var) — same as
 *    AnthropicProvider's own constructor check. This does NOT confirm the
 *    key is valid or that the account has credit; catching an auth failure
 *    is still the caller's job on the actual generate() call, exactly like
 *    today. Checking key presence only (not making a real, billed call just
 *    to probe availability) mirrors the existing Anthropic precedent from
 *    Step 3 rather than inventing a new, pricier standard for this feature.
 *  - ollama: has no API key at all (it's a local/self-hosted server), so
 *    "usable" is instead checked the same way test/run-provider-smoke.ts
 *    already does it — a live, free, fast GET against /api/version with a
 *    short timeout. There's no cheaper signal available for a provider
 *    with no credential to check the presence of.
 */
async function isProviderAvailable(name: ProviderName, config: ProviderConfigMap): Promise<{ available: boolean; reason: string }> {
  switch (name) {
    case "openrouter": {
      const hasKey = Boolean(config.openrouter?.apiKey ?? process.env.OPENROUTER_API_KEY);
      return hasKey ? { available: true, reason: "OPENROUTER_API_KEY (or config) is set." } : { available: false, reason: "No OpenRouter API key (config.openrouter.apiKey or OPENROUTER_API_KEY env var)." };
    }
    case "anthropic": {
      const hasKey = Boolean(config.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY);
      return hasKey ? { available: true, reason: "ANTHROPIC_API_KEY (or config) is set." } : { available: false, reason: "No Anthropic API key (config.anthropic.apiKey or ANTHROPIC_API_KEY env var)." };
    }
    case "ollama": {
      const baseUrl = config.ollama?.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
      const reachable = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(2000) })
        .then((r) => r.ok)
        .catch(() => false);
      return reachable ? { available: true, reason: `Ollama server reachable at ${baseUrl}.` } : { available: false, reason: `No Ollama server reachable at ${baseUrl}.` };
    }
    case "gemini": {
      // Same key-presence check as openrouter/anthropic — see this
      // function's doc comment. Not live-verified against a real key this
      // round, per user decision (9/3/2026): build only, assume it works.
      const hasKey = Boolean(config.gemini?.apiKey ?? process.env.GEMINI_API_KEY);
      return hasKey ? { available: true, reason: "GEMINI_API_KEY (or config) is set." } : { available: false, reason: "No Gemini API key (config.gemini.apiKey or GEMINI_API_KEY env var)." };
    }
    default: {
      const _exhaustive: never = name;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

/**
 * Auto-select a provider for callers that don't need a specific one — tries
 * providers in DEFAULT_PROVIDER_ORDER (openrouter, then ollama, then
 * anthropic, then gemini — the last per user decision 9/3/2026, appended
 * rather than reordering the first three), returning the first one that's
 * actually usable (see isProviderAvailable's doc for exactly what "usable"
 * checks, and why it's cheaper than a real generation call).
 *
 * This is deliberately a *selection* helper, not a *reliability* one — it
 * picks which provider to try, once, before any generation call happens.
 * It is NOT Step 7's future fallback chain (bounded repair loop → escalate
 * to a stronger model → deterministic partial extraction → graceful
 * degradation), which reacts to a call that already failed or produced a
 * bad response. Nothing here retries a failed generate() call against the
 * next provider in the list — a caller that wants that today can catch the
 * error and call getDefaultProvider() again with the failed provider's name
 * added to `skip`, but automatic runtime failover belongs to Step 7's
 * design, not this helper.
 *
 * Throws if none of the four are usable, listing why each one was
 * rejected — a silent, unexplained failure here would be worse than a
 * clear "here's what I checked and why nothing worked."
 */
export async function getDefaultProvider(
  config: ProviderConfigMap = {},
  options: { skip?: ProviderName[] } = {}
): Promise<LLMProvider> {
  const skip = new Set(options.skip ?? []);
  const attempts: string[] = [];

  for (const name of DEFAULT_PROVIDER_ORDER) {
    if (skip.has(name)) {
      attempts.push(`${name}: skipped (caller requested).`);
      continue;
    }
    const { available, reason } = await isProviderAvailable(name, config);
    attempts.push(`${name}: ${available ? "available" : "not available"} — ${reason}`);
    if (available) {
      return getProvider(name, config);
    }
  }

  throw new Error(
    `No provider in the default order (${DEFAULT_PROVIDER_ORDER.join(" -> ")}) is usable right now:\n` +
      attempts.map((a) => `  - ${a}`).join("\n")
  );
}
