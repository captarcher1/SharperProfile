import * as cheerio from "cheerio";
import { parseDateRange, rangesOverlap, type DateRange } from "./dateRange";
import type { ContactInfo, ExperienceEntry, ExtractionResult, ExtractionWarning } from "./types";

type SectionKind = "summary" | "skills" | "experience" | "education" | "certifications";

const SECTION_SYNONYMS: Record<SectionKind, string[]> = {
  summary: ["summary", "professional summary", "profile", "objective", "career summary"],
  skills: ["skills", "technical skills", "core competencies", "professional skills", "key skills", "technical skill-set"],
  experience: ["experience", "professional experience", "work experience", "employment history", "career history"],
  education: ["education", "educational background"],
  certifications: ["certifications", "certification", "licenses & certifications", "licenses and certifications", "credentials"],
};

function normalizeHeaderText(text: string): string {
  return text.trim().toLowerCase().replace(/:$/, "");
}

function exactSynonymKind(norm: string): SectionKind | null {
  for (const [kind, synonyms] of Object.entries(SECTION_SYNONYMS) as [SectionKind, string[]][]) {
    if (synonyms.includes(norm)) return kind;
  }
  return null;
}

/** Splits a combined/slash-joined header into its parts — "&"/"and" are whole-word only (`\band\b`), so this never fires inside an ordinary word like "Brand". */
const SECTION_SPLIT_RE = /\s*(?:\/|,|&|\band\b)\s*/i;

/**
 * Real resumes phrase section headers close to, but not exactly matching,
 * this project's fixed synonym list — confirmed 2026-09-07 by a real résumé
 * (Pranay's own) that used "Summary Of Qualifications" and "Key Skills/
 * Expertise" instead of a plain "Summary"/"Skills". The original exact-
 * match-only matchSectionKind missed both entirely — silently swallowing
 * them, and everything after them up to the next line that DID match
 * exactly, into the header/contact block (see the header-consuming loop
 * below, and R-note on `headline` disambiguation).
 *
 * Two narrowly-scoped fallback passes, tried after an exact match fails:
 *  1. Segment-split on "/", ",", "&", "and" — a combined header (e.g. "Key
 *     Skills/Expertise") often has ONE segment that's an exact synonym on
 *     its own, even though the whole phrase isn't. Each segment must still
 *     be an EXACT synonym match — this doesn't get any fuzzier, so a random
 *     comma/ampersand in ordinary prose essentially never false-positives.
 *  2. A short prefix-extension: the whole header starts with a synonym
 *     followed by more words (e.g. "Summary Of Qualifications" starts with
 *     "summary"). Bounded by the same 40-char header-length ceiling used
 *     elsewhere in this file, a 5-word cap, and no sentence-ending
 *     punctuation — specifically so this can't fire on an ordinary sentence
 *     that merely happens to start with a section-ish word (e.g. "Skills
 *     learned include Python and SQL" is 6 words, over the cap).
 */
function fuzzySynonymKind(norm: string): SectionKind | null {
  for (const segment of norm.split(SECTION_SPLIT_RE)) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const kind = exactSynonymKind(trimmed);
    if (kind) return kind;
  }
  const wordCount = norm.split(/\s+/).filter(Boolean).length;
  if (norm.length <= 40 && wordCount <= 5 && !/[.,;]$/.test(norm)) {
    for (const synonyms of Object.values(SECTION_SYNONYMS)) {
      for (const syn of synonyms) {
        if (norm.startsWith(`${syn} `)) return exactSynonymKind(syn);
      }
    }
  }
  return null;
}

/**
 * All distinct section kinds a compound header actually names (e.g.
 * "Education & Certifications" names BOTH education and certifications) —
 * used only where recognizing just one of them isn't good enough, because
 * the header's own content underneath needs to be split across both real
 * output arrays (see the "education" table-handling branch below). Returns
 * null for anything that isn't genuinely multi-kind, so an ordinary
 * single-kind header (including one only matched via fuzzySynonymKind, like
 * "Key Skills/Expertise") is unaffected.
 */
function matchCompoundSectionKinds(norm: string): SectionKind[] | null {
  const kinds = new Set<SectionKind>();
  for (const segment of norm.split(SECTION_SPLIT_RE)) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const kind = exactSynonymKind(trimmed);
    if (kind) kinds.add(kind);
  }
  return kinds.size >= 2 ? Array.from(kinds) : null;
}

function matchSectionKind(text: string): SectionKind | null {
  const norm = normalizeHeaderText(text);
  return exactSynonymKind(norm) ?? fuzzySynonymKind(norm);
}

/**
 * True if a <p> is *structurally* header-shaped — short, and its entire text
 * wrapped in a single <strong> run. This is a NECESSARY but NOT SUFFICIENT
 * condition for "this paragraph is a section-boundary header": a resume's own
 * bold name line, and a bold-but-short job/subrole title (e.g. golden-10's
 * "Administrative Assistant" subrole, or "Senior Administrative Coordinator"),
 * are also structurally bold-and-short without being headers at all. Callers
 * must go through classifyHeaderCandidate() below, never call this alone to
 * decide a section boundary — an earlier version of this function did exactly
 * that and misclassified both a resume's name line and golden-10's subrole
 * titles as new "unrecognized sections."
 */
function isBoldShortParagraph($el: cheerio.Cheerio<any>, tag: string | undefined): boolean {
  if (tag !== "p") return false;
  const fullText = $el.text().trim();
  if (!fullText || fullText.length > 40) return false;
  const strongText = $el.find("strong").text().trim();
  return strongText.length > 0 && strongText === fullText;
}

