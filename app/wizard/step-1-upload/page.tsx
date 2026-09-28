"use client";

// Wizard Step 1 (B4) — structure guide + résumé upload + "Try it with an
// example". Behavior grounded in wizard-phase1-spec-by-example.md B4:
// accepts .docx/.pdf only, 5MB cap (A10), surfaces every extraction warning
// as a friendly message (R5), and the example path runs the identical
// downstream flow as a real upload against the shipped example-resume-
// template fixture (fixtures/example-resume-template.docx).
//
// The structure-guide card above the upload control (added 2026-09-08, per
// Pranay's request) exists because this project's own extraction pipeline
// (src/extract.ts) parses some résumé formats far more cleanly than others
// — confirmed directly by running Pranay's own real résumé through the live
// pipeline: every experience entry came back "(unspecified)" company with
// no date, because its "Title (Company | Dates)" all-in-one-parenthetical
// format isn't one of the shapes extract.ts recognizes, and its lowercase
// "key accomplishments"/"professional development & awards" headers aren't
// recognized synonyms either, so that content silently merged into Summary
// and Education instead of staying separate. None of this content is lost
// (unrecognized text still reaches the model as extra context — see
// buildRequest.ts's formatResumeFactsText), but it does mean skills/
// education/certifications/experience come through emptier and less
// structured than they could. The checklist below and the downloadable
// examples/example-resume-template.docx fixture both reflect the format
// that's actually verified (via a direct parseResumeFile+extractResumeFacts
// run, not guessed) to extract with zero warnings.
//
// 2026-09-22 (Phase 2, B7 trigger 1): re-uploading (or trying the example)
// when this session already has a completed extraction now warns first,
// naming what's at risk downstream, instead of silently overwriting it.
// This requires knowing about existing session state on mount, which this
// page didn't previously fetch (Steps 2/3 already did, for their own
// rehydration needs) — added here for that reason, not as a rehydration
// feature in its own right (Step 1's own upload result still only lives in
// this page's own client state during the session, unchanged).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ExtractionResult } from "@/src/types";
import { ACCEPTED_RESUME_EXTENSIONS, MAX_RESUME_BYTES } from "@/lib/uploadConstraints";
import { WizardSteps } from "@/components/wizard/WizardSteps";
import { ContinueArrow } from "@/components/ContinueArrow";

type ApiSuccess = {
  ok: true;
  source: "upload" | "example";
  sourceFileName: string;
  sourceFormat: "docx" | "pdf";
  hasStructure: boolean;
  facts: ExtractionResult;
  friendlyWarnings: string[];
};

type ApiFailure = { ok: false; code: string; message: string };

type ApiResponse = ApiSuccess | ApiFailure;

type ExistingSession = {
  hasStep1: boolean;
  downstreamSectionCount: number;
};

const ACCEPT_ATTR = ACCEPTED_RESUME_EXTENSIONS.join(",");
const MAX_MB = Math.round(MAX_RESUME_BYTES / (1024 * 1024));

