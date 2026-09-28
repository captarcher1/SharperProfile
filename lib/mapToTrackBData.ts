// Step 3 (B1) — translates Track A's own envelope content shapes
// (src/schema.ts's 5 CONTENT_SCHEMA_BY_TYPE — built for talking to the LLM,
// e.g. cardGrid's {cards:[{title,description}]}) into Track B's real
// per-section `data` shapes (lib/trackBSectionSchemas.ts, mirrored from
// config/types.ts). These are genuinely different shapes, not a rename —
// field names differ (processSteps: title/description → step/copy;
// topicGrid: title/description → topic/angle; chipGroups: label/skills →
// group/chips) and the wrapper object Track A uses ({cards:[...]},
// {steps:[...]}, etc.) doesn't exist on Track B's side, which just wants a
// bare array for 4 of the 5 types.
//
// This is exactly the kind of silent-passthrough risk R1 warns about — the
// output of this function still goes through validateTrackBSectionData()
// (D2) before the wizard ever treats it as accepted, so a mapping bug here
// surfaces as a validation failure, not a corrupted published site.
import type {
  CardGridContent,
  ChipGroupsContent,
  ProcessStepsContent,
  TextAndTimelineContent,
  TopicGridContent,
} from "@/src/schema";

export function mapCardGridToTrackB(content: CardGridContent) {
  return content.cards.map((c) => ({ title: c.title, description: c.description }));
}

export function mapProcessStepsToTrackB(content: ProcessStepsContent) {
  return content.steps.map((s) => ({ step: s.title, copy: s.description }));
}

export function mapTopicGridToTrackB(content: TopicGridContent) {
  return content.topics.map((t) => ({ topic: t.title, angle: t.description }));
}

export function mapChipGroupsToTrackB(content: ChipGroupsContent) {
  return content.groups.map((g) => ({ group: g.label, chips: g.skills }));
}

export function mapTextAndTimelineToTrackB(content: TextAndTimelineContent) {
  return {
    // Track A's bio is a single string; Track B wants paragraphs — split on
    // blank lines if the model produced any, otherwise treat the whole bio
    // as one paragraph rather than inventing a split point.
    paragraphs: content.bio.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0),
    timeline: content.timeline.map((t) => ({
      organization: t.company,
      role: t.role,
      dates: t.dates,
      // No per-entry description in Track A's shape — left undefined
      // rather than invented; Track B's field is optional for exactly
      // this reason.
    })),
  };
}
