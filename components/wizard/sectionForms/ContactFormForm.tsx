import type { ContactFormData } from "@/lib/trackBSectionSchemas";
import { OptionalLinkField, TextAreaField, TextField } from "@/components/wizard/formPrimitives";

export function ContactFormForm({ value, onChange }: { value: ContactFormData; onChange: (value: ContactFormData) => void }) {
  return (
    <div className="sectionForm">
      <TextField
        label="Heading"
        required
        value={value.heading}
        onChange={(v) => onChange({ ...value, heading: v })}
        help="The title shown above your contact section — e.g. 'Start a conversation' or 'Get in touch.'"
      />
      <TextAreaField
        label="Supporting copy (optional)"
        value={value.supportingCopy ?? ""}
        onChange={(v) => onChange({ ...value, supportingCopy: v || undefined })}
        help="A short sentence inviting visitors to reach out. Optional — leave blank if the heading alone is enough."
      />
      <OptionalLinkField
        title="Social link (e.g. email)"
        value={value.socialLink}
        onChange={(v) => onChange({ ...value, socialLink: v })}
        help="A way to reach you — e.g. a mailto: link, LinkedIn profile, or contact form URL. Check the box to add one."
      />
      <TextAreaField
        label="Privacy note (optional)"
        value={value.privacyNote ?? ""}
        onChange={(v) => onChange({ ...value, privacyNote: v || undefined })}
        help="A short disclaimer shown near the contact section, if you want one — e.g. how you'll use a submitted message. Most sites leave this blank."
      />
    </div>
  );
}
