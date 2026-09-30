"use client";

// 2026-09-29 — Editorial Luxury redesign's scroll-entry mechanic. This
// stack has no framer-motion/gsap (see package.json), so the skill's
// "use IntersectionObserver, never window.addEventListener('scroll')"
// guidance is implemented directly: one observer, mounted once from
// app/layout.tsx, watches every element on the page carrying a
// `data-reveal` attribute and adds `.is-visible` (see globals.css) the
// first time it crosses the viewport threshold, then stops watching it —
// a one-way reveal, not a re-trigger-on-every-scroll effect. Renders no
// DOM of its own (returns null); it only ever reads the page.
import { useEffect } from "react";

export function ScrollReveal() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    if (typeof IntersectionObserver === "undefined") {
      // No IntersectionObserver support — reveal everything immediately
      // rather than leaving the page permanently invisible.
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
