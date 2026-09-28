import type { ChipGroupsData } from "@/config/types";
import Section from "@/components/layout/Section";

export default function ChipGroups({
  id,
  heading,
  data,
}: {
  id: string;
  heading?: string;
  data: ChipGroupsData;
}) {
  return (
    <Section id={id} heading={heading}>
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <div key={item.group}>
            <h3 className="text-lg font-semibold text-ink-navy">{item.group}</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-body"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
