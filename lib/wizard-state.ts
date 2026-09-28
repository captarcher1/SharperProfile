// Wizard session/progress state — Step 1 (B4) + Step 2 (B3) slices. Per
// ux-wizard-and-provider-config-plan.md §10.1/§13.1: this is a single-user,
// locally-run instance, so a simple server-memory store keyed by a session
// cookie is sufficient — no multi-tenant session design needed. Step 3 will
// extend `WizardSession` further with provider/credential state and
// generated content as that gets built.
//
// 2026-09-07: backed with a disk-persisted mirror (see `persistSession`/
// `loadSessionFromDisk` below) so a dev-server restart — e.g. to pick up a
// package.json/route change — no longer silently drops Step 1/2/3 progress.
// The in-memory Map stays the hot path for every read; disk is written on
// every mutation and read back only when a session id isn't already cached
// (server just restarted). This is a deliberately small, local change: it
// does not touch any of the 7 API routes that call this module — they still
// see the exact same synchronous function signatures as before.
//
// Session files contain the user's actual résumé content and (if provided)
// their headshot photo as a base64 data URL, so `.wizard-sessions/` is
// git-ignored, same as `.env.local`. There's no automatic expiry — this is a
// local single-user tool, not a hosted multi-tenant service — so old session
// files just sit there; deleting the `.wizard-sessions/` folder resets
// everything, the same way restarting the server used to.
//
// 2026-09-22 (Phase 2, B5/B6/B7): `replaceSession` added for B6's import
// (a wholesale replace of this session's step1/2/3, not a merge — B7's
// overwrite-warning is what's responsible for confirming with the user
// before that function is ever called, not this module). `SectionGenerationResult`'s
// "ok" variant gained an `edited` flag so B7's regenerate-warning (golden
// example 3) can specifically name sections with real user edits, distinct
// from sections that are merely generated-and-untouched — see
// `setStep3SectionData` below, which is the one and only place a section
// transitions to `edited: true`.
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { ExtractionResult } from "@/src/types";
import type { SectionTypeId } from "@/lib/sectionTypes";
import type { ProviderName } from "@/src/providers";

export const SESSION_COOKIE_NAME = "wizard_session_id";

export type Step1Result = {
  source: "upload" | "example";
  sourceFileName: string;
  sourceFormat: "docx" | "pdf";
  hasStructure: boolean;
  facts: ExtractionResult;
  createdAt: number;
};

export type Step2Headshot = {
  /** data: URL — small enough (<=5MB source, base64 overhead included) for in-memory session storage; never written to disk server-side. */
  dataUrl: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  fileName: string;
};

export type Step2Result = {
  selectedSectionTypes: SectionTypeId[];
  /** null = no headshot staged — a valid, explicitly-supported state (B3 failure case 3), not an error. */
  headshot: Step2Headshot | null;
  /**
   * 2026-09-27 — whether the published site should show a "Download as
   * Word / PDF" button (Track B's own opt-in feature, added this session).
   * Defaults to false: an older exported draft won't have this key, and
   * `currentStep2()` below fills it in via `?? false`, matching the same
   * additive-optional pattern already used for `publish` on `WizardSession`.
   * Read by `buildSiteConfigSource` (lib/vercelDeploy.ts) to set
   * `downloadEnabled` on the generated `config/site.ts`.
   */
  includeDownloadButton: boolean;
};

// One section's outcome from a Generate call (B1). Auto-filled sections
// (hero/metrics/logoCredentials/contactForm) are always "ok" — there's no
// provider call to fail. AI-generated sections can land in any of the
// three: "ok" (validated against Track B's schema, D2), "invalid" (the
// model's content came back but failed that validation — B1 failure case
// F2, shown inline without breaking the rest of the review screen), or
// "insufficient_evidence" (Track A's own pipeline concept, surfaced as-is
// rather than treated as an error — B1 edge cases 1/2).
//
// `edited` (added for B7): true once a user has saved a hand-edit over this
// section's content (via `setStep3SectionData`), false for content that's
// exactly what the last Generate call produced and has never been touched.
// This is what lets B7's regenerate-warning (golden example 3) say "this
// has your edits" specifically, instead of a blanket "you have a draft"
// warning that can't tell the two apart.
export type SectionGenerationResult =
  | { status: "ok"; data: unknown; source: "ai-generated" | "auto-filled"; edited: boolean }
  | { status: "invalid"; message: string }
  | { status: "insufficient_evidence"; message: string };

export type Step3Result = {
  /** null when the generate call only involved auto-filled sections — no provider was ever needed. */
  provider: ProviderName | null;
  generatedAt: number;
  sections: Partial<Record<SectionTypeId, SectionGenerationResult>>;
};

