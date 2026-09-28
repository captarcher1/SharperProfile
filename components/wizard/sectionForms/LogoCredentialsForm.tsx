import type { LogoCredentialItem, LogoCredentialsData } from "@/lib/trackBSectionSchemas";
import { ItemListEditor, OptionalLinkField, TextField } from "@/components/wizard/formPrimitives";

export function LogoCredentialsForm({
  value,
  onChange,
}: {
  value: LogoCredentialsData;
  onChange: (value: LogoCredentialsData) => void;
}) {
  return (
    <div className="sectionForm">
      <ItemListEditor<LogoCredentialItem>
        items={value.items}
        onChange={(items) => onChange({ ...value, items })}
        emptyItem={() => ({ issuer: "", title: "" })}
        addLabel="Add credential"
        itemLabel={(item, i) => item.title || `Credential ${i + 1}`}
        renderItem={(item, update) => (
          <>
            <div className="formRow">
              <TextField
                label="Issuer"
                required
                placeholder="e.g. Project Management Institute"
                value={item.issuer}
                onChange={(v) => update({ issuer: v })}
                help="The organization that granted this certification or credential."
              />
              <TextField
                label="Title"
                required
                placeholder="e.g. PMP"
                value={item.title}
                onChange={(v) => update({ title: v })}
                help="The name of the certification or credential itself, usually as an abbreviation — e.g. 'PMP' or 'CPA.'"
              />
            </div>
            <div className="formRow">
              <TextField
                label="Link (optional)"
                value={item.href ?? ""}
                onChange={(v) => update({ href: v || undefined })}
                help="A URL to verify this credential, if you have one (e.g. a badge or verification page). Leave blank if not applicable."
              />
              <TextField
                label="Logo path (optional)"
                value={item.logo ?? ""}
                onChange={(v) => update({ logo: v || undefined })}
                help="An image path or URL for this issuer's logo, if you want one shown. This is an advanced field — most people leave it blank and the site falls back to text only."
              />
            </div>
          </>
        )}
      />
      <OptionalLinkField
        title="'See all credentials' link"
        value={value.moreLink}
        onChange={(v) => onChange({ ...value, moreLink: v })}
        help="An optional link shown after your credential list, pointing to a fuller list elsewhere (e.g. your LinkedIn certifications tab). Leave unchecked if you'd rather just show the list above."
      />
    </div>
  );
}
