// Step 2 (phase1-build-plan.md) — the 5 semantic validation rules from
// pipeline-acceptance-criteria.md §2.3. Schema validation (schema.ts) only
// proves the JSON is well-formed and shaped correctly; these rules catch the
// business-rule violations schema validation can't see — a well-formed
// cardGrid with the wrong number of cards is still a failure.
//
// Each validator takes the already-schema-validated envelope/content plus a
// SectionValidationContext carrying the B2-extracted ground truth (entry
// count, skill list, source text) it needs to check against. In a real
// pipeline this context comes from the same B2 extraction result already
// built in src/extract.ts — that's the whole point of building B2 first
// (phase1-build-plan.md Step 1's stated dependency reason).

import type { Envelope } from "./schema";
import { validateEnvelopeSchema } from "./schema";

export type SectionValidationContext = {
  /** Real experience-entry count from B2 — drives the completeness check for cardGrid/textAndTimeline. */
  sourceEntryCount: number;
  /**
   * The full eligible skill/tool list for chipGroups — per changelog #4 this
   * includes tools named anywhere in the resume, not just an explicit
   * skills line, so callers build this from B2's flat `skills` list PLUS
   * anything else they've decided counts (this project doesn't yet
   * automate "tools named in bullets" extraction — see known-gaps note in
   * the fixtures file).
   */
  skillList: string[];
  /**
   * Free text to check non-dollar figures against — normally the
   * concatenation of B2's extracted summary + all bullets + headline for
   * this persona. Numbers in generated text must appear here to pass the
   * number-fidelity check.
   */
  sourceText: string;
  /**
   * Dollar figures that are allowed to appear bare/exact because they're
   * descriptive/contextual (the business the candidate supported) rather
   * than the candidate's own claimed delivered impact (changelog #7) — e.g.
   * Naomi's "$8B" AUM figure, Ben's "$200M"-revenue division. A pure regex
   * pass over generated text cannot tell these two cases apart on its own;
   * this allowlist is the "first pass" the pipeline-acceptance-criteria doc
   * describes, checked here in place of the human/LLM-judge backstop the
   * doc says is still needed for cases this can't catch.
   */
  descriptiveDollarFigures?: string[];
};

export type ValidationIssue = { rule: string; message: string };

function extractTexts(sectionType: Envelope["sectionType"], content: any): string[] {
  switch (sectionType) {
    case "cardGrid":
      return (content?.cards ?? []).flatMap((c: any) => [c.title, c.description]);
    case "processSteps":
      return (content?.steps ?? []).flatMap((s: any) => [s.title, s.description]);
    case "topicGrid":
      return (content?.topics ?? []).flatMap((t: any) => [t.title, t.description]);
    case "chipGroups":
      return (content?.groups ?? []).flatMap((g: any) => [g.label, ...g.skills]);
    case "textAndTimeline":
      // Deliberately excludes t.dates: a year or date range isn't a
      // "quantitative figure" in the sense §2.3 rule 5 means (percentages,
      // counts, headcounts, team sizes) — it's structural/temporal, and it's
      // already independently verified for correctness by B2's own dateRange
      // parsing (src/dateRange.ts), not by this rule. Checking it here as if
      // it were an impact metric produced false positives on every date
      // range copied verbatim from B2 (e.g. "2022" in "Jun 2022 – Aug 2022"
      // failing because "2022" alone never appears as a standalone token in
      // the summary/bullets text this check searches).
      return [content?.bio ?? "", ...(content?.timeline ?? []).flatMap((t: any) => [t.role, t.company])];
    default:
      return [];
  }
}

// --- Rule 1: Completeness (cardGrid, textAndTimeline) ---
export function checkCompleteness(envelope: Envelope, content: any, ctx: SectionValidationContext): ValidationIssue[] {
  if (envelope.status !== "ok") return [];
  if (envelope.sectionType === "cardGrid") {
    const n = content?.cards?.length ?? 0;
    if (n !== ctx.sourceEntryCount) {
      return [{ rule: "completeness", message: `cardGrid has ${n} card(s), expected exactly ${ctx.sourceEntryCount} (one per real experience entry).` }];
    }
  }
  if (envelope.sectionType === "textAndTimeline") {
    const n = content?.timeline?.length ?? 0;
    if (n !== ctx.sourceEntryCount) {
      return [{ rule: "completeness", message: `textAndTimeline has ${n} timeline entr(y/ies), expected exactly ${ctx.sourceEntryCount}.` }];
    }
  }
  return [];
}

