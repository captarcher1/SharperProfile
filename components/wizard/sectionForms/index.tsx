// Step 3 (B1) — dispatches to the right per-type form, and defensively
// coerces whatever data is on hand (a real generated/auto-filled value, the
// empty template for an invalid/insufficient section, or anything in
// between) into a shape each form can render without crashing. The actual
// safety net is still server-side (validateTrackBSectionData, D2) — this
// coercion only has to be good enough for editing, not authoritative.
import type { SectionTypeId } from "@/lib/sectionTypes";
import type {
  CardGridData,
  ChipGroupsData,
  ContactFormData,
  HeroData,
  LogoCredentialsData,
  MetricsData,
  ProcessStepsData,
  TextAndTimelineData,
  TopicGridData,
} from "@/lib/trackBSectionSchemas";
import { HeroForm } from "@/components/wizard/sectionForms/HeroForm";
import { MetricsForm } from "@/components/wizard/sectionForms/MetricsForm";
import { CardGridForm } from "@/components/wizard/sectionForms/CardGridForm";
import { ProcessStepsForm } from "@/components/wizard/sectionForms/ProcessStepsForm";
import { TopicGridForm } from "@/components/wizard/sectionForms/TopicGridForm";
import { LogoCredentialsForm } from "@/components/wizard/sectionForms/LogoCredentialsForm";
import { ChipGroupsForm } from "@/components/wizard/sectionForms/ChipGroupsForm";
import { TextAndTimelineForm } from "@/components/wizard/sectionForms/TextAndTimelineForm";
import { ContactFormForm } from "@/components/wizard/sectionForms/ContactFormForm";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fills in a safe, schema-shaped default for anything missing/wrong-typed on `value`, per section type. */
export function coerceSectionData(sectionType: SectionTypeId, value: unknown): unknown {
  switch (sectionType) {
    case "hero": {
      const v = isRecord(value) ? value : {};
      return {
        eyebrow: typeof v.eyebrow === "string" ? v.eyebrow : undefined,
        headline: typeof v.headline === "string" ? v.headline : "",
        supportingCopy: typeof v.supportingCopy === "string" ? v.supportingCopy : undefined,
        primaryCta: isRecord(v.primaryCta) ? v.primaryCta : undefined,
        secondaryCta: isRecord(v.secondaryCta) ? v.secondaryCta : undefined,
      } as HeroData;
    }
    case "metrics":
      return Array.isArray(value) ? value : [];
    case "cardGrid":
      return Array.isArray(value) ? value : [];
    case "processSteps":
      return Array.isArray(value) ? value : [];
    case "topicGrid":
      return Array.isArray(value) ? value : [];
    case "chipGroups":
      return Array.isArray(value) ? value : [];
    case "logoCredentials": {
      const v = isRecord(value) ? value : {};
      return {
        items: Array.isArray(v.items) ? v.items : [],
        moreLink: isRecord(v.moreLink) ? v.moreLink : undefined,
      } as LogoCredentialsData;
    }
    case "textAndTimeline": {
      const v = isRecord(value) ? value : {};
      return {
        paragraphs: Array.isArray(v.paragraphs) ? v.paragraphs : [],
        timeline: Array.isArray(v.timeline) ? v.timeline : [],
      } as TextAndTimelineData;
    }
    case "contactForm": {
      const v = isRecord(value) ? value : {};
      return {
        heading: typeof v.heading === "string" ? v.heading : "Start a conversation",
        supportingCopy: typeof v.supportingCopy === "string" ? v.supportingCopy : undefined,
        socialLink: isRecord(v.socialLink) ? v.socialLink : undefined,
        privacyNote: typeof v.privacyNote === "string" ? v.privacyNote : undefined,
      } as ContactFormData;
    }
  }
}

export function SectionForm({
  sectionType,
  value,
  onChange,
}: {
  sectionType: SectionTypeId;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (sectionType) {
    case "hero":
      return <HeroForm value={value as HeroData} onChange={onChange} />;
    case "metrics":
      return <MetricsForm value={value as MetricsData} onChange={onChange} />;
    case "cardGrid":
      return <CardGridForm value={value as CardGridData} onChange={onChange} />;
    case "processSteps":
      return <ProcessStepsForm value={value as ProcessStepsData} onChange={onChange} />;
    case "topicGrid":
      return <TopicGridForm value={value as TopicGridData} onChange={onChange} />;
    case "logoCredentials":
      return <LogoCredentialsForm value={value as LogoCredentialsData} onChange={onChange} />;
    case "chipGroups":
      return <ChipGroupsForm value={value as ChipGroupsData} onChange={onChange} />;
    case "textAndTimeline":
      return <TextAndTimelineForm value={value as TextAndTimelineData} onChange={onChange} />;
    case "contactForm":
      return <ContactFormForm value={value as ContactFormData} onChange={onChange} />;
    default:
      return null;
  }
}
