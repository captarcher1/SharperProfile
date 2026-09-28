// Informal diagnostic tool — NOT part of the formal Step 1 acceptance suite
// (that's run-golden-set.ts, scoped to the 9 SME-validated golden personas per
// pipeline-acceptance-criteria.md). Use this to eyeball how extraction handles
// any single real resume file, e.g. one that isn't in the golden set at all.
//
// Usage: npx tsx test/spot-check-resume.ts /path/to/some-resume.docx [more paths...]

import { extractFromFile } from "../src/index";

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: npx tsx test/spot-check-resume.ts /path/to/resume.docx [more...]");
    process.exitCode = 1;
    return;
  }
  for (const f of files) {
    console.log(`\n=== ${f} ===`);
    try {
      const r = await extractFromFile(f);
      console.log("name:", r.name, "| headline:", r.headline);
      console.log("sectionsFound:", r.sectionsFound);
      console.log("skills:", r.skills);
      console.log("experience entries:", r.experience.length);
      for (const e of r.experience) {
        console.log(
          `  - title="${e.title}" company="${e.company}" dates=${e.dateRange?.raw ?? "UNPARSED"} ambiguous=${e.ambiguous}${e.ambiguous ? " (" + e.ambiguityReason + ")" : ""} bullets=${e.bullets.length}`
        );
      }
      console.log("unrecognizedSections:", r.unrecognizedSections.map((s) => `[${s.header}] (${s.content.length} lines)`));
      console.log("warnings:", r.warnings.map((w) => `${w.code}: ${w.message}`));
    } catch (e) {
      console.log("ERROR:", (e as Error).message);
    }
  }
}

main();
