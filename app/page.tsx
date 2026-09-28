// Landing page — rebuilt from scratch 2026-09-28.
//
// PROJECT-STATE.md's own history log claimed a hero/benefits/flow-diagram
// landing page was already built and Playwright-verified back on 2026-09-12.
// It wasn't here: `app/page.tsx` was just a 4-line redirect straight to
// Step 1, with none of this project's usual header comment explaining why.
// Checked every source that could confirm what happened (no git repo, this
// cloud session's or the device's; every on-device archive/zip snapshot
// predates 2026-08-29; the public GitHub repo has only a LICENSE file) and
// found nothing — no confirmed root cause, no code to restore. Built fresh
// rather than chase a copy that isn't recoverable from anything checkable.
//
// Scope resolved with Pranay 2026-09-28 (wizard-phase3-landing-and-navigation-scope.md,
// Feature 1): homepage hook features AI-speed and privacy equally (neither
// wins over the other); proof is a screenshot of a real, live example site
// rather than an invented mockup; primary CTA is "See how it works," which
// scrolls to the in-page explainer rather than jumping straight into the
// wizard. Same round he added: logos for the AI providers + Vercel (a
// real "works with" strip, not filler), multiple real screenshots of his
// own live site (not just one), and a lightweight looping CSS animation for
// the 4-step flow diagram — no JS animation library, so this stays fast and
// has nothing to break.
//
// PRODUCT_NAME (lib/productName.ts) is "SharperProfile" — the final name,
// picked 2026-09-28 after several rounds of candidates. One constant, one
// place it's defined; every place the name appears on this page (and in
// app/layout.tsx's site header) reads from it.
//
// The three screenshots under public/landing/ are real captures of Pranay's
// own live site (https://pranaysrivastava.vercel.app/), taken via a live
// browser session, not staged/fabricated. The five logos under
// public/landing/logos/ are real, official brand marks from the `simple-icons`
// npm package (version live-checked against the registry before use) — never
// hand-traced or invented — shown monochrome to read as "compatible with,"
// not as a sponsor/endorsement wall.
import Link from "next/link";
import Image from "next/image";
import { PRODUCT_NAME } from "@/lib/productName";
import { BrandLogo, type BrandLogoId } from "@/components/BrandLogo";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M12 4l-5 5M12 4l5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ConfigureIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h13M21 18h0" />
      <circle cx="16" cy="6" r="2.2" />
      <circle cx="9" cy="12" r="2.2" />
      <circle cx="16" cy="18" r="2.2" />
    </svg>
  );
}

function GenerateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

function PublishIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 14H4z" />
      <path d="M8 20h8" />
    </svg>
  );
}

function SpeedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

function PrivacyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function OwnershipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const FLOW_STEPS = [
  { icon: <UploadIcon />, title: "Upload résumé", desc: "Drop in a PDF or Word file — or try it with an example first." },
  { icon: <ConfigureIcon />, title: "Configure sections", desc: "Pick which sections your site shows, and add a headshot." },
  { icon: <GenerateIcon />, title: "Generate draft", desc: "Your chosen AI provider writes every section. Review and edit." },
  { icon: <PublishIcon />, title: "Publish", desc: "One click sends it to your own Vercel account. It's live." },
] as const;

const LOGOS: { id: BrandLogoId; label: string }[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "googlegemini", label: "Google Gemini" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "ollama", label: "Ollama (runs fully offline)" },
  { id: "vercel", label: "Vercel" },
];

