// B5/B6 — the export/import file format (resolves OQ-P2-2, 2026-09-22).
//
// Per A3, this mirrors the wizard's existing session-state shape directly
// rather than inventing a separate schema: `WizardSession` already contains
// zero secrets — provider keys and a future Vercel token live only in
// `.env.local` (see envFile.ts), never in session state — so A4 ("no
// secrets in the export") is satisfied by WizardSession's own shape, not by
// a field-stripping step here that could later be forgotten as new session
// fields get added. B5's own failure case 1 (a future code change
// accidentally putting a secret into session state) is exactly the
// regression this structural choice is meant to make impossible by
// construction, not just by discipline.
//
// OQ-P2-2 resolved:
//   - Format: `{ schemaVersion, exportedAt, wizardSession }` — a thin
//     wrapper around the real session object, not a redesigned shape.
//   - Headshot: kept exactly as session state already stores it (a base64
//     `data:` URL on `Step2Headshot.dataUrl`) — i.e. embedded, not
//     referenced. It's already that encoding internally, so embedding it
//     costs nothing extra and needs no new decode/encode step on import.
//   - Filename: date-only, no résumé filename or extracted name in it, so a
//     shared or renamed export file doesn't leak identity via its filename
//     alone.
//   - Versioning: a numeric `schemaVersion` field (B6 edge case 2 / D2) —
//     bump this whenever `WizardSession`'s shape changes in a
//     backward-incompatible way; `parseImport` below rejects a mismatch
//     with a specific message rather than attempting a silent migration.
import type { WizardSession } from "./wizard-state";

export const EXPORT_SCHEMA_VERSION = 1;

export type WizardExportFile = {
  schemaVersion: number;
  exportedAt: number;
  wizardSession: WizardSession;
};

export function buildExport(session: WizardSession): WizardExportFile {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    wizardSession: session,
  };
}

/** OQ-P2-2's filename convention — see file header. */
export function exportFileName(exportedAt: number): string {
  const d = new Date(exportedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `portfolio-wizard-draft-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** B5 edge case 1: a session with no progress yet is still a valid, legitimate state — never an error. */
export function hasAnyProgress(session: WizardSession): boolean {
  return Boolean(session.step1 || session.step2 || session.step3);
}

export type ImportResult =
  | { ok: true; session: WizardSession }
  | { ok: false; code: "invalid_json" | "invalid_shape" | "unsupported_version"; message: string };

/**
 * B6 failure cases 1-2: reject cleanly, never partially load or crash.
 *
 * Deliberately shallow: this checks the top-level export wrapper and the
 * three step slots exist with the right *kind* of shape, but does not
 * re-validate every field inside `ExtractionResult` / Track B section data a
 * second time — those already went through Track A's/Track B's own
 * validation once, when the export was originally produced by this same
 * wizard. A genuinely corrupted inner shape (e.g. a hand-edited file) will
 * surface when a page tries to render it, through the same rendering code
 * that already handles a section being absent or malformed today — a small,
 * disclosed scope choice, not an oversight.
 */
export function parseImport(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      code: "invalid_json",
      message: "This doesn't look like a valid saved draft — try exporting a fresh one.",
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      ok: false,
      code: "invalid_shape",
      message: "This doesn't look like a valid saved draft — try exporting a fresh one.",
    };
  }

  const file = parsed as Partial<WizardExportFile>;
  if (typeof file.schemaVersion !== "number" || typeof file.wizardSession !== "object" || file.wizardSession === null) {
    return {
      ok: false,
      code: "invalid_shape",
      message: "This doesn't look like a valid saved draft — try exporting a fresh one.",
    };
  }

  if (file.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "unsupported_version",
      message: `This draft was saved by a different version of the wizard (schema v${file.schemaVersion}, this wizard reads v${EXPORT_SCHEMA_VERSION}) — re-export it with the current wizard, or check for an update.`,
    };
  }

  const session = file.wizardSession as Partial<WizardSession>;
  if (!("step1" in session) || !("step2" in session) || !("step3" in session)) {
    return {
      ok: false,
      code: "invalid_shape",
      message: "This doesn't look like a valid saved draft — a required part of it is missing.",
    };
  }

  return { ok: true, session: session as WizardSession };
}
