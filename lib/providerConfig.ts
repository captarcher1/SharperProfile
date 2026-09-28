// Step 3 (B2) — wizard-facing metadata for the 4 real providers Track A's
// pipeline supports (src/providers/index.ts's ProviderName). Deliberately a
// thin, display-only layer: the actual provider objects/availability logic
// live in src/providers/ and lib/providerAvailability.ts — this file only
// answers "what does the credential-entry form look like for provider X."
//
// Field kinds differ by provider, not just labels: Anthropic/OpenRouter/
// Gemini are cloud APIs gated by a secret API key (A6: paste → write to
// .env.local); Ollama is a local/self-hosted server with no secret at all —
// its "credential" is really just an optional base URL override (defaults
// to http://localhost:11434 if left blank, per src/providers/index.ts's own
// isProviderAvailable()). Treating Ollama as a fourth "paste a key" field
// would be dishonest UI — it isn't a secret and blank is a valid, common
// choice — so fieldKind distinguishes the two cases everywhere this is used.
import type { ProviderName } from "@/src/providers";

export type ProviderFieldKind = "apiKey" | "baseUrl";

/**
 * A second, optional field for choosing which model to use — currently only
 * Ollama has one. The 3 cloud providers always use their fixed default from
 * lib/providerModels.ts's DEFAULT_MODEL_BY_PROVIDER; Ollama's whole point is
 * running whatever the user has already pulled locally (`ollama list`), so
 * it needs a plain paste-the-name field rather than a fixed/guessed default
 * — there is no way for this project to know in advance which model tag a
 * given user has on their own machine.
 */
export type ProviderModelField = {
  /** Exact env var name this is persisted under — same .env.local mechanism as the credential/base-URL field (lib/envFile.ts). */
  envVar: string;
  label: string;
  placeholder: string;
  helpText: string;
};

export type ProviderMeta = {
  id: ProviderName;
  label: string;
  /** Exact env var name — verified directly from src/providers/index.ts's isProviderAvailable(), not assumed. */
  envVar: string;
  fieldKind: ProviderFieldKind;
  fieldLabel: string;
  placeholder: string;
  helpText: string;
  modelField?: ProviderModelField;
};

// Ollama listed first: it's the only provider that costs nothing and needs
// no account/API key to try, so it's the easiest first stop when testing
// this wizard locally.
export const PROVIDERS: ProviderMeta[] = [
  {
    id: "ollama",
    label: "Ollama (local)",
    envVar: "OLLAMA_BASE_URL",
    fieldKind: "baseUrl",
    fieldLabel: "Base URL (optional)",
    placeholder: "http://localhost:11434",
    helpText: "Leave blank to use the default local address. Only works if Ollama is already running on this machine.",
    modelField: {
      envVar: "OLLAMA_MODEL",
      label: "Model",
      placeholder: "e.g. qwen3:32b",
      helpText:
        "Paste the exact name of a model you've already pulled via Ollama (check with `ollama list` in a terminal). Leave blank to use this project's built-in default.",
    },
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    envVar: "ANTHROPIC_API_KEY",
    fieldKind: "apiKey",
    fieldLabel: "API key",
    placeholder: "sk-ant-...",
    helpText: "From console.anthropic.com — Account Settings → API Keys.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    fieldKind: "apiKey",
    fieldLabel: "API key",
    placeholder: "sk-or-...",
    helpText: "From openrouter.ai/keys.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    envVar: "GEMINI_API_KEY",
    fieldKind: "apiKey",
    fieldLabel: "API key",
    placeholder: "AIza...",
    helpText: "From aistudio.google.com/apikey. Built but not live-verified by this project yet.",
    // Added 2026-09-08 after this project's own default (gemini-2.0-flash)
    // was retired by Google mid-project — a hardcoded id here would just go
    // stale again the next time Google reshuffles its Gemini lineup. Same
    // pattern as Ollama's modelField above: a plain paste-the-id field, not
    // a dropdown, since this project has no reliable way to keep a list of
    // "current" Gemini ids in sync with Google's own schedule.
    modelField: {
      envVar: "GEMINI_MODEL",
      label: "Model",
      placeholder: "e.g. gemini-3.6-flash",
      helpText:
        "Paste the exact model id from Google's own current list at ai.google.dev/gemini-api/docs/models (look under \"Gemini\" for a Flash or Pro variant marked as the current/stable release, not \"deprecated\" or \"preview\") — Google periodically retires older ids, most recently gemini-2.0-flash, so check there rather than reusing an id from an old screenshot or example. Leave blank to use this project's built-in default.",
    },
  },
];

export function getProviderMeta(id: string): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function isProviderName(id: string): id is ProviderName {
  return PROVIDERS.some((p) => p.id === id);
}
