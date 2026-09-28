import Image from "next/image";
import { Mail, Calendar } from "lucide-react";
import type { HeroData } from "@/config/types";
import { config } from "@/config/site";
import SocialIconLink from "@/components/SocialIconLink";
import LinkedinIcon from "@/components/icons/LinkedinIcon";
import GithubIcon from "@/components/icons/GithubIcon";
import { initials } from "@/lib/initials";

export default function Hero({ id, data }: { id: string; data: HeroData }) {
  const { social, headshot, name, role } = config;

  return (
    <section
      id={id}
      className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-8 px-5 py-12 sm:px-8 md:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:py-20"
    >
      <div className="order-2 lg:order-1">
        {data.eyebrow && (
          <p className="text-sm font-semibold tracking-[0.14em] text-accent">{data.eyebrow}</p>
        )}
        <h1 className="mt-3 text-[40px] leading-[1.08] font-semibold tracking-tight text-ink-navy sm:text-[48px] lg:text-[62px] lg:leading-[1.05] xl:text-[70px]">
          {data.headline}
        </h1>
        {data.supportingCopy && (
          <p className="mt-5 max-w-[65ch] text-base leading-relaxed text-ink-body sm:text-lg">
            {data.supportingCopy}
          </p>
        )}
        {(data.primaryCta || data.secondaryCta) && (
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {data.primaryCta && (
              <a
                href={data.primaryCta.href}
                className="inline-flex h-12 items-center justify-center rounded-full bg-ink-navy px-6 text-sm font-medium text-white transition-colors hover:bg-accent"
              >
                {data.primaryCta.label}
              </a>
            )}
            {data.secondaryCta && (
              <a
                href={data.secondaryCta.href}
                className="inline-flex h-12 items-center justify-center rounded-full bg-surface px-6 text-sm font-medium text-ink-navy transition-colors hover:bg-border"
              >
                {data.secondaryCta.label}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="order-1 flex flex-col items-center lg:order-2 lg:items-end">
        <div className="flex w-48 flex-col items-center sm:w-64 lg:w-72">
          <div className="relative h-48 w-48 overflow-hidden rounded-[16px] border border-border bg-surface sm:h-64 sm:w-64 lg:h-72 lg:w-72">
            {headshot ? (
              <Image
                src={headshot}
                alt={`Portrait of ${name}`}
                fill
                sizes="(min-width: 1024px) 288px, (min-width: 640px) 256px, 192px"
                className="object-cover"
                priority
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-4xl font-semibold text-ink-muted"
                aria-hidden="true"
              >
                {initials(name)}
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-[18px] font-semibold text-ink-navy">{name}</p>
          <p className="text-center text-sm text-ink-muted">{role}</p>

          <div className="mt-4 flex items-center justify-center gap-3">
            {social.email && (
              <SocialIconLink href={`mailto:${social.email}`} label="Email" external={false}>
                <Mail size={18} />
              </SocialIconLink>
            )}
            {social.linkedin && (
              <SocialIconLink href={social.linkedin} label="LinkedIn">
                <LinkedinIcon size={18} />
              </SocialIconLink>
            )}
            {social.github && (
              <SocialIconLink href={social.github} label="GitHub">
                <GithubIcon size={18} />
              </SocialIconLink>
            )}
            {social.calendarBookingUrl && (
              <SocialIconLink href={social.calendarBookingUrl} label="Book a call">
                <Calendar size={18} />
              </SocialIconLink>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
