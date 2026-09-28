import type { ChipGroupItem, ChipGroupsData } from "@/lib/trackBSectionSchemas";
import { ItemListEditor, TagListInput, TextField } from "@/components/wizard/formPrimitives";

export function ChipGroupsForm({ value, onChange }: { value: ChipGroupsData; onChange: (value: ChipGroupsData) => void }) {
  return (
    <ItemListEditor<ChipGroupItem>
      items={value}
      onChange={onChange}
      emptyItem={() => ({ group: "", chips: [] })}
      addLabel="Add group"
      itemLabel={(item, i) => item.group || `Group ${i + 1}`}
      renderItem={(item, update) => (
        <>
          <TextField
            label="Group name"
            required
            placeholder="e.g. Languages"
            value={item.group}
            onChange={(v) => update({ group: v })}
            help="A label for this category of skills, shown as a heading above its chips on the live site — e.g. 'Languages,' 'Tools,' or 'Frameworks.'"
          />
          <TagListInput
            label="Skills"
            value={item.chips}
            onChange={(v) => update({ chips: v })}
            placeholder="Type a skill and press Enter"
            help="The individual skills in this group, shown as small pills. Type one and press Enter (or a comma) to add it, or click a skill's × to remove it."
          />
        </>
      )}
    />
  );
}
