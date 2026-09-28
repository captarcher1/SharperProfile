"use client";

// Wizard Step 4 (B8) — Vercel account + token setup, plus (B9/B10, added
// 2026-09-27) the actual publish/republish action itself.
//
// Deliberately does NOT gate the *page* on step1/2/3 existing, unlike Steps
// 2/3 — connecting a Vercel account has no dependency on résumé/section
// data. The Publish section below the connection card does gate on a draft
// existing (B9's own precondition), but it degrades to a plain "finish your
// draft first" message rather than hiding the whole page.
//
// Per A6 (confirmed 2026-09-14): unlike Step 3's LLM provider keys — which
// only get lazily validated at Generate time (A8) — a pasted Vercel token is
// validated with a real, live call to Vercel *before* it's ever written.
// That's why the token form has a "checking your token…" busy state that
// the LLM credential fields don't need.
//
// Per OQ-P2-4 (resolved 2026-09-27, via a real live test against Vercel's
// API — see PROJECT-STATE.md's 2026-09-27 entry): Vercel does support
// project-scoped (least-privilege) tokens, but only for a project that
// already exists. Since there's no Vercel project yet at this point in the
// flow, the walkthrough below steers the user toward a Full Account or Team
// token now, and says plainly that a narrower project-scoped token becomes
// an option later, once a first publish (B9) creates that first project.
//
// B9/B10 (2026-09-27): the Publish section reuses the same two-click-confirm
// idiom already used by B7's overwrite-warning and Step 3's regenerate flow
// (per Pranay's own choice, discussed before this was built) — a real, live,
// side-effecting call to Vercel deserves the same "are you sure" pattern as
// those, not a new one-off UI shape. Failure case 3 (must route into B8
// rather than attempt-and-fail-generically) is naturally satisfied here
// since this Publish section lives on the same page as the connection form
// — an unconnected user simply can't reach a working Publish button; the
// message below it points at the form above instead of a separate redirect.
import Link from "next/link";
import { useEffect, useState } from "react";
import { WizardSteps } from "@/components/wizard/WizardSteps";

type TokenStatus = { configured: boolean; accountLabel: string | null };

type PublishRecord = {
  projectId: string;
  projectName: string;
  alias: string;
  lastDeploymentId: string;
  publishedAt: number;
  target: "production";
};

type PublishStatus = {
  tokenConfigured: boolean;
  hasDraft: boolean;
  hasValidatedContent: boolean;
  publish: PublishRecord | null;
};

