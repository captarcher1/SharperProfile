"use client";

// Wizard Step 3 (B2 credentials + B1 generate). Behavior grounded in
// wizard-phase1-spec-by-example.md: B2's paste-to-.env.local flow (A6, no
// live key verification at save — A8) and B1's whole-batch generate (A9),
// with the 4 auto-filled section types (per the 2026-09-06 scope
// resolution) needing no provider at all.
//
// The review/edit screen renders a real, per-type form for each of the 9
// section shapes (components/wizard/sectionForms/) — not a JSON editor.
// Every save still goes through the same PATCH /api/wizard/content route,
// which re-validates against Track B's real schema (D2) before accepting
// it, so a polished form is a UX improvement on top of the same safety net,
// not a replacement for it.
//
// 2026-09-28 (Phase 3 scoping): per-section edits used to require an
// explicit "Save changes" click, with a separate "Discard changes" to
// revert an unsaved edit back to the last-saved value. Replaced with
// autosave (debounced ~800ms after the last keystroke) so the new
// stepper's backward-navigation links (WizardSteps.tsx) never have to
// reason about whether this page has unsaved work — there no longer is
// any, beyond a sub-second window. Real trade-off, disclosed rather than
// silently dropped: there's no more "discard my edit back to what the AI
// wrote" safety net — a "revert to AI-generated" action was flagged to
// Pranay as an optional future addition (would need a new field to keep
// the original AI output around after an edit overwrites `data`), not yet
// requested, not built here.
//
// The debounce window itself is a real, small residual risk (a keystroke
// followed instantly by leaving the page can still race the timer) — closed
// for every navigation *on this page* (Back, Continue to Step 4, and the
// stepper's new backward links) by flushing any pending save immediately on
// unmount, since every one of those is a Next <Link> client-side navigation
// (the component actually unmounts, the tab/JS context doesn't reload) —
// see the cleanup effect below. This page deliberately never navigates via
// `window.location`, which would race this a full page reload can't recover
// from.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProviderName } from "@/src/providers";
import { SECTION_TYPES, type SectionTypeId } from "@/lib/sectionTypes";
import { SECTION_DATA_TEMPLATE } from "@/lib/sectionDataTemplates";
import { SectionForm, coerceSectionData } from "@/components/wizard/sectionForms";
import { WizardSteps } from "@/components/wizard/WizardSteps";
import { ContinueArrow } from "@/components/ContinueArrow";

const SECTION_META = new Map(SECTION_TYPES.map((s) => [s.id, s]));

const AUTOSAVE_DEBOUNCE_MS = 800; // A reasonable default, not confirmed with Pranay — easy to retune.

type ProviderModelField = {
  envVar: string;
  label: string;
  placeholder: string;
  helpText: string;
};

type ProviderStatus = {
  id: ProviderName;
  label: string;
  fieldKind: "apiKey" | "baseUrl";
  fieldLabel: string;
  placeholder: string;
  helpText: string;
  configured: boolean;
  reason: string;
  /** Currently only Ollama has this — a plain paste-the-model-name field, since this project can't know in advance which model tag a given user has pulled locally (see lib/providerConfig.ts). */
  modelField?: ProviderModelField;
  /** The model's currently-saved value (from GET), pre-filled into modelDrafts below. Not a secret, so unlike credentialDrafts this is safe to echo back. */
  model?: string;
};

type SectionResult =
  | { status: "ok"; data: unknown; source: "ai-generated" | "auto-filled"; edited?: boolean }
  | { status: "invalid"; message: string }
  | { status: "insufficient_evidence"; message: string };

type Step3State = {
  provider: ProviderName | null;
  generatedAt: number;
  sections: Partial<Record<SectionTypeId, SectionResult>>;
};

type PendingSave = { timer: ReturnType<typeof setTimeout>; flush: () => void };

