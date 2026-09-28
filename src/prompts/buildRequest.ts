// Step 4 — ties the system prompt, section instructions, resume facts, and
// response schema together into one provider-agnostic request, and turns a
// model's (deliberately partial — see responseSchema.ts) response back into
// a full envelope matching schema.ts's EnvelopeSchema.

import type { ExtractionResult } from "../types";
import type { SectionType } from "../schema";
import type { StructuredGenerationRequest } from "../providers";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { buildSectionInstructions } from "./sectionPrompts";
import { buildModelResponseSchema } from "./responseSchema";

export interface SectionDefinition {
  /** Matches schema.ts's EnvelopeSchema.sectionKey — a stable id for this section, e.g. "work", "awards". */
  key: string;
  type: SectionType;
  /** Human-readable heading a user gave this section, e.g. "Selected Work", "Awards & Recognition". */
  header: string;
  /**
   * What to call the missing material in the default insufficient_evidence
   * userMessage (changelog #5's template, e.g. "awards, honors, or
   * recognitions" for an Awards section). Defaults to a lowercased version
   * of `header` if not given — good enough for most cases, but a caller
   * building a real section list should usually pass something more
   * natural for sections whose header doesn't read well lowercased inline
   * (see buildDefaultUserMessage below for exactly how it's used).
   */
  topicDescriptor?: string;
}

/**
 * Renders B2's extracted facts into the delimited text block the model
 * receives (AC-S1: everything inside the markers is data, never
 * instructions). Includes everything B2 found, not just what a given
 * section type strictly needs — richer context only helps groundedness and
 * lets the model correctly find real material for a user-defined section
 * B2 doesn't have a dedicated field for (e.g. "Awards & Recognition" living
 * inside unrecognizedSections, per AC-F1's Devon reference case).
 */
export function formatResumeFactsText(extraction: ExtractionResult): string {
  const lines: string[] = [];
  lines.push(`Name: ${extraction.name ?? "(not found)"}`);
  if (extraction.headline) lines.push(`Headline: ${extraction.headline}`);
  if (extraction.summary) lines.push(`Summary: ${extraction.summary}`);

  lines.push("");
  lines.push(`Skills (${extraction.skills.length}): ${extraction.skills.length > 0 ? extraction.skills.join(", ") : "(none found)"}`);

  lines.push("");
  lines.push(`Experience (${extraction.experience.length} entries, in order):`);
  extraction.experience.forEach((e, i) => {
    const dates = e.dateRange?.raw ?? "(dates unknown)";
    lines.push(`${i + 1}. ${e.title} — ${e.company} (${dates})${e.ambiguous ? " [NOTE: extraction was ambiguous about this entry's boundaries]" : ""}`);
    for (const b of e.bullets) lines.push(`   - ${b}`);
  });

  if (extraction.education.length > 0) {
    lines.push("");
    lines.push("Education:");
    for (const ed of extraction.education) lines.push(`- ${ed}`);
  }

  if (extraction.certifications.length > 0) {
    lines.push("");
    lines.push("Certifications:");
    for (const c of extraction.certifications) lines.push(`- ${c}`);
  }

  if (extraction.unrecognizedSections.length > 0) {
    lines.push("");
    lines.push("Other sections found in the resume:");
    for (const s of extraction.unrecognizedSections) {
      lines.push(`${s.header}:`);
      for (const line of s.content) lines.push(`   ${line}`);
    }
  }

  return lines.join("\n");
}

/**
 * Full provider-agnostic request for one section — everything except
 * `model` (a provider/deployment choice, not a prompt concern), which the
 * caller supplies.
 */
export function buildSectionRequest(
  section: SectionDefinition,
  extraction: ExtractionResult
): Omit<StructuredGenerationRequest, "model"> {
  const factsText = formatResumeFactsText(extraction);
  const instructions = buildSectionInstructions(section.type, {
    sourceEntryCount: extraction.experience.length,
    skillList: extraction.skills,
  });

  const userPrompt = [
    `This section's heading is "${section.header}".`,
    "",
    instructions,
    "",
    "--- RESUME FACTS START ---",
    factsText,
    "--- RESUME FACTS END ---",
  ].join("\n");

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    jsonSchema: buildModelResponseSchema(section.type),
    temperature: 0,
  };
}

/**
 * What the model is actually asked to produce — see responseSchema.ts for
 * why this is narrower than the full envelope, and for why this is a flat
 * shape rather than a `status`-discriminated union: Anthropic's structured
 * outputs don't support `oneOf` (confirmed live, 8/29/2026 — see
 * responseSchema.ts), so both `reason` and `content` are always present in
 * the raw JSON, with whichever one doesn't apply to the actual status set
 * to `null` by the model per the system prompt's instructions — not
 * enforced at the schema level, verified by Step 2's escape-hatch-
 * consistency semantic rule after the fact instead.
 */
export type ModelSectionResponse = {
  status: "ok" | "insufficient_evidence";
  confidence: "high" | "medium" | "low";
  reason: string | null;
  content: unknown | null;
};

function buildDefaultUserMessage(section: SectionDefinition): string {
  const descriptor = section.topicDescriptor ?? section.header.toLowerCase();
  return `We didn't find any ${descriptor} in your resume for this section. Add a few of your own below, or remove this section if it doesn't apply.`;
}

/**
 * Merges a model's (partial) response into the full envelope shape
 * schema.ts's EnvelopeSchema expects — filling in sectionKey/sectionType
 * (already known, not requested from the model), userMessage (our fixed
 * template, not model prose — see responseSchema.ts's file header), and
 * injectionWarning.
 *
 * injectionWarning is hardcoded false here with a TODO rather than wired to
 * a real check: the heuristic pre-check (AC-S2) is Step 9's job, not built
 * yet. Defaulting to false is the honest placeholder — it means Step 4's
 * envelopes are not yet AC-F3-compliant for genuinely suspicious input, and
 * that gap is real, not hidden.
 */
export function buildEnvelope(section: SectionDefinition, modelResponse: ModelSectionResponse): Record<string, unknown> {
  const base = {
    sectionKey: section.key,
    sectionType: section.type,
    status: modelResponse.status,
    confidence: modelResponse.confidence,
    // TODO(Step 9): wire to the real heuristic pre-check result instead of
    // a hardcoded false once AC-S2 is built.
    injectionWarning: false,
  };

  if (modelResponse.status === "insufficient_evidence") {
    return {
      ...base,
      // Falls back to a generic reason if the model left this null despite
      // choosing insufficient_evidence — schema.ts's EnvelopeSchema requires
      // a non-empty reason string, so this keeps a model's (rare, spec-
      // violating) null from turning into a schema failure that obscures
      // what actually happened.
      reason: modelResponse.reason ?? "No supporting evidence was found for this section.",
      userMessage: buildDefaultUserMessage(section),
      content: null,
    };
  }

  return {
    ...base,
    // Passed through as-is, including a null the model shouldn't have sent
    // for status "ok" — schema.ts's per-type content schema will correctly
    // reject that on the next validation step rather than this function
    // quietly working around it.
    content: modelResponse.content,
  };
}