export default function Step4PublishPage() {
  const [loadingState, setLoadingState] = useState(true);
  const [status, setStatus] = useState<TokenStatus>({ configured: false, accountLabel: null });
  const [tokenDraft, setTokenDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [publishStatus, setPublishStatus] = useState<PublishStatus | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  async function refreshPublishStatus() {
    try {
      const response = await fetch("/api/wizard/publish");
      const data = await response.json();
      if (data.ok) {
        setPublishStatus({
          tokenConfigured: Boolean(data.tokenConfigured),
          hasDraft: Boolean(data.hasDraft),
          hasValidatedContent: Boolean(data.hasValidatedContent),
          publish: data.publish ?? null,
        });
      }
    } catch {
      // Best-effort — the Publish section just stays hidden/disabled if this fails; the user can still use the token form above.
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/wizard/vercel-token");
        const data = await response.json();
        if (cancelled) return;
        if (data.ok) {
          setStatus({ configured: Boolean(data.configured), accountLabel: data.accountLabel ?? null });
        }
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    })();
    void refreshPublishStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setError(null);
    if (tokenDraft.trim().length === 0) {
      setError("Please paste your Vercel access token.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/wizard/vercel-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenDraft }),
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.message ?? "Vercel rejected this token.");
        // A token Vercel itself says is invalid/expired/revoked (TOKEN_REJECTED)
        // has no reason to keep sitting in this field — clear it so a value
        // already confirmed bad doesn't linger any longer than it has to.
        // A VALIDATION_UNREACHABLE failure (network hiccup, Vercel's API down)
        // is different: the token itself might be fine, so we leave it in
        // place for an easy retry instead of making the user re-paste it.
        if (data.code === "TOKEN_REJECTED") {
          setTokenDraft("");
        }
        return;
      }
      setStatus({ configured: true, accountLabel: data.accountLabel ?? null });
      setTokenDraft("");
      void refreshPublishStatus();
    } catch {
      setError("Something went wrong talking to the wizard's local server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/wizard/vercel-token", { method: "DELETE" });
      const data = await response.json();
      setStatus({ configured: Boolean(data.configured), accountLabel: data.accountLabel ?? null });
      void refreshPublishStatus();
    } finally {
      setBusy(false);
    }
  }

  function handlePublishClick() {
    if (!confirmPublish) {
      setConfirmPublish(true);
      return;
    }
    void doPublish();
  }

  async function doPublish() {
    setPublishBusy(true);
    setPublishError(null);
    setConfirmPublish(false);
    try {
      const response = await fetch("/api/wizard/publish", { method: "POST" });
      const data = await response.json();
      if (!data.ok) {
        setPublishError(data.message ?? "Publishing failed.");
        return;
      }
      setPublishStatus((prev) => (prev ? { ...prev, publish: data.publish } : prev));
    } catch {
      setPublishError(
        "Couldn't confirm whether this published — the request failed before we got a response. Check your Vercel dashboard before retrying, since retrying a possibly-succeeded deployment risks creating a duplicate."
      );
    } finally {
      setPublishBusy(false);
    }
  }

  const isRepublish = Boolean(publishStatus?.publish);
  const canPublish = Boolean(publishStatus?.tokenConfigured && publishStatus?.hasValidatedContent);

  return (
    <main className="page">
      <WizardSteps current={4} />
      <h1>Step 4 — Connect Vercel &amp; Publish</h1>
      <p className="lede">
        Connect a Vercel account so your generated site can be published to a real, live URL, then publish it below.
      </p>

      <div className="card">
        <h2>1. Create a Vercel account</h2>
        <p className="meta">
          Sign-up is email-only — no GitHub account needed, and this wizard never asks for one for this step. Go to{" "}
          <a href="https://vercel.com/signup" target="_blank" rel="noreferrer">
            vercel.com/signup
          </a>{" "}
          if you don&apos;t already have an account.
        </p>
      </div>

      <div className="card">
        <h2>2. Create a Personal Access Token</h2>
        <p className="meta">
          Go to{" "}
          <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer">
            vercel.com/account/tokens
          </a>
          , name the token, and set <strong>Scope</strong> to <strong>Full Account</strong> (or a specific{" "}
          <strong>Team</strong>, if you have one) — not <strong>Project</strong>. A project-scoped token is more
          locked-down, but Vercel can only create one for a project that already exists, and your first site
          doesn&apos;t exist yet. Once you&apos;ve published for the first time, you&apos;ll be able to swap in a
          narrower, project-scoped token for future updates instead.
        </p>
        <p className="meta">Choose an expiration and copy the token — Vercel only shows it to you once.</p>
      </div>

      <div className="card">
        <h2>3. Paste your token</h2>
        {loadingState ? (
          <p className="meta">Loading…</p>
        ) : status.configured ? (
          <div className="providerRow providerReady">
            <p>
              <span className="badge badgeAi">Connected</span>{" "}
              {status.accountLabel ? (
                <>
                  as <strong>{status.accountLabel}</strong>
                </>
              ) : (
                "to Vercel"
              )}
            </p>
            <div className="actions">
              <button type="button" className="secondary" onClick={handleDisconnect} disabled={busy}>
                {busy ? "Removing…" : "Disconnect"}
              </button>
            </div>
            <p className="meta">Pasting a new token below will replace this connection.</p>
          </div>
        ) : null}

        <div className="providerConfigure hasTip" data-tip="Vercel validates this token with a real check before it's ever saved — nothing is written until Vercel itself confirms it works.">
          <input
            type="password"
            placeholder="vcp_... or a Full Account / Team token"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            disabled={busy}
          />
          <button type="button" onClick={handleSave} disabled={busy}>
            {busy ? "Checking your token…" : "Save"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h2>4. {isRepublish ? "Republish your site" : "Publish your site"}</h2>

        {!publishStatus ? (
          <p className="meta">Loading…</p>
        ) : !publishStatus.tokenConfigured ? (
          <p className="meta">Connect a Vercel account above first.</p>
        ) : !publishStatus.hasDraft || !publishStatus.hasValidatedContent ? (
          <p className="meta">
            There&apos;s no finished draft to publish yet.{" "}
            <Link href="/wizard/step-3-generate" className="linkButton">
              Go back to Step 3
            </Link>{" "}
            to generate one.
          </p>
        ) : (
          <>
            {publishStatus.publish && (
              <div className="providerRow providerReady">
                <p>
                  <span className="badge badgeAi">Live</span> at{" "}
                  <a href={`https://${publishStatus.publish.alias}`} target="_blank" rel="noreferrer">
                    {publishStatus.publish.alias}
                  </a>
                </p>
                <p className="meta">
                  Last published {new Date(publishStatus.publish.publishedAt).toLocaleString()}. Publishing again
                  updates this same site — the link above won&apos;t change.
                </p>
              </div>
            )}

            <div className="actions">
              <button
                type="button"
                className="hasTip"
                data-tip={
                  isRepublish
                    ? "Redeploys your current draft to the same live site — the URL above stays the same."
                    : "Deploys your current draft to a brand-new live Vercel site."
                }
                onClick={handlePublishClick}
                disabled={publishBusy || !canPublish}
              >
                {publishBusy
                  ? "Publishing…"
                  : confirmPublish
                    ? `Confirm — ${isRepublish ? "republish" : "publish"} now`
                    : isRepublish
                      ? "Republish"
                      : "Publish"}
              </button>
              {confirmPublish && (
                <button type="button" className="secondary" onClick={() => setConfirmPublish(false)} disabled={publishBusy}>
                  Cancel
                </button>
              )}
            </div>
            {confirmPublish && (
              <div className="warnings">
                <p className="warningsTitle">
                  This will make your site {isRepublish ? "update live" : "go live"} on the internet
                </p>
                <p>
                  {isRepublish
                    ? "Anyone with the link above will immediately see your updated content."
                    : "This creates a brand-new, publicly-reachable site on Vercel with your current draft's content."}
                </p>
              </div>
            )}
            {publishError && <p className="error">{publishError}</p>}
          </>
        )}
      </div>

      <div className="actions">
        <Link href="/wizard/step-3-generate" className="linkButton">
          Back
        </Link>
      </div>
    </main>
  );
}
