// Step 3 (B2) — credential entry. Per A6 (confirmed 2026-08-30): a pasted
// key/URL writes straight to .env.local via this local backend route, no
// OAuth. Per A8 (confirmed 2026-09-06): no live key *validity* check here —
// "configured" only means "present," never "verified"; a bad key only
// surfaces later at Generate (B1 failure case 1). Per R2/R4: never echo a
// pasted value back, and confirm the write actually landed on disk rather
// than firing-and-forgetting it.
//
// A provider's optional `modelField` (currently only Ollama — see
// providerConfig.ts) goes through this same route with an explicit
// `field: "model"` on the request body, distinguishing it from the
// credential/base-URL field's default `field: "credential"`. Unlike a real
// credential, a model name isn't a secret (R2 doesn't apply to it), so GET
// freely echoes it back — that's what lets the wizard pre-fill the model
// input with whatever was saved last time.
import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS, getProviderMeta } from "@/lib/providerConfig";
import { upsertEnvVar, removeEnvVar, envVarIsPersisted } from "@/lib/envFile";
import { checkAllProviders, checkProviderAvailability } from "@/lib/providerAvailability";

/** Status for all 4 providers — drives Step 3's provider dropdown/cards. */
export async function GET() {
  const availability = await checkAllProviders();
  const byId = new Map(availability.map((a) => [a.id, a]));
  const providers = PROVIDERS.map((meta) => ({
    ...meta,
    ...byId.get(meta.id)!,
    model: meta.modelField ? process.env[meta.modelField.envVar] ?? "" : undefined,
  }));
  return NextResponse.json({ ok: true, providers });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_BODY", message: "Malformed request." }, { status: 400 });
  }

  const providerId = (body as { provider?: unknown })?.provider;
  const value = (body as { value?: unknown })?.value;
  if (typeof providerId !== "string" || typeof value !== "string") {
    return NextResponse.json(
      { ok: false, code: "INVALID_BODY", message: "Expected { provider, value }." },
      { status: 400 }
    );
  }

  const meta = getProviderMeta(providerId);
  if (!meta) {
    return NextResponse.json({ ok: false, code: "UNKNOWN_PROVIDER", message: `Unknown provider: ${providerId}` }, { status: 400 });
  }

  const fieldRaw = (body as { field?: unknown })?.field;
  const field = fieldRaw === "model" ? "model" : "credential";

  if (field === "model") {
    if (!meta.modelField) {
      return NextResponse.json(
        { ok: false, code: "NO_MODEL_FIELD", message: `${meta.label} has no model field to save.` },
        { status: 400 }
      );
    }
    const envVar = meta.modelField.envVar;
    const trimmedModel = value.trim();
    // Blank is a real, meaningful choice here too — "use this project's
    // built-in default" — same as Ollama's base-URL field, not an error.
    if (trimmedModel.length === 0) {
      removeEnvVar(envVar);
      delete process.env[envVar];
    } else {
      try {
        upsertEnvVar(envVar, trimmedModel);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save this value.";
        return NextResponse.json({ ok: false, code: "WRITE_FAILED", message }, { status: 500 });
      }
      if (!envVarIsPersisted(envVar)) {
        return NextResponse.json(
          { ok: false, code: "WRITE_NOT_CONFIRMED", message: "We couldn't confirm this was saved to .env.local. Please try again." },
          { status: 500 }
        );
      }
      process.env[envVar] = trimmedModel;
    }
    const availability = await checkProviderAvailability(meta.id);
    return NextResponse.json({ ok: true, ...availability, model: process.env[envVar] ?? "" });
  }

  const trimmed = value.trim();

  // Ollama's field is an optional base URL — a blank value is a real,
  // meaningful choice ("use the default"), not an error. The 3 API-key
  // providers require a non-empty value; a deliberate clear goes through
  // DELETE instead, so POST's contract stays "save this value" everywhere.
  if (trimmed.length === 0) {
    if (meta.fieldKind === "baseUrl") {
      removeEnvVar(meta.envVar);
      delete process.env[meta.envVar];
      const availability = await checkProviderAvailability(meta.id);
      return NextResponse.json({ ok: true, ...availability });
    }
    return NextResponse.json(
      { ok: false, code: "EMPTY_VALUE", message: `Please paste your ${meta.label} ${meta.fieldLabel}.` },
      { status: 400 }
    );
  }

  try {
    upsertEnvVar(meta.envVar, trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save this value.";
    return NextResponse.json({ ok: false, code: "WRITE_FAILED", message }, { status: 500 });
  }

  // R4: explicit confirmation round-trip — re-read the file rather than
  // trusting that a non-throwing write landed.
  if (!envVarIsPersisted(meta.envVar)) {
    return NextResponse.json(
      { ok: false, code: "WRITE_NOT_CONFIRMED", message: "We couldn't confirm this was saved to .env.local. Please try again." },
      { status: 500 }
    );
  }

  // Apply immediately to the running process too — src/providers/index.ts
  // reads process.env directly, so this makes the credential usable this
  // session without requiring a server restart, on top of being persisted
  // to .env.local for next time.
  process.env[meta.envVar] = trimmed;

  const availability = await checkProviderAvailability(meta.id);
  return NextResponse.json({ ok: true, ...availability });
}

export async function DELETE(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const providerId = (body as { provider?: unknown })?.provider;
  if (typeof providerId !== "string") {
    return NextResponse.json({ ok: false, code: "INVALID_BODY", message: "Expected { provider }." }, { status: 400 });
  }
  const meta = getProviderMeta(providerId);
  if (!meta) {
    return NextResponse.json({ ok: false, code: "UNKNOWN_PROVIDER", message: `Unknown provider: ${providerId}` }, { status: 400 });
  }

  removeEnvVar(meta.envVar);
  delete process.env[meta.envVar];
  const availability = await checkProviderAvailability(meta.id);
  return NextResponse.json({ ok: true, ...availability });
}
