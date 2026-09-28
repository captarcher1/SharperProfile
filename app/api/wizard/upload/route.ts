// Step 1 (B4) — résumé upload. Reuses src/parseFile.ts + src/extract.ts
// exactly as they exist (D1: not modified) — this route is orchestration
// only: validate, stage to a temp file (parseFile.ts needs a real path),
// call the pipeline, map its output to a wizard-friendly shape, then delete
// the temp file. Grounded directly in wizard-phase1-spec-by-example.md B4.
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { parseResumeFile } from "@/src/parseFile";
import { extractResumeFacts } from "@/src/extract";
import { friendlyWarningMessage } from "@/lib/extractionWarnings";
import { ACCEPTED_RESUME_EXTENSIONS, MAX_RESUME_BYTES, isAcceptedResumeExtension } from "@/lib/uploadConstraints";
import { SESSION_COOKIE_NAME, getOrCreateSessionId, setStep1Result } from "@/lib/wizard-state";

export async function POST(request: NextRequest) {
  const { sessionId, isNew } = getOrCreateSessionId(request);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return withSessionCookie(
      NextResponse.json({ ok: false, code: "NO_FILE", message: "No file was received. Please choose a file and try again." }, { status: 400 }),
      sessionId,
      isNew
    );
  }

  const file = formData.get("resume");
  if (!(file instanceof File)) {
    return withSessionCookie(
      NextResponse.json({ ok: false, code: "NO_FILE", message: "Please choose a résumé file to upload." }, { status: 400 }),
      sessionId,
      isNew
    );
  }

  // Failure case 1 (B4): reject unsupported formats before ever touching the pipeline.
  const ext = path.extname(file.name).toLowerCase();
  if (!isAcceptedResumeExtension(ext)) {
    return withSessionCookie(
      NextResponse.json(
        {
          ok: false,
          code: "UNSUPPORTED_FORMAT",
          message: `Please upload a Word (${ACCEPTED_RESUME_EXTENSIONS.join(" or ")}) file.`,
        },
        { status: 400 }
      ),
      sessionId,
      isNew
    );
  }

  // Failure case 3 (B4): reject an oversized file client-side-equivalent —
  // before ever writing it to disk or attempting to parse it.
  if (file.size > MAX_RESUME_BYTES) {
    return withSessionCookie(
      NextResponse.json(
        { ok: false, code: "FILE_TOO_LARGE", message: "Please upload a file under 5MB." },
        { status: 400 }
      ),
      sessionId,
      isNew
    );
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "wizard-resume-"));
  const tempPath = path.join(tempDir, `${randomUUID()}${ext}`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempPath, buffer);

    let parsed;
    try {
      parsed = await parseResumeFile(tempPath);
    } catch (error) {
      return withSessionCookie(NextResponse.json(mapParseError(error), { status: 400 }), sessionId, isNew);
    }

    const facts = extractResumeFacts(parsed.html);
    const friendlyWarnings = facts.warnings.map(friendlyWarningMessage);

    setStep1Result(sessionId, {
      source: "upload",
      sourceFileName: file.name,
      sourceFormat: parsed.sourceFormat,
      hasStructure: parsed.hasStructure,
      facts,
      createdAt: Date.now(),
    });

    return withSessionCookie(
      NextResponse.json({
        ok: true,
        source: "upload" as const,
        sourceFileName: file.name,
        sourceFormat: parsed.sourceFormat,
        hasStructure: parsed.hasStructure,
        facts,
        friendlyWarnings,
      }),
      sessionId,
      isNew
    );
  } finally {
    // Delete the uploaded file immediately after processing — never leave a
    // résumé sitting on disk longer than the single request needs it for.
    await rm(tempDir, { recursive: true, force: true });
  }
}

/** Maps src/parseFile.ts's two real thrown-error shapes (B4 failure cases 1 & 2) to a friendly response. */
function mapParseError(error: unknown): { ok: false; code: string; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("UNSUPPORTED_FORMAT")) {
    return {
      ok: false,
      code: "UNSUPPORTED_FORMAT",
      message: `Please upload a Word (${ACCEPTED_RESUME_EXTENSIONS.join(" or ")}) file.`,
    };
  }
  if (message.startsWith("EMPTY_DOCUMENT")) {
    return {
      ok: false,
      code: "EMPTY_DOCUMENT",
      message:
        "We couldn't read any text from this file — it may be a scanned image. Please upload a text-based PDF or Word file instead.",
    };
  }
  return {
    ok: false,
    code: "PARSE_FAILED",
    message: "We couldn't read this file — it may be corrupted. Please try a different file.",
  };
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
