import type { TopicGridData } from "@/config/types";
import Section from "@/components/layout/Section";
import CardWatermark from "@/components/CardWatermark";
import { iconMap } from "@/components/icons/iconMap";

export default function TopicGrid({
  id,
  heading,
  data,
}: {
  id: string;
  heading?: string;
  data: TopicGridData;
}) {
  return (
    <Section id={id} heading={heading}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-7">
        {data.map((item, index) => {
          const Icon = item.icon ? iconMap[item.icon] : undefined;
          return (
            <div
              key={item.topic}
              className="relative overflow-hidden rounded-[16px] border border-border p-6 sm:p-7"
            >
              <CardWatermark title={item.topic} tintIndex={index + 1} />
              <div className="relative">
                <div className="flex items-center gap-3">
                  {Icon && (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-surface">
                      <Icon size={20} className="text-gray-700" aria-hidden="true" />
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-ink-navy">{item.topic}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-body">{item.angle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
