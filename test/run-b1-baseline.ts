// Step 4 (phase1-build-plan.md) — the formal baseline-prompt acceptance
// suite. "Done when," per the build plan: every one of the 7 non-held-out
// personas (everyone except Priya and Jordan, per pipeline-acceptance-
// criteria.md §4's held-out slice) produces a schema-valid response for all
// 5 section types, on at least one provider.
//
// Scope discipline: this checks SCHEMA validity only (via
// validateEnvelopeSchema from src/schema.ts), matching Step 4's literal
// "done when." It also runs the Step 2 semantic validators
// (validateSectionResponse) and reports what they find, but that's
// informational only here, NOT part of this step's pass/fail gate — tuning
// prompts against the semantic rules (completeness, skill-coverage,
// dollar-ranging, etc.) at real quality thresholds is Step 6's job, once
// Step 5's eval harness exists to measure it properly across repeated runs.
// Reporting it now is free signal for calibrating expectations, not a
// second gate smuggled into this step.
//
// Uses live B2 extraction (extractFromFile) as the ground truth for
// completeness/skill-coverage context, exactly like the Step 2 and Step 3
// harnesses — never hardcoded.

import * as path from "node:path";
import { extractFromFile } from "../src/index";
import { validateEnvelopeSchema } from "../src/schema";
import { runSemanticValidators, type SectionValidationContext } from "../src/validators";
import { getProvider } from "../src/providers";
import { buildSectionRequest, buildEnvelope, type SectionDefinition, type ModelSectionResponse } from "../src/prompts";
import { DESCRIPTIVE_DOLLAR_FIGURES, type PersonaKey } from "./fixtures/expected-outputs-fixtures";

const GOLDEN_DIR = "/tmp/golden-set-out";

// The 7 non-held-out personas (everyone except Priya/02 and Jordan/07, per
// pipeline-acceptance-criteria.md §4's held-out slice) — free to use for
// prompt iteration, unlike the held-out pair reserved for Step 12.
const BASELINE_PERSONA_FILES: Record<string, string> = {
  devon: "golden-01-entry-level-controls-engineer.docx",
  naomi: "golden-03-midcareer-business-analyst.docx",
  marisol: "golden-04-midcareer-pharmacy-technician.docx",
  farhan: "golden-05-senior-manager-finance-erp.docx",
  katherine: "golden-06-senior-director-banking-tech.docx",
  alicia: "golden-08-senior-director-program-mgmt-insurance.docx",
  ben: "golden-09-midcareer-program-manager-retail-bi.docx",
};

// Stable section definitions, matching the golden set's own sectionKey
// convention (test/fixtures/expected-outputs-fixtures.ts) so this step's
// output is directly comparable to the golden examples later.
const SECTIONS: SectionDefinition[] = [
  { key: "work", type: "cardGrid", header: "Selected Work", topicDescriptor: "work achievements" },
  { key: "how-i-work", type: "processSteps", header: "How I Work", topicDescriptor: "process or approach details" },
  { key: "perspectives", type: "topicGrid", header: "Perspectives", topicDescriptor: "distinctive perspectives or topics" },
  { key: "skills", type: "chipGroups", header: "Capabilities", topicDescriptor: "skills" },
  { key: "about", type: "textAndTimeline", header: "About", topicDescriptor: "career history" },
];

const MODEL = process.env.ANTHROPIC_SMOKE_MODEL ?? "claude-haiku-4-5-20251001";

type CaseResult = {
  persona: string;
  sectionKey: string;
  schemaValid: boolean;
  schemaErrors: string[];
  semanticIssueCount: number;
  semanticIssues: string[];
  status: string;
  elapsedMs: number;
};

