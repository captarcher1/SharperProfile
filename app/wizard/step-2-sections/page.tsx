"use client";

// Wizard Step 2 (B3 + A1) — section type selection + headshot upload/skip.
// Behavior grounded in wizard-phase1-spec-by-example.md B3: JPEG/PNG/WebP
// only, 5MB cap (A7), preview via the exact center-crop CSS Track B's own
// Hero.tsx uses in production (golden example 1's "what you see is what
// gets published" requirement), skip is a fully supported non-error path
// (failure case 3). Section picker offers all 9 real Track B section types
// (A1), each labeled with whether Track A's B1 pipeline actually generates
// it with AI or auto-fills it deterministically (per the 2026-09-06
// 9-vs-5 scope-gap resolution) — never presented as if all 9 behave the same.
//
// 2026-09-22 (Phase 2, B7 trigger 2): deselecting a section that already has
// generated/edited content warns first and names the specific section at
// risk — this also means this page fetches Step 3's state on mount
// (previously it only pulled Step 1/2), purely to know what would be lost,
// not to display or edit it here.
//
// 2026-09-28 (Phase 3 scoping): section selection and the download-button
// toggle used to persist only when "Continue to Step 3" was clicked — so
// the new stepper's backward-navigation links (WizardSteps.tsx) could have
// silently discarded an unsaved checkbox change. Fixed by persisting each
// toggle immediately instead (matching how the headshot upload already
// worked). That retiming means B7 trigger 2's warning has to move too: it
// used to fire once, at Continue, after every checkbox change had already
// piled up; now it fires immediately, per-toggle, *before* a content-losing
// uncheck is actually saved — see `toggleSection`/`pendingDrop` below. A
// cancel just re-checks the box; nothing was ever sent to the server.
//
// Two more races this introduced, both closed below: (1) each toggle now
// fires its own independent POST rather than one single awaited save at
// Continue-time, so two toggled in quick succession could reach the server
// out of order — `persistQueueRef` chains every call after the previous one
// resolves, so sends and completions stay in the same order. (2) "Continue
// to Step 3" no longer has anything of its own to save, but Step 3's very
// first load reads state fresh from the server (`/api/wizard/state`) — if
// the last toggle's request hadn't landed yet, Step 3 could read stale
// data. `handleContinue` awaits the same queue before navigating, so this
// is only ever a wait of however long the last request actually takes
// (typically well under 50ms on a local dev server), never a visible
// "saving..." step from the user's point of view.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SECTION_TYPES, type SectionTypeId } from "@/lib/sectionTypes";
import { WizardSteps } from "@/components/wizard/WizardSteps";
import { ContinueArrow } from "@/components/ContinueArrow";

type Step1State = { sourceFileName: string; source: "upload" | "example" } | null;

type HeadshotState = { dataUrl: string; mimeType: string; fileName: string } | null;

const SECTION_LABEL_BY_ID = new Map(SECTION_TYPES.map((s) => [s.id, s.label]));

