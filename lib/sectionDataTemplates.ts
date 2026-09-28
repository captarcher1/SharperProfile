// Step 3 (B1) — starting JSON for the review/edit screen's edit box when a
// section has no usable data yet (an "invalid" or "insufficient_evidence"
// result) — an empty, schema-shaped skeleton rather than a blank box, so the
// user is editing toward a shape that will actually pass D2 validation.
import type { SectionTypeId } from "@/lib/sectionTypes";

export const SECTION_DATA_TEMPLATE: Record<SectionTypeId, unknown> = {
  hero: { headline: "", supportingCopy: "" },
  metrics: [],
  cardGrid: [],
  processSteps: [],
  topicGrid: [],
  logoCredentials: { items: [] },
  chipGroups: [],
  textAndTimeline: { paragraphs: [], timeline: [] },
  contactForm: { heading: "Start a conversation" },
};
