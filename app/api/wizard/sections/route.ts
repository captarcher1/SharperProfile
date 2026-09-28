// Step 2 (B3/A1) — persists the user's selected section types. Validates
// every id against the real 9-type list (lib/sectionTypes.ts) rather than
// trusting the client — a stray/typo'd id here would otherwise flow all the
// way to Step 3's generate call before failing.
import { NextRequest, NextResponse } from "next/server";
import { isSectionTypeId, type SectionTypeId } from "@/lib/sectionTypes";
import { SESSION_COOKIE_NAME, getOrCreateSessionId, setStep2Sections, setStep2DownloadButton } from "@/lib/wizard-state";

export async function POST(request: NextRequest) {
  const { sessionId, isNew } = getOrCreateSessionId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withSessionCookie(
      NextResponse.json({ ok: false, code: "INVALID_BODY", message: "Malformed request." }, { status: 400 }),
      sessionId,
      isNew
    );
  }

  const sectionTypes = (body as { sectionTypes?: unknown })?.sectionTypes;
  if (!Array.isArray(sectionTypes) || !sectionTypes.every((id): id is string => typeof id === "string")) {
    return withSessionCookie(
      NextResponse.json(
        { ok: false, code: "INVALID_BODY", message: "sectionTypes must be an array of strings." },
        { status: 400 }
      ),
      sessionId,
      isNew
    );
  }

  const invalid = sectionTypes.filter((id) => !isSectionTypeId(id));
  if (invalid.length > 0) {
    return withSessionCookie(
      NextResponse.json(
        { ok: false, code: "UNKNOWN_SECTION_TYPE", message: `Unknown section type(s): ${invalid.join(", ")}` },
        { status: 400 }
      ),
      sessionId,
      isNew
    );
  }

  let step2 = setStep2Sections(sessionId, sectionTypes as SectionTypeId[]);

  // 2026-09-27 — optional; a request from a wizard build before this toggle
  // existed simply omits it, and the session's existing value is left as-is
  // rather than being reset to false.
  const includeDownloadButton = (body as { includeDownloadButton?: unknown })?.includeDownloadButton;
  if (typeof includeDownloadButton === "boolean") {
    step2 = setStep2DownloadButton(sessionId, includeDownloadButton);
  }

  return withSessionCookie(
    NextResponse.json({
      ok: true,
      selectedSectionTypes: step2.selectedSectionTypes,
      includeDownloadButton: step2.includeDownloadButton,
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