export default function Step3GeneratePage() {
  const [loadingState, setLoadingState] = useState(true);
  const [hasStep1, setHasStep1] = useState(false);
  const [selectedSectionTypes, setSelectedSectionTypes] = useState<SectionTypeId[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [credentialDrafts, setCredentialDrafts] = useState<Record<string, string>>({});
  const [credentialBusy, setCredentialBusy] = useState<Record<string, boolean>>({});
  const [credentialErrors, setCredentialErrors] = useState<Record<string, string | null>>({});
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({});
  const [modelBusy, setModelBusy] = useState<Record<string, boolean>>({});
  const [modelErrors, setModelErrors] = useState<Record<string, string | null>>({});
  const [modelSaved, setModelSaved] = useState<Record<string, boolean>>({});
  const [selectedProvider, setSelectedProvider] = useState<ProviderName | null>(null);
  const [step3, setStep3] = useState<Step3State | null>(null);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastGenerateMs, setLastGenerateMs] = useState<number | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<SectionTypeId, unknown>>>({});
  const [savingType, setSavingType] = useState<SectionTypeId | null>(null);
  const [pendingTypes, setPendingTypes] = useState<Set<SectionTypeId>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Partial<Record<SectionTypeId, string | null>>>({});
  const [justSaved, setJustSaved] = useState<Partial<Record<SectionTypeId, boolean>>>({});

  const pendingSaves = useRef<Partial<Record<SectionTypeId, PendingSave>>>({});

  const needsProvider = useMemo(
    () => selectedSectionTypes.some((id) => SECTION_META.get(id)?.contentSource === "ai-generated"),
    [selectedSectionTypes]
  );
  const hasExistingDraft = useMemo(
    () => Object.values(step3?.sections ?? {}).some((s) => s?.status === "ok"),
    [step3]
  );
  // B7 golden example 3: name sections with real user edits specifically,
  // distinct from sections that are merely generated-and-untouched. `edited`
  // is undefined (not false) for a section written before this field
  // existed (an old `.wizard-sessions/*.json` file) — treated the same as
  // "not known to be edited," which just falls back to the same generic
  // regenerate-confirmation this page already had before this change, never
  // a new, worse behavior.
  const editedSectionLabels = useMemo(
    () =>
      Object.entries(step3?.sections ?? {})
        .filter(([, s]) => s?.status === "ok" && s.edited === true)
        .map(([type]) => SECTION_META.get(type as SectionTypeId)?.label ?? type),
    [step3]
  );
  // 2026-09-29 — backs the provider dropdown: `activeProvider` is whichever
  // provider is currently selected (regardless of whether it's configured
  // yet — see the dropdown's own comment below for why that's now allowed),
  // and `configuredProviders` powers the small "already configured" summary
  // line so switching the dropdown away from a provider doesn't hide the
  // fact that it's still set up.
  const activeProvider = useMemo(() => providers.find((p) => p.id === selectedProvider) ?? null, [providers, selectedProvider]);
  const configuredProviders = useMemo(() => providers.filter((p) => p.configured), [providers]);

  /** What a section's form should show when there's no unsaved edit yet — the last-saved "ok" data, or an empty schema-shaped template. */
  function baselineFor(sectionType: SectionTypeId, state: Step3State | null): unknown {
    const result = state?.sections[sectionType];
    const base = result && result.status === "ok" ? result.data : SECTION_DATA_TEMPLATE[sectionType];
    return coerceSectionData(sectionType, base);
  }

  function resetDrafts(types: SectionTypeId[], state: Step3State | null) {
    const next: Partial<Record<SectionTypeId, unknown>> = {};
    for (const type of types) next[type] = baselineFor(type, state);
    setDrafts(next);
  }

  /** Cancels every scheduled-but-not-yet-fired autosave without running them — used right after a fresh Generate replaces all section content, so a stale pre-generate edit can't land on top of it a moment later. */
  function discardPendingSaves() {
    Object.values(pendingSaves.current).forEach((entry) => entry && clearTimeout(entry.timer));
    pendingSaves.current = {};
    setPendingTypes(new Set());
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stateRes, credsRes] = await Promise.all([
          fetch("/api/wizard/state"),
          fetch("/api/wizard/credentials"),
        ]);
        const state = await stateRes.json();
        const creds = await credsRes.json();
        if (cancelled) return;
        setHasStep1(Boolean(state.step1));
        const types: SectionTypeId[] = state.step2?.selectedSectionTypes ?? [];
        setSelectedSectionTypes(types);
        if (state.step3) {
          setStep3(state.step3);
          if (state.step3.provider) setSelectedProvider(state.step3.provider);
          resetDrafts(types, state.step3);
        }
        setProviders(creds.providers ?? []);
        seedModelDrafts(creds.providers ?? []);
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Flush every still-pending autosave immediately on unmount, rather than
  // letting a scheduled timer be silently dropped by React tearing this page
  // down (e.g. Back / Continue to Step 4 / a stepper backward-navigation
  // link — all client-side <Link> navigations, so this cleanup actually
  // runs and the fetch it fires still completes). See the file header
  // comment for why this only works because nothing on this page navigates
  // via a hard `window.location` reload.
  useEffect(() => {
    return () => {
      Object.values(pendingSaves.current).forEach((entry) => {
        if (!entry) return;
        clearTimeout(entry.timer);
        entry.flush();
      });
    };
  }, []);

  /** Pre-fills each provider's model input from its saved value (GET), without clobbering an edit already in progress. */
  function seedModelDrafts(list: ProviderStatus[]) {
    const seeded: Record<string, string> = {};
    for (const p of list) {
      if (p.modelField) seeded[p.id] = p.model ?? "";
    }
    setModelDrafts((d) => ({ ...seeded, ...d }));
  }

  async function refreshCredentials() {
    const res = await fetch("/api/wizard/credentials");
    const data = await res.json();
    setProviders(data.providers ?? []);
    seedModelDrafts(data.providers ?? []);
  }

  async function handleSaveModel(providerId: ProviderName) {
    setModelBusy((b) => ({ ...b, [providerId]: true }));
    setModelErrors((e) => ({ ...e, [providerId]: null }));
    setModelSaved((s) => ({ ...s, [providerId]: false }));
    try {
      const response = await fetch("/api/wizard/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, value: modelDrafts[providerId] ?? "", field: "model" }),
      });
      const data = await response.json();
      if (!data.ok) {
        setModelErrors((e) => ({ ...e, [providerId]: data.message }));
        return;
      }
      await refreshCredentials();
      setModelSaved((s) => ({ ...s, [providerId]: true }));
    } catch {
      setModelErrors((e) => ({ ...e, [providerId]: "Something went wrong saving this. Please try again." }));
    } finally {
      setModelBusy((b) => ({ ...b, [providerId]: false }));
    }
  }

  async function handleSaveCredential(providerId: ProviderName) {
    setCredentialBusy((b) => ({ ...b, [providerId]: true }));
    setCredentialErrors((e) => ({ ...e, [providerId]: null }));
    try {
      const response = await fetch("/api/wizard/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, value: credentialDrafts[providerId] ?? "" }),
      });
      const data = await response.json();
      if (!data.ok) {
        setCredentialErrors((e) => ({ ...e, [providerId]: data.message }));
        return;
      }
      // Never keep the pasted value in client state after a successful save (R2).
      setCredentialDrafts((d) => ({ ...d, [providerId]: "" }));
      await refreshCredentials();
    } catch {
      setCredentialErrors((e) => ({ ...e, [providerId]: "Something went wrong saving this. Please try again." }));
    } finally {
      setCredentialBusy((b) => ({ ...b, [providerId]: false }));
    }
  }

  async function handleClearCredential(providerId: ProviderName) {
    setCredentialBusy((b) => ({ ...b, [providerId]: true }));
    try {
      await fetch("/api/wizard/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      await refreshCredentials();
    } finally {
      setCredentialBusy((b) => ({ ...b, [providerId]: false }));
    }
  }

  function handleGenerateClick() {
    if (hasExistingDraft && !confirmRegenerate) {
      setConfirmRegenerate(true);
      return;
    }
    void doGenerate();
  }

  async function doGenerate() {
    setGenerateBusy(true);
    setGenerateError(null);
    setLastGenerateMs(null);
    setConfirmRegenerate(false);
    const startedAt = Date.now();
    try {
      const response = await fetch("/api/wizard/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider ?? undefined }),
      });
      const data = await response.json();
      if (!data.ok) {
        setGenerateError(data.message);
        return;
      }
      // A fresh Generate replaces every selected section's content — any
      // autosave still waiting on an edit made just before this click is now
      // stale and must not be allowed to land afterward and clobber it.
      discardPendingSaves();
      setStep3(data.step3);
      resetDrafts(selectedSectionTypes, data.step3);
      setSaveErrors({});
      setJustSaved({});
      setLastGenerateMs(Date.now() - startedAt);
    } catch {
      setGenerateError("Something went wrong talking to the wizard's local server. Please try again.");
    } finally {
      setGenerateBusy(false);
    }
  }

  /** e.g. 1400 -> "1s", 125000 -> "2m 5s" — used to show how long a Generate call actually took. */
  function formatElapsed(ms: number): string {
    const totalSeconds = Math.max(1, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  /** The actual PATCH — called either after the debounce fires or immediately on unmount-flush. Takes `value` as a parameter rather than reading `drafts` again, so it always saves exactly what was current at the moment it was scheduled, never a value that's gone stale by the time it runs. */
  async function saveSectionValue(sectionType: SectionTypeId, value: unknown) {
    setSavingType(sectionType);
    setSaveErrors((e) => ({ ...e, [sectionType]: null }));
    try {
      const response = await fetch("/api/wizard/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionType, data: value }),
      });
      const data = await response.json();
      if (!data.ok) {
        setSaveErrors((e) => ({ ...e, [sectionType]: data.message }));
        return;
      }
      setStep3(data.step3);
      setDrafts((d) => ({ ...d, [sectionType]: coerceSectionData(sectionType, data.step3.sections[sectionType]?.data) }));
      setJustSaved((s) => ({ ...s, [sectionType]: true }));
    } catch {
      setSaveErrors((e) => ({
        ...e,
        [sectionType]: "Couldn't save automatically — check your connection. Your edit is still on this page; change the field again (or use Retry below) to try saving it once more.",
      }));
    } finally {
      setSavingType((current) => (current === sectionType ? null : current));
    }
  }

  /** Every keystroke lands here. Schedules (or reschedules) a debounced autosave rather than firing a network call per keystroke — see AUTOSAVE_DEBOUNCE_MS and the file header comment for how the debounce window itself is closed on navigation. */
  function updateDraft(sectionType: SectionTypeId, value: unknown) {
    setDrafts((d) => ({ ...d, [sectionType]: value }));
    setJustSaved((s) => ({ ...s, [sectionType]: false }));
    setSaveErrors((e) => ({ ...e, [sectionType]: null }));
    setPendingTypes((prev) => new Set(prev).add(sectionType));

    const existing = pendingSaves.current[sectionType];
    if (existing) clearTimeout(existing.timer);

    const flush = () => {
      setPendingTypes((prev) => {
        const next = new Set(prev);
        next.delete(sectionType);
        return next;
      });
      delete pendingSaves.current[sectionType];
      void saveSectionValue(sectionType, value);
    };
    pendingSaves.current[sectionType] = { timer: setTimeout(flush, AUTOSAVE_DEBOUNCE_MS), flush };
  }

  function retrySave(sectionType: SectionTypeId) {
    void saveSectionValue(sectionType, drafts[sectionType]);
  }

  if (loadingState) {
    return (
      <main className="page">
        <WizardSteps current={3} />
        <p>Loading…</p>
      </main>
    );
  }

  if (!hasStep1 || selectedSectionTypes.length === 0) {
    return (
      <main className="page">
        <WizardSteps current={3} />
        <h1>Step 3 — Generate</h1>
        <div className="card">
          <p>We&apos;re missing something from an earlier step.</p>
          <p className="nextStepNote">
            {!hasStep1 ? (
              <Link href="/wizard/step-1-upload">Go back to Step 1 to upload a résumé first.</Link>
            ) : (
              <Link href="/wizard/step-2-sections">Go back to Step 2 to choose your sections first.</Link>
            )}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <WizardSteps current={3} />
      <h1>Step 3 — Provider & generate</h1>
      <p className="lede">Choose an LLM provider (if you selected any AI-written sections), then generate your draft.</p>

      {needsProvider && (
        <div className="card">
          <h2>Provider</h2>
          {/* 2026-09-29 — replaced the always-all-expanded radio list with a
              single dropdown + one visible config panel, per Pranay's
              request ("keep the design cleaner"). Two real behavior changes,
              not just a visual swap:
              - The dropdown lets you pick ANY provider (configured or not)
                to reveal its fields — the old radio was disabled until a
                provider was already configured, which meant configuring one
                and then selecting it for generation was two separate clicks.
                Now picking it from the dropdown and configuring it is the
                same action, and Generate unlocks the moment that selected
                provider's key is actually saved — no extra click.
              - Generate's guard now checks the SELECTED provider's own
                `configured` flag (`activeProvider?.configured`) rather than
                just "is something selected," since selecting is no longer
                proof of being configured the way checking a disabled-until-
                configured radio used to be. Same safety guarantee as
                before — you still can't generate with an unconfigured
                provider — just derived correctly for the new control. */}
          <label className="fieldLabel" htmlFor="provider-select">
            Choose a provider
          </label>
          <select
            id="provider-select"
            className="providerSelect"
            value={selectedProvider ?? ""}
            onChange={(e) => setSelectedProvider((e.target.value || null) as ProviderName | null)}
          >
            <option value="" disabled>
              Select a provider…
            </option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.configured ? "Configured" : "Not configured"}
              </option>
            ))}
          </select>

          {configuredProviders.length > 0 && (
            <p className="meta providerConfiguredNote">
              Already configured: {configuredProviders.map((p) => p.label).join(", ")}.
            </p>
          )}

          {activeProvider && (
            <div className={`providerPanel providerRow ${activeProvider.configured ? "providerReady" : ""}`}>
              <div className="sectionTitleRow">
                <span className="sectionTitle hasTip" data-tip={activeProvider.helpText}>
                  {activeProvider.label}
                  <span className="tipIcon" aria-hidden="true">
                    ?
                  </span>
                </span>
                <span className={`badge ${activeProvider.configured ? "badgeAi" : "badgeAuto"}`}>
                  {activeProvider.configured ? "Configured" : "Not configured"}
                </span>
              </div>

              <div className="providerConfigure">
                <input
                  type={activeProvider.fieldKind === "apiKey" ? "password" : "text"}
                  placeholder={activeProvider.placeholder}
                  value={credentialDrafts[activeProvider.id] ?? ""}
                  onChange={(e) => setCredentialDrafts((d) => ({ ...d, [activeProvider.id]: e.target.value }))}
                  disabled={credentialBusy[activeProvider.id]}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleSaveCredential(activeProvider.id)}
                  disabled={credentialBusy[activeProvider.id]}
                >
                  Save
                </button>
                {activeProvider.configured && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleClearCredential(activeProvider.id)}
                    disabled={credentialBusy[activeProvider.id]}
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="meta">{activeProvider.helpText}</p>
              {credentialErrors[activeProvider.id] && <p className="error">{credentialErrors[activeProvider.id]}</p>}

              {activeProvider.modelField && (
                <>
                  <div className="providerConfigure hasTip" data-tip={activeProvider.modelField.helpText}>
                    <input
                      type="text"
                      placeholder={activeProvider.modelField.placeholder}
                      value={modelDrafts[activeProvider.id] ?? ""}
                      onChange={(e) => setModelDrafts((d) => ({ ...d, [activeProvider.id]: e.target.value }))}
                      disabled={modelBusy[activeProvider.id]}
                    />
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handleSaveModel(activeProvider.id)}
                      disabled={modelBusy[activeProvider.id]}
                    >
                      {modelBusy[activeProvider.id] ? "Saving…" : "Save model"}
                    </button>
                  </div>
                  <p className="meta">
                    <span className="hasTip" data-tip={activeProvider.modelField.helpText}>
                      {activeProvider.modelField.label}
                      <span className="tipIcon" aria-hidden="true">
                        ?
                      </span>
                    </span>
                    : {activeProvider.modelField.helpText}
                  </p>
                  {modelErrors[activeProvider.id] && <p className="error">{modelErrors[activeProvider.id]}</p>}
                  {!modelErrors[activeProvider.id] && modelSaved[activeProvider.id] && <p className="meta">Model saved.</p>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2>Generate</h2>
        <p className="meta">
          This regenerates every selected section at once — there&apos;s no partial/single-section regenerate yet.
        </p>
        <div className="actions">
          <Link href="/wizard/step-2-sections" className="linkButton">
            Back
          </Link>
          <button
            type="button"
            className="hasTip"
            data-tip="Regenerates every currently-selected section at once, using the provider chosen above — there's no partial/single-section regenerate yet. This replaces any existing draft content for those sections."
            onClick={handleGenerateClick}
            disabled={generateBusy || (needsProvider && !activeProvider?.configured)}
          >
            {generateBusy ? "Generating…" : confirmRegenerate ? "Confirm — replace current draft" : hasExistingDraft ? "Regenerate" : "Generate"}
          </button>
          {confirmRegenerate && (
            <button type="button" className="secondary" onClick={() => setConfirmRegenerate(false)}>
              Cancel
            </button>
          )}
        </div>
        {confirmRegenerate && (
          <div className="warnings">
            <p className="warningsTitle">This will replace your current draft</p>
            {editedSectionLabels.length > 0 ? (
              <p>
                <strong>{editedSectionLabels.join(", ")}</strong> {editedSectionLabels.length === 1 ? "has" : "have"}{" "}
                your own edits, not just generated content — regenerating will overwrite {editedSectionLabels.length === 1 ? "it" : "them"} too.
                This can&apos;t be undone (unless you&apos;ve exported a copy — see Save / Export above).
              </p>
            ) : (
              <p>
                Regenerating replaces every currently-selected section&apos;s content. This can&apos;t be undone
                (unless you&apos;ve exported a copy — see Save / Export above).
              </p>
            )}
          </div>
        )}
        {needsProvider && !activeProvider && <p className="error">Choose a provider above first.</p>}
        {needsProvider && activeProvider && !activeProvider.configured && (
          <p className="error">Add a valid key for {activeProvider.label} above before generating.</p>
        )}
        {generateError && <p className="error">{generateError}</p>}
        {!generateBusy && !generateError && lastGenerateMs !== null && (
          <p className="meta">Generated in {formatElapsed(lastGenerateMs)}.</p>
        )}
      </div>

      {step3 ? (
        <div className="card">
          <h2>Review your draft</h2>
          <p className="meta">Every edit here saves automatically a moment after you stop typing — there&apos;s no separate save button.</p>
          <p className="actions">
            <ContinueArrow />
            <Link href="/wizard/step-4-publish" className="linkButton continueButton">
              Continue to Step 4
            </Link>
          </p>
          {selectedSectionTypes.map((sectionType) => {
            const meta = SECTION_META.get(sectionType);
            const result = step3.sections[sectionType];
            const draftValue = sectionType in drafts ? drafts[sectionType] : baselineFor(sectionType, step3);
            const autosaveStatus: "saving" | "pending" | "error" | "saved" | null = savingType === sectionType
              ? "saving"
              : pendingTypes.has(sectionType)
              ? "pending"
              : saveErrors[sectionType]
              ? "error"
              : justSaved[sectionType]
              ? "saved"
              : null;
            return (
              <div key={sectionType} className="reviewBlock">
                <div className="sectionTitleRow">
                  <span className="sectionTitle">{meta?.label ?? sectionType}</span>
                  {result?.status === "ok" && (
                    <span className={`badge ${result.source === "ai-generated" ? "badgeAi" : "badgeAuto"}`}>
                      {result.source === "ai-generated" ? "AI-written" : "Auto-filled"}
                    </span>
                  )}
                </div>

                {!result && <p className="meta">Not generated yet — fill this in below, or select it and Generate again.</p>}
                {result?.status === "insufficient_evidence" && <p className="warnings">{result.message}</p>}
                {result?.status === "invalid" && <p className="error">{result.message}</p>}

                <SectionForm sectionType={sectionType} value={draftValue} onChange={(v) => updateDraft(sectionType, v)} />

                <div className="actions">
                  {autosaveStatus === "pending" && <span className="meta">Waiting to save…</span>}
                  {autosaveStatus === "saving" && <span className="meta">Saving…</span>}
                  {autosaveStatus === "saved" && <span className="meta">Saved.</span>}
                  {autosaveStatus === "error" && (
                    <button type="button" className="secondary small" onClick={() => retrySave(sectionType)}>
                      Retry save
                    </button>
                  )}
                </div>
                {autosaveStatus === "error" && <p className="error">{saveErrors[sectionType]}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <p className="meta">Click Generate above to create your first draft — this is where you&apos;ll review and edit each section.</p>
        </div>
      )}
    </main>
  );
}
