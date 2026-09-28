// Step 5 (phase1-build-plan.md) — the eval harness itself: "the lightweight
// `npm run eval` script the PRD recommended (§6) — runs the golden set
// against whichever provider/model is configured, checks schema validity
// and all 5 semantic rules automatically, and reports per-persona,
// per-section pass/fail against the thresholds in
// pipeline-acceptance-criteria.md §6."
//
// Done-when bar for this step (explicitly modest, per the build plan): "the
// harness runs the 7 non-held-out personas end to end and produces a
// report — even if most cases are still failing at this point." This is NOT
// a gate the way test:golden/test:schema/test:b1-baseline are — it's the
// measurement apparatus Step 6 (prompt tuning) and beyond depend on, so it
// always runs to completion and always writes its report, regardless of
// how many cases pass.
//
// Scope note, matching thresholds.ts's own measuredByThisHarness flags:
// this harness measures schema validity, the 5 semantic rules (§2.3), and
// escape-hatch trigger accuracy against the 37-case set in cases.ts (35
// standard + 2 golden-set bonus cases). It does NOT measure: chip-grouping
// placement stability (needs repeated runs, Step 6), tone/quality
// (LLM-judge, Step 13), injection heuristic recall or the adversarial
// false-positive rate (Step 9, different suite entirely). Those rows print
// in the threshold-comparison summary as "not measured by this harness",
// not silently omitted and not faked as a pass.
//
// Reuses the exact same call pattern test/run-b1-baseline.ts established
// (extractFromFile → buildSectionRequest → provider.generate →
// buildEnvelope → validateEnvelopeSchema → runSemanticValidators),
// including that harness's sourceText fix (date-range text included, so
// years mentioned in generated prose aren't false-flagged as fabrication —
// see run-b1-baseline.ts's file-header note on this).

import * as fs from "node:fs";
import * as path from "node:path";
import { extractFromFile } from "../src/index";
import { validateEnvelopeSchema } from "../src/schema";
import { runSemanticValidators, type SectionValidationContext, type ValidationIssue } from "../src/validators";
import { getProvider } from "../src/providers";
import { buildSectionRequest, buildEnvelope, type ModelSectionResponse } from "../src/prompts";
import { buildEvalCases, type EvalCase } from "./cases";
import { THRESHOLDS } from "./thresholds";
import { DESCRIPTIVE_DOLLAR_FIGURES, type PersonaKey } from "../test/fixtures/expected-outputs-fixtures";

const GOLDEN_DIR = "/tmp/golden-set-out";
const MODEL = process.env.ANTHROPIC_SMOKE_MODEL ?? "claude-haiku-4-5-20251001";

type CaseOutcome = {
  id: string;
  persona: string;
  sectionKey: string;
  sectionType: string;
  expectedStatus: "ok" | "insufficient_evidence";
  actualStatus: string;
  schemaValid: boolean;
  schemaErrors: string[];
  semanticIssues: ValidationIssue[];
  elapsedMs: number;
  threw?: string;
};

async function runOneCase(c: EvalCase, extraction: any, ctx: SectionValidationContext): Promise<CaseOutcome> {
  const provider = getProvider("anthropic");
  const request = buildSectionRequest(c.section, extraction);

  const base = {
    id: c.id,
    persona: c.persona,
    sectionKey: c.section.key,
    sectionType: c.section.type,
    expectedStatus: c.expectedStatus,
  };

  let result;
  try {
    result = await provider.generate({ ...request, model: MODEL, maxTokens: 1500 });
  } catch (e) {
    return {
      ...base,
      actualStatus: "(error)",
      schemaValid: false,
      schemaErrors: [`Provider call threw: ${(e as Error).message}`],
      semanticIssues: [],
      elapsedMs: 0,
      threw: (e as Error).message,
    };
  }

  let modelResponse: ModelSectionResponse;
  try {
    modelResponse = JSON.parse(result.raw);
  } catch (e) {
    return {
      ...base,
      actualStatus: "(unparseable)",
      schemaValid: false,
      schemaErrors: [`Response was not valid JSON: ${(e as Error).message}. Raw: ${result.raw.slice(0, 300)}`],
      semanticIssues: [],
      elapsedMs: result.elapsedMs,
    };
  }

  const envelope = buildEnvelope(c.section, modelResponse);
  const schemaCheck = validateEnvelopeSchema(envelope);

  if (!schemaCheck.valid) {
    return {
      ...base,
      actualStatus: String((envelope as any).status),
      schemaValid: false,
      schemaErrors: schemaCheck.errors,
      semanticIssues: [],
      elapsedMs: result.elapsedMs,
    };
  }

  const semanticIssues = runSemanticValidators(schemaCheck.envelope, schemaCheck.content, ctx);

  return {
    ...base,
    actualStatus: String((envelope as any).status),
    schemaValid: true,
    schemaErrors: [],
    semanticIssues,
    elapsedMs: result.elapsedMs,
  };
}

