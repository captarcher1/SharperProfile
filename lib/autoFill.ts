// Step 3 (B1) — deterministic, no-LLM content for the 4 section types
// Track A's pipeline can't generate (hero, metrics, logoCredentials,
// contactForm — per the 2026-09-06 scope-gap resolution logged in
// lib/sectionTypes.ts). Every field here traces to something the pipeline
// actually extracted (Step 1's ExtractionResult) — nothing is invented, per
// Pranay's explicit instruction. Where there's genuinely nothing to fill a
// required field with, this uses an honest empty string/array, never a
// fabricated placeholder value ("Add your metrics here" as a *label* would
// be fine; as a *value* pretending to be real data, it would not be).
import type { ExtractionResult } from "@/src/types";
import { SECTION_TYPES, type SectionTypeId } from "@/lib/sectionTypes";

export function autoFillHero(facts: ExtractionResult) {
  return {
    headline: facts.headline ?? facts.name ?? "",
    supportingCopy: facts.summary ?? undefined,
  };
}

/** Empty, editable placeholder — Track A has no source of real numeric metrics, and inventing one is exactly the failure class this project's eval harness tests against. */
export function autoFillMetrics(_facts: ExtractionResult) {
  return [] as { value: string; label: string }[];
}

export function autoFillLogoCredentials(facts: ExtractionResult) {
  return {
    // `issuer` is a required field on Track B's schema, but Step 1's
    // extraction only returns each certification as one raw string (no
    // reliable issuer/title split without a model call) — left blank
    // rather than guessed, so the user fills it in during review instead
    // of trusting an invented issuer name.
    items: facts.certifications.map((title) => ({ issuer: "", title })),
  };
}

export function autoFillContactForm(facts: ExtractionResult) {
  const email = facts.contact?.email ?? null;
  return {
    heading: "Start a conversation",
    socialLink: email ? { label: "Email", href: `mailto:${email}` } : undefined,
  };
}

// Derived from lib/sectionTypes.ts's own contentSource classification rather
// than a second hardcoded list, so the two can't silently drift apart.
export const AUTO_FILL_SECTION_TYPES: SectionTypeId[] = SECTION_TYPES.filter(
  (s) => s.contentSource === "auto-filled"
).map((s) => s.id);

export function buildAutoFilledData(sectionType: SectionTypeId, facts: ExtractionResult): unknown {
  switch (sectionType) {
    case "hero":
      return autoFillHero(facts);
    case "metrics":
      return autoFillMetrics(facts);
    case "logoCredentials":
      return autoFillLogoCredentials(facts);
    case "contactForm":
      return autoFillContactForm(facts);
    default:
      throw new Error(`${sectionType} is not an auto-filled section type.`);
  }
}
