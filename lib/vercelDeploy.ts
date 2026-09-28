// B9 (first publish) / B10 (republish) — assembles a deployment payload for
// Vercel's non-git `POST /v13/deployments` and calls it.
//
// D3 correction (2026-09-27): the spec's D3 entry claimed a "live-template-
// tarball-fetch mechanism" for Track B already existed and just needed
// re-plumbing into a Vercel payload. Direct investigation this session found
// that mechanism was never actually built — it was only ever designed
// (ux-wizard-and-provider-config-plan.md A8/A9, under the pre-2026-09-13
// GitHub-push architecture) and became moot before it was written. Its
// design was still sound though: A8 specified fetching Track B's template
// live from its public GitHub repo at publish time, and that was re-verified
// live this session (a real fetch against
// codeload.github.com/captarcher1/portfolio-website/tar.gz/main succeeded,
// 74KB, correct file layout). Given the choice between that live-fetch
// design and vendoring a local copy, Pranay chose to vendor — see the
// `template/` directory at the repo root, a point-in-time copy of Track B's
// deployable files (everything except `.github/`, `.gitignore`,
// `.env.example`, and top-level docs, which aren't needed to build or run
// the site). Trade-off, disclosed per A8's own reasoning: this can drift
// from Track B's real repo over time and needs a manual re-sync
// (re-running the same fetch-and-copy this session did) if Track B changes
// — the live-fetch alternative would have avoided that at the cost of a new
// runtime dependency on GitHub being reachable at every publish.
//
// D1's confirmed request/response shape (PROJECT-STATE.md §7, 2026-09-27
// live test) drives every choice below: `skipAutoDetectionConfirmation=1`
// (a new project has no projectSettings yet), `files` as base64-inlined
// entries, and reading the stable link from `alias`/`automaticAliases` —
// never the per-deployment `url`, which carries a random build-specific
// suffix that changes on every republish.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { PublishResult, Step2Headshot, WizardSession } from "@/lib/wizard-state";
import { SECTION_TYPES, type SectionTypeId } from "@/lib/sectionTypes";

const TEMPLATE_DIR = path.join(process.cwd(), "template");
const VERCEL_API_BASE = "https://api.vercel.com";

// Nav-visible section types get a heading/navLabel; hero/metrics/contactForm
// deliberately don't (matches template/config/site.example.ts's own
// convention: Navbar.tsx only links a section that has a `navLabel` set).
// Reuses the wizard's own already-user-facing Step 2 copy (SECTION_TYPES'
// `label`) rather than inventing new headline copy — a disclosed, build-time
// choice (same pattern as OQ-P2-3's copy being "resolved at build time"),
// worth a look once this ships rather than something to block on.
const SECTION_HEADINGS: Partial<Record<SectionTypeId, { heading: string; navLabel: string }>> = {
  cardGrid: { heading: "Featured Work", navLabel: "Work" },
  processSteps: { heading: "How I Work", navLabel: "Approach" },
  topicGrid: { heading: "Topics & Interests", navLabel: "Topics" },
  logoCredentials: { heading: "Certifications & Credentials", navLabel: "Certifications" },
  chipGroups: { heading: "Skills", navLabel: "Skills" },
  textAndTimeline: { heading: "About", navLabel: "About" },
};

const EXT_BY_MIME: Record<Step2Headshot["mimeType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// This is a wizard-side safety circuit breaker, NOT a documented Vercel
// limit — no live source gave one for inlining files in the create-
// deployment request body (checked Vercel's REST API docs directly; only
// the unrelated 4.5MB *hosted serverless function* body limit turned up,
// which doesn't apply to calling Vercel's own management API from here).
// Chosen generously above the realistic worst case (a 5MB headshot,
// B3's own existing cap, plus ~450KB of vendored template source) so it
// should never trip in practice; it exists so an unexpectedly huge payload
// fails with a clear, specific message instead of an opaque Vercel error.
// Flagging this as unverified rather than presenting it as a real limit —
// worth a live test with an oversized payload the same way D1/D4 were
// verified, if that ever seems worth doing.
const PAYLOAD_SIZE_WARNING_BYTES = 20 * 1024 * 1024; // 20MB

type DeploymentFile = { file: string; data: string; encoding: "base64" };

function listTemplateFiles(): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry === ".DS_Store") continue;
      const abs = path.join(dir, entry);
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
      } else if (stat.isFile()) {
        results.push(abs);
      }
    }
  }
  walk(TEMPLATE_DIR);
  return results;
}

/**
 * Builds `config/site.ts`'s full source text from the wizard's own session
 * state — never anything the user didn't provide or generate. Emits the
 * config object as `JSON.stringify(..., null, 2)` passed straight into
 * `defineSiteConfig(...)`: valid JSON is valid TS object-literal syntax, so
 * this sidesteps any manual string-escaping bugs, and `defineSiteConfig`'s
 * own zod validation (config/types.ts) is a real safety net — if this
 * function ever produces a shape mismatch, the site's own build fails
 * loudly with a specific zod error instead of silently deploying something
 * broken.
 */