// --- Rule 2: Skill coverage (chipGroups only) ---
export function checkSkillCoverage(envelope: Envelope, content: any, ctx: SectionValidationContext): ValidationIssue[] {
  if (envelope.status !== "ok" || envelope.sectionType !== "chipGroups") return [];
  const issues: ValidationIssue[] = [];
  const groups: { label: string; skills: string[] }[] = content?.groups ?? [];
  const allPlaced: string[] = groups.flatMap((g) => g.skills);

  const expected = new Set(ctx.skillList);
  const placedCounts = new Map<string, number>();
  for (const s of allPlaced) placedCounts.set(s, (placedCounts.get(s) ?? 0) + 1);

  const missing = ctx.skillList.filter((s) => !placedCounts.has(s));
  const invented = allPlaced.filter((s) => !expected.has(s));
  const duplicated = [...placedCounts.entries()].filter(([, count]) => count > 1).map(([s]) => s);

  if (missing.length) issues.push({ rule: "skill-coverage", message: `Missing skill(s) not placed in any group: ${missing.join(", ")}` });
  if (invented.length) issues.push({ rule: "skill-coverage", message: `Invented skill(s) not in the source skill list: ${[...new Set(invented)].join(", ")}` });
  if (duplicated.length) issues.push({ rule: "skill-coverage", message: `Skill(s) placed in more than one group: ${duplicated.join(", ")}` });
  return issues;
}

// --- Rule 3: Dollar-figure format ---
// Matches a bare dollar figure NOT already in ranged ("$1M–$2M") or "X+"
// ("$30M+") form. Ranged/plus forms are compliant by construction; anything
// else must be in the descriptive-figures allowlist (see context type doc).
// Digits allow comma-grouped thousands ("$450,000") as well as bare ("$1M").
const DOLLAR_NUM = String.raw`\d{1,3}(?:,\d{3})*(?:\.\d+)?`;
const BARE_DOLLAR_RE = new RegExp(String.raw`\$${DOLLAR_NUM}\s*(?:[MKB]|million|thousand|billion)?\b(?!\s*[–-]\s*\$?${DOLLAR_NUM})(?!\+)`, "gi");
const RANGED_OR_PLUS_DOLLAR_RE = new RegExp(
  String.raw`\$${DOLLAR_NUM}\s*[MKB]?\s*(?:[–-]\s*\$?${DOLLAR_NUM}\s*[MKB]?|\+)`,
  "gi"
);

export function checkDollarFigureFormat(envelope: Envelope, content: any, ctx: SectionValidationContext): ValidationIssue[] {
  if (envelope.status !== "ok") return [];
  const issues: ValidationIssue[] = [];
  const allowed = new Set((ctx.descriptiveDollarFigures ?? []).map((s) => s.replace(/\s+/g, " ").trim()));
  const texts = extractTexts(envelope.sectionType, content);

  for (const text of texts) {
    if (!text) continue;
    // Remove ranged/plus matches first so the bare-dollar regex doesn't
    // re-match the first half of a valid range (e.g. the "$1M" inside "$1M–$2M").
    const withoutRanged = text.replace(RANGED_OR_PLUS_DOLLAR_RE, "");
    const bareMatches = withoutRanged.match(BARE_DOLLAR_RE) ?? [];
    for (const raw of bareMatches) {
      const normalized = raw.replace(/\s+/g, " ").trim();
      const isAllowed = [...allowed].some((a) => a.includes(normalized) || normalized.includes(a));
      if (!isAllowed) {
        issues.push({
          rule: "dollar-figure-format",
          message: `Bare (non-ranged) dollar figure "${normalized}" found in "${text}" — must be a range or "X+" unless it's an allowlisted descriptive figure.`,
        });
      }
    }
  }
  return issues;
}

// --- Rule 4: Escape-hatch consistency ---
export function checkEscapeHatchConsistency(envelope: Envelope): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (envelope.status === "insufficient_evidence") {
    if (envelope.content !== null && envelope.content !== undefined) {
      const isEmptyObjectish =
        typeof envelope.content === "object" &&
        envelope.content !== null &&
        Object.values(envelope.content as object).every((v) => v == null || (Array.isArray(v) && v.length === 0) || v === "");
      if (!isEmptyObjectish) {
        issues.push({ rule: "escape-hatch-consistency", message: `status is "insufficient_evidence" but content is not empty/null.` });
      }
    }
    if (!envelope.reason) issues.push({ rule: "escape-hatch-consistency", message: `status is "insufficient_evidence" but reason is missing.` });
    if (!envelope.userMessage) issues.push({ rule: "escape-hatch-consistency", message: `status is "insufficient_evidence" but userMessage is missing.` });
  } else {
    if (envelope.reason) issues.push({ rule: "escape-hatch-consistency", message: `status is "ok" but reason is present (should be absent).` });
    if (envelope.userMessage) issues.push({ rule: "escape-hatch-consistency", message: `status is "ok" but userMessage is present (should be absent).` });
  }
  return issues;
}

