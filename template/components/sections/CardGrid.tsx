import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { CardGridData } from "@/config/types";
import Section from "@/components/layout/Section";
import CardWatermark from "@/components/CardWatermark";
import { iconMap } from "@/components/icons/iconMap";

// Covers both presentation styles from the original site in one component:
// an item with an `image` renders as an image-led external-link card; an
// item without one renders as an icon-led card with the watermark treatment.
export default function CardGrid({
  id,
  heading,
  data,
}: {
  id: string;
  heading?: string;
  data: CardGridData;
}) {
  return (
    <Section id={id} heading={heading}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-7">
        {data.map((item, index) =>
          item.image ? (
            <ImageCard key={item.title} {...item} />
          ) : (
            <IconCard key={item.title} {...item} tintIndex={index} />
          )
        )}
      </div>
    </Section>
  );
}

function ImageCard({
  title,
  tagline,
  description,
  image,
  badge,
  chips,
  href,
  linkLabel,
}: CardGridData[number]) {
  const content = (
    <>
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border bg-surface">
        <Image
          src={image!}
          alt={`Screenshot of ${title}`}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover object-top"
        />
      </div>
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        {badge && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {badge}
          </span>
        )}
        <h3 className="mt-3 text-lg font-semibold text-ink-navy">{title}</h3>
        {tagline && <p className="mt-1 text-sm font-medium text-accent">{tagline}</p>}
        <p className="mt-3 text-sm leading-relaxed text-ink-body">{description}</p>
        {chips && chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-muted"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
        {href && (
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent">
            {linkLabel ?? "View project"}
            <ArrowUpRight size={15} />
          </span>
        )}
      </div>
    </>
  );

  const className =
    "group flex flex-col overflow-hidden rounded-[16px] border border-border bg-background transition-colors hover:border-accent";

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

function IconCard({
  title,
  description,
  icon,
  badge,
  href,
  linkLabel,
  tintIndex = 0,
}: CardGridData[number] & { tintIndex?: number }) {
  const Icon = icon ? iconMap[icon] : undefined;
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-border p-6 sm:p-7">
      <CardWatermark title={title} tintIndex={tintIndex} />
      <div className="relative">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-surface">
              <Icon size={20} className="text-gray-700" aria-hidden="true" />
            </span>
          )}
          <h3 className="text-lg font-semibold text-ink-navy">{title}</h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-body">{description}</p>
        {badge && !href && <p className="mt-3 text-xs text-ink-muted">{badge}</p>}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            {linkLabel ?? "Learn more"}
            <ArrowUpRight size={15} />
          </a>
        )}
      </div>
    </div>
  );
}
