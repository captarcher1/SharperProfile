// Step 3 (B1) — the actual Generate action. Orchestrates Track A's existing
// pipeline (D1: not modified) for the 5 AI-generated section types, and
// lib/autoFill.ts's deterministic builders for the 4 auto-filled ones (per
// the 2026-09-06 scope-gap resolution). Per A9 (confirmed): always
// regenerates every currently-selected section in one call — no partial/
// incremental regenerate in v1.
//
// Failure handling, deliberately asymmetric (see code comments below):
// a THROWN error from a provider call (bad/revoked key, network, rate
// limit — B1 failure case 1) aborts the whole batch immediately and leaves
// session state untouched, so a retry never loses Step 1/2 data. A
// per-section schema-validation failure (B1 failure case F2 — the call
// succeeded but the content doesn't validate against Track B's schema, D2)
// is instead recorded as that one section's own result, so the rest of the
// review screen still renders normally rather than the whole draft dying
// over one bad section.
import { NextRequest, NextResponse } from "next/server";
import { getProvider, type ProviderName } from "@/src/providers";
import { buildSectionRequest, type ModelSectionResponse, type SectionDefinition, buildEnvelope } from "@/src/prompts/buildRequest";
import { validateEnvelopeSchema, SECTION_TYPES as AI_GENERATED_TYPES, type SectionType } from "@/src/schema";
import { SECTION_TYPES, type SectionTypeId } from "@/lib/sectionTypes";
import { AUTO_FILL_SECTION_TYPES, buildAutoFilledData } from "@/lib/autoFill";
import { validateTrackBSectionData } from "@/lib/trackBSectionSchemas";
import {
  mapCardGridToTrackB,
  mapChipGroupsToTrackB,
  mapProcessStepsToTrackB,
  mapTextAndTimelineToTrackB,
  mapTopicGridToTrackB,
} from "@/lib/mapToTrackBData";
import { getModelForProvider } from "@/lib/providerModels";
import { isProviderName } from "@/lib/providerConfig";
import { checkProviderAvailability } from "@/lib/providerAvailability";
import { readSessionId, getSession, setStep3Result, type SectionGenerationResult } from "@/lib/wizard-state";

const SECTION_LABEL_BY_ID = new Map(SECTION_TYPES.map((s) => [s.id, s.label]));

// Raised 2026-09-08 from 1500 (no particular evidence backed that original
// number — it wasn't a tested/deliberate constraint anywhere in this
// project's docs) after a real, live failure: 4 of 5 AI-generated section
// types produced no valid content against a local Qwen3 model, while the
// one needing the least generation (chipGroups, just regrouping an
// already-known skill list) succeeded — consistent with the harder,
// more-synthesis sections running out of token budget before finishing
// their JSON. Doubled rather than left exact-margin, since the real
// per-section cost genuinely varies (a résumé with many jobs needs a longer
// cardGrid than one with few) and cloud providers charge per output token
// regardless, so there's no reason to cut this close.
const GENERATE_MAX_TOKENS = 3000;

/**
 * Some models (this project has directly observed it with a local Qwen3
 * model via Ollama, even with `format`/schema-forced decoding and thinking
 * explicitly disabled) still wrap their JSON in a markdown code fence, or
 * leave incidental whitespace around it. Stripping this defensively costs
 * nothing for a provider that already returns bare JSON (the common case,
 * and the only case actually verified live for Anthropic/OpenRouter) and
 * fixes a real class of otherwise-silent "didn't produce valid content"
 * failures for ones that don't. Deliberately conservative: only strips a
 * wrapping fence and outer whitespace, never attempts to repair or
 * bracket-match truncated/malformed JSON — a response that's genuinely
 * broken should still fail, visibly, rather than have this quietly guess
 * at what was meant.
 */
function cleanModelJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function mapAiContentToTrackB(sectionType: SectionType, content: unknown): unknown {
  switch (sectionType) {
    case "cardGrid":
      return mapCardGridToTrackB(content as never);
    case "processSteps":
      return mapProcessStepsToTrackB(content as never);
    case "topicGrid":
      return mapTopicGridToTrackB(content as never);
    case "chipGroups":
      return mapChipGroupsToTrackB(content as never);
    case "textAndTimeline":
      return mapTextAndTimelineToTrackB(content as never);
  }
}

