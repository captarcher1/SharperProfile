import type { TextAndTimelineData } from "@/config/types";
import Section from "@/components/layout/Section";

export default function TextAndTimeline({
  id,
  heading,
  data,
}: {
  id: string;
  heading?: string;
  data: TextAndTimelineData;
}) {
  return (
    <Section id={id} heading={heading}>
      {data.paragraphs.map((p, i) => (
        <p key={i} className="mt-4 max-w-[70ch] text-base leading-relaxed text-ink-body first:mt-0">
          {p}
        </p>
      ))}

      {data.timeline && data.timeline.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-ink-navy">Timeline</h3>
          <ol className="mt-5 space-y-6 border-l border-border pl-6">
            {data.timeline.map((entry) => (
              <li key={`${entry.organization}-${entry.dates}`} className="relative">
                <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                <p className="text-xs font-semibold tracking-wide text-ink-muted">{entry.dates}</p>
                <p className="mt-1 text-base font-semibold text-ink-navy">
                  {entry.role} · {entry.organization}
                </p>
                {entry.description && (
                  <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-ink-body">
                    {entry.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Section>
  );
}
