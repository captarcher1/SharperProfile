import type { TextAndTimelineData, TimelineEntry } from "@/lib/trackBSectionSchemas";
import { ItemListEditor, ParagraphsField, TextAreaField, TextField } from "@/components/wizard/formPrimitives";

export function TextAndTimelineForm({
  value,
  onChange,
}: {
  value: TextAndTimelineData;
  onChange: (value: TextAndTimelineData) => void;
}) {
  const timeline = value.timeline ?? [];
  return (
    <div className="sectionForm">
      <ParagraphsField
        label="Bio"
        value={value.paragraphs}
        onChange={(paragraphs) => onChange({ ...value, paragraphs })}
        help="A short summary of your career, 2-4 sentences. Separate paragraphs with a blank line. Match your own tone to your career stage — plain and grounded for early-career, a more confident register for senior."
      />
      <ItemListEditor<TimelineEntry>
        items={timeline}
        onChange={(t) => onChange({ ...value, timeline: t })}
        emptyItem={() => ({ organization: "", role: "", dates: "" })}
        addLabel="Add timeline entry"
        itemLabel={(item, i) => item.role || `Entry ${i + 1}`}
        renderItem={(item, update) => (
          <>
            <div className="formRow">
              <TextField
                label="Role"
                required
                value={item.role}
                onChange={(v) => update({ role: v })}
                help="Your job title at this organization."
              />
              <TextField
                label="Organization"
                required
                value={item.organization}
                onChange={(v) => update({ organization: v })}
                help="The employer or organization name for this role."
              />
            </div>
            <TextField
              label="Dates"
              required
              placeholder="e.g. 2022-Present"
              value={item.dates}
              onChange={(v) => update({ dates: v })}
              help="The date range for this role, shown exactly as typed here — e.g. '2022-Present' or 'Jan 2019 - Mar 2021.'"
            />
            <TextAreaField
              label="Description (optional)"
              value={item.description ?? ""}
              onChange={(v) => update({ description: v || undefined })}
              help="An optional sentence or two on what this role involved. Leave blank if the role/organization/dates already say enough on their own."
            />
          </>
        )}
      />
    </div>
  );
}
