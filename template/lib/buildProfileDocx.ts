// 2026-09-27 — server-only. Builds a .docx from the same structured
// `SiteConfig` data every section component already renders from — never
// scraped/re-parsed HTML, so this can't drift from what the schema actually
// contains or invent content the config doesn't have.
//
// Deliberately simple for this first version: plain paragraphs and bold
// labels, no tables/bullets/hyperlinks — kept to the small, well-established
// subset of the `docx` package's API (Document/Paragraph/TextRun/
// HeadingLevel/Packer) to minimize the risk of a misused API call, since
// this runs unattended on every request rather than being visually checked
// each time the way a one-off generated document normally would be.
//
// `contactForm` is deliberately skipped — a live form has no meaning in a
// static downloaded document, and its own text (heading/privacyNote) isn't
// profile content. This is a disclosed content-inclusion choice, not an
// oversight; worth confirming if a different subset is wanted.
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { SectionConfig, SiteConfig } from "@/config/types";
import { sectionHasContent } from "./sections";

function heading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } });
}

function body(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}

function boldLine(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true })], spacing: { after: 60 } });
}

function sectionParagraphs(section: SectionConfig): Paragraph[] {
  switch (section.type) {
    case "hero": {
      const out: Paragraph[] = [heading(section.heading ?? "Introduction")];
      out.push(boldLine(section.data.headline));
      if (section.data.supportingCopy) out.push(body(section.data.supportingCopy));
      return out;
    }
    case "metrics": {
      const out: Paragraph[] = [heading(section.heading ?? "Highlights")];
      section.data.forEach((m) => out.push(body(`${m.value} — ${m.label}`)));
      return out;
    }
    case "cardGrid": {
      const out: Paragraph[] = [heading(section.heading ?? "Work")];
      section.data.forEach((card) => {
        out.push(boldLine(card.tagline ? `${card.title} — ${card.tagline}` : card.title));
        out.push(body(card.description));
        if (card.chips && card.chips.length > 0) out.push(body(card.chips.join(", ")));
      });
      return out;
    }
    case "processSteps": {
      const out: Paragraph[] = [heading(section.heading ?? "How I Work")];
      section.data.forEach((step, i) => {
        out.push(boldLine(`${i + 1}. ${step.step}`));
        out.push(body(step.copy));
      });
      return out;
    }
    case "topicGrid": {
      const out: Paragraph[] = [heading(section.heading ?? "Perspectives")];
      section.data.forEach((t) => {
        out.push(boldLine(t.topic));
        out.push(body(t.angle));
      });
      return out;
    }
    case "logoCredentials": {
      const out: Paragraph[] = [heading(section.heading ?? "Certifications & Credentials")];
      section.data.items.forEach((item) => out.push(body(`${item.title} — ${item.issuer}`)));
      return out;
    }
    case "chipGroups": {
      const out: Paragraph[] = [heading(section.heading ?? "Skills")];
      section.data.forEach((group) => out.push(body(`${group.group}: ${group.chips.join(", ")}`)));
      return out;
    }
    case "textAndTimeline": {
      const out: Paragraph[] = [heading(section.heading ?? "About")];
      section.data.paragraphs.forEach((p) => out.push(body(p)));
      (section.data.timeline ?? []).forEach((entry) => {
        out.push(boldLine(`${entry.role}, ${entry.organization} (${entry.dates})`));
        if (entry.description) out.push(body(entry.description));
      });
      return out;
    }
    case "contactForm":
      return [];
    default:
      return [];
  }
}

export async function buildProfileDocx(config: SiteConfig): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: config.name, heading: HeadingLevel.TITLE, spacing: { after: 60 } }),
  ];
  if (config.role) {
    children.push(new Paragraph({ children: [new TextRun({ text: config.role, italics: true })], spacing: { after: 160 } }));
  }

  const contactLine = [config.social.email, config.social.linkedin, config.social.github, config.social.calendarBookingUrl]
    .filter((v): v is string => Boolean(v))
    .join("  ·  ");
  if (contactLine) children.push(body(contactLine));

  for (const section of config.sections) {
    if (!sectionHasContent(section)) continue;
    children.push(...sectionParagraphs(section));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
