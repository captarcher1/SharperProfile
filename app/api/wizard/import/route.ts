// B6 — Import/load a saved draft (B5's counterpart).
//
// Accepts the exported file's raw JSON text as the request body (not
// multipart — the whole point of B5's format is that it's already just
// JSON, so there's no binary upload here the way there is for a résumé or a
// headshot). Validates via lib/wizard-export.ts's `parseImport` (B6 failure
// cases 1-2: reject cleanly, never partially load or corrupt state) and then
// wholesale-replaces the current session.
//
// This route does NOT implement B7's overwrite-warning itself — by design.
// The client is responsible for asking "are you sure?" first (per B7 golden
// example 4) when the current session already has unsaved progress, and
// only calling this route once the user has confirmed. This route just does
// the replace, the same separation of concerns B7's own spec draws between
// "the warning" and "the action being warned about."
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSessionId, replaceSession, SESSION_COOKIE_NAME } from "@/lib/wizard-state";
import { parseImport } from "@/lib/wizard-export";

export async function POST(request: NextRequest) {
  const { sessionId, isNew } = getOrCreateSessionId(request);

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return withSessionCookie(
      NextResponse.json({ ok: false, code: "INVALID_BODY", message: "Malformed request." }, { status: 400 }),
      sessionId,
      isNew
    );
  }

  const result = parseImport(raw);
  if (!result.ok) {
    return withSessionCookie(
      NextResponse.json({ ok: false, code: result.code.toUpperCase(), message: result.message }, { status: 400 }),
      sessionId,
      isNew
    );
  }

  replaceSession(sessionId, result.session);
  return withSessionCookie(
    NextResponse.json({
      ok: true,
      step1: result.session.step1,
      step2: result.session.step2,
      step3: result.session.step3,
    }),
    sessionId,
    isNew
  );
}

function withSessionCookie(response: NextResponse, sessionId: string, isNew: boolean): NextResponse {
  if (isNew) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}
