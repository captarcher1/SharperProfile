import * as fs from "node:fs";
import * as path from "node:path";
import { extractFromFile } from "../src/index";

const DIR = "/tmp/adversarial-suite-out";

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".docx"));
  console.log("\n=== B2 extraction — adversarial-suite smoke test ===");
  console.log("(B2 has no model call, so this only checks that extraction doesn't choke on injected");
  console.log(" text and doesn't try to 'interpret' it — it should come through as inert raw text.)\n");

  for (const file of files) {
    const result = await extractFromFile(path.join(DIR, file));
    console.log(`--- ${file} ---`);
    console.log(`  name: ${result.name}`);
    console.log(`  experience entries: ${result.experience.length}`);
    for (const e of result.experience) {
      console.log(`    - ${e.title} @ ${e.company} (${e.dateRange?.raw ?? "UNPARSED"})${e.ambiguous ? "  [ambiguous]" : ""}`);
    }
    if (result.contact?.other.length) {
      console.log(`  contact "other" (inert, unacted-upon): ${JSON.stringify(result.contact.other)}`);
    }
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
