// Step 3 (B2/A8) — "is this provider usable right now?" without spending a
// real, billed generation call to find out, and without live-verifying key
// *validity* at save time (A8, confirmed 2026-09-06 — a bad key only
// surfaces later, at Generate, per B1 failure case 1).
//
// Deliberately reuses Track A's own real `getDefaultProvider()` rather than
// re-implementing the "does this provider have what it needs" logic a
// second time in the wizard: `isProviderAvailable()` inside
// src/providers/index.ts already does exactly this (key-presence check for
// the 3 cloud providers, a real cheap reachability GET for Ollama) but isn't
// exported. Calling `getDefaultProvider({}, { skip: <every other provider> })`
// exercises that same real logic for exactly one provider — if it resolves,
// that provider is usable; if it throws, the thrown message already names
// why (Track A's own wording, not re-derived here).
import { getDefaultProvider, type ProviderName } from "@/src/providers";

const ALL_PROVIDERS: ProviderName[] = ["openrouter", "ollama", "anthropic", "gemini"];

export type ProviderAvailability = { id: ProviderName; configured: boolean; reason: string };

export async function checkProviderAvailability(id: ProviderName): Promise<ProviderAvailability> {
  const skip = ALL_PROVIDERS.filter((name) => name !== id);
  try {
    await getDefaultProvider({}, { skip });
    return { id, configured: true, reason: "Ready." };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { id, configured: false, reason: message };
  }
}

export async function checkAllProviders(): Promise<ProviderAvailability[]> {
  return Promise.all(ALL_PROVIDERS.map((id) => checkProviderAvailability(id)));
}
