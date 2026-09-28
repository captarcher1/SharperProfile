// Step 4 (B8) — Vercel token entry. Deliberately its OWN route rather than
// reusing /api/wizard/credentials' generic {provider, value, field} shape:
// Vercel isn't one of Track A's 4 LLM providers (ProviderName), and per A6
// it needs a distinct live-validate-*then*-write flow that route doesn't
// have (that route's B2/A8 contract is "configured means present, never
// verified" — the opposite of what A6 requires here).
//
// Storage: same `.env.local` mechanism as every other credential
// (lib/envFile.ts), under the env var name Vercel's own CLI already reads
// (`VERCEL_TOKEN`) so it's immediately recognizable to a technical user
// poking at the file. A second, non-secret var (`VERCEL_ACCOUNT_LABEL`)
// caches the connected account's own username/email from the last
// successful validation — same precedent as Ollama/Gemini's model-name
// fields (providerConfig.ts): not a secret, so GET freely echoes it back.
// This is what lets Step 4 show "Connected as X" on every page load without
// re-hitting Vercel's API just to render the page — A6's live check is a
// save-time behavior, not a "re-verify on every load" one.
import { NextRequest, NextResponse } from "next/server";
import { upsertEnvVar, removeEnvVar, envVarIsPersisted } from "@/lib/envFile";
import { validateVercelToken } from "@/lib/vercelValidation";

const VERCEL_TOKEN_ENV_VAR = "VERCEL_TOKEN";
const VERCEL_ACCOUNT_LABEL_ENV_VAR = "VERCEL_ACCOUNT_LABEL";

export async function GET() {
  const configured = envVarIsPersisted(VERCEL_TOKEN_ENV_VAR);
  return NextResponse.json({
    ok: true,
    configured,
    accountLabel: configured ? process.env[VERCEL_ACCOUNT_LABEL_ENV_VAR] ?? null : null,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_BODY", message: "Malformed request." }, { status: 400 });
  }

  const token = (body as { token?: unknown })?.token;
  if (typeof token !== "string") {
    return NextResponse.json({ ok: false, code: "INVALID_BODY", message: "Expected { token }." }, { status: 400 });
  }

  // Edge case 1: trim before validating/writing, same as B2.
  const trimmed = token.trim();

  // Failure case 2: never attempt to validate/write an empty string.
  if (trimmed.length === 0) {
    return NextResponse.json(
      { ok: false, code: "EMPTY_VALUE", message: "Please paste your Vercel access token." },
      { status: 400 }
    );
  }

  // A6 / failure cases 3-4: a real live call, and it gates the write —
  // never save a token that just failed its own validation check, and
  // distinguish "Vercel rejected this" from "we couldn't reach Vercel."
  const validation = await validateVercelToken(trimmed);
  if (!validation.ok) {
    if (validation.reason === "rejected") {
      return NextResponse.json({ ok: false, code: "TOKEN_REJECTED", message: validation.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, code: "VALIDATION_UNREACHABLE", message: validation.message }, { status: 502 });
  }

  try {
    upsertEnvVar(VERCEL_TOKEN_ENV_VAR, trimmed);
    upsertEnvVar(VERCEL_ACCOUNT_LABEL_ENV_VAR, validation.accountLabel);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save this token.";
    return NextResponse.json({ ok: false, code: "WRITE_FAILED", message }, { status: 500 });
  }

  // Failure case 1: must not report success when nothing was actually
  // written — explicit re-read confirmation, same R4 discipline as B2.
  if (!envVarIsPersisted(VERCEL_TOKEN_ENV_VAR)) {
    return NextResponse.json(
      { ok: false, code: "WRITE_NOT_CONFIRMED", message: "We couldn't confirm this was saved to .env.local. Please try again." },
      { status: 500 }
    );
  }

  process.env[VERCEL_TOKEN_ENV_VAR] = trimmed;
  process.env[VERCEL_ACCOUNT_LABEL_ENV_VAR] = validation.accountLabel;

  return NextResponse.json({ ok: true, configured: true, accountLabel: validation.accountLabel });
}

export async function DELETE() {
  removeEnvVar(VERCEL_TOKEN_ENV_VAR);
  removeEnvVar(VERCEL_ACCOUNT_LABEL_ENV_VAR);
  delete process.env[VERCEL_TOKEN_ENV_VAR];
  delete process.env[VERCEL_ACCOUNT_LABEL_ENV_VAR];
  return NextResponse.json({ ok: true, configured: false, accountLabel: null });
}
