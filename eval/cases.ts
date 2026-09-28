// Step 5 — the eval case set: the 7 non-held-out personas × 5 standard
// section types (35 cases, same grid Step 4's baseline suite used) plus the
// 2 golden-set "bonus" cases that specifically exercise the escape-hatch
// boundary (AC-F1, AC-F2) — both already scoped to non-held-out personas in
// the golden set, so they slot in without touching Priya/Jordan.
//
// Each case carries an `expectedStatus` — the ground truth this harness
// needs to score escape-hatch trigger accuracy (§6): whether a case SHOULD
// come back "ok" or "insufficient_evidence". For the 35 standard cases this
// is always "ok" (the golden set's expected-outputs.md provides real
// content for all of them, by construction). The 2 bonus cases are the
// actual test of the boundary — Devon's Awards section has zero supporting
// evidence anywhere in his resume (should trigger), Marisol's Leadership
// Philosophy has thin-but-real evidence (should NOT trigger — AC-F2 says
// this should produce a narrow, low-confidence "ok" answer instead).

import type { SectionDefinition } from "../src/prompts";

export type EvalCase = {
  id: string;
  persona: string;
  file: string;
  section: SectionDefinition;
  expectedStatus: "ok" | "insufficient_evidence";
};

// Same 7 non-held-out personas as Step 4's baseline (pipeline-acceptance-criteria.md §4).
const BASELINE_PERSONA_FILES: Record<string, string> = {
  devon: "golden-01-entry-level-controls-engineer.docx",
  naomi: "golden-03-midcareer-business-analyst.docx",
  marisol: "golden-04-midcareer-pharmacy-technician.docx",
  farhan: "golden-05-senior-manager-finance-erp.docx",
  katherine: "golden-06-senior-director-banking-tech.docx",
  alicia: "golden-08-senior-director-program-mgmt-insurance.docx",
  ben: "golden-09-midcareer-program-manager-retail-bi.docx",
};

// Same 5 standard section definitions as Step 4, matching the golden set's
// own sectionKey convention.
const STANDARD_SECTIONS: SectionDefinition[] = [
  { key: "work", type: "cardGrid", header: "Selected Work", topicDescriptor: "work achievements" },
  { key: "how-i-work", type: "processSteps", header: "How I Work", topicDescriptor: "process or approach details" },
  { key: "perspectives", type: "topicGrid", header: "Perspectives", topicDescriptor: "distinctive perspectives or topics" },
  { key: "skills", type: "chipGroups", header: "Capabilities", topicDescriptor: "skills" },
  { key: "about", type: "textAndTimeline", header: "About", topicDescriptor: "career history" },
];

export function buildEvalCases(): EvalCase[] {
  const cases: EvalCase[] = [];

  for (const [persona, file] of Object.entries(BASELINE_PERSONA_FILES)) {
    for (const section of STANDARD_SECTIONS) {
      cases.push({ id: `${persona}-${section.key}`, persona, file, section, expectedStatus: "ok" });
    }
  }

  // Bonus case 1 — AC-F1 reference: zero evidence anywhere, escape hatch
  // SHOULD fire. sectionType is nominal (cardGrid) per the same reasoning
  // test/fixtures/expected-outputs-fixtures.ts uses for this case: an
  // insufficient_evidence response's content is empty regardless of type.
  cases.push({
    id: "devon-awards-bonus",
    persona: "devon",
    file: BASELINE_PERSONA_FILES.devon,
    section: { key: "awards", type: "cardGrid", header: "Awards & Recognition", topicDescriptor: "awards, honors, or recognitions" },
    expectedStatus: "insufficient_evidence",
  });

  // Bonus case 2 — AC-F2 reference: thin-but-real evidence, escape hatch
  // should NOT fire (a narrow, low-confidence "ok" answer is correct). This
  // is the harder, sharper test of the false-trigger side of escape-hatch
  // accuracy than the 35 standard cases, which all have generous evidence.
  cases.push({
    id: "marisol-leadership-bonus",
    persona: "marisol",
    file: BASELINE_PERSONA_FILES.marisol,
    section: { key: "leadership-philosophy", type: "topicGrid", header: "Leadership Philosophy", topicDescriptor: "leadership philosophy or experience" },
    expectedStatus: "ok",
  });

  return cases;
}
