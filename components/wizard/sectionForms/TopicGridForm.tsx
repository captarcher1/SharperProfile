import type { TopicGridData, TopicGridItem } from "@/lib/trackBSectionSchemas";
import { ItemListEditor, TextAreaField, TextField } from "@/components/wizard/formPrimitives";

export function TopicGridForm({ value, onChange }: { value: TopicGridData; onChange: (value: TopicGridData) => void }) {
  return (
    <ItemListEditor<TopicGridItem>
      items={value}
      onChange={onChange}
      emptyItem={() => ({ topic: "", angle: "" })}
      addLabel="Add topic"
      itemLabel={(item, i) => item.topic || `Topic ${i + 1}`}
      renderItem={(item, update) => (
        <>
          <TextField
            label="Topic"
            required
            value={item.topic}
            onChange={(v) => update({ topic: v })}
            help="A short name for a professional interest or focus area — e.g. a technology, methodology, or industry theme you're drawn to."
          />
          <TextAreaField
            label="Angle"
            value={item.angle}
            onChange={(v) => update({ angle: v })}
            help="Write this in first person, as if you're describing yourself ('I've long been focused on...', 'This reflects my...') — never in third person. Say either a direct fact about your interest, or what your career pattern suggests, but keep it grounded in your actual experience rather than a generic claim."
          />
        </>
      )}
    />
  );
}