/**
 * True for text that is entirely upper-case (and contains at least one
 * letter) — the convention every section header this project's own
 * generator scripts actually render, via heading()'s text.toUpperCase().
 * Used only as a fallback signal for "this bold/short paragraph is a genuine
 * header we don't have a synonym for" (e.g. "TRAININGS AND PRESENTATIONS"),
 * never for recognized-synonym matching, which is already case-insensitive
 * via matchSectionKind.
 *
 * Known, disclosed limitation (see README): a real resume with a mixed-case
 * unrecognized header (e.g. "Personal Details") will NOT be caught by this —
 * it falls through as ordinary body text, the same failure mode the original
 * spot-check surfaced. This heuristic only closes the gap for resumes that
 * happen to use the all-caps convention; it does not fully solve the
 * general "unknown header in arbitrary casing" problem.
 */
function isAllCapsHeaderText(text: string): boolean {
  return /[A-Z]/.test(text) && !/[a-z]/.test(text);
}

/** Small connector words ignored when checking "every significant word is capitalized" below — a real header like "Trainings and Presentations" or "Licenses & Certifications" shouldn't fail just because of "and"/"&". */
const HEADING_CONNECTOR_WORDS = new Set(["and", "or", "of", "the", "for", "in", "to", "a", "an", "on", "with", "&"]);

/**
 * True for a short, comma-free, digit-free line where every significant word
 * is capitalized and it doesn't end in sentence-ending punctuation — the
 * shape of a genuine plain-text, mixed-case header like "Trainings and
 * Presentations", "Personal Details", "Volunteer Work" (all real examples:
 * the first three from Shraddha Srivastava's actual resume, which uses this
 * exact plain/title-case convention with no bold or all-caps anywhere).
 *
 * This is a heuristic, not a reliable signal, and it is KNOWN to have false-
 * positive potential: a short, comma-free descriptive line that happens to
 * capitalize every word (e.g. a skill or credential phrased like "Notary
 * Public Kansas" with no comma) could be misread as a header. The comma/
 * digit exclusions were added specifically because real fixtures in this
 * project's own golden set (e.g. "Notary Public, State of Kansas") would
 * otherwise trip this — but that's a patch for observed cases, not a proof
 * this heuristic is safe in general. See README for the honest scope of what
 * this does and doesn't solve.
 */
