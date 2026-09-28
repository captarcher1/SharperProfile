import type { CardGridData, CardGridItem } from "@/lib/trackBSectionSchemas";
import { ItemListEditor, TagListInput, TextAreaField, TextField } from "@/components/wizard/formPrimitives";

export function CardGridForm({ value, onChange }: { value: CardGridData; onChange: (value: CardGridData) => void }) {
  return (
    <ItemListEditor<CardGridItem>
      items={value}
      onChange={onChange}
      emptyItem={() => ({ title: "", description: "" })}
      addLabel="Add card"
      itemLabel={(item, i) => item.title || `Card ${i + 1}`}
      renderItem={(item, update) => (
        <>
          <TextField
            label="Title"
            required
            value={item.title}
            onChange={(v) => update({ title: v })}
            help="A short, specific headline for this card — what the achievement or role was about, not just a repeat of your job title."
          />
          <TextAreaField
            label="Description"
            value={item.description}
            onChange={(v) => update({ description: v })}
            help="1-2 sentences on what you did and the result, grounded in this one role. If a dollar figure represents impact you personally delivered, keep it written as a range (e.g. '$15M–$20M') rather than one exact number."
          />
          <div className="formRow">
            <TextField
              label="Tagline (optional)"
              value={item.tagline ?? ""}
              onChange={(v) => update({ tagline: v || undefined })}
              help="A very short sub-label shown under the title on the live site — e.g. a role or team name. Leave blank if the title already says enough."
            />
            <TextField
              label="Badge (optional)"
              value={item.badge ?? ""}
              onChange={(v) => update({ badge: v || undefined })}
              help="A small tag shown on the card, like 'Featured' or a year. Leave blank if you don't want one."
            />
          </div>
          <TagListInput
            label="Chips (optional)"
            value={item.chips ?? []}
            onChange={(v) => update({ chips: v.length > 0 ? v : undefined })}
            help="Small keyword pills shown on the card (e.g. tools or skills used in this role). Type one and press Enter to add it, or click a chip's × to remove it."
          />
          <div className="formRow">
            <TextField
              label="Link URL (optional)"
              value={item.href ?? ""}
              onChange={(v) => update({ href: v || undefined })}
              help="Where this card links to if clicked — e.g. a project write-up or company site. Leave both link fields blank to make the card non-clickable."
            />
            <TextField
              label="Link text (optional)"
              value={item.linkLabel ?? ""}
              onChange={(v) => update({ linkLabel: v || undefined })}
              help="The clickable text shown for the link above, e.g. 'View project.' Only shown if you also set a Link URL."
            />
          </div>
        </>
      )}
    />
  );
}
