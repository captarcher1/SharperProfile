import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { LogoCredentialsData } from "@/config/types";
import Section from "@/components/layout/Section";
import { initials } from "@/lib/initials";

export default function LogoCredentials({
  id,
  heading,
  data,
}: {
  id: string;
  heading?: string;
  data: LogoCredentialsData;
}) {
  return (
    <Section id={id} heading={heading}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
        {data.items.map((item) => {
          const card = (
            <>
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-border bg-background">
                {item.logo ? (
                  <Image src={item.logo} alt={`${item.issuer} logo`} fill sizes="44px" className="object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-ink-muted" aria-hidden="true">
                    {initials(item.issuer)}
                  </span>
                )}
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  {item.issuer}
                </span>
                <span className="mt-1 text-sm font-semibold text-ink-navy">{item.title}</span>
                {item.href && (
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent group-hover:underline">
                    Verify credential
                    <ArrowUpRight size={14} />
                  </span>
                )}
              </span>
            </>
          );
          const className =
            "group flex items-start gap-4 rounded-[16px] border border-border bg-surface p-6 transition-colors hover:border-accent";
          return item.href ? (
            <a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
              {card}
            </a>
          ) : (
            <div key={item.title} className={className}>
              {card}
            </div>
          );
        })}
      </div>
      {data.moreLink && (
        <a
          href={data.moreLink.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          {data.moreLink.label}
          <ArrowUpRight size={15} />
        </a>
      )}
    </Section>
  );
}