export default function Step1UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiSuccess | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [existing, setExisting] = useState<ExistingSession | null>(null);
  const [pendingAction, setPendingAction] = useState<"upload" | "example" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/wizard/state");
        const data = await response.json();
        if (cancelled) return;
        const downstreamSectionCount = Object.keys(data.step3?.sections ?? {}).length;
        setExisting({ hasStep1: Boolean(data.step1), downstreamSectionCount });
      } catch {
        // Best-effort — if this fails, trigger 1's warning just won't fire;
        // the upload/example actions still work exactly as before.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitToApi(run: () => Promise<Response>) {
    setIsLoading(true);
    setClientError(null);
    setApiError(null);
    setResult(null);
    try {
      const response = await run();
      const data: ApiResponse = await response.json();
      if (data.ok) {
        setResult(data);
        setExisting({ hasStep1: true, downstreamSectionCount: 0 });
      } else {
        setApiError(data.message);
      }
    } catch {
      setApiError("Something went wrong talking to the wizard's local server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function runUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setClientError("Please choose a résumé file first.");
      return;
    }
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ACCEPTED_RESUME_EXTENSIONS.includes(ext as (typeof ACCEPTED_RESUME_EXTENSIONS)[number])) {
      setClientError(`Please upload a Word (${ACCEPT_ATTR}) file.`);
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setClientError(`Please upload a file under ${MAX_MB}MB.`);
      return;
    }
    void submitToApi(() => {
      const formData = new FormData();
      formData.set("resume", file);
      return fetch("/api/wizard/upload", { method: "POST", body: formData });
    });
  }

  function runTryExample() {
    void submitToApi(() => fetch("/api/wizard/example", { method: "POST" }));
  }

  // B7 trigger 1: re-uploading (or trying the example) over an existing
  // extraction warns first, naming what's downstream at risk, rather than
  // silently overwriting it.
  function handleUploadClick() {
    setClientError(null);
    if (existing?.hasStep1 && pendingAction !== "upload") {
      setPendingAction("upload");
      return;
    }
    setPendingAction(null);
    runUpload();
  }

  function handleTryExampleClick() {
    if (existing?.hasStep1 && pendingAction !== "example") {
      setPendingAction("example");
      return;
    }
    setPendingAction(null);
    runTryExample();
  }

  function cancelPendingAction() {
    setPendingAction(null);
  }

  const confirming = pendingAction !== null;

  return (
    <main className="page">
      <WizardSteps current={1} />
      <h1>Step 1 — Upload your résumé</h1>
      <p className="lede">
        Upload a résumé (Word or PDF, under {MAX_MB}MB) and we&apos;ll pull out your experience, skills, and
        education. Not ready to upload your own yet? Try it with an example first.
      </p>

      <div className="card">
        <h2>Get the best results</h2>
        <p className="meta">
          We read your résumé with a set of formatting rules, not a general-purpose AI reader — a few small
          structure choices make a real difference in how completely we can pull out your experience, skills, and
          education:
        </p>
        <ul className="structureChecklist">
          <li>
            Use plain section headings — <strong>Summary</strong>, <strong>Skills</strong>,{" "}
            <strong>Experience</strong>, <strong>Education</strong>, <strong>Certifications</strong> — rather than
            combined or creatively-worded ones like &ldquo;Professional Development &amp; Awards.&rdquo; Headline
            achievements read best folded into your Summary or into the bullets under the job that earned them,
            rather than a separate &ldquo;Key Accomplishments&rdquo; section.
          </li>
          <li>
            For each job, put the job title and company on one line (e.g. &ldquo;Product Manager — Acme Corp&rdquo;),
            then the date range on its own line right below it (e.g. &ldquo;Jan 2022 – Present&rdquo;) — rather than
            combining the title, company, and dates all together in one line.
          </li>
          <li>
            Keep your name, phone, email, location, and links on one clean contact line right under your name —
            leave taglines or quotes out of that line, since we&apos;ll otherwise mistake them for your location.
          </li>
          <li>
            List skills as a plain line separated by commas or &ldquo;|&rdquo; — skip inline labels like
            &ldquo;Technical Skills:&rdquo; glued onto the front of the same line, since we&apos;d otherwise read
            the label itself as one of your skills.
          </li>
        </ul>
        <p className="actions">
          <a href="/example-resume-template.docx" download className="linkButton hasTip" data-tip="A short, fictional résumé (.docx) built to follow every rule above — download it as a concrete reference, or click 'Try it with an example' below to see it run through the wizard directly.">
            Download an example résumé
          </a>
        </p>
      </div>

      <div className="card">
        <div
          className="hasTip"
          data-tip={`A Word (.docx) or PDF résumé, under ${MAX_MB}MB. We only read your career details — name, roles, dates, skills, education — never anything beyond what a portfolio site needs.`}
        >
          <label className="fieldLabel" htmlFor="resume-input">
            Résumé file
            <span className="tipIcon" aria-hidden="true">
              ?
            </span>
          </label>
          <input id="resume-input" ref={fileInputRef} type="file" accept={ACCEPT_ATTR} disabled={isLoading} />
        </div>
        <div className="actions">
          <button type="button" onClick={handleUploadClick} disabled={isLoading}>
            {isLoading
              ? "Processing…"
              : pendingAction === "upload"
                ? "Confirm — replace existing résumé"
                : "Upload résumé"}
          </button>
          <button
            type="button"
            className="secondary hasTip"
            data-tip="Skips the file picker and runs the wizard on the well-structured example résumé above instead — a fast way to see how the rest of the wizard works before uploading your own."
            onClick={handleTryExampleClick}
            disabled={isLoading}
          >
            {isLoading
              ? "Processing…"
              : pendingAction === "example"
                ? "Confirm — replace existing résumé"
                : "Try it with an example"}
          </button>
          {confirming && (
            <button type="button" className="secondary" onClick={cancelPendingAction}>
              Cancel
            </button>
          )}
        </div>

        {confirming && (
          <div className="warnings">
            <p className="warningsTitle">Replace your existing résumé data?</p>
            <p>
              This session already has an extracted résumé.
              {existing && existing.downstreamSectionCount > 0
                ? ` You also have ${existing.downstreamSectionCount} generated/edited section${
                    existing.downstreamSectionCount === 1 ? "" : "s"
                  } in Step 3 that were built from it — those will no longer match the new résumé.`
                : ""}{" "}
              Continuing will replace it. This can&apos;t be undone (unless you&apos;ve exported a copy — see Save /
              Export above).
            </p>
          </div>
        )}

        {clientError && <p className="error">{clientError}</p>}
        {apiError && <p className="error">{apiError}</p>}
      </div>

      {result && <ResultCard result={result} />}
    </main>
  );
}

function ResultCard({ result }: { result: ApiSuccess }) {
  const { facts, friendlyWarnings, sourceFileName, sourceFormat } = result;
  return (
    <div className="card result">
      <h2>We read your résumé{result.source === "example" ? " (example)" : ""}</h2>
      <p className="meta">
        Source: {sourceFileName} ({sourceFormat.toUpperCase()})
      </p>

      {friendlyWarnings.length > 0 && (
        <div className="warnings">
          <p className="warningsTitle">A few things worth double-checking:</p>
          <ul>
            {friendlyWarnings.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <dl className="summary">
        <dt>Name</dt>
        <dd>{facts.name ?? "Not found"}</dd>
        <dt>Headline</dt>
        <dd>{facts.headline ?? "Not found"}</dd>
        <dt>Skills found</dt>
        <dd>{facts.skills.length > 0 ? facts.skills.join(", ") : "None found"}</dd>
        <dt>Experience entries</dt>
        <dd>{facts.experience.length}</dd>
        <dt>Education entries</dt>
        <dd>{facts.education.length > 0 ? facts.education.join("; ") : "None found"}</dd>
      </dl>

      <div className="actions">
        <ContinueArrow />
        <Link href="/wizard/step-2-sections" className="linkButton continueButton">
          Continue to Step 2
        </Link>
      </div>
    </div>
  );
}
