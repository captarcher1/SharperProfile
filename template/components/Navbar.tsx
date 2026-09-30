"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { config } from "@/config/site";
import { sectionHasContent } from "@/lib/sections";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const navItems = config.sections
    .filter((s) => s.navLabel && sectionHasContent(s))
    .map((s) => ({ label: s.navLabel as string, href: `#${s.id}` }));

  // 2026-09-29 — "Fluid Island" treatment: a floating, inset pill rather
  // than a full-bleed bar, matching the wizard tool's own header (see its
  // globals.css .siteHeader comment). Purely a shell/positioning change —
  // every existing class driving the actual nav behavior (mobile menu
  // state, active-link colors) is untouched.
  return (
    <header className="sticky top-3 z-50 px-4 print:hidden sm:top-4">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between rounded-full border border-border bg-background/85 px-5 shadow-[0_10px_30px_-14px_rgba(44,32,21,0.28)] backdrop-blur-md sm:px-7">
        <a href="#top" className="font-serif font-semibold text-ink-navy tracking-tight">
          {config.name}
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-ink-body hover:text-accent transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden flex h-12 w-12 items-center justify-center rounded-full text-ink-navy"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav className="md:hidden mx-auto mt-2 max-w-[1200px] rounded-[22px] border border-border bg-background px-5 pb-2 pt-2 shadow-[0_10px_30px_-14px_rgba(44,32,21,0.28)]">
          <ul className="flex flex-col">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center text-ink-body hover:text-accent"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
