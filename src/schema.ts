// Step 2 (phase1-build-plan.md) — structured-output contract for B1 (LLM-generated
// section content), exactly as specified in pipeline-acceptance-criteria.md §2.1–2.2.
// This is schema validation only (reliability-ladder rung 1/2) — it catches
// malformed JSON and wrong shapes. It CANNOT catch business-rule violations like
// "the card count doesn't match the real entry count" or "a skill got dropped" —
// those need the semantic validators in validators.ts (§2.3), which run AFTER a
// response passes this schema.
//
// WHERE THIS BELONGS LONG-TERM: same placeholder situation as src/types.ts — the
// PRD wants this in the template scaffold's config/types.ts, which doesn't exist
// yet. Move both files there together once it does, so B1 and B2 share one type
// source instead of two that can drift apart.

import { z } from "zod";

// --- §2.2 per-type content shapes ---

export const CardGridContentSchema = z.object({
  cards: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
    })
  ),
});
export type CardGridContent = z.infer<typeof CardGridContentSchema>;

export const ProcessStepsContentSchema = z.object({
  // Fixed cardinality per pipeline-acceptance-criteria.md §2.2's cardinality
  // table: "steps.length === 3, fixed" — enforced here, at the schema layer,
  // rather than left as a semantic check, since it's a structural constraint
  // exactly like the shape checks above it, not a business rule that needs
  // B2 context to evaluate (unlike cardGrid/textAndTimeline's completeness
  // rule, which genuinely can't be schema-enforced since "3" isn't the right
  // number for every resume — AC-PS1).
  steps: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
    })
  ).length(3),
});
export type ProcessStepsContent = z.infer<typeof ProcessStepsContentSchema>;

export const TopicGridContentSchema = z.object({
  topics: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
    })
  ),
});
export type TopicGridContent = z.infer<typeof TopicGridContentSchema>;

export const ChipGroupsContentSchema = z.object({
  groups: z.array(
    z.object({
      label: z.string().min(1),
      skills: z.array(z.string().min(1)),
    })
  ),
});
export type ChipGroupsContent = z.infer<typeof ChipGroupsContentSchema>;

export const TextAndTimelineContentSchema = z.object({
  bio: z.string().min(1),
  timeline: z.array(
    z.object({
      role: z.string().min(1),
      company: z.string().min(1),
      dates: z.string().min(1),
    })
  ),
});
export type TextAndTimelineContent = z.infer<typeof TextAndTimelineContentSchema>;

export const SECTION_TYPES = ["cardGrid", "processSteps", "topicGrid", "chipGroups", "textAndTimeline"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

const CONTENT_SCHEMA_BY_TYPE = {
  cardGrid: CardGridContentSchema,
  processSteps: ProcessStepsContentSchema,
  topicGrid: TopicGridContentSchema,
  chipGroups: ChipGroupsContentSchema,
  textAndTimeline: TextAndTimelineContentSchema,
} as const;

// --- §2.1 common envelope ---
//
// content's shape depends on sectionType, and is null/omitted when
// status === "insufficient_evidence" (§2.3 rule 4, escape-hatch consistency).
// zod's discriminated union can't easily express "content shape depends on a
// DIFFERENT field's value" cleanly without duplicating every content schema
// per status, so the envelope schema validates structure only (content is
// z.unknown() at this layer) and EnvelopeContentSchema below re-validates
// content against the right per-type shape once sectionType is known. This
// two-step approach mirrors how a real implementation would work anyway: you
// have to read sectionType before you know which schema to hand the model's
// response to.

export const EnvelopeSchema = z.object({
  sectionKey: z.string().min(1),
  sectionType: z.enum(SECTION_TYPES),
  status: z.enum(["ok", "insufficient_evidence"]),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string().min(1).optional(),
  userMessage: z.string().min(1).optional(),
  injectionWarning: z.boolean(),
  content: z.unknown(),
});
export type Envelope = z.infer<typeof EnvelopeSchema>;

export type SchemaValidationResult =
  | { valid: true; envelope: Envelope; content: unknown }
  | { valid: false; errors: string[] };

/**
 * Full schema validation: parse the envelope, then — ONLY when status is
 * "ok" — parse `content` against the schema matching `sectionType`. When
 * status is "insufficient_evidence", content is expected to be empty/null
 * (checked by the semantic escape-hatch-consistency rule, not here) so
 * there's no per-type shape to validate it against.
 */
export function validateEnvelopeSchema(raw: unknown): SchemaValidationResult {
  const envelopeResult = EnvelopeSchema.safeParse(raw);
  if (!envelopeResult.success) {
    return { valid: false, errors: envelopeResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const envelope = envelopeResult.data;

  if (envelope.status === "insufficient_evidence") {
    // Content shape doesn't apply here — escape-hatch-consistency (semantic
    // rule 4) is responsible for checking content is actually empty/null.
    return { valid: true, envelope, content: envelope.content };
  }

  const contentSchema = CONTENT_SCHEMA_BY_TYPE[envelope.sectionType];
  const contentResult = contentSchema.safeParse(envelope.content);
  if (!contentResult.success) {
    return {
      valid: false,
      errors: contentResult.error.issues.map((i) => `content.${i.path.join(".")}: ${i.message}`),
    };
  }
  return { valid: true, envelope, content: contentResult.data };
}
