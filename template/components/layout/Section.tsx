import type { ReactNode } from "react";

type SectionProps = {
  id: string;
  heading?: string;
  className?: string;
  children: ReactNode;
};

// Shared wrapper used by every section type: container width, top divider,
// heading typography, and spacing. Every section automatically gets the
// divider line — it's structural here, not something to remember per
// section (a bug class the original one-off-JSX version was prone to).
export default function Section({ id, heading, className = "", children }: SectionProps) {
  return (
    <section id={id} className={`border-t border-border ${className}`}>
      <div className="mx-auto max-w-[1200px] px-5 py-11 sm:px-8 md:py-14">
        {heading && (
          <h2 className="text-2xl font-semibold text-ink-navy sm:text-3xl">{heading}</h2>
        )}
        <div className={heading ? "mt-6" : ""}>{children}</div>
      </div>
    </section>
  );
}
