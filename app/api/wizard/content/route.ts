// Step 3 (B1) — the review/edit screen's save action. A user edit is
// re-validated against Track B's real schema (D2) before being accepted,
// same as a freshly generated section — an edit that would make the draft
// invalid gets rejected with a specific reason instead of silently corrupting
// session state.
import { NextRequest, NextResponse } from "next/server";
import { isSectionTypeId } from "@/lib/sectionTypes";
import { validateTrackBSectionData } from "@/lib/trackBSectionSchemas";
import { readSessionId, getSession, setStep3SectionData } from "@/lib/wizard-state";

export async function PATCH(request: NextRequest) {
  const sessionId = readSessionId(request);
  const session = sessionId ? getSession(sessionId) : undefined;
  if (!session?.step3) {
    return NextResponse.json(
      { ok: false, code: "NOTHING_GENERATED", message: "Generate content first before editing it." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_BODY", message: "Malformed request." }, { status: 400 });
  }

  const sectionType = (body as { sectionType?: unknown })?.sectionType;
  const data = (body as { data?: unknown })?.data;
  if (typeof sectionType !== "string" || !isSectionTypeId(sectionType)) {
    return NextResponse.json({ ok: false, code: "UNKNOWN_SECTION_TYPE", message: "Unknown section type." }, { status: 400 });
  }

  const validation = validateTrackBSectionData(sectionType, data);
  if (!validation.valid) {
    return NextResponse.json(
      { ok: false, code: "INVALID_CONTENT", message: `That edit doesn't look right: ${validation.errors.join("; ")}` },
      { status: 400 }
    );
  }

  const step3 = setStep3SectionData(sessionId!, sectionType, validation.data);
  return NextResponse.json({ ok: true, step3 });
}
