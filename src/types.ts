// B2 — deterministic fact extraction. Explicitly NOT an LLM behaviour (PRD §5, B2).
//
// NOTE ON WHERE THIS BELONGS LONG-TERM: the PRD listed "zod schema definitions
// reused from the template repo's config/types.ts" as a Phase 1 dependency —
// but the open-source template scaffold (the "professional-website" repo)
// hasn't actually been built yet; only planned in earlier planning docs. These
// types are a local placeholder so B2 can be built and tested now, on its own,
// without waiting on that scaffold. When the scaffold exists, move these into
// config/types.ts alongside the B1 section-content schemas from
// pipeline-acceptance-criteria.md §2, so both behaviours share one type source
// instead of two that can drift apart.

export type DateRange = {
  /** The exact substring matched, kept for debugging and for surfacing to a human reviewer. */
  raw: string;
  startYear: number | null;
  /** 1-12, or null if the source only gave a year. */
  startMonth: number | null;
  /** null when endIsPresent is true. */
  endYear: number | null;
  endMonth: number | null;
  endIsPresent: boolean;
};

export type ExperienceEntry = {
  /** The raw text block this entry was parsed from — kept for debugging, never shown to a user. */
  rawBlock: string;
  title: string;
  company: string;
  dateRange: DateRange | null;
  bullets: string[];
  /**
   * True when the extractor could not confidently separate this block into a
   * single title/company/date-range with the same confidence as a clean case —
   * per PRD §5 B2, this is the signal that should escalate to a model call for
   * disambiguation rather than silently guessing. AC reference:
   * pipeline-acceptance-criteria.md Step 1 "Done when" clause.
   */
  ambiguous: boolean;
  ambiguityReason: string | null;
};

export type ContactInfo = {
  location: string | null;
  phone: string | null;
  email: string | null;
  /** Anything in the contact line the extractor didn't recognize as location/phone/email. */
  other: string[];
  raw: string;
};

export type ExtractionWarning = {
  code:
    | "SECTION_NOT_FOUND"
    | "EXPERIENCE_ENTRY_AMBIGUOUS"
    | "DATE_UNPARSEABLE"
    | "EMPTY_DOCUMENT"
    | "NO_EXPERIENCE_ENTRIES";
  message: string;
};

export type ExtractionResult = {
  name: string | null;
  headline: string | null;
  contact: ContactInfo | null;
  summary: string | null;
  /** Flat list, in source order, deduplicated. Used by B1's chipGroups groundedness check. */
  skills: string[];
  experience: ExperienceEntry[];
  education: string[];
  certifications: string[];
  /** Which of the 5 expected section headers were actually found — used to build the completeness check in pipeline-acceptance-criteria.md §2.3.1. */
  sectionsFound: string[];
  /**
   * Header-shaped paragraphs (short, fully bold) that didn't match any known
   * section synonym — e.g. "Trainings and Presentations", "Additional
   * Information". Captured separately, with their content, rather than left
   * to bleed into whatever section was open before them. This is what fixes
   * the real bug a spot-check surfaced: an unrecognized header letting later
   * content (in one real case, a personal-details field) get silently
   * absorbed into an earlier, unrelated section like Skills.
   */
  unrecognizedSections: { header: string; content: string[] }[];
  warnings: ExtractionWarning[];
};
