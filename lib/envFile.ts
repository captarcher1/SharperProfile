// Step 3 (B2/A6) — the actual ".env.local write" half of "paste a key/URL
// → local backend writes to .env.local." Deliberately tiny and dependency-
// free (no dotenv package) since the only operations needed are "replace or
// append one KEY=VALUE line" and "remove one line" — a full parser would be
// more surface area than the job needs.
//
// R2 (credential leakage) discipline: nothing in this file ever logs,
// console.log's, or returns the raw value it writes — callers get back a
// boolean/confirmation only, never the value itself reflected back.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ENV_LOCAL_PATH = path.join(process.cwd(), ".env.local");

function readLines(): string[] {
  if (!existsSync(ENV_LOCAL_PATH)) return [];
  return readFileSync(ENV_LOCAL_PATH, "utf8").split(/\r?\n/);
}

function quoteValue(value: string): string {
  // Always double-quote so spaces/#/= in a pasted key or URL can't corrupt
  // the file's line structure; escape the two characters that would break
  // out of the quotes.
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Writes (replacing an existing line for the same key, or appending a new
 * one) a KEY="value" line into .env.local at the project root. Rejects
 * values containing a newline outright — a credential can't legitimately
 * contain one, and allowing it would let one "value" become multiple env
 * lines.
 *
 * R4 (write-confirmation, not fire-and-forget): the caller should treat a
 * thrown error here as a real save failure, and may call
 * `envVarIsPersisted()` afterward for an explicit round-trip check rather
 * than assuming a non-throwing write landed correctly.
 */
export function upsertEnvVar(key: string, value: string): void {
  if (/[\r\n]/.test(value)) {
    throw new Error(`Value for ${key} contains a newline — not a valid single-line credential.`);
  }
  const lines = readLines();
  const newLine = `${key}=${quoteValue(value)}`;
  const keyPattern = new RegExp(`^${key}=`);
  const existingIndex = lines.findIndex((line) => keyPattern.test(line));
  if (existingIndex >= 0) {
    lines[existingIndex] = newLine;
  } else {
    // Drop a single trailing blank line before appending, so repeated
    // writes don't accumulate blank lines at the end of the file.
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }
    lines.push(newLine);
  }
  writeFileSync(ENV_LOCAL_PATH, lines.join("\n") + "\n", "utf8");
}

/** Removes a key's line entirely (the "reset to default" / "clear" path). */
export function removeEnvVar(key: string): void {
  if (!existsSync(ENV_LOCAL_PATH)) return;
  const lines = readLines();
  const keyPattern = new RegExp(`^${key}=`);
  const filtered = lines.filter((line) => !keyPattern.test(line));
  writeFileSync(ENV_LOCAL_PATH, filtered.join("\n") + (filtered.length > 0 ? "\n" : ""), "utf8");
}

/**
 * R4's explicit confirmation round-trip: re-reads the file from disk (not
 * from the in-memory value just written) and confirms a line for `key`
 * exists. Does not compare the value itself — that would mean holding the
 * plaintext value longer than necessary just to prove a point already
 * proven by the write not throwing.
 */
export function envVarIsPersisted(key: string): boolean {
  const keyPattern = new RegExp(`^${key}=`);
  return readLines().some((line) => keyPattern.test(line));
}
