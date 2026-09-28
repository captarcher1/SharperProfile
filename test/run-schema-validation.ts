// Step 2 (phase1-build-plan.md) — the formal schema + semantic validator
// acceptance suite. "Done when," per the build plan: the validators correctly
// pass every one of the 45 core golden examples' expected outputs (plus the
// 2 bonus edge/failure cases = 47 total), and correctly fail a handful of
// deliberately broken variants constructed by hand.
//
// Ground truth (entry count, skill list, source text for number-fidelity) is
// pulled from LIVE B2 extraction against the actual golden-set docx files —
// not hand-copied — so this suite is testing the validators against the real
// output of Step 1's code, exactly as pipeline-acceptance-criteria.md
// intends ("you can't verify completeness without first knowing,
// deterministically, how many real entries exist").

import * as path from "node:path";
import { extractFromFile } from "../src/index";
import { validateSectionResponse, type SectionValidationContext } from "../src/validators";
import { FIXTURES, PERSONA_FILES, DESCRIPTIVE_DOLLAR_FIGURES, type PersonaKey } from "./fixtures/expected-outputs-fixtures";

const GOLDEN_DIR = "/tmp/golden-set-out";

async function buildContexts(): Promise<Record<PersonaKey, SectionValidationContext>> {
  const contexts = {} as Record<PersonaKey, SectionValidationContext>;
  for (const key of Object.keys(PERSONA_FILES) as PersonaKey[]) {
    const result = await extractFromFile(path.join(GOLDEN_DIR, PERSONA_FILES[key]));
    const sourceText = [
      result.headline ?? "",
      result.summary ?? "",
      ...result.experience.map((e) => `${e.title} ${e.company} ${e.bullets.join(" ")}`),
    ].join(" | ");
    contexts[key] = {
      sourceEntryCount: result.experience.length,
      skillList: result.skills,
      sourceText,
      descriptiveDollarFigures: DESCRIPTIVE_DOLLAR_FIGURES[key],
    };
  }
  return contexts;
}

