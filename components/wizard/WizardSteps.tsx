"use client";

// Shared step-progress indicator shown at the top of all 4 wizard pages, so
// the user has an expectation of what's coming next instead of wondering
// (Pranay's own framing, 2026-09-07). Purely a "you are here" breadcrumb, not
// a nav control — earlier/later step numbers aren't links, since jumping
// ahead without a résumé uploaded or sections chosen would just bounce back
// via each page's own existing "we're missing something from an earlier
// step" guard; a stepper that looked clickable but usually wasn't would be
// more confusing than no stepper at all.
//
// 2026-09-27 (Phase 2, B8): added step 4 ("Connect Vercel"). Unlike steps
// 2/3, step 4's own page deliberately has no "missing something from an
// earlier step" guard — connecting a Vercel account has no dependency on
// résumé/section data, so there's nothing to bounce back to.
//
// 2026-09-22 (Phase 2, B5/B6/B7): also carries the Save/Export and Import
// controls, since they need to be reachable from every wizard step, not just
// one of them (B5: "any step, once any progress exists"). Putting them here
// — rather than duplicating the same markup/logic into all 3 step pages —
// keeps the change to one file.
//
// 2026-09-28 (Phase 3 scoping): a completed ("done") step is now a real
// link back to that step's page — the header comment above described why
// that used to be unsafe (jumping *forward* without prerequisite data just
// bounces back), but that reasoning only ever applied to jumping forward.
// Jumping backward to a step you've already done has no such risk, and this
// was the actual "navigation isn't straightforward" complaint (2026-09-28
// discussion) — see wizard-phase3-landing-and-navigation-scope.md. This
// works safely with zero awareness of any other page's state because
// Step 2 and Step 3 were separately changed the same day to autosave every
// field immediately (debounced ~800ms, flushed on unmount) — there's
// nothing left to lose by navigating away, so this component doesn't need
// to know anything about "unsaved changes" to do this safely. The toolbar
// below is also visually muted this same round, since it was flagged as
// competing with the stepper for attention from Step 1 onward.
//
// B7 trigger 4 needs to know, at the moment a file is chosen, whether this
// session currently has any progress to lose. An earlier version of this
// component fetched that once on mount into React state and read it back in
// `handleFileChosen` — that has a real race: a fast click (or a slow initial
// fetch) can run before the mount-time fetch resolves, so the check reads a
// still-null `session` and silently skips the warning. Caught by an actual
// end-to-end run, not by inspection. Fixed by fetching fresh, on demand,
// inside `handleFileChosen` itself — one extra request per import attempt,
// but a correct one every time, on a local single-user dev server where
// that request is negligible.
import Link from "next/link";
import { useRef, useState } from "react";
import { hasAnyProgress } from "@/lib/wizard-export";
import type { WizardSession } from "@/lib/wizard-state";

const STEPS = [
  { number: 1, label: "Upload résumé", href: "/wizard/step-1-upload" },
  { number: 2, label: "Sections & photo", href: "/wizard/step-2-sections" },
  { number: 3, label: "Generate Draft", href: "/wizard/step-3-generate" },
  { number: 4, label: "Connect Vercel", href: "/wizard/step-4-publish" },
] as const;

type ImportOutcome = { kind: "error"; message: string } | { kind: "confirm"; fileText: string } | null;

export function WizardSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importOutcome, setImportOutcome] = useState<ImportOutcome>(null);

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-choosing the same file after an error
    if (!file) return;

    const fileText = await file.text();

    // B7 golden example 4 / edge case 3: only warn when this session already
    // has unsaved progress to lose — an empty session has nothing to protect.
    // Fetched fresh right here (see header comment) rather than from state
    // set at mount time.
    let currentSession: WizardSession | null = null;
    try {
      const response = await fetch("/api/wizard/state");
      const data = await response.json();
      currentSession = {
        step1: data.step1 ?? null,
        step2: data.step2 ?? null,
        step3: data.step3 ?? null,
        publish: data.publish ?? null,
      };
    } catch {
      // If we can't even tell whether there's progress to lose, the safer
      // default is to warn anyway rather than silently import over
      // something we couldn't check.
      setImportOutcome({ kind: "confirm", fileText });
      return;
    }

    if (hasAnyProgress(currentSession)) {
      setImportOutcome({ kind: "confirm", fileText });
      return;
    }
    void runImport(fileText);
  }

  async function runImport(fileText: string) {
    setImportBusy(true);
    setImportOutcome(null);
    try {
      const response = await fetch("/api/wizard/import", { method: "POST", body: fileText });
      const data = await response.json();
      if (!data.ok) {
        setImportOutcome({ kind: "error", message: data.message ?? "That file couldn't be imported." });
        return;
      }
      // Every wizard page rehydrates its own state from the server on load
      // (the same pattern each step page already uses for a browser
      // refresh), so a full reload is enough to reflect the imported draft
      // everywhere — no page-specific plumbing needed here.
      window.location.reload();
    } catch {
      setImportOutcome({ kind: "error", message: "Something went wrong talking to the wizard's local server. Please try again." });
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div>
      <ol className="wizardSteps" aria-label="Wizard progress">
        {STEPS.map((step, index) => {
          const status = step.number === current ? "current" : step.number < current ? "done" : "upcoming";
          const content = (
            <>
              <span className="wizardStepNumber">{status === "done" ? "✓" : step.number}</span>
              <span className="wizardStepLabel">{step.label}</span>
            </>
          );
          return (
            <li
              key={step.number}
              className={`wizardStep wizardStep-${status}`}
              aria-current={status === "current" ? "step" : undefined}
            >
              {status === "done" ? (
                <Link href={step.href} className="wizardStepLink">
                  {content}
                </Link>
              ) : (
                content
              )}
              {index < STEPS.length - 1 && <span className="wizardStepConnector" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div className="wizardToolbar wizardToolbarMuted">
        {/* 2026-09-28 — the standalone "Help" button here was removed: it
            duplicated the "Help" link now permanently in the sticky site
            header (see app/layout.tsx), which is reachable from every page,
            not just the 3 wizard steps this toolbar renders on. */}
        <a href="/api/wizard/export" download className="linkButton small hasTip" data-tip="Downloads a JSON file with your progress so far — résumé facts, chosen sections, and any generated/edited content. Never includes your AI provider key or Vercel token; those stay only on this computer.">
          Save / Export
        </a>
        <button type="button" className="secondary small" onClick={handleImportClick} disabled={importBusy}>
          {importBusy ? "Importing…" : "Import a saved draft"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChosen}
          style={{ display: "none" }}
        />
      </div>

      {importOutcome?.kind === "error" && <p className="error">{importOutcome.message}</p>}

      {importOutcome?.kind === "confirm" && (
        <div className="warnings">
          <p className="warningsTitle">Replace your current in-progress work?</p>
          <p>
            You have unsaved progress in this session. Importing this draft will replace it — anything not already
            exported will be lost. This can&apos;t be undone.
          </p>
          <div className="actions">
            <button type="button" onClick={() => void runImport(importOutcome.fileText)} disabled={importBusy}>
              {importBusy ? "Importing…" : "Confirm — replace with imported draft"}
            </button>
            <button type="button" className="secondary" onClick={() => setImportOutcome(null)} disabled={importBusy}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
