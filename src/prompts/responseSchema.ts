// Step 4 (phase1-build-plan.md) — the JSON Schema sent to a provider's
// schema-forced generation (Step 3's `jsonSchema` field), one per
// SectionType, per pipeline-acceptance-criteria.md §2.2's content shapes.
//
// Design decision, worth stating explicitly: the model is NOT asked to
// produce the full envelope from schema.ts's EnvelopeSchema (§2.1). It's
// only asked for the parts it actually has to decide: `status`, `confidence`,
// and — depending on status — either `content` or a `reason`. `sectionKey`
// and `sectionType` are already known deterministically by whichever code
// is calling the model (it decided which section to generate); asking the
// model to echo them back just creates a new way for the response to be
// wrong (a typo'd key, a hallucinated type) for zero benefit. `userMessage`
// is deliberately NOT requested from the model either — see buildRequest.ts
// for why (it's a fixed template our own code fills in, not model prose).
// `injectionWarning` is set by the heuristic pre-check (AC-S2, Step 9 — not
// built yet), which is a deterministic check that runs BEFORE generation;
// there's no reason to ask the model to self-report on its own input after
// the fact. All four of these are merged in by buildEnvelope() in
// buildRequest.ts, not requested here.
//
// The two `status` branches are modeled as a JSON Schema `oneOf`, mirroring
// exactly what validators.ts's escape-hatch-consistency rule (§2.3 rule 4)
// checks post-hoc — belt-and-suspenders: the request-time schema and the
// response-time semantic rule agree on the same shape, they just enforce it
// at different points in the reliability ladder.

import type { SectionType } from "../schema";

const CONFIDENCE_ENUM = { type: "string", enum: ["high", "medium", "low"] } as const;

// --- §2.2 per-type content shapes, as JSON Schema (hand-mirrored from
// schema.ts's zod definitions — see Step 3's README note on why this
// project doesn't auto-derive JSON Schema from zod: zod-to-json-schema is
// deprecated upstream, and the SDK's own zodOutputFormat() helper needs
// zod/v4-authored schemas, which would mean migrating the already-shipped,
// tested schema.ts off zod v3 for a convenience this step doesn't need). ---

const CARD_GRID_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string", minLength: 1 }, description: { type: "string", minLength: 1 } },
        required: ["title", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
} as const;

const PROCESS_STEPS_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    // AC-PS1: exactly 3 steps, always. NOT enforced here via minItems/
    // maxItems — confirmed live (8/29/2026) that Anthropic's structured
    // outputs reject any `minItems` other than 0 or 1: `output_config.
    // format.schema: For 'array' type, 'minItems' values other than 0 or 1
    // are not supported`. Cardinality is instead carried entirely by the
    // prompt instruction (sectionPrompts.ts) and enforced for real by
    // schema.ts's ProcessStepsContentSchema (.length(3)) once the response
    // comes back — exactly the rung-1-vs-rung-2 split the reliability
    // ladder is built around; this request-time schema was never the
    // actual enforcement point, just a best-effort nudge.
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string", minLength: 1 }, description: { type: "string", minLength: 1 } },
        required: ["title", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["steps"],
  additionalProperties: false,
} as const;

const TOPIC_GRID_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    // AC-TG1: 2-4 topics, flexing with evidence density. Same minItems
    // constraint dropped for the same reason as processSteps above — see
    // that comment. Prompt-instructed only; schema.ts intentionally
    // doesn't fix a count for this type either (2-4 is a range, not a
    // single enforceable number).
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string", minLength: 1 }, description: { type: "string", minLength: 1 } },
        required: ["title", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["topics"],
  additionalProperties: false,
} as const;

const CHIP_GROUPS_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          label: { type: "string", minLength: 1 },
          skills: { type: "array", items: { type: "string", minLength: 1 } },
        },
        required: ["label", "skills"],
        additionalProperties: false,
      },
    },
  },
  required: ["groups"],
  additionalProperties: false,
} as const;

const TEXT_AND_TIMELINE_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    bio: { type: "string", minLength: 1 },
    timeline: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string", minLength: 1 },
          company: { type: "string", minLength: 1 },
          dates: { type: "string", minLength: 1 },
        },
        required: ["role", "company", "dates"],
        additionalProperties: false,
      },
    },
  },
  required: ["bio", "timeline"],
  additionalProperties: false,
} as const;

const CONTENT_SCHEMA_BY_TYPE: Record<SectionType, Record<string, unknown>> = {
  cardGrid: CARD_GRID_CONTENT_SCHEMA,
  processSteps: PROCESS_STEPS_CONTENT_SCHEMA,
  topicGrid: TOPIC_GRID_CONTENT_SCHEMA,
  chipGroups: CHIP_GROUPS_CONTENT_SCHEMA,
  textAndTimeline: TEXT_AND_TIMELINE_CONTENT_SCHEMA,
};

/**
 * Builds the full request-time JSON Schema for one section type.
 *
 * REVISED after live testing against the real API (8/29/2026) — the first
 * version of this function used a top-level `oneOf` to express "ok" vs.
 * "insufficient_evidence" as two mutually exclusive shapes. Anthropic's
 * structured outputs rejected it outright: `output_config.format.schema:
 * Schema type 'oneOf' is not supported` (a live 400 on all 35 of Step 4's
 * first baseline run, not a guess — see phase1-build-plan.md's Step 4
 * status for the full story). Verified the fix empirically before rewriting
 * everything: Anthropic's structured outputs use the same "all fields
 * required, optionality expressed via a nullable type union" convention
 * OpenAI's strict mode uses (`"type": ["string", "null"]` rather than a
 * `oneOf`/`anyOf` branch) — confirmed with two minimal live test calls, one
 * per branch, both round-tripping correctly.
 *
 * So every field is now always `required`, and the two fields that only
 * apply to one status branch (`reason`, `content`) are typed as
 * `["<real type>", "null"]` instead of being conditionally present. The
 * model is instructed (systemPrompt.ts) which one to leave null for a given
 * status; nothing at the schema level *forces* that correlation — that's
 * exactly what Step 2's escape-hatch-consistency semantic rule is for
 * (reliability-ladder rung 2 catching what rung 1's schema-forcing can't).
 */
export function buildModelResponseSchema(sectionType: SectionType): Record<string, unknown> {
  const contentSchema = CONTENT_SCHEMA_BY_TYPE[sectionType];
  return {
    type: "object",
    properties: {
      status: { type: "string", enum: ["ok", "insufficient_evidence"] },
      confidence: CONFIDENCE_ENUM,
      // Null when status is "ok" — only meaningful as the internal
      // explanation for why insufficient_evidence fired.
      reason: { type: ["string", "null"] },
      // Null when status is "insufficient_evidence"; the type-specific
      // shape (with its own cardinality constraints, e.g. processSteps'
      // fixed 3) applies only when non-null.
      content: { type: [(contentSchema as any).type, "null"], ...omitType(contentSchema) },
    },
    required: ["status", "confidence", "reason", "content"],
    additionalProperties: false,
  };
}

function omitType(schema: Record<string, unknown>): Record<string, unknown> {
  const { type, ...rest } = schema;
  return rest;
}