async function main() {
  const contexts = await buildContexts();

  console.log("\n=== Step 2 — schema + semantic validator report (expected-outputs.md fixtures) ===\n");
  let passCount = 0;
  let reconstructedCount = 0;
  for (const fixture of FIXTURES) {
    const ctx = contexts[fixture.persona];
    const raw = { sectionKey: fixture.sectionKey, sectionType: fixture.sectionType, ...fixture.envelope };
    const result = validateSectionResponse(raw, ctx);
    const status = result.pass ? "PASS" : "FAIL";
    if (result.pass) passCount++;
    if (fixture.reconstructed) reconstructedCount++;
    const tag = fixture.reconstructed ? " [reconstructed]" : "";
    console.log(`[${status}] ${fixture.id}${tag}`);
    if (!result.schemaValid) {
      for (const e of result.schemaErrors) console.log(`   schema: ${e}`);
    } else {
      for (const issue of result.semanticIssues) console.log(`   ${issue.rule}: ${issue.message}`);
    }
  }
  console.log(`\n${passCount}/${FIXTURES.length} fixtures pass (${reconstructedCount} of these are marked "reconstructed" — see fixtures file header for why).\n`);

  // --- Deliberately broken variants — each should FAIL, and fail for the
  // specific reason named, not just fail incidentally for some other reason. ---
  console.log("=== Deliberately broken variants — each MUST fail ===\n");
  const naomiCtx = contexts.naomi;
  const marisolCtx = contexts.marisol;
  const devonCtx = contexts.devon;

  type BrokenCase = { id: string; expectRule: string; sectionType: string; envelope: any; ctx: SectionValidationContext };
  const broken: BrokenCase[] = [
    {
      id: "broken-cardGrid-one-short",
      expectRule: "completeness",
      sectionType: "cardGrid",
      ctx: marisolCtx,
      envelope: {
        status: "ok", confidence: "high", injectionWarning: false,
        content: {
          cards: [
            { title: "Pharmacy Accuracy & Claims Turnaround", description: "Maintain a 99.8% prescription-accuracy rate across a 12-person pharmacy team." },
            { title: "Retail-to-Pharmacy Progression", description: "Advanced from deli/bakery associate to pharmacy technician in 18 months." },
            { title: "Restaurant Operations & Vendor Management", description: "Managed vendor ordering and payroll for a 12-person staff." },
            // Missing the 4th real entry (Community Disaster-Relief Coordination) — one card short.
          ],
        },
      },
    },
    {
      id: "broken-chipGroups-skill-dropped",
      expectRule: "skill-coverage",
      sectionType: "chipGroups",
      ctx: naomiCtx,
      envelope: {
        status: "ok", confidence: "high", injectionWarning: false,
        content: {
          groups: [
            { label: "Business Analysis & Delivery", skills: ["Requirements Gathering", "UAT Coordination"] }, // SQL dropped
            { label: "Markets & Stakeholder Expertise", skills: ["Trade Lifecycle Analysis", "Equities / Fixed Income / Derivatives", "Stakeholder Management"] },
          ],
        },
      },
    },
    {
      id: "broken-chipGroups-skill-invented",
      expectRule: "skill-coverage",
      sectionType: "chipGroups",
      ctx: naomiCtx,
      envelope: {
        status: "ok", confidence: "high", injectionWarning: false,
        content: {
          groups: [
            { label: "Business Analysis & Delivery", skills: ["Requirements Gathering", "UAT Coordination", "SQL", "Python"] }, // Python invented
            { label: "Markets & Stakeholder Expertise", skills: ["Trade Lifecycle Analysis", "Equities / Fixed Income / Derivatives", "Stakeholder Management"] },
          ],
        },
      },
    },
    {
      id: "broken-cardGrid-unranged-dollar",
      expectRule: "dollar-figure-format",
      sectionType: "cardGrid",
      ctx: contexts.alicia,
      envelope: {
        status: "ok", confidence: "high", injectionWarning: false,
        content: {
          cards: [
            { title: "Underwriting Modernization", description: "Leading a $40 million policy-administration program." }, // should be "$40M+", not a bare figure
          ],
        },
      },
    },
    {
      id: "broken-escape-hatch-content-present",
      expectRule: "escape-hatch-consistency",
      sectionType: "cardGrid",
      ctx: devonCtx,
      envelope: {
        status: "insufficient_evidence", confidence: "low",
        reason: "No awards found.",
        userMessage: "We didn't find any awards in your resume.",
        injectionWarning: false,
        content: { cards: [{ title: "Dean's List", description: "Fabricated award." }] }, // content must be empty when insufficient_evidence
      },
    },
    {
      id: "broken-escape-hatch-missing-message",
      expectRule: "escape-hatch-consistency",
      sectionType: "cardGrid",
      ctx: devonCtx,
      envelope: {
        status: "insufficient_evidence", confidence: "low",
        reason: "No awards found.",
        // userMessage missing entirely
        injectionWarning: false,
        content: null,
      },
    },
    {
      id: "broken-number-fidelity-fabricated-figure",
      expectRule: "number-fidelity",
      sectionType: "topicGrid",
      ctx: marisolCtx,
      envelope: {
        status: "ok", confidence: "high", injectionWarning: false,
        content: {
          topics: [
            { title: "Scale matters", description: "Trained 47 new hires across the pharmacy network." }, // 47 doesn't appear anywhere in her source text (real figure is 3)
          ],
        },
      },
    },
    {
      id: "broken-processSteps-wrong-count",
      expectRule: "schema (steps.length !== 3 is a schema-level minLength/shape issue in a stricter schema; here it's still valid shape-wise, so this exercises that count isn't schema-enforced — only semantic AC-PS1 would catch it in a real pipeline, not this validator layer)",
      sectionType: "processSteps",
      ctx: devonCtx,
      envelope: {
        status: "ok", confidence: "high", injectionWarning: false,
        content: {
          steps: [
            { title: "Only one step", description: "processSteps is supposed to always have exactly 3 (AC-PS1), but this validator layer doesn't enforce a fixed count in the zod schema or semantic rules — flagging this as a named gap rather than silently passing it as fine." },
          ],
        },
      },
    },
  ];

  function toRaw(b: BrokenCase) {
    return { sectionKey: "test-section", sectionType: b.sectionType, ...b.envelope };
  }

  let brokenCorrectlyFailed = 0;
  for (const b of broken) {
    const result = validateSectionResponse(toRaw(b), b.ctx);
    const gotIssueRules = result.schemaValid ? result.semanticIssues.map((i) => i.rule) : ["schema"];
    const failedAsExpected = !result.pass;
    if (failedAsExpected) brokenCorrectlyFailed++;
    console.log(`[${failedAsExpected ? "CORRECTLY FAILED" : "DID NOT FAIL (BUG)"}] ${b.id} — issues: ${gotIssueRules.join(", ") || "(none)"}`);
  }
  console.log(`\n${brokenCorrectlyFailed}/${broken.length} broken variants correctly failed.\n`);
  // Note: "broken-processSteps-wrong-count" is EXPECTED to still report pass:true
  // at this validator layer — see its own comment above. It's included to make
  // that gap visible in the report rather than leaving it undiscovered.

  // The wrong-count case is excluded from the gate below since it's a
  // documented, known non-enforcement (processSteps count isn't in the zod
  // schema or semantic rules yet), not a validator bug — everything else
  // deliberately broken must fail.
  const requiredToFail = broken.filter((b) => b.id !== "broken-processSteps-wrong-count");
  const requiredCorrectlyFailed = requiredToFail.filter((b) => !validateSectionResponse(toRaw(b), b.ctx).pass).length;

  const allGoldenPass = passCount === FIXTURES.length;
  const allRequiredBrokenFailed = requiredCorrectlyFailed === requiredToFail.length;

  if (!allGoldenPass || !allRequiredBrokenFailed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
