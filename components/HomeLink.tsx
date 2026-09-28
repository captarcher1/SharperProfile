"use client";

// 2026-09-28 — fixes a real bug: clicking "Home" while already scrolled down
// the home page ("/") did nothing, because Next.js's router treats a click
// on a Link pointing at the current route as a same-route no-op and doesn't
// reset scroll position. A real navigation to "/" from any *other* page
// already scrolls to top on its own (the router's default behavior for an
// actual route change) — this only needed to handle the same-route case.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

export function HomeLink({ className }: { className?: string }) {
  const pathname = usePathname();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const isPlainLeftClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (pathname === "/" && isPlainLeftClick) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <Link href="/" className={className} onClick={handleClick}>
      Home
    </Link>
  );
}