export function buildSiteConfigSource(session: WizardSession): string {
  const facts = session.step1?.facts;
  const name = facts?.name?.trim() || "Portfolio";
  const role = facts?.headline?.trim() ?? "";
  const email = facts?.contact?.email ?? null;

  const headshotExt = session.step2?.headshot ? EXT_BY_MIME[session.step2.headshot.mimeType] : null;

  const selectedOrder = session.step2?.selectedSectionTypes ?? [];
  const sections = selectedOrder
    .map((type) => {
      const result = session.step3?.sections?.[type];
      if (!result || result.status !== "ok") return null; // Skip anything that never validated — never publish invalid/insufficient-evidence content silently.
      const headed = SECTION_HEADINGS[type];
      return {
        id: type,
        ...(headed ? { heading: headed.heading, navLabel: headed.navLabel } : {}),
        enabled: true,
        type,
        data: result.data,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const siteConfig = {
    name,
    role,
    ...(headshotExt ? { headshot: `/images/headshot.${headshotExt}` } : {}),
    metaTitle: role ? `${name} | ${role}` : `${name} | Portfolio`,
    metaDescription: facts?.summary?.trim() || `${name}'s professional portfolio.`,
    social: { ...(email ? { email } : {}) },
    // 2026-09-27 — Step 2's opt-in "Download as Word/PDF" toggle. Defaults to
    // false via the same `?? false` normalization currentStep2() already
    // uses, so a draft saved before this toggle existed publishes with the
    // button off rather than crashing on a missing field.
    downloadEnabled: session.step2?.includeDownloadButton ?? false,
    sections,
  };

  return [
    "// Generated by the portfolio wizard's publish step (B9/B10) — every field here",
    "// traces to what the wizard's own Step 1-3 actually produced, nothing invented.",
    "// Regenerated fresh on every publish; don't hand-edit this on Vercel directly,",
    "// since the next republish from the wizard will overwrite it.",
    'import { defineSiteConfig } from "./types";',
    "",
    `export const config = defineSiteConfig(${JSON.stringify(siteConfig, null, 2)});`,
    "",
  ].join("\n");
}

export type AssembleResult =
  | { ok: true; files: DeploymentFile[]; totalBytes: number }
  | { ok: false; reason: "too_large"; totalBytes: number; limitBytes: number };

/** Reads every vendored template file plus the freshly-generated `config/site.ts` and (if present) the headshot, all base64-inlined per D1's confirmed request shape. */
export function assembleDeploymentFiles(session: WizardSession): AssembleResult {
  const files: DeploymentFile[] = [];
  let totalBytes = 0;

  for (const absPath of listTemplateFiles()) {
    const relPath = path.relative(TEMPLATE_DIR, absPath).split(path.sep).join("/");
    if (relPath === "config/site.example.ts") continue; // superseded by the generated config/site.ts below
    const buf = readFileSync(absPath);
    totalBytes += buf.length;
    files.push({ file: relPath, data: buf.toString("base64"), encoding: "base64" });
  }

  const siteConfigSource = buildSiteConfigSource(session);
  const siteConfigBuf = Buffer.from(siteConfigSource, "utf8");
  totalBytes += siteConfigBuf.length;
  files.push({ file: "config/site.ts", data: siteConfigBuf.toString("base64"), encoding: "base64" });

  const headshot = session.step2?.headshot;
  if (headshot) {
    const ext = EXT_BY_MIME[headshot.mimeType];
    const base64Data = headshot.dataUrl.slice(headshot.dataUrl.indexOf(",") + 1);
    const bytes = Buffer.byteLength(base64Data, "base64");
    totalBytes += bytes;
    files.push({ file: `public/images/headshot.${ext}`, data: base64Data, encoding: "base64" });
  }

  if (totalBytes > PAYLOAD_SIZE_WARNING_BYTES) {
    return { ok: false, reason: "too_large", totalBytes, limitBytes: PAYLOAD_SIZE_WARNING_BYTES };
  }

  return { ok: true, files, totalBytes };
}

/** Vercel project names must be a URL-safe slug — derived from the person's own name, never invented. Vercel's own documented max isn't something I found stated as a hard number either; 40 chars is a conservative wizard-side cap, not a cited Vercel limit. */
export function slugifyProjectName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = slug || "my-portfolio";
  return base.slice(0, 40).replace(/-+$/g, "") || "my-portfolio";
}

export type PublishOutcome =
  | { status: "ok"; projectId: string; projectName: string; alias: string; deploymentId: string }
  | { status: "rejected"; message: string }
  | { status: "unconfirmed"; message: string }
  | { status: "too_large"; message: string };

type DeploymentApiResponse = {
  id?: string;
  readyState?: string;
  url?: string;
  alias?: string[];
  automaticAliases?: string[];
  aliasAssigned?: boolean;
  errorMessage?: string | null;
  errorCode?: string;
  project?: { id?: string; name?: string };
  projectId?: string;
  name?: string;
  error?: { code?: string; message?: string };
};

const TERMINAL_STATES = new Set(["READY", "ERROR", "CANCELED", "BLOCKED"]);

async function fetchDeployment(token: string, id: string): Promise<DeploymentApiResponse | null> {
  try {
    const res = await fetch(`${VERCEL_API_BASE}/v13/deployments/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as DeploymentApiResponse;
  } catch {
    return null;
  }
}

function resolveAlias(data: DeploymentApiResponse): string | null {
  if (data.alias && data.alias.length > 0) return data.alias[0];
  if (data.automaticAliases && data.automaticAliases.length > 0) return data.automaticAliases[0];
  return null;
}

/**
 * Publishes (or republishes, when `existingProjectId` is set) to Vercel.
 *
 * Failure-case handling (B9/B10 spec, §"Failure cases"):
 * - A definitive rejection from Vercel (4xx/5xx with a clear body) surfaces
 *   Vercel's own message, mirroring B1 failure case 1's pattern — never a
 *   generic "something went wrong."
 * - A network failure, or a deployment that hasn't reached a terminal
 *   readyState after polling, returns "unconfirmed" rather than assuming
 *   either success or failure — the caller must show the spec's required
 *   "couldn't confirm — check your Vercel dashboard before retrying"
 *   message, since blindly retrying a possibly-succeeded deployment risks a
 *   duplicate.
 */
export async function publishToVercel(params: {
  token: string;
  projectSlugSeed: string;
  files: DeploymentFile[];
  existingProjectId: string | null;
}): Promise<PublishOutcome> {
  const { token, projectSlugSeed, files, existingProjectId } = params;
  const projectName = existingProjectId ? undefined : slugifyProjectName(projectSlugSeed);

  const body: Record<string, unknown> = {
    name: projectName ?? "portfolio-site",
    files,
    target: "production",
  };
  if (existingProjectId) {
    body.project = existingProjectId;
  } else {
    // Required for a project's first deployment (D1's confirmed finding) —
    // omitted on republish since Vercel already has settings saved for an
    // existing project.
    body.projectSettings = {};
  }

  let response: Response;
  try {
    response = await fetch(`${VERCEL_API_BASE}/v13/deployments?skipAutoDetectionConfirmation=1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      status: "unconfirmed",
      message:
        "Couldn't confirm whether this published — the request to Vercel failed before we got a response. Check your Vercel dashboard before retrying, since retrying a possibly-succeeded deployment risks creating a duplicate.",
    };
  }

  let data: DeploymentApiResponse;
  try {
    data = (await response.json()) as DeploymentApiResponse;
  } catch {
    return {
      status: "unconfirmed",
      message:
        "Vercel responded, but with something this wizard couldn't parse. Check your Vercel dashboard before retrying.",
    };
  }

  if (!response.ok) {
    const message = data.error?.message || data.errorMessage || `Vercel rejected the deployment (HTTP ${response.status}).`;
    return { status: "rejected", message };
  }

  let deploymentId = data.id;
  let readyState = data.readyState;
  let current = data;

  // Poll until a terminal state, capped so a stuck build doesn't hang the
  // request indefinitely — 15 tries * 2s = 30s, generous for a small static
  // Next.js site, deliberately not open-ended.
  for (let i = 0; i < 15 && deploymentId && readyState && !TERMINAL_STATES.has(readyState); i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const polled = await fetchDeployment(token, deploymentId);
    if (!polled) continue;
    current = polled;
    readyState = polled.readyState;
  }

  if (!deploymentId || !readyState) {
    return {
      status: "unconfirmed",
      message: "Vercel accepted the request but didn't return a deployment id/status to confirm it. Check your Vercel dashboard before retrying.",
    };
  }

  if (readyState === "ERROR" || readyState === "CANCELED" || readyState === "BLOCKED") {
    return {
      status: "rejected",
      message: current.errorMessage || `Vercel reported this deployment as ${readyState.toLowerCase()}.`,
    };
  }

  if (readyState !== "READY") {
    return {
      status: "unconfirmed",
      message: `Still ${readyState.toLowerCase()} after 30 seconds of checking — this can happen on a slower build. Check your Vercel dashboard for the current status before retrying.`,
    };
  }

  const alias = resolveAlias(current);
  const resolvedProjectId = current.projectId ?? current.project?.id ?? existingProjectId;
  if (!alias || !resolvedProjectId) {
    return {
      status: "unconfirmed",
      message: "Vercel reported this deployment as ready, but didn't return the project id/alias this wizard needs to show your live link. Check your Vercel dashboard directly.",
    };
  }

  return {
    status: "ok",
    projectId: resolvedProjectId,
    projectName: current.project?.name ?? current.name ?? projectName ?? resolvedProjectId,
    alias,
    deploymentId,
  };
}

export function toPublishResult(outcome: Extract<PublishOutcome, { status: "ok" }>): PublishResult {
  return {
    projectId: outcome.projectId,
    projectName: outcome.projectName,
    alias: outcome.alias,
    lastDeploymentId: outcome.deploymentId,
    publishedAt: Date.now(),
    target: "production",
  };
}
