// The 9 fixed section types (A1, confirmed 2026-08-30 — no free-form
// authoring). Identifiers match Track B's config/types.ts sectionConfigSchema
// exactly (read directly from that file, not re-typed from memory), since
// whatever the wizard produces must validate against that schema (D2).
//
// contentSource distinguishes the 5 types Track A's B1 pipeline can actually
// generate via an LLM call (src/schema.ts's SECTION_TYPES, src/prompts/
// sectionPrompts.ts) from the 4 it cannot — confirmed 2026-09-06 there is no
// prompt/schema/generation code anywhere in Track A for hero, metrics,
// logoCredentials, or contactForm. Per Pranay's decision that day: all 9 are
// still offered in Step 2, but the 4 non-generated ones get a deterministic,
// no-LLM auto-fill in Step 3 instead of a fabricated-content risk (metrics/
// logoCredentials in particular — inventing numbers or credentials is
// exactly the failure class this project's own eval harness tests against).
export type SectionTypeId =
  | "hero"
  | "metrics"
  | "cardGrid"
  | "processSteps"
  | "topicGrid"
  | "logoCredentials"
  | "chipGroups"
  | "textAndTimeline"
  | "contactForm";

export type SectionTypeMeta = {
  id: SectionTypeId;
  label: string;
  description: string;
  contentSource: "ai-generated" | "auto-filled";
  /** Pre-checked by default in Step 2 — Hero and Skills are the two sections almost every résumé supports well. */
  defaultSelected: boolean;
};

export const SECTION_TYPES: SectionTypeMeta[] = [
  {
    id: "hero",
    label: "Hero (name, headline, photo)",
    description: "Your name, headline, and headshot — filled in automatically from Step 1 and the photo below.",
    contentSource: "auto-filled",
    defaultSelected: true,
  },
  {
    id: "metrics",
    label: "Metrics",
    description: "Key numbers you want to highlight. Auto-filled with an empty, editable placeholder — we don't let AI invent numbers.",
    contentSource: "auto-filled",
    defaultSelected: false,
  },
  {
    id: "cardGrid",
    label: "Featured Work",
    description: "One card per role from your résumé, AI-written from your actual experience.",
    contentSource: "ai-generated",
    defaultSelected: true,
  },
  {
    id: "processSteps",
    label: "How I Work",
    description: "3 steps describing your working style, AI-synthesized from patterns across your experience.",
    contentSource: "ai-generated",
    defaultSelected: false,
  },
  {
    id: "topicGrid",
    label: "Topics & Interests",
    description: "2-4 topics grounded in your résumé, AI-generated.",
    contentSource: "ai-generated",
    defaultSelected: false,
  },
  {
    id: "logoCredentials",
    label: "Certifications & Credentials",
    description: "Auto-filled from the certifications on your résumé — we don't let AI invent credentials or logos.",
    contentSource: "auto-filled",
    defaultSelected: false,
  },
  {
    id: "chipGroups",
    label: "Skills",
    description: "Your extracted skills, AI-grouped into labeled categories.",
    contentSource: "ai-generated",
    defaultSelected: true,
  },
  {
    id: "textAndTimeline",
    label: "Bio & Career Timeline",
    description: "A short bio plus your career timeline, AI-written from your actual experience.",
    contentSource: "ai-generated",
    defaultSelected: true,
  },
  {
    id: "contactForm",
    label: "Contact",
    description: "A contact section — auto-filled with your extracted email and standard copy.",
    contentSource: "auto-filled",
    defaultSelected: true,
  },
];

export const SECTION_TYPE_IDS = SECTION_TYPES.map((s) => s.id) as SectionTypeId[];

export function isSectionTypeId(value: string): value is SectionTypeId {
  return (SECTION_TYPE_IDS as string[]).includes(value);
}
