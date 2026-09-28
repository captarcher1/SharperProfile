// Step 1 (B4) — "Try it with an example" path. Runs the identical
// downstream flow as a real upload (same parseResumeFile + extractResumeFacts
// calls, same response shape) against the shipped example-resume-template
// fixture, per wizard-phase1-spec-by-example.md B4 golden example 3: this
// must be functionally identical to the real upload path, not a separate
// mocked-up experience that could drift out of sync.
//
// Switched 2026-09-08 from the original golden-03 (fictional business
// analyst) fixture to a purpose-built fixture (fixtures/example-resume-
// template.docx, also served for download at public/example-resume-
// template.docx — see Step 1's page.tsx) whose structure is deliberately
// grounded in what src/extract.ts actually parses cleanly: exact-synonym
// section headers (Summary/Skills/Experience/Education/Certifications),
// each job as a bold "Title — Company" line followed by an italic date
// line and a real bullet list. Verified directly against this project's
// own parseResumeFile+extractResumeFacts (not assumed): zero warnings,
// all 5 sections recognized, all skills/education/certifications populated,
// every experience entry's company+dates correctly attributed except the
// intentionally-condensed "Early-Career Roles — Various Firms" entry,
// which the pipeline correctly (and expectedly) flags for review since it
// really does bundle multiple employers into one block. This fixture is
// unrelated to the golden-set regression suite (test/run-golden-set.ts
// reads its own fixtures from golden-set/ via /tmp/golden-set-out, never
// from this fixtures/ directory), so swapping it here has zero effect on
// test:golden/test:schema/test:adversarial.
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { parseResumeFile } from "@/src/parseFile";
import { extractResumeFacts } from "@/src/extract";
import { friendlyWarningMessage } from "@/lib/extractionWarnings";
import { SESSION_COOKIE_NAME, getOrCreateSessionId, setStep1Result } from "@/lib/wizard-state";

const EXAMPLE_FILE_PATH = path.join(process.cwd(), "fixtures", "example-resume-template.docx");
const EXAMPLE_FILE_NAME = "example-resume-template.docx";

export async function POST(request: NextRequest) {
  const { sessionId, isNew } = getOrCreateSessionId(request);

  const parsed = await parseResumeFile(EXAMPLE_FILE_PATH);
  const facts = extractResumeFacts(parsed.html);
  const friendlyWarnings = facts.warnings.map(friendlyWarningMessage);

  setStep1Result(sessionId, {
    source: "example",
    sourceFileName: EXAMPLE_FILE_NAME,
    sourceFormat: parsed.sourceFormat,
    hasStructure: parsed.hasStructure,
    facts,
    createdAt: Date.now(),
  });

  const response = NextResponse.json({
    ok: true,
    source: "example" as const,
    sourceFileName: EXAMPLE_FILE_NAME,
    sourceFormat: parsed.sourceFormat,
    hasStructure: parsed.hasStructure,
    facts,
    friendlyWarnings,
  });

  if (isNew) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  return response;
}