// B9/B10 (2026-09-27) — records the outcome of the most recent successful
// publish, so B10 knows there's an existing Vercel project to redeploy to
// instead of creating a new one. `projectId` is what's sent back as the
// `project` field on a republish (per D1's confirmed request shape) — using
// Vercel's own project id rather than the human-chosen project name, since
// the id can't collide/typo the way a name could. `alias` is the stable,
// durable hostname (D1's finding: never the per-deployment `url`, which
// carries a random build-specific suffix that changes every republish).
// This is a plain, additive, optional field: an older exported draft simply
// won't have it (`parseImport` only requires step1/2/3 to exist), and every
// read of this field goes through `session.publish ?? null` rather than
// assuming it's present — same defensive pattern this file already uses for
// `SectionGenerationResult.edited` on an old session file.
export type PublishResult = {
  projectId: string;
  projectName: string;
  /** The stable, durable hostname (no scheme) — e.g. "my-site-team.vercel.app". Show this to the user, never a raw per-deployment `url`. */
  alias: string;
  lastDeploymentId: string;
  publishedAt: number;
  target: "production";
};

export type WizardSession = {
  step1: Step1Result | null;
  step2: Step2Result | null;
  step3: Step3Result | null;
  publish: PublishResult | null;
};

// Module-level Map — the in-memory hot path, still consulted first on every
// call. What changed 2026-09-07: it's now backed by a JSON file per session
// under SESSIONS_DIR, so a session absent from the Map (e.g. right after a
// server restart) is loaded from disk before being treated as "unknown."
const sessions = new Map<string, WizardSession>();

const SESSIONS_DIR = path.join(process.cwd(), ".wizard-sessions");

// Session ids only ever come from randomUUID() (below) or a cookie value
// that's checked against that same shape here — never used to build a path
// from unvalidated input.
const SESSION_ID_RE = /^[0-9a-f-]{36}$/i;