// --- Rule 5: Number fidelity (non-dollar figures) ---
// Extracts non-dollar numeric tokens (percentages, counts, headcounts,
// hyphenated counts like "12-person") from generated text and requires each
// one's bare number to appear somewhere in the source text. This is a
// mechanical substring/set-membership check, not true semantic matching — it
// will not catch a number that's technically present in the source but
// attached to a different fact (e.g. reusing "45" from a headcount as if it
// were a percentage). Documented as a known simplification, not claimed as
// a complete fact-check.
const NUMBER_TOKEN_RE = /\b\d[\d,]*(?:\.\d+)?%?\+?\b/g;

function normalizeNumber(tok: string): string {
  return tok.replace(/,/g, "").replace(/%$/, "").replace(/\+$/, "");
}

function isPrecededByDollar(text: string, index: number): boolean {
  // Walk back over whitespace to see if a '$' immediately precedes the token.
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  return i >= 0 && text[i] === "$";
}

export function checkNumberFidelity(envelope: Envelope, content: any, ctx: SectionValidationContext): ValidationIssue[] {
  if (envelope.status !== "ok") return [];
  const issues: ValidationIssue[] = [];
  const texts = extractTexts(envelope.sectionType, content);
  const sourceNumbers = new Set(
    (ctx.sourceText.match(NUMBER_TOKEN_RE) ?? []).map(normalizeNumber)
  );

  for (const text of texts) {
    if (!text) continue;
    let match: RegExpExecArray | null;
    NUMBER_TOKEN_RE.lastIndex = 0;
    while ((match = NUMBER_TOKEN_RE.exec(text)) !== null) {
      if (isPrecededByDollar(text, match.index)) continue; // dollar figures are checked separately
      const normalized = normalizeNumber(match[0]);
      // Single-digit numbers (e.g. "a 3-person team" vs. a stray "3") are
      // common as ordinary language (list positions, "top-3", etc.) and
      // produce too many incidental false positives to be worth checking
      // at single-digit granularity — this check focuses on the more
      // distinctive multi-digit figures the rubric is actually worried
      // about (percentages, headcounts, dollar-adjacent scale figures).
      if (normalized.length < 2) continue;
      if (!sourceNumbers.has(normalized)) {
        issues.push({
          rule: "number-fidelity",
          message: `Figure "${match[0]}" in "${text}" does not appear in the source text — possible fabrication or rounding.`,
        });
      }
    }
  }
  return issues;
}

export type FullValidationResult = {
  schemaValid: boolean;
  schemaErrors: string[];
  semanticIssues: ValidationIssue[];
  pass: boolean;
};

export function runSemanticValidators(envelope: Envelope, content: unknown, ctx: SectionValidationContext): ValidationIssue[] {
  return [
    ...checkCompleteness(envelope, content, ctx),
    ...checkSkillCoverage(envelope, content, ctx),
    ...checkDollarFigureFormat(envelope, content, ctx),
    ...checkEscapeHatchConsistency(envelope),
    ...checkNumberFidelity(envelope, content, ctx),
  ];
}

/**
 * The full Step-2 validation pipeline: schema validation (schema.ts) first —
 * a malformed response never reaches the semantic checks, matching AC-G2
 * ("schema validation runs on every response, before any file write") — then
 * the 5 semantic rules above. This is the single function a real generation
 * pipeline (Step 4 onward) will call after every model response.
 */
export function validateSectionResponse(raw: unknown, ctx: SectionValidationContext): FullValidationResult {
  const schemaResult = validateEnvelopeSchema(raw);
  if (!schemaResult.valid) {
    return { schemaValid: false, schemaErrors: schemaResult.errors, semanticIssues: [], pass: false };
  }
  const semanticIssues = runSemanticValidators(schemaResult.envelope, schemaResult.content, ctx);
  return { schemaValid: true, schemaErrors: [], semanticIssues, pass: semanticIssues.length === 0 };
}
