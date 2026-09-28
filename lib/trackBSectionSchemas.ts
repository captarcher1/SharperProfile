// Step 3 (B1/D2) — the wizard must validate generated content against Track
// B's real schema before ever treating it as "done" (R1's mitigation). Track
// A (this repo) and Track B (`portfolio-website`) are two separate git repos
// with no shared package between them, so this file MIRRORS the 9 per-type
// `data` shapes from Track B's real `config/types.ts` (read directly from
// that file, not re-typed from memory or guessed) rather than importing it.
//
// **Disclosed drift risk, same class as OQ-8's template-fetch discussion**:
// if Track B's `config/types.ts` changes after this was written, this file
// goes stale silently — nothing here can detect that automatically. Re-sync
// by hand against the real file if Track B's schema ever changes. Mirrored
// as of 2026-09-06.
//
// Track A's OWN schema.ts (5 AI-generated types only) is a DIFFERENT, looser
// shape used only to talk to the LLM (e.g. {title, description} for
// cardGrid) — it is NOT what Track B's site renders. lib/mapToTrackBData.ts
// is the translation layer between the two; this file is only the
// destination shape that translation must satisfy.
import { z } from "zod";
import type { SectionTypeId } from "@/lib/sectionTypes";

const linkSchema = z.object({
  label: z.string(),
  href: z.string(),
});
export type LinkData = z.infer<typeof linkSchema>;

export const heroDataSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string(),
  supportingCopy: z.string().optional(),
  primaryCta: linkSchema.optional(),
  secondaryCta: linkSchema.optional(),
});
export type HeroData = z.infer<typeof heroDataSchema>;

export const metricsDataSchema = z.array(
  z.object({
    value: z.string(),
    label: z.string(),
  })
);
export type MetricsData = z.infer<typeof metricsDataSchema>;
export type MetricItem = MetricsData[number];

export const cardGridDataSchema = z.array(
  z.object({
    title: z.string(),
    description: z.string(),
    tagline: z.string().optional(),
    icon: z.string().optional(),
    image: z.string().optional(),
    badge: z.string().optional(),
    chips: z.array(z.string()).optional(),
    href: z.string().optional(),
    linkLabel: z.string().optional(),
  })
);
export type CardGridData = z.infer<typeof cardGridDataSchema>;
export type CardGridItem = CardGridData[number];

export const processStepsDataSchema = z.array(
  z.object({
    step: z.string(),
    copy: z.string(),
    icon: z.string().optional(),
  })
);
export type ProcessStepsData = z.infer<typeof processStepsDataSchema>;
export type ProcessStepItem = ProcessStepsData[number];

export const topicGridDataSchema = z.array(
  z.object({
    topic: z.string(),
    angle: z.string(),
    icon: z.string().optional(),
  })
);
export type TopicGridData = z.infer<typeof topicGridDataSchema>;
export type TopicGridItem = TopicGridData[number];

export const logoCredentialsDataSchema = z.object({
  items: z.array(
    z.object({
      issuer: z.string(),
      title: z.string(),
      href: z.string().optional(),
      logo: z.string().optional(),
    })
  ),
  moreLink: linkSchema.optional(),
});
export type LogoCredentialsData = z.infer<typeof logoCredentialsDataSchema>;
export type LogoCredentialItem = LogoCredentialsData["items"][number];

export const chipGroupsDataSchema = z.array(
  z.object({
    group: z.string(),
    chips: z.array(z.string()),
  })
);
export type ChipGroupsData = z.infer<typeof chipGroupsDataSchema>;
export type ChipGroupItem = ChipGroupsData[number];

export const textAndTimelineDataSchema = z.object({
  paragraphs: z.array(z.string()),
  timeline: z
    .array(
      z.object({
        organization: z.string(),
        role: z.string(),
        dates: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
});
export type TextAndTimelineData = z.infer<typeof textAndTimelineDataSchema>;
export type TimelineEntry = NonNullable<TextAndTimelineData["timeline"]>[number];

export const contactFormDataSchema = z.object({
  heading: z.string().default("Start a conversation"),
  supportingCopy: z.string().optional(),
  socialLink: linkSchema.optional(),
  privacyNote: z.string().optional(),
});
export type ContactFormData = z.infer<typeof contactFormDataSchema>;

const DATA_SCHEMA_BY_TYPE: Record<SectionTypeId, z.ZodTypeAny> = {
  hero: heroDataSchema,
  metrics: metricsDataSchema,
  cardGrid: cardGridDataSchema,
  processSteps: processStepsDataSchema,
  topicGrid: topicGridDataSchema,
  logoCredentials: logoCredentialsDataSchema,
  chipGroups: chipGroupsDataSchema,
  textAndTimeline: textAndTimelineDataSchema,
  contactForm: contactFormDataSchema,
};

export type SectionDataValidation =
  | { valid: true; data: unknown }
  | { valid: false; errors: string[] };

/** Validates `data` against Track B's real per-type shape for `sectionType` (D2). */
export function validateTrackBSectionData(sectionType: SectionTypeId, data: unknown): SectionDataValidation {
  const schema = DATA_SCHEMA_BY_TYPE[sectionType];
  const result = schema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  return { valid: true, data: result.data };
}