async function runOne(persona: string, section: SectionDefinition, extraction: any, ctx: SectionValidationContext): Promise<CaseResult> {
  const provider = getProvider("anthropic");
  const request = buildSectionRequest(section, extraction);

  const result = await provider.generate({ ...request, model: MODEL, maxTokens: 1500 });

  let modelResponse: ModelSectionResponse;
  try {
    modelResponse = JSON.parse(result.raw);
  } catch (e) {
    return {
      persona,
      sectionKey: section.key,
      schemaValid: false,
      schemaErrors: [`Response was not valid JSON: ${(e as Error).message}. Raw: ${result.raw.slice(0, 300)}`],
      semanticIssueCount: 0,
      semanticIssues: [],
      status: "(unparseable)",
      elapsedMs: result.elapsedMs,
    };
  }

  const envelope = buildEnvelope(section, modelResponse);
  const schemaCheck = validateEnvelopeSchema(envelope);

  if (!schemaCheck.valid) {
    return {
      persona,
      sectionKey: section.key,
      schemaValid: false,
      schemaErrors: schemaCheck.errors,
      semanticIssueCount: 0,
      semanticIssues: [],
      status: String((envelope as any).status),
      elapsedMs: result.elapsedMs,
    };
  }

  // Informational only (see file header) — run the Step 2 semantic
  // validators too, so the report shows how close the baseline prompt
  // already is to Step 6's real quality bar without gating on it here.
  // Reuses the envelope/content this call's own validateEnvelopeSchema()
  // already parsed above, rather than re-validating from scratch.
  const semanticIssues = runSemanticValidators(schemaCheck.envelope, schemaCheck.content, ctx);

  return {
    persona,
    sectionKey: section.key,
    schemaValid: true,
    schemaErrors: [],
    semanticIssueCount: semanticIssues.length,
    semanticIssues: semanticIssues.map((i) => `${i.rule}: ${i.message}`),
    status: String((envelope as any).status),
    elapsedMs: result.elapsedMs,
  };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set — Step 4 requires live calls, there is no build-only mode for this step.");
    process.exitCode = 1;
    return;
  }

  console.log("\n=== Step 4 — baseline B1 prompt acceptance suite (live Anthropic calls) ===\n");
  console.log(`Model: ${MODEL}`);
  console.log(`Personas: ${Object.keys(BASELINE_PERSONA_FILES).join(", ")} (7 non-held-out, per pipeline-acceptance-criteria.md §4)`);
  console.log(`Section types: ${SECTIONS.map((s) => s.type).join(", ")}\n`);

  const results: CaseResult[] = [];

  for (const [persona, file] of Object.entries(BASELINE_PERSONA_FILES)) {
    const extraction = await extractFromFile(path.join(GOLDEN_DIR, file));
    const sourceText = [
      extraction.headline ?? "",
      extraction.summary ?? "",
      // Includes each entry's raw date-range text, unlike Step 2's harness
      // (which deliberately excludes it for the textAndTimeline.timeline[].dates
      // *structured field*, since those are independently checked by
      // dateRange.ts). Here, generated prose in ANY section type can
      // legitimately mention a year in a sentence (e.g. "between 2003 and
      // 2010") — excluding dates from this harness's source text would make
      // every such year a false "fabrication" flag, which is exactly what
      // happened on Farhan's cardGrid response before this fix (discovered
      // via this very run, not assumed away).
      ...extraction.experience.map((e: any) => `${e.title} ${e.company} ${e.dateRange?.raw ?? ""} ${e.bullets.join(" ")}`),
    ].join(" | ");
    const ctx: SectionValidationContext = {
      sourceEntryCount: extraction.experience.length,
      skillList: extraction.skills,
      sourceText,
      // Step 6 fix (8/29/2026): this was missing here too — the same gap
      // eval/runEval.ts had (see that file's header). Without it, Naomi's
      // $8B/$400M and Ben's $5M/$200M were reported as dollar-figure-format
      // violations in this harness's informational report even though
      // they're already-approved descriptive figures (test/fixtures/
      // expected-outputs-fixtures.ts's DESCRIPTIVE_DOLLAR_FIGURES). Reusing
      // the same map eval/runEval.ts and test/run-schema-validation.ts use
      // rather than a third copy.
      descriptiveDollarFigures: DESCRIPTIVE_DOLLAR_FIGURES[persona as PersonaKey],
    };

    for (const section of SECTIONS) {
      process.stdout.write(`  ${persona} / ${section.key} ... `);
      try {
        const result = await runOne(persona, section, extraction, ctx);
        results.push(result);
        console.log(
          `${result.schemaValid ? "PASS" : "FAIL"} (status=${result.status}, ${result.elapsedMs}ms${
            result.schemaValid ? `, ${result.semanticIssueCount} semantic issue(s)` : ""
          })`
        );
        if (!result.schemaValid) {
          for (const e of result.schemaErrors) console.log(`      schema: ${e}`);
        }
      } catch (e) {
        console.log(`FAIL (threw)`);
        results.push({
          persona,
          sectionKey: section.key,
          schemaValid: false,
          schemaErrors: [`Threw: ${(e as Error).message}`],
          semanticIssueCount: 0,
          semanticIssues: [],
          status: "(error)",
          elapsedMs: 0,
        });
      }
    }
  }

  const passed = results.filter((r) => r.schemaValid);
  const failed = results.filter((r) => !r.schemaValid);

  console.log(`\n${passed.length}/${results.length} schema-valid.`);
  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const f of failed) {
      console.log(`  ${f.persona} / ${f.sectionKey}: ${f.schemaErrors.join("; ")}`);
    }
  }

  const totalSemanticIssues = passed.reduce((sum, r) => sum + r.semanticIssueCount, 0);
  const casesWithIssues = passed.filter((r) => r.semanticIssueCount > 0);
  if (casesWithIssues.length > 0) {
    console.log("\n(Informational detail, not gating this step) semantic-validator issues by case:");
    for (const r of casesWithIssues) {
      console.log(`  ${r.persona} / ${r.sectionKey}:`);
      for (const issue of r.semanticIssues) console.log(`      ${issue}`);
    }
  }
  console.log(
    `\n(Informational, not gating this step) ${totalSemanticIssues} semantic-validator issue(s) across ${passed.length} schema-valid responses — expected at a Step 4 baseline; Step 6 is where prompts get tuned against these.`
  );

  // Done-when bar (phase1-build-plan.md Step 4): all 35 cases schema-valid
  // on at least one provider.
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
