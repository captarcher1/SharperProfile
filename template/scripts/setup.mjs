// Runs automatically via the `postinstall` npm hook. Copies
// config/site.example.ts to config/site.ts on first install, so a fresh
// `git clone` + `npm install` has a working (fictional) site with no manual
// setup step required. config/site.ts is git-ignored, so real content never
// gets committed to this repo.

import { existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleFile = join(__dirname, "..", "config", "site.example.ts");
const targetFile = join(__dirname, "..", "config", "site.ts");

if (existsSync(targetFile)) {
  console.log("[setup] config/site.ts already exists — leaving it alone.");
} else {
  copyFileSync(exampleFile, targetFile);
  console.log(
    "[setup] Created config/site.ts from config/site.example.ts.\n" +
      "        Edit config/site.ts with your own content — it's git-ignored\n" +
      "        and will never be committed. See CONFIGURING.md for a guide."
  );
}
