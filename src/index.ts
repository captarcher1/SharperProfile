import { parseResumeFile } from "./parseFile";
import { extractResumeFacts } from "./extract";
import type { ExtractionResult } from "./types";

export * from "./types";
export { parseDateRange, rangesOverlap } from "./dateRange";
export { extractResumeFacts } from "./extract";

/** End-to-end B2: file path in, deterministic facts out. No model call anywhere in this path. */
export async function extractFromFile(filePath: string): Promise<ExtractionResult> {
  const parsed = await parseResumeFile(filePath);
  return extractResumeFacts(parsed.html);
}