function buildSourceContext(extraction: any, persona: string): SectionValidationContext {
  const sourceText = [
    extraction.headline ?? "",
    extraction.summary ?? "",
    // Same fix run-b1-baseline.ts applies: include each entry's raw
    // date-range text so years mentioned in legitimate generated prose
    // aren't false-flagged by the number-fidelity check.
    ...extraction.experience.map((e: any) => `${e.title} ${e.company} ${e.dateRange?.raw ?? ""} ${e.bullets.join(" ")}`),
  ].join(" | ");
  return {
    sourceEntryCount: extraction.experience.length,
    skillList: extraction.skills,
    sourceText,
    // Step 6 fix (8/29/2026): the first version of this harness never set
    // this field, so every descriptive dollar figure already established
    // by Step 2's SME-approved fixtures (test/fixtures/expected-outputs-
    // fixtures.ts's DESCRIPTIVE_DOLLAR_FIGURES — e.g. Naomi's $8B AUM,
    // Ben's $200M revenue-division) was scored as a violation here, even
    // though it's correct, already-approved output. Reusing the same map
    // test/run-schema-validation.ts already uses instead of inventing a
    // separate one for this harness, so there's one source of truth for
    // "which dollar figures are descriptive," not two that can drift.
    descriptiveDollarFigures: DESCRIPTIVE_DOLLAR_FIGURES[persona as PersonaKey],
  };
}

// --- §6-aligned metric computation ---

type MetricResult = { label: string; rate: number | null; numerator: number; denominator: number; note?: string };

function rate(num: number, den: number): number | null {
  return den === 0 ? null : num / den;
}

function computeMetrics(outcomes: CaseOutcome[]) {
  const total = outcomes.length;
  const schemaValid = outcomes.filter((o) => o.schemaValid);
  const schemaValidOk = schemaValid.filter((o) => o.actualStatus === "ok");

  const schemaValidityRate = rate(schemaValid.length, total);

  const numberFidelityFails = schemaValidOk.filter((o) => o.semanticIssues.some((i) => i.rule === "number-fidelity"));
  const groundednessRate = rate(schemaValidOk.length - numberFidelityFails.length, schemaValidOk.length);

  const completenessApplicable = schemaValidOk.filter((o) => o.sectionType === "cardGrid" || o.sectionType === "textAndTimeline");
  const completenessFails = completenessApplicable.filter((o) => o.semanticIssues.some((i) => i.rule === "completeness"));
  const completenessRate = rate(completenessApplicable.length - completenessFails.length, completenessApplicable.length);

  const skillCovApplicable = schemaValidOk.filter((o) => o.sectionType === "chipGroups");
  const skillCovFails = skillCovApplicable.filter((o) => o.semanticIssues.some((i) => i.rule === "skill-coverage"));
  const skillCoverageRate = rate(skillCovApplicable.length - skillCovFails.length, skillCovApplicable.length);

  const dollarFails = schemaValidOk.filter((o) => o.semanticIssues.some((i) => i.rule === "dollar-figure-format"));
  const dollarRangingRate = rate(schemaValidOk.length - dollarFails.length, schemaValidOk.length);

  // Escape-hatch trigger accuracy — compares actual status to the case's
  // ground-truth expectedStatus (cases.ts), NOT the same thing as
  // checkEscapeHatchConsistency (which only checks internal
  // reason/userMessage/content consistency given whatever status the model
  // picked). Only schema-valid cases can be scored here — an unparseable
  // or schema-invalid response has no status worth comparing.
  const shouldTrigger = schemaValid.filter((o) => o.expectedStatus === "insufficient_evidence");
  const trueTriggers = shouldTrigger.filter((o) => o.actualStatus === "insufficient_evidence");
  const trueTriggerRate = rate(trueTriggers.length, shouldTrigger.length);

  const shouldNotTrigger = schemaValid.filter((o) => o.expectedStatus === "ok");
  const falseTriggers = shouldNotTrigger.filter((o) => o.actualStatus === "insufficient_evidence");
  const falseTriggerRate = rate(falseTriggers.length, shouldNotTrigger.length);

  return {
    schemaValidityRate: { label: "Schema validity rate", rate: schemaValidityRate, numerator: schemaValid.length, denominator: total } as MetricResult,
    groundednessRate: {
      label: "Groundedness (number-fidelity proxy)",
      rate: groundednessRate,
      numerator: schemaValidOk.length - numberFidelityFails.length,
      denominator: schemaValidOk.length,
    } as MetricResult,
    completenessRate: {
      label: "Completeness (cardGrid/textAndTimeline)",
      rate: completenessRate,
      numerator: completenessApplicable.length - completenessFails.length,
      denominator: completenessApplicable.length,
    } as MetricResult,
    skillCoverageRate: {
      label: "Skill-coverage (chipGroups)",
      rate: skillCoverageRate,
      numerator: skillCovApplicable.length - skillCovFails.length,
      denominator: skillCovApplicable.length,
    } as MetricResult,
    dollarRangingRate: {
      label: "Dollar-figure ranging compliance",
      rate: dollarRangingRate,
      numerator: schemaValidOk.length - dollarFails.length,
      denominator: schemaValidOk.length,
    } as MetricResult,
    escapeHatch: {
      trueTriggerRate: { label: "Escape-hatch true-trigger rate", rate: trueTriggerRate, numerator: trueTriggers.length, denominator: shouldTrigger.length } as MetricResult,
      falseTriggerRate: { label: "Escape-hatch false-trigger rate", rate: falseTriggerRate, numerator: falseTriggers.length, denominator: shouldNotTrigger.length } as MetricResult,
    },
  };
}

