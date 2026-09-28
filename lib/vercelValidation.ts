// Step 4 (B8, A6) — live validation of a pasted Vercel Personal Access
// Token. Unlike B2's LLM provider keys (validated only lazily, at Generate
// time — A8), Pranay confirmed 2026-09-14 that a Vercel token gets a real,
// live check *before* it's ever written to `.env.local`, given a Vercel
// token's much higher blast radius (R3: it can create/modify/delete real,
// live sites, not just make a metered generation call).
//
// Calls Vercel's own `GET /v2/user` ("Retrieves information related to the
// currently authenticated User") — confirmed against Vercel's live REST API
// docs on 2026-09-27, the same day this project ran its own real deployment
// against this API (see PROJECT-STATE.md's 2026-09-27 entry / this spec's
// D1/D4). A 200 here (either the full or the token-is-"limited" response
// variant Vercel documents) means the token authenticates; 401/403 means
// Vercel itself rejected it (failure case 3); anything else — a thrown
// fetch, a non-2xx/401/403 status, an unreadable body — is treated as "we
// couldn't check," not "the token is bad" (failure case 4), since those are
// meaningfully different outcomes a user needs to react to differently.
//
// `interpretVercelUserResponse` is split out from the actual network call
// so it can be exercised directly (unit-test style, no network, no real
// token needed) for the response-shape cases, while the live-rejection path
// (a garbage token really does get a real 401 from Vercel) can still be
// verified for real without needing anyone's actual credential.
export type VercelValidationResult =
  | { ok: true; accountLabel: string }
  | { ok: false; reason: "rejected"; message: string }
  | { ok: false; reason: "unreachable"; message: string };

const VERCEL_USER_ENDPOINT = "https://api.vercel.com/v2/user";

function extractVercelErrorMessage(body: unknown): string | undefined {
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}

export function interpretVercelUserResponse(status: number, body: unknown): VercelValidationResult {
  if (status === 401 || status === 403) {
    const message = extractVercelErrorMessage(body) ?? "Vercel rejected this token — it may be invalid, expired, or revoked.";
    return { ok: false, reason: "rejected", message };
  }
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      reason: "unreachable",
      message: `Vercel returned an unexpected response (HTTP ${status}) while checking this token. Please try again.`,
    };
  }
  const user = (body as { user?: { username?: unknown; email?: unknown; name?: unknown } } | null)?.user;
  const accountLabel =
    (typeof user?.username === "string" && user.username) ||
    (typeof user?.email === "string" && user.email) ||
    (typeof user?.name === "string" && user.name) ||
    "your Vercel account";
  return { ok: true, accountLabel };
}

export async function validateVercelToken(token: string): Promise<VercelValidationResult> {
  let response: Response;
  try {
    response = await fetch(VERCEL_USER_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return {
      ok: false,
      reason: "unreachable",
      message: "Couldn't reach Vercel to check this token. Check your internet connection and try again.",
    };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      return { ok: false, reason: "unreachable", message: "Vercel's response couldn't be read. Please try again." };
    }
    // A non-JSON error body still carries a real status code worth
    // interpreting (e.g. a plain-text 401 from an edge/proxy layer).
  }

  return interpretVercelUserResponse(response.status, body);
}
