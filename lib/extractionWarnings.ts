// Maps src/extract.ts's real ExtractionWarning codes to a friendly, specific,
// non-technical message shown on Step 1. This exists because the pipeline's
// own `warning.message` strings are developer-facing debug notes (e.g. one
// literally reads "...escalate to a model call per PRD B2") — never fit to
// show an end user directly. Per wizard-phase1-spec-by-example.md R5
// (confirmed 2026-09-06): every ExtractionWarning must surface as a friendly
// on-screen message, never silently absorbed and never the raw code/message.
//
// Grounded in the 5 real codes read directly from src/types.ts /
// src/extract.ts — nothing here is invented behavior.
import type { ExtractionWarning } from "@/src/types";

const SECTION_LABELS: Record<string, string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  certifications: "Certifications",
};

/** Extracts the section kind extract.ts embeds in a SECTION_NOT_FOUND message
 * (`No "<kind>" section found.`), falling back gracefully if the format ever
 * changes rather than leaking the raw text. */
function sectionLabelFromMessage(message: string): string | null {
  const match = /No "([a-z]+)" section found\./.exec(message);
  if (!match) return null;
  return SECTION_LABELS[match[1]] ?? null;
}

export function friendlyWarningMessage(warning: ExtractionWarning): string {
  switch (warning.code) {
    case "SECTION_NOT_FOUND": {
      const label = sectionLabelFromMessage(warning.message);
      return label
        ? `We couldn't find a "${label}" section in your résumé — that's fine, you can add it in Step 2 if you'd like it included.`
        : `We couldn't find one of the usual résumé sections — you can add anything missing in Step 2.`;
    }
    case "EXPERIENCE_ENTRY_AMBIGUOUS": {
      // extract.ts's raw message names the specific entry (or entries, for
      // the overlap case) in quotes — surfacing that here, rather than a
      // single unvarying sentence, is what makes multiple real ambiguous
      // entries actually distinguishable on screen instead of reading like
      // the same warning duplicated (a real, reported gap, 2026-09-07:
      // R5 requires "specific," and this fallback wasn't achieving that
      // whenever more than one entry needed it).
      const overlap = /^Overlapping date ranges: "([^"]+)" and "([^"]+)"/.exec(warning.message);
      if (overlap) {
        return `We noticed "${overlap[1]}" and "${overlap[2]}" have overlapping dates — you'll be able to review and fix that in Step 2.`;
      }
      const singleTitle = /^"([^"]+)"/.exec(warning.message)?.[1];
      if (singleTitle) {
        const shortTitle = singleTitle.length > 60 ? `${singleTitle.slice(0, 57)}...` : singleTitle;
        return `We had trouble reading your "${shortTitle}" entry clearly — you'll be able to review and fix it in Step 2.`;
      }
      return "We had trouble reading one of your job entries clearly — you'll be able to review and fix it in Step 2.";
    }
    case "DATE_UNPARSEABLE":
      return "We couldn't read the dates on one of your job entries — you can fix that in Step 2.";
    case "EMPTY_DOCUMENT":
      return "We couldn't find any readable résumé content in this file. You can try a different file, or continue and fill in your details manually in Step 2.";
    case "NO_EXPERIENCE_ENTRIES":
      return "We didn't find any work experience entries — you can add them manually in Step 2.";
    default: {
      // Exhaustiveness guard: if extract.ts ever adds a new warning code,
      // fail loudly in development rather than silently showing nothing —
      // matching this project's own standing discipline against silently
      // absorbing gaps.
      const _exhaustive: never = warning.code;
      return `We noticed something worth double-checking on Step 2 (code: ${_exhaustive}).`;
    }
  }
}
