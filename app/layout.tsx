import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { PRODUCT_NAME } from "@/lib/productName";
import { SiteHeaderName } from "@/components/SiteHeaderName";
import { HomeLink } from "@/components/HomeLink";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "AI-assisted portfolio builder wizard — upload a résumé, configure sections, generate your site.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="siteHeader">
          <div className="siteHeaderInner">
            <SiteHeaderName productName={PRODUCT_NAME} />
            {/* 2026-09-28 — "Home" used to point straight at Step 1, which made
                sense only while "/" was itself a redirect to Step 1 (so "Home"
                and "start the wizard" were the same destination). Now that "/"
                is a real landing page, this needs to actually go home — a user
                partway through the wizard who wants to get back to the landing
                page (e.g. to re-read the benefits, or grab the Help link) had
                no way to do that before this fix. "Help" added next to it the
                same round, and the whole header made sticky (see .siteHeader
                in globals.css), so the name plus both links stay reachable
                from anywhere in the app, not just at the top of the page.
                The product name itself is also a Home link now (see
                components/SiteHeaderName.tsx) — clicking it checks for
                session progress first, same as the Import flow already does.
                "Home" itself is now components/HomeLink.tsx, a small client
                component: clicking it while already on "/" scrolled down
                used to do nothing (a same-route Link doesn't reset scroll
                on its own) — it now scrolls back to top instead. */}
            <nav className="siteHeaderNav">
              <HomeLink className="siteHeaderHome" />
              <Link href="/wizard/help" className="siteHeaderHome">
                Help
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="siteFooter">
          <div className="siteFooterInner">
            <p className="siteFooterAttribution">Built by Pranay Srivastava. September 2026.</p>
            <p className="siteFooterDisclaimer">
              This site&apos;s content, including this tool itself, is AI-assisted. AI can make mistakes — double-check
              anything here before publishing or relying on it.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