export default function Step2SectionsPage() {
  const [loadingState, setLoadingState] = useState(true);
  const [step1, setStep1] = useState<Step1State>(null);
  const [selected, setSelected] = useState<Set<SectionTypeId>>(
    () => new Set(SECTION_TYPES.filter((s) => s.defaultSelected).map((s) => s.id))
  );
  const [headshot, setHeadshot] = useState<HeadshotState>(null);
  const [includeDownloadButton, setIncludeDownloadButton] = useState(false);
  const [headshotError, setHeadshotError] = useState<string | null>(null);
  const [headshotBusy, setHeadshotBusy] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [sectionsWithContent, setSectionsWithContent] = useState<Set<SectionTypeId>>(new Set());
  /** The single section currently awaiting a drop-confirmation — at most one at a time, since each toggle now persists (or, for a content-losing uncheck, pauses for confirmation) immediately rather than batching until Continue. */
  const [pendingDrop, setPendingDrop] = useState<SectionTypeId | null>(null);
  /** Chains every persistSections call after the previous one resolves — see the file header comment for the ordering race this closes. */
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Rehydrate from server session state on load — this is a real page
  // navigation from Step 1, not shared in-memory React state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/wizard/state");
        const data = await response.json();
        if (cancelled) return;
        setStep1(data.step1 ? { sourceFileName: data.step1.sourceFileName, source: data.step1.source } : null);
        if (data.step2?.selectedSectionTypes?.length) {
          setSelected(new Set(data.step2.selectedSectionTypes as SectionTypeId[]));
        }
        if (data.step2?.headshot) {
          setHeadshot(data.step2.headshot);
        }
        setIncludeDownloadButton(Boolean(data.step2?.includeDownloadButton));
        const withContent = Object.entries(data.step3?.sections ?? {})
          .filter(([, result]) => (result as { status?: string } | undefined)?.status === "ok")
          .map(([sectionType]) => sectionType as SectionTypeId);
        setSectionsWithContent(new Set(withContent));
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Persists the current selection + download-button choice immediately — called after every toggle (or its confirmation), never batched until Continue. Queued (see persistQueueRef) so overlapping calls always land in the order they were made. */
  function persistSections(sectionTypes: Set<SectionTypeId>, download: boolean): Promise<void> {
    const run = async () => {
      setSaveNote(null);
      try {
        const response = await fetch("/api/wizard/sections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionTypes: Array.from(sectionTypes), includeDownloadButton: download }),
        });
        const data = await response.json();
        if (!data.ok) {
          setSaveNote(data.message ?? "Something went wrong saving your selection.");
        }
      } catch {
        setSaveNote("Something went wrong saving your selection. Please try again.");
      }
    };
    const next = persistQueueRef.current.then(run, run);
    persistQueueRef.current = next;
    return next;
  }

  // B7 trigger 2: unchecking a section that already has generated/edited
  // content warns first and names exactly what's at risk — now at the
  // moment of the toggle itself (see file header), not deferred to
  // Continue. The checkbox updates immediately either way (so it never
  // feels unresponsive); only the *persist* waits on confirmation when
  // content is actually at stake.
  function toggleSection(id: SectionTypeId) {
    setSaveNote(null);
    const isCurrentlySelected = selected.has(id);

    if (isCurrentlySelected && sectionsWithContent.has(id)) {
      const next = new Set(selected);
      next.delete(id);
      setSelected(next);
      setPendingDrop(id);
      return;
    }

    const next = new Set(selected);
    if (isCurrentlySelected) next.delete(id);
    else next.add(id);
    setSelected(next);
    setPendingDrop(null);
    void persistSections(next, includeDownloadButton);
  }

  function confirmDrop() {
    if (pendingDrop === null) return;
    setPendingDrop(null);
    void persistSections(selected, includeDownloadButton);
  }

  function cancelDrop() {
    if (pendingDrop === null) return;
    const restored = new Set(selected);
    restored.add(pendingDrop);
    setSelected(restored);
    setPendingDrop(null);
  }

  function handleDownloadToggleChange(checked: boolean) {
    setIncludeDownloadButton(checked);
    void persistSections(selected, checked);
  }

  /** Everything here already autosaves — this only needs to make sure the most recent toggle has actually landed on the server before Step 3 does its own fresh read, which is what persistQueueRef is for. Not a user-visible "saving" step in practice: the wait is however long the last request takes, typically well under 50ms locally. */
  async function handleContinue() {
    if (selected.size === 0) return;
    await persistQueueRef.current;
    window.location.href = "/wizard/step-3-generate";
  }

  async function handleHeadshotChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file after an error
    if (!file) return;

    setHeadshotError(null);
    setHeadshotBusy(true);
    try {
      const formData = new FormData();
      formData.set("headshot", file);
      const response = await fetch("/api/wizard/headshot", { method: "POST", body: formData });
      const data = await response.json();
      if (data.ok) {
        setHeadshot(data.headshot);
      } else {
        setHeadshotError(data.message);
      }
    } catch {
      setHeadshotError("Something went wrong uploading that photo. Please try again.");
    } finally {
      setHeadshotBusy(false);
    }
  }

  async function handleRemoveHeadshot() {
    setHeadshotBusy(true);
    setHeadshotError(null);
    try {
      const response = await fetch("/api/wizard/headshot", { method: "DELETE" });
      const data = await response.json();
      setHeadshot(data.headshot ?? null);
    } finally {
      setHeadshotBusy(false);
    }
  }

  if (loadingState) {
    return (
      <main className="page">
        <WizardSteps current={2} />
        <p>Loading…</p>
      </main>
    );
  }

  if (!step1) {
    return (
      <main className="page">
        <WizardSteps current={2} />
        <h1>Step 2 — Sections & photo</h1>
        <div className="card">
          <p>We&apos;re missing something from an earlier step.</p>
          <p className="nextStepNote">
            <Link href="/wizard/step-1-upload">Go back to Step 1 to upload a résumé first.</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <WizardSteps current={2} />
      <h1>Step 2 — Sections & photo</h1>
      <p className="lede">
        Continuing from {step1.source === "example" ? "the example résumé" : step1.sourceFileName}. Choose which
        sections your site should include, and optionally add a headshot for the Hero section. Every choice here
        saves automatically — there&apos;s nothing separate to save before moving on.
      </p>

      <div className="card">
        <h2>Sections</h2>
        <p className="meta">
          &ldquo;AI-written&rdquo; sections are generated from your résumé in Step 3. &ldquo;Auto-filled&rdquo;
          sections are built directly from what you&apos;ve already provided — we never let AI invent numbers,
          logos, or credentials.
        </p>
        <ul className="sectionList">
          {SECTION_TYPES.map((section) => (
            <li key={section.id} className="sectionRow">
              <label
                className="sectionLabel hasTip"
                data-tip={`${section.description} Check the box to include this section on your generated site — uncheck to leave it out entirely.`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(section.id)}
                  onChange={() => toggleSection(section.id)}
                />
                <span className="sectionText">
                  <span className="sectionTitleRow">
                    <span className="sectionTitle">
                      {section.label}
                      <span className="tipIcon" aria-hidden="true">
                        ?
                      </span>
                    </span>
                    <span className={`badge ${section.contentSource === "ai-generated" ? "badgeAi" : "badgeAuto"}`}>
                      {section.contentSource === "ai-generated" ? "AI-written" : "Auto-filled"}
                    </span>
                  </span>
                  <span className="sectionDescription">{section.description}</span>
                </span>
              </label>
              {pendingDrop === section.id && (
                <div className="warnings">
                  <p className="warningsTitle">This will leave existing content behind</p>
                  <p>
                    <strong>{SECTION_LABEL_BY_ID.get(section.id) ?? section.id}</strong> already has generated or
                    edited content. Unchecking it means that content won&apos;t be part of your generated site —
                    this can&apos;t be undone (unless you&apos;ve exported a copy — see Save / Export above).
                  </p>
                  <div className="actions">
                    <button type="button" onClick={confirmDrop}>
                      Confirm — uncheck it
                    </button>
                    <button type="button" className="secondary" onClick={cancelDrop}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Headshot (optional)</h2>
        <p className="meta">JPEG, PNG, or WebP, under 5MB. No cropping tool — this preview is exactly how it will look.</p>

        <div className="headshotRow">
          <div className="headshotPreview">
            {headshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headshot.dataUrl} alt="Headshot preview" className="headshotImg" />
            ) : (
              <span className="headshotPlaceholder">No photo</span>
            )}
          </div>
          <div className="headshotControls">
            <div
              className="hasTip"
              data-tip="JPEG, PNG, or WebP, under 5MB. This is the photo shown in your site's Hero section, cropped and shown exactly as previewed here — there's no separate cropping tool, so what you see is what gets published."
            >
              <label className="fieldLabel" htmlFor="headshot-input">
                {headshot ? "Replace photo" : "Upload a photo"}
                <span className="tipIcon" aria-hidden="true">
                  ?
                </span>
              </label>
              <input
                id="headshot-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={headshotBusy}
                onChange={handleHeadshotChange}
              />
            </div>
            {headshot && (
              <button type="button" className="secondary" onClick={handleRemoveHeadshot} disabled={headshotBusy}>
                Remove photo
              </button>
            )}
            {headshotError && <p className="error">{headshotError}</p>}
            {!headshot && !headshotError && (
              <p className="meta">No photo? Your site will show your initials instead.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Download button (optional)</h2>
        <p className="meta">
          Adds a &ldquo;Download as Word / PDF&rdquo; button to your published site, so a visitor can save your
          profile as a document. Built from the same content as your site — nothing extra to fill in.
        </p>
        <label className="checkboxRow">
          <input
            type="checkbox"
            checked={includeDownloadButton}
            onChange={(event) => handleDownloadToggleChange(event.target.checked)}
          />
          Include a download button on my published site
        </label>
      </div>

      <div className="actions">
        <Link href="/wizard/step-1-upload" className="linkButton">
          Back
        </Link>
        <ContinueArrow />
        <button type="button" className="continueButton" onClick={handleContinue} disabled={selected.size === 0}>
          Continue to Step 3
        </button>
      </div>
      {selected.size === 0 && <p className="error">Choose at least one section to continue.</p>}
      {saveNote && <p className="nextStepNote">{saveNote}</p>}
    </main>
  );
}
