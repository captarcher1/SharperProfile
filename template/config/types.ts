// Config schema for the whole site. Validated at dev/build time with zod so a
// typo or missing field fails with a clear, specific error message instead of
// a cryptic React crash — this matters for an audience that may not be
// engineers (per the plan's Assumption A4).
//
// Every section is a typed, ordered, toggleable entry in `sections`. Add,
// remove, reorder, or rename a section by editing `config/site.ts` only —
// never by editing component code. Nav links and page order are both derived
// from this same array, so they can never drift out of sync with each other.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const linkSchema = z.object({
  label: z.string(),
  href: z.string(),
});

// ---------------------------------------------------------------------------
// Per-section-type data shapes
// ---------------------------------------------------------------------------

const heroDataSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string(),
  supportingCopy: z.string().optional(),
  primaryCta: linkSchema.optional(),
  secondaryCta: linkSchema.optional(),
});

const metricsDataSchema = z.array(
  z.object({
    value: z.string(),
    label: z.string(),
  })
);

// Covers both the image-led "product" card style and the icon-led "work" card
// style from the original site — image and icon are both optional so one
// config can mix either presentation per card.
const cardGridDataSchema = z.array(
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

const processStepsDataSchema = z.array(
  z.object({
    step: z.string(),
    copy: z.string(),
    icon: z.string().optional(),
  })
);

const topicGridDataSchema = z.array(
  z.object({
    topic: z.string(),
    angle: z.string(),
    icon: z.string().optional(),
  })
);

const logoCredentialsDataSchema = z.object({
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

const chipGroupsDataSchema = z.array(
  z.object({
    group: z.string(),
    chips: z.array(z.string()),
  })
);

const textAndTimelineDataSchema = z.object({
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

const contactFormDataSchema = z.object({
  heading: z.string().default("Start a conversation"),
  supportingCopy: z.string().optional(),
  socialLink: linkSchema.optional(),
  privacyNote: z.string().optional(),
  // The Web3Forms access key itself is never stored here — it's read from
  // NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY at build time (see .env.example). Keeping
  // it out of the config schema means it can never end up in a config/site.ts
  // a user accidentally commits.
});

// ---------------------------------------------------------------------------
// The section union
// ---------------------------------------------------------------------------
// A discriminated union keyed on `type`, so TypeScript narrows `data` to the
// right shape for each section automatically.

const baseSectionFields = {
  id: z.string(),
  heading: z.string().optional(),
  navLabel: z.string().optional(),
  enabled: z.boolean().default(true),
};

export const sectionConfigSchema = z.discriminatedUnion("type", [
  z.object({ ...baseSectionFields, type: z.literal("hero"), data: heroDataSchema }),
  z.object({ ...baseSectionFields, type: z.literal("metrics"), data: metricsDataSchema }),
  z.object({ ...baseSectionFields, type: z.literal("cardGrid"), data: cardGridDataSchema }),
  z.object({ ...baseSectionFields, type: z.literal("processSteps"), data: processStepsDataSchema }),
  z.object({ ...baseSectionFields, type: z.literal("topicGrid"), data: topicGridDataSchema }),
  z.object({ ...baseSectionFields, type: z.literal("logoCredentials"), data: logoCredentialsDataSchema }),
  z.object({ ...baseSectionFields, type: z.literal("chipGroups"), data: chipGroupsDataSchema }),
  z.object({ ...baseSectionFields, type: z.literal("textAndTimeline"), data: textAndTimelineDataSchema }),
  z.object({ ...baseSectionFields, type: z.literal("contactForm"), data: contactFormDataSchema }),
]);

// ---------------------------------------------------------------------------
// Site identity (used by Hero, Navbar, Footer, and page metadata)
// ---------------------------------------------------------------------------

const socialLinksSchema = z.object({
  email: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  calendarBookingUrl: z.string().optional(),
});

export const siteConfigSchema = z.object({
  name: z.string(),
  role: z.string(),
  headshot: z.string().optional(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  social: socialLinksSchema.default({}),
  sections: z.array(sectionConfigSchema),
  // 2026-09-27 — opt-in "Download as Word / PDF" button, shown in the
  // Footer when true. Optional + undefined-safe everywhere it's read
  // (`config.downloadEnabled ?? false`-equivalent via `sectionHasContent`-
  // style guards) so a site.ts written before this field existed still
  // builds cleanly with the button simply absent.
  downloadEnabled: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Inferred TS types — import these in components, not the zod schemas
// directly.
// ---------------------------------------------------------------------------

export type Link = z.infer<typeof linkSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type SectionConfig = z.infer<typeof sectionConfigSchema>;
export type SectionType = SectionConfig["type"];

export type HeroData = z.infer<typeof heroDataSchema>;
export type MetricsData = z.infer<typeof metricsDataSchema>;
export type CardGridData = z.infer<typeof cardGridDataSchema>;
export type ProcessStepsData = z.infer<typeof processStepsDataSchema>;
export type TopicGridData = z.infer<typeof topicGridDataSchema>;
export type LogoCredentialsData = z.infer<typeof logoCredentialsDataSchema>;
export type ChipGroupsData = z.infer<typeof chipGroupsDataSchema>;
export type TextAndTimelineData = z.infer<typeof textAndTimelineDataSchema>;
export type ContactFormData = z.infer<typeof contactFormDataSchema>;

// ---------------------------------------------------------------------------
// Validation entry point — called once from config/site.ts itself, so a
// misconfigured file fails immediately and loudly at dev/build time.
// ---------------------------------------------------------------------------

export function defineSiteConfig(config: SiteConfig): SiteConfig {
  const result = siteConfigSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid site config in config/site.ts — fix the following and restart:\n${issues}`
    );
  }
  return result.data;
}
