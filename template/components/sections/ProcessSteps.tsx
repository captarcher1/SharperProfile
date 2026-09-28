import type { ProcessStepsData } from "@/config/types";
import Section from "@/components/layout/Section";
import CardWatermark from "@/components/CardWatermark";
import { iconMap } from "@/components/icons/iconMap";

// Curved connector shown between steps on desktop, echoing a "step 1 leads
// into step 2 leads into step 3" flow.
function LeadArrow() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-1 text-accent"
    >
      <path d="M3 17c4.5-7 11-11 17-11" />
      <path d="M13 4.5 20 6l-1.5 7" />
    </svg>
  );
}

export default function ProcessSteps({
  id,
  heading,
  data,
}: {
  id: string;
  heading?: string;
  data: ProcessStepsData;
}) {
  return (
    <Section id={id} heading={heading}>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-3">
        {data.map((item, index) => {
          const Icon = item.icon ? iconMap[item.icon] : undefined;
          return (
            <div key={item.step} className="flex flex-1 items-start gap-3">
              <div className="relative flex-1 overflow-hidden rounded-[16px] border border-border p-6 sm:p-7">
                {/* Offset by 3 so this section's hues differ from other card sections */}
                <CardWatermark title={item.step} tintIndex={index + 3} />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    {Icon && (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-surface">
                        <Icon size={20} className="text-gray-700" aria-hidden="true" />
                      </span>
                    )}
                    <p className="text-lg font-semibold text-ink-navy">{item.step}</p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-body">{item.copy}</p>
                </div>
              </div>
              {index < data.length - 1 && (
                <span className="mt-16 hidden shrink-0 md:block">
                  <LeadArrow />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