function fmtRate(m: MetricResult): string {
  if (m.rate === null) return `n/a (0/0)`;
  return `${(m.rate * 100).toFixed(1)}% (${m.numerator}/${m.denominator})`;
}

function printThresholdComparison(metrics: ReturnType<typeof computeMetrics>) {
  console.log("\n=== §6 threshold comparison ===\n");
  const computed: Record<string, MetricResult | { trueTriggerRate: MetricResult; falseTriggerRate: MetricResult }> = {
    "Schema validity rate": metrics.schemaValidityRate,
    "Groundedness (no fabrication)": metrics.groundednessRate,
    "Completeness (entry-coverage rule)": metrics.completenessRate,
    "Skill-coverage (chipGroups)": metrics.skillCoverageRate,
    "Dollar-figure ranging compliance": metrics.dollarRangingRate,
    "Escape-hatch trigger accuracy": metrics.escapeHatch,
  };

  for (const row of THRESHOLDS) {
    if (!row.measuredByThisHarness) {
      console.log(`  [not measured] ${row.metric} — threshold: ${row.thresholdLabel}`);
      console.log(`      why: ${row.notMeasuredReason}`);
      continue;
    }
    const c = computed[row.metric];
    if (!c) {
      console.log(`  [no computed metric wired up] ${row.metric}`);
      continue;
    }
    if (row.metric === "Escape-hatch trigger accuracy") {
      const cc = c as { trueTriggerRate: MetricResult; falseTriggerRate: MetricResult };
      const truePass = cc.trueTriggerRate.rate === null ? "n/a" : cc.trueTriggerRate.rate === 1 ? "PASS" : "FAIL";
      const falsePass = cc.falseTriggerRate.rate === null ? "n/a" : cc.falseTriggerRate.rate === 0 ? "PASS" : "FAIL";
      console.log(`  [${truePass}/${falsePass}] ${row.metric} — threshold: ${row.thresholdLabel}`);
      console.log(`      true-trigger:  ${fmtRate(cc.trueTriggerRate)}`);
      console.log(`      false-trigger: ${fmtRate(cc.falseTriggerRate)}`);
      if (row.notMeasuredReason) console.log(`      note: ${row.notMeasuredReason}`);
      continue;
    }
    const m = c as MetricResult;
    const pass = m.rate === null || row.threshold === null ? "n/a" : m.rate >= row.threshold ? "PASS" : "FAIL";
    console.log(`  [${pass}] ${row.metric} — threshold: ${row.thresholdLabel} — measured: ${fmtRate(m)}`);
    if (row.notMeasuredReason) console.log(`      note: ${row.notMeasuredReason}`);
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set — the eval harness requires live calls, same as Step 4's baseline suite.");
    process.exitCode = 1;
    return;
  }

  const cases = buildEvalCases();
  console.log("\n=== Step 5 — eval harness (live Anthropic calls) ===\n");
  console.log(`Model: ${MODEL}`);
  console.log(`Cases: ${cases.length} (35 standard + 2 golden-set bonus escape-hatch cases)\n`);

  // Cache extraction per persona — several cases share the same source
  // file (5-6 section cases per persona), and B2 extraction is
  // deterministic, so there's no reason to re-run it per case.
  const extractionCache = new Map<string, { extraction: any; ctx: SectionValidationContext }>();
  async function getPersonaContext(c: EvalCase) {
    if (!extractionCache.has(c.persona)) {
      const extraction = await extractFromFile(path.join(GOLDEN_DIR, c.file));
      extractionCache.set(c.persona, { extraction, ctx: buildSourceContext(extraction, c.persona) });
    }
    return extractionCache.get(c.persona)!;
  }

  const outcomes: CaseOutcome[] = [];
  for (const c of cases) {
    process.stdout.write(`  ${c.id} ... `);
    try {
      const { extraction, ctx } = await getPersonaContext(c);
      const outcome = await runOneCase(c, extraction, ctx);
      outcomes.push(outcome);
      const statusMatch = outcome.actualStatus === outcome.expectedStatus ? "" : ` [expected ${outcome.expectedStatus}]`;
      console.log(
        `${outcome.schemaValid ? "PASS" : "FAIL"} (status=${outcome.actualStatus}${statusMatch}, ${outcome.semanticIssues.length} semantic issue(s), ${outcome.elapsedMs}ms)`
      );
    } catch (e) {
      console.log(`FAIL (threw)`);
      outcomes.push({
        id: c.id,
        persona: c.persona,
        sectionKey: c.section.key,
        sectionType: c.section.type,
        expectedStatus: c.expectedStatus,
        actualStatus: "(error)",
        schemaValid: false,
        schemaErrors: [`Threw: ${(e as Error).message}`],
        semanticIssues: [],
        elapsedMs: 0,
        threw: (e as Error).message,
      });
    }
  }

  // --- Per-persona / per-section report ---
  console.log("\n=== Per-case results ===\n");
  const schemaFailures = outcomes.filter((o) => !o.schemaValid);
  const withSemanticIssues = outcomes.filter((o) => o.schemaValid && o.semanticIssues.length > 0);
  const misclassified = outcomes.filter((o) => o.schemaValid && o.actualStatus !== o.expectedStatus);

  console.log(`Schema-valid: ${outcomes.length - schemaFailures.length}/${outcomes.length}`);
  if (schemaFailures.length > 0) {
    console.log("\nSchema failures:");
    for (const f of schemaFailures) {
      console.log(`  ${f.id}: ${f.schemaErrors.join("; ")}`);
    }
  }

  if (misclassified.length > 0) {
    console.log("\nStatus mismatches (expected vs. actual):");
    for (const m of misclassified) {
      console.log(`  ${m.id}: expected "${m.expectedStatus}", got "${m.actualStatus}"`);
    }
  }

  if (withSemanticIssues.length > 0) {
    console.log("\nSemantic-validator issues by case:");
    for (const o of withSemanticIssues) {
      console.log(`  ${o.id}:`);
      for (const issue of o.semanticIssues) console.log(`      ${issue.rule}: ${issue.message}`);
    }
  }

  // --- Metrics + threshold comparison ---
  const metrics = computeMetrics(outcomes);
  console.log("\n=== Computed metrics ===\n");
  console.log(`  ${metrics.schemaValidityRate.label}: ${fmtRate(metrics.schemaValidityRate)}`);
  console.log(`  ${metrics.groundednessRate.label}: ${fmtRate(metrics.groundednessRate)}`);
  console.log(`  ${metrics.completenessRate.label}: ${fmtRate(metrics.completenessRate)}`);
  console.log(`  ${metrics.skillCoverageRate.label}: ${fmtRate(metrics.skillCoverageRate)}`);
  console.log(`  ${metrics.dollarRangingRate.label}: ${fmtRate(metrics.dollarRangingRate)}`);
  console.log(`  ${metrics.escapeHatch.trueTriggerRate.label}: ${fmtRate(metrics.escapeHatch.trueTriggerRate)}`);
  console.log(`  ${metrics.escapeHatch.falseTriggerRate.label}: ${fmtRate(metrics.escapeHatch.falseTriggerRate)}`);

  printThresholdComparison(metrics);

  // --- Write a timestamped results file for later comparison (Step 6 onward) ---
  const resultsDir = path.join(__dirname, "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsFile = path.join(resultsDir, `eval-${timestamp}.json`);
  fs.writeFileSync(
    resultsFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        model: MODEL,
        caseCount: cases.length,
        outcomes,
        metrics,
      },
      null,
      2
    )
  );
  console.log(`\nResults written to ${resultsFile}`);

  // Step 5's "done when" bar is explicitly modest — this harness reports,
  // it doesn't gate a build. Never fails the process on threshold misses;
  // only a genuine harness error (already handled above) would exit non-zero.
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
