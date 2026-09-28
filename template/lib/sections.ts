import type { SectionConfig } from "@/config/types";

// Single source of truth for "does this section have anything to show,"
// used by both SectionRenderer (to decide what to render) and Navbar (to
// decide what to link to) — so the nav can never drift out of sync with what
// actually appears on the page.
export function sectionHasContent(section: SectionConfig): boolean {
  if (!section.enabled) return false;

  switch (section.type) {
    case "hero":
      return true;
    case "logoCredentials":
      return section.data.items.length > 0;
    case "textAndTimeline":
      return section.data.paragraphs.length > 0;
    case "contactForm":
      return true;
    case "metrics":
    case "cardGrid":
    case "processSteps":
    case "topicGrid":
    case "chipGroups":
      return section.data.length > 0;
    default:
      return false;
  }
}
