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

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <a href="#top" className="font-semibold text-ink-navy tracking-tight">
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
        <nav className="md:hidden border-t border-border bg-background px-5 pb-4">
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
