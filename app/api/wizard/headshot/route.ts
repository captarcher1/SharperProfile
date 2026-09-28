// Step 2 (B3) — headshot upload. Validates real file content (magic bytes),
// not just the extension/MIME the browser reports (B3 edge case 3), enforces
// the 5MB cap (A7, B3 edge case 2 — exactly-5MB is accepted), and stores the
// result as a data: URL in wizard session state so both the wizard's own
// preview and the eventual Step 3 "hero" auto-fill can reuse it without a
// second upload. Optional — DELETE clears a staged headshot for the "skip"
// path (B3 failure case 3), which must never be treated as an error.
import { NextRequest, NextResponse } from "next/server";
import { detectImageMime } from "@/lib/imageValidation";
import { MAX_HEADSHOT_BYTES } from "@/lib/uploadConstraints";
import { SESSION_COOKIE_NAME, getOrCreateSessionId, setStep2Headshot } from "@/lib/wizard-state";

const REJECT_MESSAGE = "Please upload a JPEG, PNG, or WebP file.";

export async function POST(request: NextRequest) {
  const { sessionId, isNew } = getOrCreateSessionId(request);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return withSessionCookie(
      NextResponse.json({ ok: false, code: "NO_FILE", message: "Please choose a photo to upload." }, { status: 400 }),
      sessionId,
      isNew
    );
  }

  const file = formData.get("headshot");
  if (!(file instanceof File)) {
    return withSessionCookie(
      NextResponse.json({ ok: false, code: "NO_FILE", message: "Please choose a photo to upload." }, { status: 400 }),
      sessionId,
      isNew
    );
  }

  // Failure case 2 (B3): reject oversized files before ever inspecting content.
  if (file.size > MAX_HEADSHOT_BYTES) {
    return withSessionCookie(
      NextResponse.json(
        { ok: false, code: "FILE_TOO_LARGE", message: "Please upload a photo under 5MB." },
        { status: 400 }
      ),
      sessionId,
      isNew
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Edge case 3 (B3): check real magic bytes — a renamed/corrupted file with
  // an image extension must not pass just because the browser reported an
  // image MIME type. Also covers failure case 1 (GIF/SVG/HEIC/PDF etc.).
  const detectedMime = detectImageMime(buffer);
  if (!detectedMime) {
    return withSessionCookie(
      NextResponse.json({ ok: false, code: "UNSUPPORTED_TYPE", message: REJECT_MESSAGE }, { status: 400 }),
      sessionId,
      isNew
    );
  }

  const dataUrl = `data:${detectedMime};base64,${buffer.toString("base64")}`;
  const step2 = setStep2Headshot(sessionId, {
    dataUrl,
    mimeType: detectedMime,
    fileName: file.name,
  });

  return withSessionCookie(
    NextResponse.json({ ok: true, headshot: step2.headshot }),
    sessionId,
    isNew
  );
}

/** Clears a staged headshot — the "skip"/"remove photo" path. Never an error (B3 failure case 3). */
export async function DELETE(request: NextRequest) {
  const { sessionId, isNew } = getOrCreateSessionId(request);
  const step2 = setStep2Headshot(sessionId, null);
  return withSessionCookie(NextResponse.json({ ok: true, headshot: step2.headshot }), sessionId, isNew);
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
