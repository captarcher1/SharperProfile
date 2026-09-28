import type { HeroData } from "@/lib/trackBSectionSchemas";
import { OptionalLinkField, TextAreaField, TextField } from "@/components/wizard/formPrimitives";

export function HeroForm({ value, onChange }: { value: HeroData; onChange: (value: HeroData) => void }) {
  return (
    <div className="sectionForm">
      <TextField
        label="Eyebrow (small text above the headline)"
        value={value.eyebrow ?? ""}
        onChange={(v) => onChange({ ...value, eyebrow: v || undefined })}
        placeholder="e.g. Business Analyst"
        help="A short line shown in small text above your main headline — usually your role or a one-word category. Leave blank to skip it."
      />
      <TextField
        label="Headline"
        required
        value={value.headline}
        onChange={(v) => onChange({ ...value, headline: v })}
        help="The main, large text at the top of your site — usually your name or a short personal tagline. This is the first thing a visitor reads."
      />
      <TextAreaField
        label="Supporting copy"
        value={value.supportingCopy ?? ""}
        onChange={(v) => onChange({ ...value, supportingCopy: v || undefined })}
        help="A sentence or two under the headline expanding on who you are or what you do. Optional, but most sites use this to add a bit more context than the headline alone."
      />
      <OptionalLinkField
        title="Primary button"
        value={value.primaryCta}
        onChange={(v) => onChange({ ...value, primaryCta: v })}
        help="The main call-to-action button on your homepage — e.g. 'Contact me' or 'View résumé.' Check the box to add one, and fill in its text and destination URL."
      />
      <OptionalLinkField
        title="Secondary button"
        value={value.secondaryCta}
        onChange={(v) => onChange({ ...value, secondaryCta: v })}
        help="A second, less prominent button next to the primary one — e.g. a link to LinkedIn or a portfolio. Optional."
      />
    </div>
  );
}
