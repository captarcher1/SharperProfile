import { config } from "@/config/site";
import LinkedinIcon from "@/components/icons/LinkedinIcon";
import GithubIcon from "@/components/icons/GithubIcon";
import DownloadProfileButton from "@/components/DownloadProfileButton";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-5 py-6 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
        <p className="text-sm text-ink-muted">
          © {year} {config.name}
        </p>
        {config.downloadEnabled && <DownloadProfileButton />}
        <div className="flex items-center gap-5">
          {config.social.linkedin && (
            <a
              href={config.social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-ink-muted hover:text-accent"
            >
              <LinkedinIcon size={18} />
            </a>
          )}
          {config.social.github && (
            <a
              href={config.social.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-ink-muted hover:text-accent"
            >
              <GithubIcon size={18} />
            </a>
          )}
          {/* Optional open-source attribution — add a link to this template's
              repo here once it's published, if you'd like to credit it. */}
          <p className="text-xs text-ink-muted">Built with the portfolio-website template</p>
        </div>
      </div>
    </footer>
  );
}
