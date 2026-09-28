import type { SectionConfig } from "@/config/types";
import { sectionHasContent } from "@/lib/sections";
import Hero from "@/components/sections/Hero";
import Metrics from "@/components/sections/Metrics";
import CardGrid from "@/components/sections/CardGrid";
import ProcessSteps from "@/components/sections/ProcessSteps";
import TopicGrid from "@/components/sections/TopicGrid";
import LogoCredentials from "@/components/sections/LogoCredentials";
import ChipGroups from "@/components/sections/ChipGroups";
import TextAndTimeline from "@/components/sections/TextAndTimeline";
import ContactForm from "@/components/sections/ContactForm";

// Type -> component lookup. A disabled section, or one with an empty data
// array, is skipped entirely — see lib/sections.ts for the shared rule that
// keeps this in sync with what Navbar links to.
export default function SectionRenderer({ section }: { section: SectionConfig }) {
  if (!sectionHasContent(section)) return null;

  switch (section.type) {
    case "hero":
      return <Hero id={section.id} data={section.data} />;
    case "metrics":
      return <Metrics id={section.id} heading={section.heading} data={section.data} />;
    case "cardGrid":
      return <CardGrid id={section.id} heading={section.heading} data={section.data} />;
    case "processSteps":
      return <ProcessSteps id={section.id} heading={section.heading} data={section.data} />;
    case "topicGrid":
      return <TopicGrid id={section.id} heading={section.heading} data={section.data} />;
    case "logoCredentials":
      return <LogoCredentials id={section.id} heading={section.heading} data={section.data} />;
    case "chipGroups":
      return <ChipGroups id={section.id} heading={section.heading} data={section.data} />;
    case "textAndTimeline":
      return <TextAndTimeline id={section.id} heading={section.heading} data={section.data} />;
    case "contactForm":
      return <ContactForm id={section.id} data={section.data} />;
    default:
      return null;
  }
}