function sessionFilePath(sessionId: string): string {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

function loadSessionFromDisk(sessionId: string): WizardSession | undefined {
  if (!SESSION_ID_RE.test(sessionId)) return undefined;
  try {
    const raw = readFileSync(sessionFilePath(sessionId), "utf8");
    return JSON.parse(raw) as WizardSession;
  } catch {
    // Missing file, corrupt JSON, or any other read failure — treat exactly
    // like "no session," same as before this change existed.
    return undefined;
  }
}

function persistSession(sessionId: string, session: WizardSession): void {
  try {
    mkdirSync(SESSIONS_DIR, { recursive: true });
    writeFileSync(sessionFilePath(sessionId), JSON.stringify(session));
  } catch (error) {
    // Best-effort: a disk write failure (permissions, out of space) should
    // degrade to "this session won't survive a restart," not break the
    // in-memory flow the user is actively in the middle of.
    console.error(`wizard-state: failed to persist session ${sessionId}`, error);
  }
}

function emptySession(): WizardSession {
  return { step1: null, step2: null, step3: null, publish: null };
}

/** Reads the session id from the request's cookie, if present — does not create one. */
export function readSessionId(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/** Resolves this request's session id, creating a new session (and a new id, if none was sent) as needed. */
export function getOrCreateSessionId(request: NextRequest): { sessionId: string; isNew: boolean } {
  const existingId = readSessionId(request);
  if (existingId && sessions.has(existingId)) {
    return { sessionId: existingId, isNew: false };
  }
  if (existingId) {
    const fromDisk = loadSessionFromDisk(existingId);
    if (fromDisk) {
      sessions.set(existingId, fromDisk);
      return { sessionId: existingId, isNew: false };
    }
  }
  const sessionId = existingId ?? randomUUID();
  const fresh = emptySession();
  sessions.set(sessionId, fresh);
  persistSession(sessionId, fresh);
  return { sessionId, isNew: true };
}

export function getSession(sessionId: string): WizardSession | undefined {
  const cached = sessions.get(sessionId);
  if (cached) return cached;
  const fromDisk = loadSessionFromDisk(sessionId);
  if (fromDisk) {
    sessions.set(sessionId, fromDisk);
    return fromDisk;
  }
  return undefined;
}

export function setStep1Result(sessionId: string, result: Step1Result): void {
  const session = sessions.get(sessionId) ?? loadSessionFromDisk(sessionId) ?? emptySession();
  session.step1 = result;
  sessions.set(sessionId, session);
  persistSession(sessionId, session);
}

function currentStep2(sessionId: string): Step2Result {
  const session = sessions.get(sessionId) ?? loadSessionFromDisk(sessionId) ?? emptySession();
  const existing = session.step2;
  return {
    selectedSectionTypes: existing?.selectedSectionTypes ?? [],
    headshot: existing?.headshot ?? null,
    includeDownloadButton: existing?.includeDownloadButton ?? false,
  };
}

export function setStep2Sections(sessionId: string, selectedSectionTypes: SectionTypeId[]): Step2Result {
  const session = sessions.get(sessionId) ?? loadSessionFromDisk(sessionId) ?? emptySession();
  const step2 = { ...currentStep2(sessionId), selectedSectionTypes };
  session.step2 = step2;
  sessions.set(sessionId, session);
  persistSession(sessionId, session);
  return step2;
}

export function setStep2Headshot(sessionId: string, headshot: Step2Headshot | null): Step2Result {
  const session = sessions.get(sessionId) ?? loadSessionFromDisk(sessionId) ?? emptySession();
  const step2 = { ...currentStep2(sessionId), headshot };
  session.step2 = step2;
  sessions.set(sessionId, session);
  persistSession(sessionId, session);
  return step2;
}

/** 2026-09-27 — sets whether the published site shows the Word/PDF download button (Step 2's new opt-in toggle). */
export function setStep2DownloadButton(sessionId: string, includeDownloadButton: boolean): Step2Result {
  const session = sessions.get(sessionId) ?? loadSessionFromDisk(sessionId) ?? emptySession();
  const step2 = { ...currentStep2(sessionId), includeDownloadButton };
  session.step2 = step2;
  sessions.set(sessionId, session);
  persistSession(sessionId, session);
  return step2;
}

export function setStep3Result(sessionId: string, result: Step3Result): void {
  const session = sessions.get(sessionId) ?? loadSessionFromDisk(sessionId) ?? emptySession();
  session.step3 = result;
  sessions.set(sessionId, session);
  persistSession(sessionId, session);
}

/** Updates one section's data in-place after a user edit (the review/edit screen) — always marks it "ok" (an edit that reaches this point has already been re-validated by the caller) and, per B7, always marks it `edited: true` — this is the one function on the "a human changed this by hand" path, as opposed to `setStep3Result`'s "this is what Generate just produced" path. */
export function setStep3SectionData(sessionId: string, sectionType: SectionTypeId, data: unknown): Step3Result | null {
  const session = sessions.get(sessionId) ?? loadSessionFromDisk(sessionId);
  if (!session?.step3) return null;
  const existing = session.step3.sections[sectionType];
  const source = existing && existing.status === "ok" ? existing.source : "ai-generated";
  session.step3 = {
    ...session.step3,
    sections: { ...session.step3.sections, [sectionType]: { status: "ok", data, source, edited: true } },
  };
  sessions.set(sessionId, session);
  persistSession(sessionId, session);
  return session.step3;
}

/**
 * B6 — wholesale replace of a session's step1/2/3 with an imported draft.
 * Deliberately a full replace, not a field-by-field merge: B7's
 * overwrite-warning is what's responsible for telling the user what's about
 * to be lost *before* this is ever called, so by the time this runs, the
 * replace is exactly what the user already confirmed. Does not create a new
 * session id — imports into whichever session the request already has.
 *
 * `publish` is normalized to `null` when absent (an export produced before
 * B9 existed won't have it — `parseImport` only requires step1/2/3) rather
 * than left as `undefined`, so every later read of `session.publish` can
 * assume the field is always at least present. Per B10 edge case 2: if the
 * imported draft *does* carry a `publish` (it was published from a
 * different machine), that project id travels with it as-is — a republish
 * from here correctly targets that same project, which is exactly the
 * point of storing the id on the session rather than per-machine.
 */
export function replaceSession(sessionId: string, session: WizardSession): void {
  const normalized: WizardSession = { ...session, publish: session.publish ?? null };
  sessions.set(sessionId, normalized);
  persistSession(sessionId, normalized);
}

/** B9/B10 — always resolves through `?? null` so a session file saved before this field existed (or an imported one missing it) never crashes a caller expecting the field to exist. */
export function getPublishResult(sessionId: string): PublishResult | null {
  const session = sessions.get(sessionId) ?? loadSessionFromDisk(sessionId);
  return session?.publish ?? null;
}

/** B9 (first publish) and B10 (republish) both call this after a successful deployment — B10 overwrites the previous entry with the new `lastDeploymentId`/`publishedAt`, keeping the same `projectId`/`alias` since it deployed with `project` set to the existing id. */
export function setPublishResult(sessionId: string, result: PublishResult): void {
  const session = sessions.get(sessionId) ?? loadSessionFromDisk(sessionId) ?? emptySession();
  session.publish = result;
  sessions.set(sessionId, session);
  persistSession(sessionId, session);
}