function isTitleCaseHeadingShaped(text: string): boolean {
  if (!text || text.length > 40) return false;
  if (/[0-9]/.test(text)) return false;
  if (text.includes(",")) return false;
  if (/[.,;]\s*$/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  let hasSignificantWord = false;
  for (const w of words) {
    const clean = w.replace(/[^A-Za-z'-]/g, "");
    if (!clean) continue;
    if (HEADING_CONNECTOR_WORDS.has(clean.toLowerCase())) continue;
    hasSignificantWord = true;
    if (!/^[A-Z]/.test(clean)) return false;
  }
  return hasSignificantWord;
}

/**
 * Four-tier header classification, in priority order:
 *  1. A recognized synonym always wins, on ANY <p> paragraph, REGARDLESS of
 *     bold formatting or case. This deliberately does NOT require
 *     isBoldShortParagraph — a real-world spot-check (Sunanda Srivastava's
 *     actual resume) showed that real "SUMMARY" / "EXPERIENCE" headers are
 *     frequently plain, unbolded paragraphs with no distinguishing formatting
 *     at all. matchSectionKind() already requires an exact normalized match,
 *     so a paragraph containing other text won't accidentally equal "summary".
 *  2. An ALL-CAPS bold/short paragraph is a genuine-but-unrecognized header
 *     (e.g. "ADDITIONAL INFORMATION") — this project's own generator scripts'
 *     convention (golden-10).
 *  2b. A bold/short paragraph in ANY OTHER case (e.g. "Key Accomplishments",
 *      "key accomplishments") is ALSO a genuine-but-unrecognized header —
 *      confirmed 2026-09-08 against Pranay's own actual résumé, whose
 *      lowercase bold sub-headers ("key accomplishments", "professional
 *      development & awards") matched neither tier 2 (not ALL-CAPS) nor
 *      tier 3 below (isTitleCaseHeadingShaped requires each significant word
 *      to start with a capital letter, which a lowercase phrase never does)
 *      — so instead of landing in unrecognizedSections like any other
 *      unrecognized header, that content was silently absorbed as body text
 *      into whichever section happened to still be open (accomplishments
 *      merged into the end of `summary`; awards merged into `education`).
 *      Guarded off while currentSection === "experience", same as tier 3,
 *      and for the same reason: an ordinary job title with no company/dates
 *      on its own line (e.g. "**Project Lead**") is exactly as short and
 *      wholly-bold as a real header, and a job title being ALSO fully
 *      upper-case essentially never happens — the thing that lets tier 2
 *      stay unconditional — but a job title being bold in ordinary mixed
 *      case is the single most common shape in this entire codebase, so 2b
 *      would misclassify nearly every job title as a header if left
 *      unconditional inside Experience.
 *  3. A plain, mixed-case, title-cased short line (see
 *     isTitleCaseHeadingShaped) is ALSO treated as a genuine-but-unrecognized
 *     header — covers real resumes (golden-11, and the Shraddha Srivastava
 *     spot-check) that mark headers with no formatting signal at all.
 * Tiers 2b and 3 are skipped while currentSection === "experience" — a job/
 * subrole title inside Experience (e.g. "Senior Administrative Coordinator",
 * "Facilities Coordinator") is exactly as short and title-case-shaped (and,
 * per 2b above, exactly as short and bold) as a real header, and the two are
 * only distinguishable by context: a title only appears inside an
 * already-open Experience section, a genuine header never does. Tier 2
 * (bold + ALL-CAPS) stays active even inside Experience — golden-10's own
 * unrecognized headers ("TRAININGS AND PRESENTATIONS") immediately follow
 * the last job's bullets with nothing else closing the Experience section
 * first, so tier 2 has to be able to fire right there. That's safe to leave
 * unconditional: a job title being simultaneously bold AND fully upper-case
 * essentially never happens, unlike merely being short and bold/title-case,
 * which is exactly what an ordinary job title looks like — hence why tiers
 * 2b and 3 need the extra guard tier 2 doesn't. Tier 1 (recognized synonyms)
 * is never skipped, since "Experience" ending and e.g. "Education" beginning
 * must still be caught while currentSection is "experience".
 * `allowUnrecognizedFallback: false` disables tiers 2–3 entirely — used for
 * the header-block-consumption loop (name/headline/contact), where a bold or
 * title-case-shaped NAME line (e.g. "Casey Lindqvist", "Riley Faulkner")
 * must never be mistaken for a section header.
 */
function classifyHeaderCandidate(
  $el: cheerio.Cheerio<any>,
  tag: string | undefined,
  opts: { allowUnrecognizedFallback: boolean; currentSection: SectionKind | null }
): { isHeader: boolean; kind: SectionKind | null; text: string; compoundKinds?: SectionKind[] } {
  const text = $el.text().trim();
  if (tag !== "p" || !text) return { isHeader: false, kind: null, text };
  const norm = normalizeHeaderText(text);
  const kind = exactSynonymKind(norm) ?? fuzzySynonymKind(norm);
  if (kind) {
    const compoundKinds = matchCompoundSectionKinds(norm) ?? undefined;
    return { isHeader: true, kind, text, compoundKinds };
  }
  if (!opts.allowUnrecognizedFallback) {
    return { isHeader: false, kind: null, text };
  }
  if (isBoldShortParagraph($el, tag)) {
    if (isAllCapsHeaderText(text) || opts.currentSection !== "experience") {
      return { isHeader: true, kind: null, text };
    }
  }
  if (opts.currentSection !== "experience" && isTitleCaseHeadingShaped(text)) {
    return { isHeader: true, kind: null, text };
  }
  return { isHeader: false, kind: null, text };
}

const PHONE_RE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const EMAIL_RE = /[^\s|]+@[^\s|]+\.[^\s|]+/;
// A leading label before the actual value on its own "|"-separated token
// (e.g. "Phone: (804) 819-0716", "Email: name@example.com") — stripped
// before deciding whether anything is left over to keep as "other", so a
// plainly-labeled token doesn't leave behind an inert, meaningless "Phone:"/
// "Email:" fragment (found 2026-09-07: only became visible once a real
// fix elsewhere started routing an actual phone/email line through this
// function at all — see the headline/contact disambiguation above).
const CONTACT_LABEL_RE = /^(phone|tel|telephone|mobile|cell|email|e-mail)\s*:?\s*/i;

function parseContact(raw: string): ContactInfo {
  const tokens = raw.split("|").map((t) => t.trim()).filter(Boolean);
  const contact: ContactInfo = { location: null, phone: null, email: null, other: [], raw };
  for (const token of tokens) {
    const emailMatch = token.match(EMAIL_RE);
    const phoneMatch = token.match(PHONE_RE);
    if (emailMatch) {
      contact.email = emailMatch[0];
      const rest = token.replace(emailMatch[0], "").replace(CONTACT_LABEL_RE, "").trim();
      if (rest) contact.other.push(rest);
    } else if (phoneMatch) {
      contact.phone = phoneMatch[0];
      const rest = token.replace(phoneMatch[0], "").replace(CONTACT_LABEL_RE, "").trim();
      if (rest) contact.other.push(rest);
    } else if (contact.location === null) {
      contact.location = token;
    } else {
      // Anything past the first non-phone/non-email token, including an
      // embedded instruction like the INJ-05 fixture's PII request, lands
      // here as inert raw text — B2 has no model call, so it cannot "act" on
      // it, but it also must never be silently dropped, since a downstream
      // reviewer or the B1 prompt-construction layer needs to see it exists.
      contact.other.push(token);
    }
  }
  return contact;
}

/** Heuristic for "this entry actually describes more than one employer/role" — PRD §5 B2's ambiguity trigger, generalized past just overlapping dates. */
function looksLikeCombinedEntry(company: string): boolean {
  const c = company.toLowerCase();
  if (/\b(roles|employers|various|multiple)\b/.test(c)) return true;
  // Two+ comma-separated, capitalized-looking tokens without a connector word ("and", "of") reads as a list, not one employer name.
  const parts = company.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => /^[A-Z]/.test(p))) return true;
  return false;
}

// A trailing month/year-or-year date range, isolated from whatever
// non-date text precedes it on the same line (e.g. "Silicon Valley Bank
// (Remote, Charlotte, NC)  Aug 2022 - Present"). Deliberately reuses the
// same month-name/year token shapes parseDateRange already knows (see its
// own scope note in dateRange.ts) rather than inventing a parallel date
// grammar — this only has to isolate the substring to hand to it.
const TRAILING_DATE_RANGE_RE =
  /^(.*?)[\s,;–—-]*\b((?:[A-Za-z]{3,9}\.?\s+\d{4}|\d{4})\s*(?:–|—|-{1,2}|\bto\b)\s*(?:[A-Za-z]{3,9}\.?\s+\d{4}|\d{4}|present|current|ongoing|now))\s*$/i;

// A looser variant of the pattern above — accepts a HYPHEN as well as a
// space between a month name and its year (e.g. "Jul-2003"), which
// parseSingleDate doesn't support. Used only to DETECT that a line is still
// structurally a trailing company/dates line even when the exact tokens
// can't be parsed into a real DateRange — never to parse one. Deliberately
// keeps the same "ends right at the date, nothing after it" requirement as
// the strict version above: that requirement, not just "the line contains
// two year-like numbers," is what correctly excludes a real title line
// whose own date sits inside a closing parenthesis instead (e.g. "...
// Technology (June 2021 – July 2022)") — an earlier, broader "does this
// contain two 4-digit years anywhere" version of this check wrongly matched
// exactly that shape and silently dropped 3 genuine job titles; caught by
// this fix's own re-test against the résumé that motivated it, 2026-09-07.
const LOOSE_TRAILING_DATE_SHAPE_RE =
  /^(.*?)[\s,;–—-]*\b((?:[A-Za-z]{3,9}\.?[\s-]+\d{4}|\d{4})\s*(?:–|—|-{1,2}|\bto\b)\s*(?:[A-Za-z]{3,9}\.?[\s-]+\d{4}|\d{4}|present|current|ongoing|now))\s*$/i;

/**
 * True only for a paragraph that is JUST "<company/location text> <date
 * range>" with nothing else — used to tell a plain-bold "Company (location)
 * — dates" context line apart from a real job-title line when both are
 * wholly-bold paragraphs with no actual <table> to signal which is which
 * (see the "wholly-bold company/dates line" branch below). Returns null,
 * not a guess, whenever the trailing text isn't a real parseable date range
 * or there's no non-empty text in front of it — a title line with a
 * differently-shaped trailing date (e.g. wrapped in its own parentheses,
 * like "Solution Train Engineer ... (June 2021 – July 2022)") deliberately
 * does NOT match this regex's un-parenthesized `\s*$` ending, so it's left
 * alone to flow through the existing title-detection logic unaffected.
 */
function extractTrailingDateRange(text: string): { before: string; dateRange: DateRange } | null {
  const collapsed = text.replace(/\s+/g, " ").trim();
  const match = collapsed.match(TRAILING_DATE_RANGE_RE);
  if (!match) return null;
  const before = match[1].trim();
  if (!before) return null;
  const dateRange = parseDateRange(match[2]);
  if (!dateRange) return null;
  return { before, dateRange };
}

// A trailing "(Company | Date range)" parenthetical — this project's OTHER
// real, currently-in-use single-line job-entry shape, distinct from the
// "Company (location)  dates" shape extractTrailingDateRange handles above:
// confirmed 2026-09-08 against Pranay's own actual résumé, whose every job
// entry is written as one wholly-bold line, e.g. "DIRECTOR, HEAD OF
// COMPLIANCE PRODUCT MANAGEMENT (First Citizens Bank | Aug 2022 – present)"
// — title, then company and dates pipe-joined inside ONE closing
// parenthetical that ends the line. extractTrailingDateRange's regex
// deliberately requires the date to be the very last thing on the line with
// nothing after it (see its own doc comment) — a closing ")" after the date
// fails that anchor, so this shape previously fell all the way through to
// the generic "title-only entry with no company context" fallback, coming
// back `company: "(unspecified)"`, `dateRange: null`, flagged ambiguous,
// for every single job entry. Deliberately narrow: requires exactly one
// "|" inside the trailing parenthetical, so an ordinary "(Remote)" or
// "(New York, NY)" parenthetical — no pipe — never matches and flows
// through unaffected.
const TRAILING_COMPANY_PIPE_DATE_RE = /^(.*?)\(\s*([^()|]+?)\s*\|\s*([^()]+?)\s*\)\s*$/;

function extractTitleCompanyDateParenthetical(
  text: string
): { title: string; company: string; dateText: string } | null {
  const collapsed = text.replace(/\s+/g, " ").trim();
  const match = collapsed.match(TRAILING_COMPANY_PIPE_DATE_RE);
  if (!match) return null;
  const company = match[2].trim();
  const dateText = match[3].trim();
  if (!company || !dateText) return null;
  // Strip a trailing separator left over from splitting off the
  // parenthetical (e.g. "Director, Head of X  " or "Director, Head of X -").
  const title = match[1].trim().replace(/[\s,;–—-]+$/, "");
  return { title, company, dateText };
}

// Same trailing "(Company | Date range)" shape, but for when the title and
// this parenthetical are split across a bold run and a plain remainder
// (e.g. "**Director, Head of X** (Acme Corp | Aug 2022 – Present)") rather
// than one wholly-bold line — the remainder here is just the parenthetical
// itself, with no title text to strip off.
const COMPANY_PIPE_DATE_ONLY_RE = /^\(\s*([^()|]+?)\s*\|\s*([^()]+?)\s*\)$/;

function parseCompanyPipeDateOnly(text: string): { company: string; dateText: string } | null {
  const match = text.trim().match(COMPANY_PIPE_DATE_ONLY_RE);
  if (!match) return null;
  const company = match[1].trim();
  const dateText = match[2].trim();
  if (!company || !dateText) return null;
  return { company, dateText };
}

// A header-block line (between the name and the first recognized section)
// that is wholly wrapped in matching quote characters — straight or the
// curly quotes Word/mammoth commonly renders ("smart quotes"). Confirmed
// 2026-09-08 against Pranay's own actual résumé: a personal tagline/quote
// ("“I build meaningful technology products…”") sharing a pipe-joined line
// with his real contact info was being read as one more unmatched contact
// token, landing in `contact.location` and bumping his real city into
// `contact.other` instead. A quoted phrase is never itself a phone number,
// email, city, or profile URL, so excluding any header-block line matching
// this shape from both headline-detection and the text handed to
// parseContact is safe and directly targets the confirmed failure, without
// touching how any OTHER header-block line (including a real multi-line
// address) is handled.
const QUOTED_LINE_RE = /^["“'‘][\s\S]*["”'’]$/;

function isQuotedTaglineLine(text: string): boolean {
  return QUOTED_LINE_RE.test(text.trim());
}

export function extractResumeFacts(html: string): ExtractionResult {
  const $ = cheerio.load(html);
  const nodes = $("body").children().toArray();
  const warnings: ExtractionWarning[] = [];

  if (nodes.length === 0) {
    return {
      name: null, headline: null, contact: null, summary: null, skills: [],
      experience: [], education: [], certifications: [], sectionsFound: [],
      unrecognizedSections: [],
      warnings: [{ code: "EMPTY_DOCUMENT", message: "No content nodes found after parsing." }],
    };
  }

  // --- Header block: everything before the first header-shaped paragraph ---
  let i = 0;
  let name: string | null = null;
  let headline: string | null = null;
  const headerLines: string[] = [];
  while (i < nodes.length) {
    const classification = classifyHeaderCandidate($(nodes[i]), (nodes[i] as any).tagName?.toLowerCase(), {
      allowUnrecognizedFallback: false,
      currentSection: null,
    });
    if (classification.isHeader) break;
    const text = $(nodes[i]).text().trim();
    if (text) headerLines.push(text);
    i++;
  }
  if (headerLines[0]) name = headerLines[0];
  // Not every résumé has a separate headline/title line between the name and
  // contact info — a real one (Pranay's own, 2026-09-07) goes straight from
  // name to "Phone: ... | Email: ..." with nothing in between. Unconditionally
  // treating headerLines[1] as the headline mistook that contact line for a
  // headline. Guard: only treat it as a headline if it does NOT itself look
  // like contact info (a phone number or email); otherwise leave headline
  // null and let contact parsing absorb it from index 1 instead of 2.
  let contactStartIndex = 2;
  if (
    headerLines[1] &&
    (PHONE_RE.test(headerLines[1]) || EMAIL_RE.test(headerLines[1]) || isQuotedTaglineLine(headerLines[1]))
  ) {
    headline = null;
    contactStartIndex = 1;
  } else if (headerLines[1]) {
    headline = headerLines[1];
  }
  // A quoted tagline can appear anywhere in the header block, not just at
  // index 1 (e.g. name, headline, quote, contact — 4 lines) — filter it out
  // of whatever range would otherwise be treated as contact text, rather
  // than only guarding the index-1 case above.
  const contactRaw = headerLines
    .slice(contactStartIndex)
    .filter((line) => !isQuotedTaglineLine(line))
    .join("  |  ");
  const contact = contactRaw ? parseContact(contactRaw) : null;

  // --- Walk remaining nodes, section by section ---
  const sectionsFound: SectionKind[] = [];
  let summary: string | null = null;
  const skills: string[] = [];
  const experience: ExperienceEntry[] = [];
  const education: string[] = [];
  const certifications: string[] = [];
  const unrecognizedSections: { header: string; content: string[] }[] = [];

  let currentSection: SectionKind | null = null;
  // Set alongside currentSection when a header names MORE than one kind at
  // once (e.g. "Education & Certifications") — currently only consulted by
  // the "education" table-handling branch below, to split a 2-column
  // education/certifications table's cells across both real output arrays
  // instead of losing the certifications half into one opaque education blob.
  let currentCompoundKinds: SectionKind[] | null = null;
  let currentUnrecognized: { header: string; content: string[] } | null = null;
  let currentEntry: ExperienceEntry | null = null;
  // Set by a <table> inside Experience — the company/date context that
  // subsequent title-only paragraphs (no " — Company" suffix of their own)
  // inherit from, until the next table or the next self-contained
  // "Title — Company" line replaces it.
  let tableCompanyContext: { company: string; dateRange: DateRange | null } | null = null;

  function flushEntry() {
    if (currentEntry) {
      if (!currentEntry.dateRange) {
        currentEntry.ambiguous = true;
        currentEntry.ambiguityReason = currentEntry.ambiguityReason ?? "no parseable date line found for this entry — escalate to a model call per PRD B2";
        warnings.push({ code: "EXPERIENCE_ENTRY_AMBIGUOUS", message: `"${currentEntry.title}" — ${currentEntry.ambiguityReason}` });
      }
      experience.push(currentEntry);
      currentEntry = null;
    }
  }

  function addSkillsText(text: string) {
    if (!text) return;
    let parts = text.split(/\s*\|\s*/).filter(Boolean);
    if (parts.length <= 1) parts = text.split(/\s*,\s*/).filter(Boolean);
    for (const p of parts) if (!skills.includes(p)) skills.push(p);
  }

  for (; i < nodes.length; i++) {
    const el = nodes[i];
    const $el = $(el);
    const tag = (el as any).tagName?.toLowerCase();

    const classification = classifyHeaderCandidate($el, tag, { allowUnrecognizedFallback: true, currentSection });
    if (classification.isHeader) {
      flushEntry();
      currentUnrecognized = null;
      if (classification.kind) {
        currentSection = classification.kind;
        sectionsFound.push(classification.kind);
        currentCompoundKinds = classification.compoundKinds ?? null;
        if (currentCompoundKinds) {
          for (const k of currentCompoundKinds) {
            if (!sectionsFound.includes(k)) sectionsFound.push(k);
          }
        }
      } else {
        // Header-shaped but not one of the 5 known kinds — close whatever
        // section was open (currentSection = null) instead of letting its
        // content keep accumulating there, and start a dedicated bucket for
        // it so the content is preserved, not silently dropped.
        currentSection = null;
        currentCompoundKinds = null;
        currentUnrecognized = { header: classification.text, content: [] };
        unrecognizedSections.push(currentUnrecognized);
      }
      continue;
    }

    if (currentSection === null) {
      // Between recognized sections — e.g. inside an unrecognized-but-real
      // section like "Additional Information".
      if (currentUnrecognized) {
        const text = $el.text().trim();
        if (tag === "table") {
          $el.find("td").each((_, td) => {
            const t = $(td).text().trim();
            if (t) currentUnrecognized!.content.push(t);
          });
        } else if (text) {
          currentUnrecognized.content.push(text);
        }
      }
      continue;
    }

    if (currentSection === "summary") {
      const text = $el.text().trim();
      if (text) summary = summary ? `${summary} ${text}` : text;
      continue;
    }

    if (currentSection === "skills") {
      if (tag === "table") {
        $el.find("td").each((_, td) => addSkillsText($(td).text().trim()));
      } else {
        addSkillsText($el.text().trim());
      }
      continue;
    }

    if (currentSection === "education") {
      // A compound "Education & Certifications" header (see
      // matchCompoundSectionKinds) commonly precedes exactly the 2-column
      // table shape this project has actually seen (school+degree | cert
      // list) — split cells across both real arrays instead of losing the
      // certifications half into education's single opaque text blob. Any
      // other node shape (or a plain, non-compound "Education" header) falls
      // through to the unchanged, pre-existing behavior below.
      if (tag === "table" && currentCompoundKinds?.includes("certifications")) {
        const cells = $el.find("td").toArray().map((td) => $(td).text().trim());
        if (cells[0]) education.push(cells[0]);
        if (cells[1]) certifications.push(cells[1]);
        continue;
      }
      const text = $el.text().trim();
      if (text) education.push(text);
      continue;
    }

    if (currentSection === "certifications") {
      const text = $el.text().trim();
      if (text) certifications.push(text);
      continue;
    }

    if (currentSection === "experience") {
      if (tag === "table") {
        // A company/dates header table — e.g. a real-world "Company | Dates"
        // row layout. Flush whatever entry was open, and set the context
        // that following title-only paragraphs will inherit from.
        flushEntry();
        const cells = $el.find("td").toArray().map((td) => $(td).text().trim());
        const company = cells[0] || "(unspecified)";
        const dateRange = cells[1] ? parseDateRange(cells[1]) : null;
        tableCompanyContext = { company, dateRange };
        if (cells[1] && !dateRange) {
          warnings.push({ code: "DATE_UNPARSEABLE", message: `Table date cell "${cells[1]}" did not match a known format.` });
        }
        continue;
      }

      const hasStrong = $el.find("strong").length > 0;

      // A paragraph's bold run only signals a new job title/company line —
      // the golden-01..09 "**Title** — Company" shape the block below is
      // built around — when that bold text actually STARTS the paragraph.
      // Confirmed 2026-09-08 against Pranay's own actual résumé: the plain
      // descriptive paragraph following his "Prior Experiences" entry
      // ("Held progressive technology roles with **Hewlett-Packard**
      // Financial Services…, **Tata Consultancy Services** Ltd.…") bolds two
      // company names mid-sentence for emphasis — ordinary prose styling,
      // not a title line. The old, unguarded `hasStrong` check treated this
      // as a title candidate anyway and sliced fullText by the FIRST bold
      // run's character length regardless of where that text actually sat
      // in the sentence, chopping it at the wrong position and fabricating
      // a phantom "Hewlett-Packard" job entry (with a mangled, truncated
      // company field) out of what should have stayed a plain description
      // attached to the already-open "Prior Experiences" entry. Requiring
      // the bold run to be a genuine prefix excludes this case (and any
      // other incidental mid-sentence bold) while every legitimate title
      // line — where the bold text was always meant to open the line — is
      // unaffected, since it already satisfies this by construction.
      const strongFirstText = hasStrong ? $el.find("strong").first().text().trim() : "";
      const hasLeadingStrong = hasStrong && strongFirstText.length > 0 && $el.text().trim().startsWith(strongFirstText);

      // A wholly-bold paragraph that is JUST "Company (location) — dates"
      // with no separate title text of its own (e.g. "Silicon Valley Bank
      // (Remote, Charlotte, NC)  Aug 2022 - Present" as its own bold line,
      // immediately followed by a SEPARATE bold title line) — a real
      // pattern (Pranay's own résumé, 2026-09-07) this project hadn't seen
      // before: company/dates given as a plain bold paragraph, not inside
      // an actual <table> the way the company/dates row above is handled.
      // Unlike golden-01..09's bold-TITLE-plus-plain-remainder shape (where
      // only PART of the line is bold), here the ENTIRE paragraph is bold,
      // so the remainder-splitting logic below (which slices fullText by
      // strongText's length) always yields an empty remainder — with
      // nothing else to distinguish it from a real title line, it was being
      // counted as its own phantom job entry (this résumé: 5 such lines,
      // inflating 6 real job entries into 11). A trailing, independently-
      // parseable date range on an otherwise-plain "company (location)"
      // line is a narrow, strong signal that this is a company/dates
      // context line, not a title — mirrors exactly how a real <table>
      // company/dates row is handled just above.
      if (tag === "p" && hasStrong) {
        const wholeText = $el.text().trim();
        const strongWholeText = $el.find("strong").text().trim();
        if (strongWholeText === wholeText) {
          const trailing = extractTrailingDateRange(wholeText);
          if (trailing) {
            flushEntry();
            tableCompanyContext = { company: trailing.before, dateRange: trailing.dateRange };
            continue;
          }
          // "Title (Company | Dates)" — the whole line, including the
          // trailing parenthetical, is one bold run, which is exactly why
          // extractTrailingDateRange above can't catch it: its regex
          // requires the date to be the very last thing on the line, and
          // here a closing ")" follows it instead. Confirmed 2026-09-08
          // against Pranay's own actual résumé, where every job entry uses
          // this exact shape — see extractTitleCompanyDateParenthetical's
          // own doc comment for the full history.
          const titleCompanyDate = extractTitleCompanyDateParenthetical(wholeText);
          if (titleCompanyDate) {
            flushEntry();
            const dateRange = parseDateRange(titleCompanyDate.dateText);
            if (!titleCompanyDate.title) {
              // No title before the parenthetical — this is a company/dates
              // context line (like the trailing-date-range case above),
              // just pipe-joined inside its own parens instead.
              tableCompanyContext = { company: titleCompanyDate.company, dateRange };
              if (!dateRange) {
                warnings.push({
                  code: "DATE_UNPARSEABLE",
                  message: `Company/dates line "${wholeText}" did not match a known date format.`,
                });
              }
              continue;
            }
            currentEntry = {
              rawBlock: wholeText,
              title: titleCompanyDate.title,
              company: titleCompanyDate.company,
              dateRange,
              bullets: [],
              ambiguous: !dateRange,
              ambiguityReason: dateRange
                ? null
                : `date text "${titleCompanyDate.dateText}" did not match a known format — escalate to a model call per PRD B2`,
            };
            if (!dateRange) {
              warnings.push({
                code: "DATE_UNPARSEABLE",
                message: `Date text "${titleCompanyDate.dateText}" in "${wholeText}" did not match a known format.`,
              });
            }
            continue;
          }
          // The clean parse above failed, but this line still looks like an
          // attempted company/dates line — two year-like numbers — just in a
          // date format this project doesn't parse (e.g. "Jul-2003", a
          // hyphen rather than a space between month and year; found
          // 2026-09-07 testing against this exact résumé). Falling through
          // to ordinary title handling here would silently misattribute it
          // to whatever company/date context happened to be left over from
          // the PRECEDING employer — a real, confirmed regression this fix
          // introduced and then caught during its own testing. Safer to
          // treat it as a recognized-but-unparseable company/dates line —
          // same as the <table>-row branch above does when its date cell
          // fails to parse — clearing any stale context so whatever comes
          // next starts a fresh, honestly-ambiguous entry instead of
          // inheriting the wrong company.
          if (LOOSE_TRAILING_DATE_SHAPE_RE.test(wholeText)) {
            flushEntry();
            tableCompanyContext = null;
            warnings.push({ code: "DATE_UNPARSEABLE", message: `Company/dates line "${wholeText}" did not match a known date format.` });
            continue;
          }
        }
      }

      // Whole-paragraph-is-italic, mirroring isBoldShortParagraph's
      // strongText === fullText check — NOT "contains an <em> anywhere."
      // A real spot-check (Sunanda Srivastava's actual resume) has title
      // lines like "Pharmacy Technician - Walmart (Rock Hill, SC) (Dec 2021
      // – Jan 2024)" where only the trailing date fragment is wrapped in
      // <em>; an earlier, looser version of this check (em.length > 0
      // anywhere) misclassified that whole line as a pure date paragraph.
      // Since currentEntry was null at that point (right after a table
      // flush), the isEmOnly branch's `&& currentEntry` guard silently did
      // nothing with it, and the line was dropped entirely — not becoming a
      // title, a date, or a bullet. Requiring the ENTIRE text to be italic
      // fixes that: a mostly-plain line with a small embedded date fragment
      // now correctly falls through to the plain-title-candidate path below.
      const emText = $el.find("em").text().trim();
      const fullTextForEmCheck = $el.text().trim();
      const isEmOnly = tag === "p" && emText.length > 0 && $el.find("strong").length === 0 && emText === fullTextForEmCheck;

      // A plain (non-bold, non-italic-only) paragraph is treated as a new
      // entry's title line too, not just a bold one — real resumes (see
      // README — Sunanda Srivastava's actual resume) often don't bold the
      // title/company line at all, especially right after a table-based
      // company/dates row. The tricky part: a bold title line unconditionally
      // starts a new entry (any hasLeadingStrong paragraph flushes and
      // re-opens — see hasLeadingStrong's own doc comment above for why
      // "leading" matters, not just "any bold run anywhere in the
      // paragraph"), but plain text alone can't carry that same
      // unconditional signal — otherwise an ordinary plain bullet/description
      // line belonging to an entry already in progress would be misread as
      // a new title. So a plain line is treated as a new title in two cases:
      //  (a) no entry is currently open (right after a table row or a
      //      flush) — the common, unambiguous case; or
      //  (b) an entry IS open, but the very next node is itself a pure date
      //      paragraph (isEmOnly) — this is the "two plain-text subroles
      //      sharing one table row" pattern (golden-11's Redwood Business
      //      Park entry): the second subrole's title line appears while the
      //      first subrole's entry is still open, and the only reliable
      //      signal that a NEW title just started, not a bullet, is that
      //      it's immediately followed by its own dedicated date line.
      // The non-empty-text check matters specifically right after a table
      // row: docx-generated spacing is often a blank paragraph (no text, no
      // runs), which would otherwise be misread as a title line with an
      // empty title, consuming the "no entry open" slot before the REAL
      // title paragraph gets a chance to open one.
      const nextNode = nodes[i + 1];
      const nextTag = nextNode ? (nextNode as any).tagName?.toLowerCase() : undefined;
      const $next = nextNode ? $(nextNode) : null;
      const nextIsDateOnlyLine =
        !!$next && nextTag === "p" && $next.find("em").length > 0 && $next.find("strong").length === 0 && $next.text().trim().length > 0;
      const isPlainTitleCandidate =
        tag === "p" &&
        !hasLeadingStrong &&
        !isEmOnly &&
        $el.text().trim().length > 0 &&
        (currentEntry === null || nextIsDateOnlyLine);

      if (tag === "p" && (hasLeadingStrong || isPlainTitleCandidate)) {
        const fullText = $el.text().trim();
        const strongText = hasLeadingStrong ? strongFirstText : fullText;
        let remainder = fullText.slice(strongText.length).trim().replace(/^[-–—]+\s*/, "").trim();
        let title = strongText;

        // A plain line frequently combines title AND company in one
        // unmarked run (e.g. "Pharmacy Technician – CVS Pharmacy (Waxhaw,
        // NC)", from the real resume that motivated this) — there's no
        // separate bold/plain run to split on the way golden-01..09's bold-
        // title-plus-plain-remainder pattern allows, so fall back to
        // splitting the plain line on its own first dash separator.
        if (!hasLeadingStrong && !remainder) {
          const dashSplit = fullText.split(/\s+[-–—]\s+/);
          if (dashSplit.length >= 2) {
            title = dashSplit[0].trim();
            remainder = dashSplit.slice(1).join(" - ").trim();
          }
        }

        flushEntry();

        if (remainder) {
          // Self-contained "Title — Company" line (the golden-01..09 pattern,
          // or a plain-line equivalent). Starting one of these clears any
          // stale table context — this paragraph carries its own company, it
          // isn't a subrole of a preceding table group.
          tableCompanyContext = null;
          // The remainder itself might be a bare "(Company | Dates)"
          // parenthetical — the bold-title-plus-plain-suffix sibling of the
          // wholly-bold "Title (Company | Dates)" shape handled above (e.g.
          // "**Director, Head of X** (Acme Corp | Aug 2022 – Present)").
          // Without this, `company` would keep the parens and pipe intact
          // as one raw string and `dateRange` would stay null (same failure
          // mode as the wholly-bold case, confirmed 2026-09-08).
          const pipeDate = parseCompanyPipeDateOnly(remainder);
          const company = pipeDate ? pipeDate.company : remainder;
          const dateRange = pipeDate ? parseDateRange(pipeDate.dateText) : null;
          const combinedEntry = !pipeDate && looksLikeCombinedEntry(remainder);
          const dateUnparseable = pipeDate && !dateRange;
          currentEntry = {
            rawBlock: fullText,
            title,
            company,
            dateRange,
            bullets: [],
            ambiguous: combinedEntry || !!dateUnparseable,
            ambiguityReason: combinedEntry
              ? "company field appears to combine multiple employers/roles into one block — escalate to a model call per PRD B2"
              : dateUnparseable
                ? `date text "${pipeDate!.dateText}" did not match a known format — escalate to a model call per PRD B2`
                : null,
          };
          if (dateUnparseable) {
            warnings.push({
              code: "DATE_UNPARSEABLE",
              message: `Date text "${pipeDate!.dateText}" in "${fullText}" did not match a known format.`,
            });
          }
        } else if (tableCompanyContext) {
          // Title-only line inheriting company (and, by default, dates) from
          // the most recent table row — the golden-10 "two subroles under one
          // employer" pattern (bold or, as of golden-11, plain title lines).
          currentEntry = {
            rawBlock: fullText,
            title,
            company: tableCompanyContext.company,
            dateRange: tableCompanyContext.dateRange,
            bullets: [],
            ambiguous: looksLikeCombinedEntry(tableCompanyContext.company),
            ambiguityReason: looksLikeCombinedEntry(tableCompanyContext.company)
              ? "company field appears to combine multiple employers/roles into one block — escalate to a model call per PRD B2"
              : null,
          };
        } else {
          // A title line with no company anywhere — genuinely ambiguous.
          currentEntry = {
            rawBlock: fullText,
            title,
            company: "(unspecified)",
            dateRange: null,
            bullets: [],
            ambiguous: true,
            ambiguityReason: "title-only entry with no company context (no preceding table and no \"Title — Company\" line) — escalate to a model call per PRD B2",
          };
        }
        continue;
      }

      if (isEmOnly && currentEntry) {
        // An explicit dates line always wins over an inherited table default —
        // this is exactly the golden-10 case where a subrole under a table
        // group narrows the outer date range to its own specific span.
        const text = $el.text().trim();
        const parsed = parseDateRange(text);
        if (parsed) {
          currentEntry.dateRange = parsed;
        } else if (!currentEntry.dateRange) {
          currentEntry.ambiguous = true;
          currentEntry.ambiguityReason = `date text "${text}" did not match a known format — escalate to a model call per PRD B2`;
          warnings.push({ code: "DATE_UNPARSEABLE", message: currentEntry.ambiguityReason });
        }
        continue;
      }

      if (tag === "ul" && currentEntry) {
        $el.find("li").each((_, li) => {
          const bulletText = $(li).text().trim();
          if (bulletText) currentEntry!.bullets.push(bulletText);
        });
        continue;
      }

      // Stray paragraph inside Experience that isn't a title line, a dates line, or a list —
      // e.g. a plain-text bullet in a messy real-world resume. Attach to the current entry
      // as a bullet rather than silently dropping it.
      if (tag === "p" && currentEntry) {
        const text = $el.text().trim();
        if (text) currentEntry.bullets.push(text);
      }
      continue;
    }
  }
  flushEntry();

  // --- Cross-entry overlap check (PRD §5 B2's named ambiguity example) ---
  for (let a = 0; a < experience.length; a++) {
    for (let b = a + 1; b < experience.length; b++) {
      const A = experience[a].dateRange;
      const B = experience[b].dateRange;
      if (A && B && rangesOverlap(A, B) && !experience[a].ambiguous && !experience[b].ambiguous) {
        experience[a].ambiguous = true;
        experience[a].ambiguityReason = `date range overlaps with "${experience[b].title}" — escalate to a model call per PRD B2`;
        experience[b].ambiguous = true;
        experience[b].ambiguityReason = `date range overlaps with "${experience[a].title}" — escalate to a model call per PRD B2`;
        warnings.push({ code: "EXPERIENCE_ENTRY_AMBIGUOUS", message: `Overlapping date ranges: "${experience[a].title}" and "${experience[b].title}"` });
      }
    }
  }

  for (const kind of Object.keys(SECTION_SYNONYMS) as SectionKind[]) {
    if (!sectionsFound.includes(kind)) {
      warnings.push({ code: "SECTION_NOT_FOUND", message: `No "${kind}" section found.` });
    }
  }
  if (experience.length === 0) {
    warnings.push({ code: "NO_EXPERIENCE_ENTRIES", message: "No experience entries were extracted." });
  }

  return {
    name, headline, contact, summary, skills, experience, education, certifications,
    sectionsFound, unrecognizedSections, warnings,
  };
}