export async function POST(request: NextRequest) {
  const sessionId = readSessionId(request);
  const session = sessionId ? getSession(sessionId) : undefined;

  if (!session?.step1) {
    return NextResponse.json(
      { ok: false, code: "NO_RESUME", message: "Please complete Step 1 first." },
      { status: 400 }
    );
  }
  if (!session.step2 || session.step2.selectedSectionTypes.length === 0) {
    // Edge case 3: Step 3 must not assume Step 2 enforced a non-empty
    // selection — check again here rather than trusting the client.
    return NextResponse.json(
      { ok: false, code: "NO_SECTIONS", message: "Please choose at least one section in Step 2 before generating." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const providerRaw = (body as { provider?: unknown })?.provider;

  const selected = session.step2.selectedSectionTypes;
  const aiGenerated = selected.filter((id): id is SectionType => (AI_GENERATED_TYPES as readonly string[]).includes(id));
  const autoFilled = selected.filter((id) => AUTO_FILL_SECTION_TYPES.includes(id));

  let provider: ProviderName | null = null;
  if (aiGenerated.length > 0) {
    if (typeof providerRaw !== "string" || !isProviderName(providerRaw)) {
      // Failure case 3: block entirely rather than attempting a call with
      // no usable credential — route the client back to the configure flow.
      return NextResponse.json(
        { ok: false, code: "NO_PROVIDER_SELECTED", message: "Please choose and configure a provider first." },
        { status: 400 }
      );
    }
    provider = providerRaw;
    const availability = await checkProviderAvailability(provider);
    if (!availability.configured) {
      return NextResponse.json(
        { ok: false, code: "PROVIDER_NOT_CONFIGURED", message: `${provider} isn't configured yet: ${availability.reason}` },
        { status: 400 }
      );
    }
  }

  const sections: Partial<Record<SectionTypeId, SectionGenerationResult>> = {};

  // Auto-filled sections first — no network call, can't fail per B1's
  // failure taxonomy (only "how do we render this" concerns, handled by D2
  // validation same as the AI-generated path).
  for (const sectionType of autoFilled) {
    const data = buildAutoFilledData(sectionType, session.step1.facts);
    const validation = validateTrackBSectionData(sectionType, data);
    sections[sectionType] = validation.valid
      ? { status: "ok", data: validation.data, source: "auto-filled", edited: false }
      : { status: "invalid", message: `Auto-fill produced content that didn't validate: ${validation.errors.join("; ")}` };
  }

  if (aiGenerated.length > 0 && provider) {
    const providerInstance = getProvider(provider);
    const model = getModelForProvider(provider);

    for (const sectionType of aiGenerated) {
      const definition: SectionDefinition = {
        key: sectionType,
        type: sectionType,
        header: SECTION_LABEL_BY_ID.get(sectionType) ?? sectionType,
      };
      const request_ = buildSectionRequest(definition, session.step1.facts);

      let raw: string;
      try {
        const result = await providerInstance.generate({ ...request_, model, maxTokens: GENERATE_MAX_TOKENS });
        raw = result.raw;
      } catch (error) {
        // B1 failure case 1: a thrown error here means the provider call
        // itself failed (bad/revoked key, rate limit, network) — this is a
        // whole-batch problem, not a per-section one, so abort immediately
        // rather than burning further calls against a broken credential.
        // Session state (Step 1/2, and any prior Step 3 draft) is left
        // untouched — nothing is written until the whole batch succeeds.
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
          {
            ok: false,
            code: "PROVIDER_CALL_FAILED",
            message: `${provider} rejected the request: ${message}`,
          },
          { status: 502 }
        );
      }

      let modelResponse: ModelSectionResponse;
      try {
        modelResponse = JSON.parse(cleanModelJsonText(raw)) as ModelSectionResponse;
      } catch (error) {
        // Diagnostic only (server console, never shown to the user) — this
        // was previously a silent, unrecoverable black box: any JSON.parse
        // failure produced the exact same generic message with no way to
        // tell a truncated response from a wrapped one from genuinely
        // malformed content. Logging the raw text (bounded, so one bad
        // response can't flood the terminal) makes a future failure like
        // this actually diagnosable from the wizard's own terminal output.
        console.error(
          `[wizard/generate] ${provider}/${model}: JSON.parse failed for section "${sectionType}" — ` +
            `${error instanceof Error ? error.message : String(error)}\n` +
            `Raw response (first 1000 chars): ${raw.slice(0, 1000)}`
        );
        sections[sectionType] = {
          status: "invalid",
          message: `Generation didn't produce valid content for ${SECTION_LABEL_BY_ID.get(sectionType)} — try again or pick a different provider.`,
        };
        continue;
      }

      const envelope = buildEnvelope(definition, modelResponse);
      const envelopeValidation = validateEnvelopeSchema(envelope);
      if (!envelopeValidation.valid) {
        console.error(
          `[wizard/generate] ${provider}/${model}: envelope schema validation failed for section "${sectionType}":\n` +
            envelopeValidation.errors.map((e) => `  - ${e}`).join("\n") +
            `\nParsed response: ${JSON.stringify(modelResponse).slice(0, 1000)}`
        );
        sections[sectionType] = {
          status: "invalid",
          message: `Generation didn't produce valid content for ${SECTION_LABEL_BY_ID.get(sectionType)} — try again or pick a different provider.`,
        };
        continue;
      }

      if (envelopeValidation.envelope.status === "insufficient_evidence") {
        sections[sectionType] = {
          status: "insufficient_evidence",
          message: envelopeValidation.envelope.userMessage ?? envelopeValidation.envelope.reason ?? "Not enough information was found for this section.",
        };
        continue;
      }

      const trackBData = mapAiContentToTrackB(sectionType, envelopeValidation.content);
      const trackBValidation = validateTrackBSectionData(sectionType, trackBData);
      if (!trackBValidation.valid) {
        console.error(
          `[wizard/generate] ${provider}/${model}: Track B schema validation failed for section "${sectionType}":\n` +
            trackBValidation.errors.map((e) => `  - ${e}`).join("\n") +
            `\nMapped data: ${JSON.stringify(trackBData).slice(0, 1000)}`
        );
      }
      sections[sectionType] = trackBValidation.valid
        ? { status: "ok", data: trackBValidation.data, source: "ai-generated", edited: false }
        : {
            status: "invalid",
            message: `Generation didn't produce valid content for ${SECTION_LABEL_BY_ID.get(sectionType)} — try again or pick a different provider.`,
          };
    }
  }

  const step3Result = {
    provider,
    generatedAt: Date.now(),
    sections,
  };
  setStep3Result(sessionId!, step3Result);

  return NextResponse.json({ ok: true, step3: step3Result });
}
