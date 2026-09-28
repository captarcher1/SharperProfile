// Step 5 (phase1-build-plan.md) — the §6 threshold table from
// pipeline-acceptance-criteria.md, encoded as data so the eval report can
// check a computed rate against the named number instead of a hardcoded
// inline comparison, and so a future change to the spec's thresholds means
// editing this file, not hunting through report-formatting code.
//
// Each row's `status` mirrors what §6 itself says about whether this
// harness can even measure that row yet — several rows are explicitly out
// of scope for Step 5 (they depend on infrastructure later steps build:
// the LLM-judge, Step 13; the injection heuristic, Step 9; repeated-run
// stability tracking, not built this step either — see runEval.ts's file
// header for why). Reporting a row as "not measured by this harness" is
// the honest state, not a gap to paper over with a fake pass.

export type ThresholdRow = {
  metric: string;
  /** Fraction (0-1) or null when this isn't a single-number threshold (e.g. the two-sided escape-hatch row). */
  threshold: number | null;
  /** Human-readable version of the threshold, for display. */
  thresholdLabel: string;
  measuredByThisHarness: boolean;
  /** Why not, when measuredByThisHarness is false. */
  notMeasuredReason?: string;
};

export const THRESHOLDS: ThresholdRow[] = [
  {
    metric: "Schema validity rate",
    threshold: 0.95,
    thresholdLabel: "≥95% (working default)",
    measuredByThisHarness: true,
  },
  {
    metric: "Groundedness (no fabrication)",
    threshold: 1.0,
    thresholdLabel: "100%, zero tolerance",
    measuredByThisHarness: true,
    notMeasuredReason:
      "Interpreted, not verbatim from the spec: this harness reports the number-fidelity semantic check's pass rate as the automated proxy for \"groundedness\" — the only rule of the 5 that's actually built to catch a fabricated figure. Qualitative fabrication (an invented employer, methodology, or interest) isn't caught by any automated check yet; only human review (Step 11) and, eventually, the LLM-judge (Step 13) cover that.",
  },
  {
    metric: "Completeness (entry-coverage rule)",
    threshold: 1.0,
    thresholdLabel: "100% — every real entry represented",
    measuredByThisHarness: true,
  },
  {
    metric: "Skill-coverage (chipGroups)",
    threshold: 1.0,
    thresholdLabel: "100% — no skill dropped or invented",
    measuredByThisHarness: true,
  },
  {
    metric: "Chip-grouping placement stability (AC-CHG3)",
    threshold: 0.9,
    thresholdLabel: "≥90% stable placement across 3 repeated runs (working default)",
    measuredByThisHarness: false,
    notMeasuredReason:
      "Needs 3 repeated runs per persona specifically for chipGroups, tracked and diffed across runs — genuinely different machinery from this harness's single-pass-per-case design. Deliberately deferred rather than bolted on awkwardly; worth adding as a dedicated flag when Step 6's tuning work actually needs it, not before.",
  },
  {
    metric: "Dollar-figure ranging compliance",
    threshold: 1.0,
    thresholdLabel: "100% — no unrounded own-impact dollar figure",
    measuredByThisHarness: true,
  },
  {
    metric: "Escape-hatch trigger accuracy",
    threshold: null,
    thresholdLabel: "100% true-trigger rate; 0% false-trigger rate",
    measuredByThisHarness: true,
    notMeasuredReason:
      "Thin coverage by construction, same caveat §6 itself names: only 1 true-trigger case exists in the golden set (Devon's Awards & Recognition). Marisol's Leadership Philosophy case is the sharper false-trigger test (modest-but-real evidence, AC-F2) — included here specifically because it's harder to pass than the other 35 obviously-evidenced cases.",
  },
  {
    metric: "Tone/quality acceptability (LLM-judge)",
    threshold: null,
    thresholdLabel: "Not yet set — blocked on calibration pass",
    measuredByThisHarness: false,
    notMeasuredReason: "No judge exists yet — Step 13.",
  },
  {
    metric: "Injection heuristic recall",
    threshold: null,
    thresholdLabel: "Not yet set — suite exists but hasn't run against real code",
    measuredByThisHarness: false,
    notMeasuredReason: "No heuristic pre-check exists yet — Step 9. This harness also runs the golden set, not the adversarial suite.",
  },
  {
    metric: "False-positive rate on benign resumes",
    threshold: 0,
    thresholdLabel: "0% — neither adversarial control case should ever trigger a warning",
    measuredByThisHarness: false,
    notMeasuredReason: "Measured against the adversarial suite's 2 control cases, not the golden set this harness runs — belongs to Step 9's own test pass.",
  },
];
