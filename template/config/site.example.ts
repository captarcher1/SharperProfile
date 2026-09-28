// Example configuration — checked into git, ships with fully fictional
// placeholder content. This is what a fresh `git clone` + `npm install` shows
// on `npm run dev`: nobody sees anyone's real data by default.
//
// To use this for your own site: `npm install` copies this file to
// `config/site.ts` automatically (see scripts/setup.mjs) if it doesn't exist
// yet. Edit `config/site.ts`, not this file — `site.ts` is git-ignored, so
// your real content never gets committed here.
//
// Every person, company, project, and credential below is invented for this
// example and does not describe a real individual or organization.

import { defineSiteConfig } from "./types";

export const config = defineSiteConfig({
  name: "Jordan Ellis",
  role: "Product Manager, Platform & Growth",
  headshot: "/images/placeholder-avatar.svg",
  metaTitle: "Jordan Ellis | Product Manager",
  metaDescription:
    "Portfolio of a fictional product manager — example content shipped with the portfolio-website template.",

  social: {
    email: "jordan.ellis@example.com",
    linkedin: "https://www.linkedin.com/in/example",
    github: "https://github.com/example",
    calendarBookingUrl: "https://calendar.example.com/jordan-ellis",
  },

  // Shows a "Download as Word / PDF" button in the footer — set to false or
  // remove entirely to leave it off.
  downloadEnabled: true,

  sections: [
    {
      id: "top",
      type: "hero",
      enabled: true,
      data: {
        eyebrow: "PRODUCT MANAGEMENT · PLATFORM · GROWTH",
        headline:
          "Building products that make complicated workflows feel simple.",
        supportingCopy:
          "I lead cross-functional teams that ship platform and growth features for mid-market SaaS products, working closely with design and engineering from problem framing through launch.",
        primaryCta: { label: "See selected work", href: "#work" },
        secondaryCta: { label: "Get in touch", href: "#contact" },
      },
    },
    {
      id: "impact",
      type: "metrics",
      enabled: true,
      data: [
        { value: "4", label: "Products shipped to GA" },
        { value: "12", label: "Cross-functional launches led" },
        { value: "3", label: "Teams grown and mentored" },
        { value: "2", label: "Industries worked across" },
      ],
    },
    {
      id: "work",
      type: "cardGrid",
      heading: "Selected Work",
      navLabel: "Work",
      enabled: true,
      data: [
        {
          title: "Onboarding Redesign",
          description:
            "Rebuilt first-run onboarding for a project-management SaaS product, cutting time-to-first-value and reducing early churn.",
          icon: "Compass",
          badge: "Case study available on request",
        },
        {
          title: "Usage-Based Billing",
          description:
            "Led the shift from seat-based to usage-based pricing, including migration tooling for existing customers.",
          icon: "TrendingUp",
        },
        {
          title: "Internal Analytics Platform",
          description:
            "Defined and shipped a self-serve analytics tool used by support and success teams to answer their own questions.",
          icon: "Workflow",
        },
      ],
    },
    {
      id: "projects",
      type: "cardGrid",
      heading: "Side Projects",
      navLabel: "Projects",
      enabled: true,
      data: [
        {
          title: "Habit Tracker",
          tagline: "A small, opinionated habit tracker",
          description:
            "A weekend project exploring streak-based motivation design, built with a simple config-driven data model.",
          image: "/images/placeholder-project.svg",
          badge: "Open source",
          chips: ["Next.js", "SQLite"],
          href: "https://github.com/example/habit-tracker",
          linkLabel: "View on GitHub",
        },
      ],
    },
    {
      id: "approach",
      type: "processSteps",
      heading: "How I Work",
      navLabel: "Approach",
      enabled: true,
      data: [
        {
          step: "Frame the problem",
          copy: "Start from the user's actual workflow, not the feature request, and get explicit about what success looks like before writing a spec.",
          icon: "Search",
        },
        {
          step: "Build with the team",
          copy: "Stay close to design and engineering throughout, not just at kickoff and review — the best tradeoffs get made in the middle of the work.",
          icon: "Bot",
        },
        {
          step: "Ship and learn",
          copy: "Launch in the smallest slice that teaches something real, then use what's learned to decide the next slice.",
          icon: "Rocket",
        },
      ],
    },
    {
      id: "perspectives",
      type: "topicGrid",
      heading: "Perspectives",
      navLabel: "Perspectives",
      enabled: true,
      data: [
        {
          topic: "Roadmaps as hypotheses",
          angle: "Treating a roadmap as a set of bets to test, not a promise to keep, changes how teams react when a bet doesn't pay off.",
          icon: "Target",
        },
        {
          topic: "Pricing is a product surface",
          angle: "Pricing and packaging decisions shape usage as much as any feature does, and deserve the same iteration discipline.",
          icon: "ShieldCheck",
        },
      ],
    },
    {
      id: "certifications",
      type: "logoCredentials",
      heading: "Certifications",
      navLabel: "Certifications",
      enabled: true,
      data: {
        items: [
          {
            issuer: "Example Certification Body",
            title: "Certified Product Manager",
            logo: "/images/placeholder-logo.svg",
            href: "https://example.com/verify",
          },
        ],
        moreLink: { label: "Other certifications", href: "https://example.com/credentials" },
      },
    },
    {
      id: "capabilities",
      type: "chipGroups",
      heading: "Capabilities",
      navLabel: "Capabilities",
      enabled: true,
      data: [
        { group: "Product", chips: ["Discovery", "Roadmapping", "Pricing & Packaging"] },
        { group: "Execution", chips: ["Cross-functional Leadership", "Agile Delivery"] },
        { group: "Tools", chips: ["SQL", "Figma", "Amplitude"] },
      ],
    },
    {
      id: "about",
      type: "textAndTimeline",
      heading: "About",
      navLabel: "About",
      enabled: true,
      data: {
        paragraphs: [
          "I'm a product manager who enjoys the unglamorous middle of a project as much as the launch — the part where a rough idea turns into something a team can actually build.",
          "Outside of work, this example paragraph would say something about your hobbies, side projects, or how you got into your field.",
        ],
        timeline: [
          {
            organization: "Example Software Co.",
            role: "Senior Product Manager",
            dates: "2023 – Present",
            description: "Owns platform and growth surfaces for a mid-market SaaS product.",
          },
          {
            organization: "Example Startup Inc.",
            role: "Product Manager",
            dates: "2020 – 2023",
            description: "First PM hire; built out onboarding, billing, and analytics.",
          },
        ],
      },
    },
    {
      id: "contact",
      type: "contactForm",
      enabled: true,
      data: {
        heading: "Start a conversation",
        supportingCopy:
          "Open to conversations about product roles, advisory work, or just talking shop.",
        socialLink: { label: "Connect on LinkedIn", href: "https://www.linkedin.com/in/example" },
        privacyNote:
          "Messages sent through this form go directly to the site owner and are not shared with any third party beyond the form provider used to deliver them.",
      },
    },
  ],
});
