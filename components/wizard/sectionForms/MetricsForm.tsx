import type { MetricItem, MetricsData } from "@/lib/trackBSectionSchemas";
import { ItemListEditor, TextField } from "@/components/wizard/formPrimitives";

export function MetricsForm({ value, onChange }: { value: MetricsData; onChange: (value: MetricsData) => void }) {
  return (
    <ItemListEditor<MetricItem>
      items={value}
      onChange={onChange}
      emptyItem={() => ({ value: "", label: "" })}
      addLabel="Add metric"
      itemLabel={(item, i) => item.label || item.value || `Metric ${i + 1}`}
      renderItem={(item, update) => (
        <div className="formRow">
          <TextField
            label="Value"
            placeholder="e.g. 150+"
            value={item.value}
            onChange={(v) => update({ value: v })}
            help="The big number shown for this metric — e.g. '150+,' '$40M,' or '12 years.' This is auto-filled as an empty placeholder since we never let AI invent numbers — fill in a real figure yourself."
          />
          <TextField
            label="Label"
            placeholder="e.g. Projects shipped"
            value={item.label}
            onChange={(v) => update({ label: v })}
            help="The short caption under the number, explaining what it counts — e.g. 'Projects shipped' or 'Years of experience.'"
          />
        </div>
      )}
    />
  );
}
