import type { ReactNode } from "react";

type SocialIconLinkProps = {
  href: string;
  label: string;
  children: ReactNode;
  external?: boolean;
};

// Circular icon-button link, used under the Hero portrait.
export default function SocialIconLink({
  href,
  label,
  children,
  external = true,
}: SocialIconLinkProps) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-ink-navy transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </a>
  );
}
