import type { DateRange } from "./types";
export type { DateRange };

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const PRESENT_WORDS = /^(present|current|ongoing|now)$/i;

// Scope note: this covers "Mon YYYY" and "YYYY" tokens, joined by an en dash,
// em dash, one or two hyphens, or the word "to" — the formats every golden-set
// and adversarial-suite resume uses. Real-world resumes also use "Q1 2020",
// "Spring 2019", "01/2020", or a bare season — those are explicitly out of
// scope for this first pass and should come back as unparseable (triggering
// escalation, per PRD §5 B2), not silently guessed at.

function parseSingleDate(token: string): { year: number; month: number | null } | null {
  const t = token.trim();
  const monthYear = t.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (monthYear) {
    const monthKey = monthYear[1].toLowerCase();
    if (MONTHS[monthKey] != null) {
      return { year: parseInt(monthYear[2], 10), month: MONTHS[monthKey] };
    }
    return null; // looked like "Word YYYY" but the word wasn't a recognized month
  }
  const yearOnly = t.match(/^(\d{4})$/);
  if (yearOnly) return { year: parseInt(yearOnly[1], 10), month: null };
  return null;
}

/**
 * Parses one date-range string into a structured DateRange, or returns null
 * if it can't be confidently parsed — the caller is responsible for treating
 * a null result as an escalation trigger (PRD §5 B2), not for guessing further.
 */
export function parseDateRange(raw: string): DateRange | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const sepMatch = cleaned.match(/^(.+?)\s*(?:–|—|-{1,2}|\bto\b)\s*(.+)$/i);

  if (!sepMatch) {
    const single = parseSingleDate(cleaned);
    if (single) {
      return {
        raw: cleaned,
        startYear: single.year,
        startMonth: single.month,
        endYear: single.year,
        endMonth: single.month,
        endIsPresent: false,
      };
    }
    return null;
  }

  const [, startTok, endTokRaw] = sepMatch;
  const start = parseSingleDate(startTok);
  if (!start) return null;

  const endTok = endTokRaw.trim();
  if (PRESENT_WORDS.test(endTok)) {
    return {
      raw: cleaned,
      startYear: start.year,
      startMonth: start.month,
      endYear: null,
      endMonth: null,
      endIsPresent: true,
    };
  }

  const end = parseSingleDate(endTok);
  if (!end) return null;

  return {
    raw: cleaned,
    startYear: start.year,
    startMonth: start.month,
    endYear: end.year,
    endMonth: end.month,
    endIsPresent: false,
  };
}

/** Sortable start-of-range value for display/sorting — treats a missing month as January (the "widest" reading). */
export function rangeStart(d: DateRange): number {
  return d.startYear! * 12 + (d.startMonth ?? 1);
}

/** Sortable end-of-range value for display/sorting — "Present" sorts as the far future; a missing month reads as December (the "widest" reading). */
export function rangeEnd(d: DateRange): number {
  if (d.endIsPresent) return 999999;
  return d.endYear! * 12 + (d.endMonth ?? 12);
}

// rangesOverlap deliberately does NOT use rangeStart/rangeEnd above. Almost
// every real resume gives year-only dates, and consecutive jobs routinely
// share a boundary year ("2017 – 2020" followed by "2020 – Present") — that's
// completely normal, not ambiguous. If overlap detection defaulted a missing
// start month to January and a missing end month to December (the "widest"
// reading used for display), every single one of those completely ordinary
// transitions would register as a false overlap, and the ambiguity flag
// would fire on nearly every multi-job resume — worse than not checking at
// all, since a signal that's wrong most of the time trains you to ignore it.
//
// Instead, overlap detection uses the *conservative* reading of an unknown
// month: a start with no month is assumed as late in the year as possible,
// an end with no month is assumed as early in the year as possible. Only a
// pair of ranges that overlap even under that narrow, benefit-of-the-doubt
// reading gets flagged — which is exactly the "genuinely ambiguous" bar the
// PRD's B2 spec asks for, not "touches a shared year."

function conservativeOverlapStart(d: DateRange): number {
  return d.startYear! * 12 + (d.startMonth ?? 12);
}

function conservativeOverlapEnd(d: DateRange): number {
  if (d.endIsPresent) return 999999;
  return d.endYear! * 12 + (d.endMonth ?? 1);
}

/** True if two date ranges overlap even under the most conservative reading of any unknown months — the PRD's named example of a B2 ambiguity trigger. */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return conservativeOverlapStart(a) <= conservativeOverlapEnd(b) && conservativeOverlapStart(b) <= conservativeOverlapEnd(a);
}
