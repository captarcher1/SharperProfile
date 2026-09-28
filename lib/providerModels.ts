// Step 3 (B1) — default model id per provider for the wizard's Generate
// action. Not invented: these are the exact same defaults Track A's own
// test scripts already use (test/run-provider-smoke.ts,
// test/run-b1-baseline.ts — ANTHROPIC_SMOKE_MODEL/OLLAMA_SMOKE_MODEL/
// OPENROUTER_SMOKE_MODEL/GEMINI_SMOKE_MODEL default values), so the wizard's
// first real call for each provider matches a combination this project has
// actually exercised before, not a guess.
//
// 2026-09-08: gemini's default was bumped from "gemini-2.0-flash" after a
// real, live failure — Google's own API started returning HTTP 404
// ("This model models/gemini-2.0-flash is no longer available... use
// models/gemini-3.6-flash") for a request that previously worked. Rather
// than trust that error message's suggestion blindly, this was
// cross-checked live against Google's own docs before changing anything:
// ai.google.dev/gemini-api/docs/deprecations confirms gemini-2.0-flash is
// deprecated (shutdown date listed there) and separately, independently
// names gemini-3.6-flash as the recommended replacement — the same model
// the error message named. ai.google.dev/gemini-api/docs/models shows a
// newer gemini-3.8-flash exists too, but since it's not what either the
// live error or Google's own deprecation table point to as *this* model's
// replacement, gemini-3.6-flash (the directly-evidenced choice) was used
// instead of guessing "newest must be right." This can't be verified with
// a real end-to-end call from this sandbox — outbound requests to
// generativelanguage.googleapis.com are blocked here (confirmed via a
// direct curl returning a 403 from the sandbox's own network proxy) — so
// this is verified structurally/via the test suite only; live
// confirmation is on whoever next runs this against a real Gemini key.
import type { ProviderName } from "@/src/providers";
import { getProviderMeta } from "@/lib/providerConfig";

export const DEFAULT_MODEL_BY_PROVIDER: Record<ProviderName, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  ollama: "llama3.2:1b",
  openrouter: "openai/gpt-4o-mini",
  gemini: "gemini-3.6-flash",
};

/** The model id to actually use for a provider's generate() call this run: its saved override if one exists and is non-blank, otherwise the verified default above. */
export function getModelForProvider(id: ProviderName): string {
  const overrideEnvVar = getProviderMeta(id)?.modelField?.envVar;
  const override = overrideEnvVar ? process.env[overrideEnvVar]?.trim() : undefined;
  return override && override.length > 0 ? override : DEFAULT_MODEL_BY_PROVIDER[id];
}
