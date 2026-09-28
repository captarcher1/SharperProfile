import type { ProcessStepItem, ProcessStepsData } from "@/lib/trackBSectionSchemas";
import { ItemListEditor, TextAreaField, TextField } from "@/components/wizard/formPrimitives";

export function ProcessStepsForm({ value, onChange }: { value: ProcessStepsData; onChange: (value: ProcessStepsData) => void }) {
  return (
    <ItemListEditor<ProcessStepItem>
      items={value}
      onChange={onChange}
      emptyItem={() => ({ step: "", copy: "" })}
      addLabel="Add step"
      itemLabel={(item, i) => item.step || `Step ${i + 1}`}
      renderItem={(item, update) => (
        <>
          <TextField
            label="Step name"
            required
            placeholder="e.g. Discover"
            value={item.step}
            onChange={(v) => update({ step: v })}
            help="A short name for one phase or principle of how you work — this site shows exactly 3 of these steps in order."
          />
          <TextAreaField
            label="Description"
            value={item.copy}
            onChange={(v) => update({ copy: v })}
            help="1-2 sentences explaining this step, grounded in real patterns from your actual experience — avoid naming a specific methodology, framework, or certification you don't actually hold."
          />
        </>
      )}
    />
  );
}
