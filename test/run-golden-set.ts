import * as path from "node:path";
import { extractFromFile } from "../src/index";
import { EXPECTED } from "./expected-golden-facts";

const GOLDEN_DIR = "/tmp/golden-set-out";
const HELD_OUT = new Set(["golden-02-entry-level-dotnet-developer.docx", "golden-07-director-agile-delivery-healthcare.docx"]);

type PersonaReport = {
  file: string;
  name: string;
  heldOut: boolean;
  entryCountMatch: boolean;
  titleMatches: number;
  companyMatches: number;
  dateMatches: number;
  totalEntries: number;
  skillCountMatch: boolean;
  expectedAmbiguousCorrect: number;
  expectedAmbiguousTotal: number;
  unexpectedAmbiguous: string[];
  warnings: string[];
  pass: boolean;
};

async function main() {
  const reports: PersonaReport[] = [];

  for (const expected of EXPECTED) {
    const filePath = path.join(GOLDEN_DIR, expected.file);
    const result = await extractFromFile(filePath);

    const entryCountMatch = result.experience.length === expected.entries.length;
    let titleMatches = 0, companyMatches = 0, dateMatches = 0;
    let expectedAmbiguousCorrect = 0;
    const expectedAmbiguousTotal = expected.entries.filter((e) => e.expectAmbiguous).length;
    const unexpectedAmbiguous: string[] = [];

    const n = Math.min(result.experience.length, expected.entries.length);
    for (let idx = 0; idx < n; idx++) {
      const exp = expected.entries[idx];
      const got = result.experience[idx];
      if (got.title.trim() === exp.title.trim()) titleMatches++;
      if (got.company.trim() === exp.company.trim()) companyMatches++;
      if (got.dateRange && got.dateRange.raw.trim() === exp.datesRaw.trim()) dateMatches++;

      if (exp.expectAmbiguous) {
        if (got.ambiguous) expectedAmbiguousCorrect++;
      } else if (got.ambiguous) {
        unexpectedAmbiguous.push(`${expected.name} — "${exp.title}" was flagged ambiguous but shouldn't be (${got.ambiguityReason})`);
      }
    }

    const skillCountMatch = result.skills.length === expected.skillCount;

    const pass =
      entryCountMatch &&
      titleMatches === expected.entries.length &&
      companyMatches === expected.entries.length &&
      dateMatches === expected.entries.length &&
      skillCountMatch &&
      expectedAmbiguousCorrect === expectedAmbiguousTotal &&
      unexpectedAmbiguous.length === 0;

    reports.push({
      file: expected.file,
      name: expected.name,
      heldOut: HELD_OUT.has(expected.file),
      entryCountMatch,
      titleMatches,
      companyMatches,
      dateMatches,
      totalEntries: expected.entries.length,
      skillCountMatch,
      expectedAmbiguousCorrect,
      expectedAmbiguousTotal,
      unexpectedAmbiguous,
      warnings: result.warnings.map((w) => `${w.code}: ${w.message}`),
      pass,
    });
  }

  console.log("\n=== B2 extraction — golden-set report ===\n");
  let passCount = 0;
  for (const r of reports) {
    const status = r.pass ? "PASS" : "FAIL";
    if (r.pass) passCount++;
    console.log(
      `[${status}]${r.heldOut ? " (held-out)" : ""} ${r.name} (${r.file})\n` +
      `  entries: ${r.entryCountMatch ? "OK" : "MISMATCH"} | titles: ${r.titleMatches}/${r.totalEntries} | companies: ${r.companyMatches}/${r.totalEntries} | dates: ${r.dateMatches}/${r.totalEntries} | skills: ${r.skillCountMatch ? "OK" : "MISMATCH"} | ambiguous-correct: ${r.expectedAmbiguousCorrect}/${r.expectedAmbiguousTotal}`
    );
    if (r.unexpectedAmbiguous.length) {
      for (const u of r.unexpectedAmbiguous) console.log(`  ! unexpected ambiguity: ${u}`);
    }
    if (r.warnings.length) {
      for (const w of r.warnings) console.log(`  - ${w}`);
    }
  }
  console.log(`\n${passCount}/${reports.length} personas fully match expected facts.\n`);

  if (passCount !== reports.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