export default function LandingPage() {
  return (
    <main className="landing">
      <section className="landingHero">
        <span className="landingEyebrow">AI-assisted portfolio builder</span>
        <h1>
          Turn your résumé into a live portfolio site — in minutes, without handing your data to anyone.
        </h1>
        <p className="landingHeroSub">
          A résumé is a list — recruiters, hiring managers, and admissions committees skim it in seconds and move on.
          A live portfolio site is different: a place where your work, your projects, and your story actually get
          seen, not just scanned. Whether you&apos;re a student building your first portfolio, a recent grad trying
          to stand out in a crowded job market, or an experienced professional going for your next role,{" "}
          {PRODUCT_NAME} turns the résumé you already have into that site — in minutes, no design skills required,
          using the AI provider you choose.
        </p>
        <div className="landingCtaRow">
          <a href="#how-it-works" className="landingCtaPrimary">
            See how it works
          </a>
          <Link href="/wizard/step-1-upload" className="landingCtaSecondary">
            Skip ahead — start now →
          </Link>
        </div>
      </section>

      <section className="landingLogos">
        <p className="landingLogosLabel">Bring your own AI provider. Publish to your own Vercel account.</p>
        <div className="landingLogoRow">
          {LOGOS.map((logo) => (
            <span key={logo.id} className="landingLogo hasTip" data-tip={logo.label} role="img" aria-label={logo.label}>
              <BrandLogo id={logo.id} />
            </span>
          ))}
        </div>
      </section>

      <section className="landingSection">
        <h2>A real site, built this way</h2>
        <p className="landingSectionSub">
          This is Pranay&apos;s own portfolio — generated and published with this exact wizard, not a mockup.
        </p>
        <div className="landingShotGrid">
          <figure className="landingShotCard">
            <div className="landingShotChrome">
              <span className="landingShotDot" />
              <span className="landingShotDot" />
              <span className="landingShotDot" />
            </div>
            <div className="landingShotFrame">
              <Image src="/landing/screenshot-hero.jpg" alt="Portfolio site hero section" width={790} height={912} />
            </div>
            <figcaption className="landingShotCaption">Overview — headline, role, and quick links.</figcaption>
          </figure>
          <figure className="landingShotCard">
            <div className="landingShotChrome">
              <span className="landingShotDot" />
              <span className="landingShotDot" />
              <span className="landingShotDot" />
            </div>
            <div className="landingShotFrame">
              <Image src="/landing/screenshot-projects.jpg" alt="Portfolio site projects section" width={790} height={912} />
            </div>
            <figcaption className="landingShotCaption">Projects — real work, with live links.</figcaption>
          </figure>
          <figure className="landingShotCard">
            <div className="landingShotChrome">
              <span className="landingShotDot" />
              <span className="landingShotDot" />
              <span className="landingShotDot" />
            </div>
            <div className="landingShotFrame">
              <Image
                src="/landing/screenshot-perspectives.jpg"
                alt="Portfolio site perspectives and certifications section"
                width={790}
                height={912}
              />
            </div>
            <figcaption className="landingShotCaption">Perspectives &amp; certifications.</figcaption>
          </figure>
        </div>
        <a href="https://pranaysrivastava.vercel.app/" target="_blank" rel="noopener noreferrer" className="landingShotSourceLink">
          View the live site ↗
        </a>
      </section>

      <section className="landingSection" id="how-it-works">
        <h2>How it works</h2>
        <p className="landingSectionSub">Four steps, each a real page — nothing hidden behind a black box.</p>
        <div className="landingFlow">
          <div className="landingFlowConnectors" aria-hidden="true">
            <span className="landingFlowArrow landingFlowArrow-1" />
            <span className="landingFlowArrow landingFlowArrow-2" />
            <span className="landingFlowArrow landingFlowArrow-3" />
          </div>
          {FLOW_STEPS.map((step) => (
            <div key={step.title} className="landingFlowStep">
              <div className="landingFlowIcon">{step.icon}</div>
              <div className="landingFlowStepTitle">{step.title}</div>
              <div className="landingFlowStepDesc">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="landingSection">
        <h2>Why this, not just ChatGPT and a template</h2>
        <div className="landingBenefits">
          <div className="landingBenefitCard landingBenefitCard-speed">
            <div className="landingBenefitIcon">
              <SpeedIcon />
            </div>
            <h3>Minutes, not weekends</h3>
            <p>Upload, pick sections, generate, publish — a full draft site in the time it takes to make coffee.</p>
          </div>
          <div className="landingBenefitCard landingBenefitCard-privacy">
            <div className="landingBenefitIcon">
              <PrivacyIcon />
            </div>
            <h3>Your keys, your data</h3>
            <p>
              Your résumé and API keys never touch a server we control. Choose Ollama and the whole thing can run
              fully offline, on your own machine.
            </p>
          </div>
          <div className="landingBenefitCard landingBenefitCard-ownership">
            <div className="landingBenefitIcon">
              <OwnershipIcon />
            </div>
            <h3>It&apos;s really yours</h3>
            <p>Publishes to your own Vercel account under your own name. No subscription, no lock-in, edit anytime.</p>
          </div>
        </div>
      </section>

      <section className="landingFinalCta">
        <h2>Ready to see yours?</h2>
        <p>Try it with an example résumé first — no account needed until you&apos;re ready to publish.</p>
        <Link href="/wizard/step-1-upload" className="landingCtaPrimary">
          Start building your portfolio
        </Link>
      </section>

      <p className="landingFooterNote">
        Not sure where to start? <Link href="/wizard/help">Read the help guide</Link>.
      </p>
    </main>
  );
}
