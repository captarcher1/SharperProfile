"use client";

// 2026-09-28 — the product name in the header is now clickable (goes Home),
// with a real check first: reuses the exact same `hasAnyProgress` fetch
// pattern WizardSteps.tsx already uses for its own import-overwrite warning
// (fetch /api/wizard/state fresh, on demand, right at click time — not from
// state cached at mount, which has the same race that component's own header
// comment describes). Deliberately does NOT claim navigating away would
// "lose" anything: Step 2/3 already autosave everything to the server
// (2026-09-28, Phase 3), so nothing is actually at risk — the message here
// only offers an export as a portable backup file, which is a genuinely
// different thing from data loss.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { hasAnyProgress } from "@/lib/wizard-export";
import type { WizardSession } from "@/lib/wizard-state";

export function SiteHeaderName({ productName }: { productName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // Already home, or the user is opening it in a new tab/window (modifier
    // key or a non-primary click) — let the browser do its normal thing
    // rather than intercepting.
    if (pathname === "/" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    try {
      const response = await fetch("/api/wizard/state");
      const data = await response.json();
      const session: WizardSession = {
        step1: data.step1 ?? null,
        step2: data.step2 ?? null,
        step3: data.step3 ?? null,
        publish: data.publish ?? null,
      };
      if (hasAnyProgress(session)) {
        setShowConfirm(true);
      } else {
        router.push("/");
      }
    } catch {
      // Same reasoning as WizardSteps.tsx's own fetch failure case: if we
      // can't tell whether there's progress, the safer default is to ask
      // rather than navigate silently past it.
      setShowConfirm(true);
    }
  }

  return (
    <div className="siteHeaderNameWrap">
      <Link href="/" className="siteHeaderName" onClick={handleClick}>
        {productName}
      </Link>
      {showConfirm && (
        <div className="siteHeaderNameConfirm warnings">
          <p className="warningsTitle">Go back to the home page?</p>
          <p>
            You have progress in this session (résumé, sections, or generated content). It&apos;s saved automatically
            as you go, so nothing is lost by leaving — but if you&apos;d like a portable backup file, export it
            first.
          </p>
          <div className="actions">
            <button type="button" onClick={() => router.push("/")}>
              Go home
            </button>
            <a href="/api/wizard/export" download className="linkButton small" onClick={() => setShowConfirm(false)}>
              Export first
            </a>
            <button type="button" className="secondary" onClick={() => setShowConfirm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
