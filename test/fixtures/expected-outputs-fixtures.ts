// Step 2 acceptance fixtures — the 45 core golden examples + 2 bonus cases
// from golden-set/expected-outputs.md, hand-encoded into the structured
// content shapes from src/schema.ts, per phase1-build-plan.md Step 2's
// "Done when": validators must pass every one of these, and correctly fail
// deliberately broken variants (see test/run-schema-validation.ts).
//
// IMPORTANT PROVENANCE NOTE — read before trusting any fixture as "the
// literal SME-approved text": expected-outputs.md is a v2 document that only
// re-states the FULL text for examples that changed between v1 and v2. Six
// examples across 9 personas were marked "validated, no change" with no text
// repeated in v2 (Devon: processSteps, topicGrid, textAndTimeline; Marisol:
// processSteps, topicGrid, textAndTimeline; Alicia: topicGrid) — and Devon's
// cardGrid gives only card TITLES, not descriptions. The original v1 document
// isn't available in this session (only v2 exists on disk), so those 8
// fixtures are marked `reconstructed: true` below: freshly written by me,
// grounded in the same real B2-extracted facts (title/company/bullets) and
// following the same rubric rules (completeness, dollar-ranging, no
// fabrication) as every validated example, but NOT the literal wording
// Pranay signed off on. Treat a `reconstructed: true` fixture as "plausible
// enough to exercise the validators correctly," not as "this is what got
// approved" — if the literal v1 text ever surfaces, replace these.
//
// Every other fixture (39 of 47) transcribes expected-outputs.md's actual
// text directly.

import type { SectionType } from "../../src/schema";

export type PersonaKey =
  | "devon" | "priya" | "naomi" | "marisol" | "farhan"
  | "katherine" | "jordan" | "alicia" | "ben";

export const PERSONA_FILES: Record<PersonaKey, string> = {
  devon: "golden-01-entry-level-controls-engineer.docx",
  priya: "golden-02-entry-level-dotnet-developer.docx",
  naomi: "golden-03-midcareer-business-analyst.docx",
  marisol: "golden-04-midcareer-pharmacy-technician.docx",
  farhan: "golden-05-senior-manager-finance-erp.docx",
  katherine: "golden-06-senior-director-banking-tech.docx",
  jordan: "golden-07-director-agile-delivery-healthcare.docx",
  alicia: "golden-08-senior-director-program-mgmt-insurance.docx",
  ben: "golden-09-midcareer-program-manager-retail-bi.docx",
};

// Dollar figures that are descriptive/contextual (the business the candidate
// supported), not the candidate's own claimed delivered impact — per
// changelog #7 these stay exact/bare rather than being ranged. Everyone else
// has none: every dollar figure in their examples is the candidate's own
// claimed impact and is already written in ranged/"X+" form.
//
// Ben's "$5M" (in "4 concurrent retail and consumer-goods engagements
// totaling roughly $5M in annual program value") was a genuinely ambiguous
// case: written bare in the SME-approved text, and not addressed either way
// in Ben's rubric note (which only discusses "$200M" as descriptive and
// "~$50M" as ranged). Flagged to the user rather than resolved unilaterally;
// user decision (8/27/2026): treat it the same as "$200M" — descriptive
// scope of the engagements he supported, not his own claimed delivered
// impact — so it's allowlisted here rather than requiring a range.
export const DESCRIPTIVE_DOLLAR_FIGURES: Record<PersonaKey, string[]> = {
  devon: [], priya: [], farhan: [], katherine: [], jordan: [], marisol: [],
  naomi: ["$8B", "$400M"],
  alicia: [],
  ben: ["$200M", "$5M"],
};

export type Fixture = {
  id: string;
  persona: PersonaKey;
  sectionType: SectionType;
  sectionKey: string;
  reconstructed?: boolean;
  envelope: {
    status: "ok" | "insufficient_evidence";
    confidence: "high" | "medium" | "low";
    reason?: string;
    userMessage?: string;
    injectionWarning: boolean;
    content: unknown;
  };
};

function ok(content: unknown, confidence: "high" | "medium" | "low" = "high") {
  return { status: "ok" as const, confidence, injectionWarning: false, content };
}

export const FIXTURES: Fixture[] = [
  // ============================== cardGrid ==============================
  {
    id: "devon-cardGrid", persona: "devon", sectionType: "cardGrid", sectionKey: "work",
    reconstructed: true, // titles are from the doc; descriptions are reconstructed
    envelope: ok({
      cards: [
        { title: "Automation Retrofit Testing", description: "Supported testing of PLC logic for a conveyor automation retrofit serving a 3-line production facility, documenting 18 test cases and identifying 4 wiring discrepancies before commissioning — preventing an estimated 2 days of unplanned downtime." },
        { title: "Automated Sorting Line Capstone", description: "Designed and built a small-scale automated PLC-driven sorting line with photoelectric sensors, achieving 95% sort accuracy in final demonstration testing and placing in the top 3 of 22 capstone teams." },
      ],
    }),
  },
  {
    id: "priya-cardGrid", persona: "priya", sectionType: "cardGrid", sectionKey: "work",
    envelope: ok({
      cards: [
        { title: "Inventory Systems Development", description: "Build and maintain internal .NET web forms used for inventory tracking across 3 warehouse locations, resolving 45+ support tickets in my first six months and improving average ticket resolution time by 30%." },
        { title: "Campus Alumni Portal Capstone", description: "Led front-end development for a 3-person student team building a web-based alumni management portal used by 500+ test users during pilot rollout, delivered two weeks ahead of the academic deadline." },
      ],
    }),
  },
  {
    id: "naomi-cardGrid", persona: "naomi", sectionType: "cardGrid", sectionKey: "work",
    envelope: ok({
      cards: [
        { title: "Global Trading Workstation Delivery", description: "Lead requirements and UAT coordination for a global trading workstation supporting roughly $8B in assets under management for a top-20 asset manager, reducing the order-to-execution defect rate by 22% across 4 quarterly releases." },
        { title: "Custodian Client Portal Delivery", description: "Supported delivery of a client account management portal for a global custodian bank serving 200+ institutional clients, and received a Client Impact Award for on-time delivery of a release affecting 15,000+ end users." },
        { title: "Equity Research Coverage", description: "Covered the mid-cap industrials sector — 18 tickers — producing weekly research notes that supported portfolio manager decisions on a $400M fund allocation." },
      ],
    }),
  },
  {
    id: "marisol-cardGrid", persona: "marisol", sectionType: "cardGrid", sectionKey: "work",
    envelope: ok({
      cards: [
        { title: "Pharmacy Accuracy & Claims Turnaround", description: "Maintain a 99.8% prescription-accuracy rate while cutting average insurance-claim resolution time from 4 days to under 2, consistently ranking among the top 3 performers in quarterly accuracy audits across a 12-person pharmacy team." },
        { title: "Retail-to-Pharmacy Progression", description: "Advanced from deli/bakery associate to pharmacy technician in 18 months, cutting out-of-stock incidents by 25% and training 3 new hires along the way." },
        { title: "Restaurant Operations & Vendor Management", description: "Managed vendor ordering and payroll processing for a 12-person staff at a 40-seat restaurant, cutting invoice processing errors by 30%." },
        { title: "Community Disaster-Relief Coordination", description: "Supported front-desk and transportation coordination for a community disaster-relief unit, scheduling transportation for 50+ patients monthly." },
      ],
    }),
  },
  {
    id: "farhan-cardGrid", persona: "farhan", sectionType: "cardGrid", sectionKey: "work",
    envelope: ok({
      cards: [
        { title: "SAP S/4HANA Finance Transformation", description: "Leading a SAP S/4HANA implementation integrating 4 company codes into a unified financial system, projected to cut month-end closing time by 25%, alongside an RPA automation initiative targeting a 35% reduction in manual reconciliation effort." },
        { title: "Close-Cycle & Cost Efficiency Leadership", description: "Reduced month-end close from 7 to 3 days (57% faster) across 3 business units, cut material variance costs by roughly $1M–$2M annually, and streamlined vendor payment cycles by 30% through SAP MM integration." },
        { title: "SAP Implementation & Compliance Automation", description: "Led two full-cycle SAP implementations spanning a combined 1,800 users, and automated tax-compliance workflows that took audit findings from 14 to zero over 3 years." },
        { title: "Early-Career Finance Operations", description: "Supported reconciliation, tax compliance, and vendor payment processing for a portfolio of 200+ vendor accounts across two manufacturing employers." },
      ],
    }),
  },
  {
    id: "katherine-cardGrid", persona: "katherine", sectionType: "cardGrid", sectionKey: "work",
    envelope: ok({
      cards: [
        { title: "Financial-Crimes Regulatory Remediation & Data Governance", description: "Leading remediation of high-impact regulatory findings across KYC and financial-crimes systems, closing 90% of severity-1 findings within 12 months, and establishing a global data-governance function spanning 28 applications." },
        { title: "Treasury Technology & Agile Transformation Leadership", description: "Managed a global team of 45 delivering treasury regulatory and operational data solutions against a $10M–$15M annual budget, led delivery across 6 liquidity-management regulatory mandates spanning 3 regions, and transformed a 220-person program from waterfall to Agile, cutting release cycles from 10 weeks to 2." },
        { title: "Risk Platform Modernization", description: "Managed a 15-person platform engineering and production support team, leading a migration that cut annual licensing costs by roughly $450,000–$500,000 while improving platform availability from 97% to 99.5%." },
        { title: "Early-Career Technology Operations", description: "Progressed through technology operations, IT asset management, and production support roles supporting a 24x7 operations center." },
      ],
    }),
  },
  {
    id: "jordan-cardGrid", persona: "jordan", sectionType: "cardGrid", sectionKey: "work",
    envelope: ok({
      cards: [
        { title: "Healthcare Claims Platform ART Leadership", description: "Leading a 10-team, 95-member Agile Release Train delivering claims-processing and care-management platform capabilities against a $30M+ annual budget across 6 product lines, and leading a payer-system integration program contributing $8M–$10M in projected annual operating savings." },
        { title: "Enterprise Agile Transformation & Data Governance", description: "As Senior Release Train Engineer, led a data-governance valuestream spanning 26 claims and eligibility systems and an Agile transformation converting a 160-person program from waterfall delivery, cutting release cycles from 90 days to 10 — while coaching 8 delivery leads across 4 release trains and improving delivery predictability by roughly 38%." },
        { title: "Cross-Industry Data & Analytics Delivery", description: "Led data-integration and analytics delivery for healthcare and manufacturing clients across 5 concurrent engagements, together valued at $10M–$12M." },
        { title: "Enterprise BI & Mobile Analytics Leadership", description: "Managed a data-warehouse and BI delivery team of 8, delivering the organization's first mobile BI application, adopted by 2,000+ internal users in its first year." },
      ],
    }),
  },
  {
    id: "alicia-cardGrid", persona: "alicia", sectionType: "cardGrid", sectionKey: "work",
    envelope: ok({
      cards: [
        { title: "Underwriting Modernization & Post-Acquisition Integration", description: "Leading a $40M+ multi-year policy-administration and underwriting modernization program with a team of 10 product and program managers across 5 workstreams; previously led a post-acquisition systems integration program delivering $15M–$20M in projected annual savings." },
        { title: "Claims Data-Governance & Portfolio Standardization", description: "Managed a claims-data governance valuestream spanning 32 applications, recovered $5M–$7M in previously trapped operational capacity through a data-platform migration, and standardized intake and prioritization across a 14-project portfolio, cutting the delivery-miss rate by 28%." },
        { title: "Cross-Industry Digital Integration Delivery", description: "Led data integration and digital analytics delivery for insurance and healthcare clients across 6 client engagements, managing $8M–$10M in combined program financials." },
        { title: "Enterprise BI Delivery Leadership", description: "Managed a data warehouse team of 7 delivering the organization's first mobile BI application, adopted by 1,200+ internal users in year one." },
      ],
    }),
  },
  {
    id: "ben-cardGrid", persona: "ben", sectionType: "cardGrid", sectionKey: "work",
    envelope: ok({
      cards: [
        { title: "Retail & Consumer-Goods BI Program Leadership", description: "Lead data-integration and BI delivery for retail and consumer-goods clients across 4 concurrent engagements totaling roughly $5M in annual program value, improving on-budget delivery rate from 78% to 94% and cutting manual reporting effort by 40% through a 6-module reporting rollout for a large specialty retailer." },
        { title: "Retail Analytics & Mobile BI Leadership", description: "Managed a data warehouse and reporting team of 6 supporting retail analytics for a $200M-annual-revenue division, delivered the organization's first mobile BI dashboard — adopted by 300+ field managers within 6 months — and cut report-build time by 35% through new BI architecture standards." },
        { title: "Early-Career BI Delivery", description: "Delivered reporting and analytics capabilities for enterprise clients, supporting a combined $45M–$55M in tracked business metrics, across two employers." },
      ],
    }),
  },

  // ============================ processSteps =============================
  {
    id: "devon-processSteps", persona: "devon", sectionType: "processSteps", sectionKey: "how-i-work",
    reconstructed: true,
    envelope: ok({
      steps: [
        { title: "Verify before you trust the wiring", description: "Documenting 18 test cases and catching 4 wiring discrepancies before commissioning taught me to verify every connection against the drawing, not just the PLC logic." },
        { title: "Build for the demo, but design for accuracy", description: "Hitting 95% sort accuracy on my capstone's automated sorting line meant tuning sensor placement as carefully as the control logic itself." },
        { title: "Document as you go, not after", description: "Keeping as-built documentation current across 6 control panels during the retrofit made the eventual commissioning review far faster." },
      ],
    }),
  },
  {
    id: "priya-processSteps", persona: "priya", sectionType: "processSteps", sectionKey: "how-i-work",
    envelope: ok({
      steps: [
        { title: "Fix what's in front of you, then find the pattern", description: "Resolving 45+ support tickets in my first six months taught me to look for the recurring root cause, not just patch each one." },
        { title: "Protect the data", description: "Pairing on a migration of roughly 40,000 records from Access to SQL Server with zero data loss reinforced how much care data integrity work deserves." },
        { title: "Ship on time, as a team", description: "Leading front-end development for a 3-person capstone team and delivering two weeks early showed me what disciplined scope management looks like in practice." },
      ],
    }),
  },
  {
    id: "naomi-processSteps", persona: "naomi", sectionType: "processSteps", sectionKey: "how-i-work",
    envelope: ok({
      steps: [
        { title: "Translate business need into testable requirements", description: "Leading requirements and UAT for an $8B trading workstation means turning trader and ops feedback into test cases that actually catch defects — we cut the order-to-execution defect rate by 22%." },
        { title: "Keep 200+ clients' expectations in the spec, not just the code", description: "Authoring functional specs for a custodian client portal serving 200+ institutional clients taught me that the spec is the contract everyone downstream relies on." },
        { title: "Start with the data", description: "My time as an equity research analyst, covering 18 mid-cap industrials tickers, built the habit of grounding every recommendation in the numbers first." },
      ],
    }),
  },
  {
    id: "marisol-processSteps", persona: "marisol", sectionType: "processSteps", sectionKey: "how-i-work",
    reconstructed: true,
    envelope: ok({
      steps: [
        { title: "Accuracy is a daily habit, not a quarterly goal", description: "Maintaining a 99.8% prescription-accuracy rate while filling 150+ prescriptions weekly comes from checking every step the same way, every time." },
        { title: "Fix the process, not just the ticket", description: "Cutting average insurance-claim resolution time from 4 days to under 2 came from coordinating directly with providers instead of just re-submitting claims." },
        { title: "Reliability earns you the next opportunity", description: "Being trusted to train 3 new hires during a leadership transition came from consistently ranking among the top performers in quarterly accuracy audits." },
      ],
    }),
  },
  {
    id: "farhan-processSteps", persona: "farhan", sectionType: "processSteps", sectionKey: "how-i-work",
    envelope: ok({
      steps: [
        { title: "Build the case in numbers finance leadership will trust", description: "Every transformation I lead is backed by the math — the RPA automation I'm leading now targets a 35% cut in manual reconciliation effort, tracked from day one." },
        { title: "Compress the cycle without cutting corners", description: "Taking month-end close from 7 days to 3 across 3 business units came from redesigning the process, not just pushing people harder." },
        { title: "Automate the compliance work nobody wants to do manually", description: "Automating tax-compliance workflows took audit findings from 14 down to zero over 3 years — the kind of unglamorous work that prevents real problems." },
      ],
    }),
  },
  {
    id: "katherine-processSteps", persona: "katherine", sectionType: "processSteps", sectionKey: "how-i-work",
    envelope: ok({
      steps: [
        { title: "Close the highest-severity findings first", description: "Leading remediation of KYC and financial-crimes regulatory findings, I prioritize ruthlessly — we closed 90% of severity-1 findings within 12 months by not spreading effort evenly." },
        { title: "Give global teams one operating rhythm", description: "Transforming a 220-person program from waterfall to Agile cut release cycles from 10 weeks to 2 — the structure change did more than adding people would have." },
        { title: "Modernize infrastructure with the business case attached", description: "The risk-platform migration I led cut licensing costs by roughly $450,000–$500,000 while improving availability from 97% to 99.5% — modernization has to pay for itself twice, in cost and reliability." },
      ],
    }),
  },
  {
    id: "jordan-processSteps", persona: "jordan", sectionType: "processSteps", sectionKey: "how-i-work",
    envelope: ok({
      steps: [
        { title: "Anchor delivery to a budget and a roadmap, not just a backlog", description: "Leading a 95-member Agile Release Train against a $30M+ annual budget means every roadmap decision has to hold up against the numbers, not just the backlog." },
        { title: "Scale the operating model before you scale the teams", description: "Building a scaled Agile operating model and coaching 8 delivery leads across 4 release trains came before we could safely add teams — the model has to exist first." },
        { title: "Make the transformation numbers visible", description: "Cutting release cycles from 90 days to 10 during a 160-person waterfall-to-Agile transformation only stuck because we tracked and published the numbers every sprint." },
      ],
    }),
  },
  {
    id: "alicia-processSteps", persona: "alicia", sectionType: "processSteps", sectionKey: "how-i-work",
    envelope: ok({
      steps: [
        { title: "Frame the business case before the roadmap", description: "Every program I lead starts with the financial case — the $15M–$20M in acquisition-driven savings I delivered was tracked from day one, not discovered after the fact." },
        { title: "Build the operating model, not just the plan", description: "Standardizing intake and prioritization across a 14-project portfolio cut our delivery-miss rate by 28% — process discipline compounds." },
        { title: "Make data governance boring, in a good way", description: "The claims-data governance work across 32 applications succeeded because it became routine, not a special initiative." },
      ],
    }),
  },
  {
    id: "ben-processSteps", persona: "ben", sectionType: "processSteps", sectionKey: "how-i-work",
    envelope: ok({
      steps: [
        { title: "Protect the budget while protecting the timeline", description: "Managing resourcing and program financials, I improved our on-budget delivery rate from 78% to 94% — discipline on the financial side is what makes timelines realistic." },
        { title: "Standardize before you scale reporting", description: "Defining BI roadmap and architecture standards for the retail division cut report-build time by 35% — the standard has to exist before speed does." },
        { title: "Build the thing the field will actually use", description: "Delivering the organization's first mobile BI dashboard, adopted by 300+ field managers within 6 months, taught me that adoption is the real success metric, not just delivery." },
      ],
    }),
  },

  // ============================== topicGrid ==============================
  {
    id: "devon-topicGrid", persona: "devon", sectionType: "topicGrid", sectionKey: "perspectives",
    reconstructed: true,
    envelope: ok({
      topics: [
        { title: "Small discrepancies matter before commissioning", description: "Inferred from catching 4 wiring discrepancies before a retrofit went live — framed as inference from his testing work, not a direct quote." },
        { title: "Testing discipline transfers from the classroom to the floor", description: "Inferred from carrying capstone-project rigor (95% sort accuracy) into an internship testing role." },
      ],
    }),
  },
  {
    id: "priya-topicGrid", persona: "priya", sectionType: "topicGrid", sectionKey: "perspectives",
    envelope: ok({
      topics: [
        { title: "Small fixes add up to reliability", description: "Inferred from ticket-resolution work and improved resolution time." },
        { title: "Care with data as a first principle", description: "Inferred from the zero-data-loss migration." },
      ],
    }),
  },
  {
    id: "naomi-topicGrid", persona: "naomi", sectionType: "topicGrid", sectionKey: "perspectives",
    envelope: ok({
      topics: [
        { title: "Requirements as risk management", description: "From the 22% defect-rate reduction via allocation-logic testing." },
        { title: "The BA as translator between business and a distributed team", description: "From being primary liaison to a 12-person distributed dev team." },
        { title: "What research discipline teaches delivery work", description: "Inferred connection between her equity-research background and her current BA rigor — framed as inference, not an asserted personal quote." },
      ],
    }),
  },
  {
    id: "marisol-topicGrid", persona: "marisol", sectionType: "topicGrid", sectionKey: "perspectives",
    reconstructed: true,
    envelope: ok({
      topics: [
        { title: "Accuracy is a form of respect for the patient", description: "Inferred from her 99.8% prescription-accuracy rate and claims-resolution work." },
        { title: "A career can pivot without starting over", description: "Inferred from her progression from deli/bakery associate to pharmacy technician in 18 months." },
        { title: "Operations skills carry across industries", description: "Inferred from moving between pharmacy, restaurant administration, and disaster-relief coordination." },
      ],
    }),
  },
  {
    id: "farhan-topicGrid", persona: "farhan", sectionType: "topicGrid", sectionKey: "perspectives",
    envelope: ok({
      topics: [
        { title: "Process redesign beats brute-force effort", description: "From the 7-to-3-day close-cycle improvement." },
        { title: "Automation as a compliance strategy, not just an efficiency play", description: "From the tax-workflow automation and RPA initiatives." },
        { title: "ERP transformation is a change-management problem as much as a technical one", description: "Inferred from leading multiple full-cycle SAP implementations across thousands of users — framed as inference, not a direct quote he never gave." },
      ],
    }),
  },
  {
    id: "katherine-topicGrid", persona: "katherine", sectionType: "topicGrid", sectionKey: "perspectives",
    envelope: ok({
      topics: [
        { title: "Regulatory delivery is a prioritization discipline", description: "From severity-1 remediation work." },
        { title: "Global data governance depends on knowing where data actually lives", description: "From establishing governance across 28 applications." },
        { title: "Scaling Agile in a regulated environment is possible, not just theoretical", description: "From the 220-person waterfall-to-Agile transformation." },
      ],
    }),
  },
  {
    id: "jordan-topicGrid", persona: "jordan", sectionType: "topicGrid", sectionKey: "perspectives",
    envelope: ok({
      topics: [
        { title: "Budget discipline is part of Agile delivery, not separate from it", description: "From ART budget and payer-integration savings work." },
        { title: "Coaching the operating model scales further than adding headcount", description: "From coaching 8 delivery leads across 4 release trains." },
        { title: "Cross-industry pattern recognition strengthens healthcare delivery", description: "Inferred from his path through manufacturing/healthcare consulting into healthcare-payer leadership — framed as inference, not an asserted personal quote." },
      ],
    }),
  },
  {
    id: "alicia-topicGrid", persona: "alicia", sectionType: "topicGrid", sectionKey: "perspectives",
    reconstructed: true,
    envelope: ok({
      topics: [
        { title: "Modernization programs are also change-management programs", description: "Inferred from leading policy-administration modernization alongside a post-acquisition integration." },
        { title: "Standardizing intake protects delivery quality at scale", description: "From standardizing intake and prioritization across a 14-project portfolio, cutting the delivery-miss rate by 28%." },
        { title: "Data governance is a delivery discipline, not just a compliance one", description: "Inferred from treating a claims-data governance valuestream as an operating-model initiative." },
      ],
    }),
  },
  {
    id: "ben-topicGrid", persona: "ben", sectionType: "topicGrid", sectionKey: "perspectives",
    envelope: ok({
      topics: [
        { title: "On-budget delivery is a resourcing discipline", description: "From the 78%→94% on-budget improvement." },
        { title: "Standards compound — build them once, reuse them everywhere", description: "From BI architecture standards cutting report-build time by 35%." },
        { title: "Adoption is the real delivery metric", description: "From the mobile BI dashboard's 300+ field-manager adoption." },
      ],
    }),
  },

  // ============================== chipGroups ==============================
  // Skill strings below are copied VERBATIM from live B2 extraction (src/extract.ts
  // against each golden docx), not retyped from expected-outputs.md's prose —
  // B2 renders "Equities / Fixed Income / Derivatives" with spaces around each
  // slash (from how cheerio joins run text), while the markdown doc writes it
  // without spaces. Using B2's actual strings is what makes the skill-coverage
  // check meaningful: it's checking against the real extraction output the
  // pipeline will actually produce, not a hand-typed approximation of it.
  {
    id: "devon-chipGroups", persona: "devon", sectionType: "chipGroups", sectionKey: "skills",
    envelope: ok({
      groups: [
        { label: "Controls & Automation", skills: ["PLC Programming (Allen-Bradley)", "Circuit Design", "AutoCAD Electrical"] },
        { label: "Engineering Tools & Practices", skills: ["MATLAB/Simulink", "Root Cause Analysis", "Technical Documentation"] },
      ],
    }),
  },
  {
    id: "priya-chipGroups", persona: "priya", sectionType: "chipGroups", sectionKey: "skills",
    envelope: ok({
      groups: [
        { label: "Core Development", skills: ["C# / .NET", "ASP.NET", "HTML/CSS"] },
        { label: "Tools & Practices", skills: ["SQL Server", "Visual Studio", "Agile Fundamentals"] },
      ],
    }),
  },
  {
    id: "naomi-chipGroups", persona: "naomi", sectionType: "chipGroups", sectionKey: "skills",
    envelope: ok({
      groups: [
        { label: "Business Analysis & Delivery", skills: ["Requirements Gathering", "UAT Coordination", "SQL"] },
        { label: "Markets & Stakeholder Expertise", skills: ["Trade Lifecycle Analysis", "Equities / Fixed Income / Derivatives", "Stakeholder Management"] },
      ],
    }),
  },
  {
    id: "marisol-chipGroups", persona: "marisol", sectionType: "chipGroups", sectionKey: "skills",
    envelope: ok({
      groups: [
        { label: "Pharmacy & Patient Operations", skills: ["Prescription Processing", "Insurance Claims Coordination", "Patient Communication"] },
        { label: "Retail & Administrative Systems", skills: ["Inventory Management", "POS Systems", "Data Entry Accuracy"] },
      ],
    }),
  },
  {
    id: "farhan-chipGroups", persona: "farhan", sectionType: "chipGroups", sectionKey: "skills",
    envelope: ok({
      groups: [
        { label: "ERP & Financial Systems", skills: ["SAP S/4HANA Finance (FICO, CO-PA, CO-PC)", "Record-to-Report", "Procure-to-Pay"] },
        { label: "Automation, Compliance & Reporting", skills: ["RPA-Driven Automation", "GST / IFRS / SOX Compliance", "Power BI"] },
      ],
    }),
  },
  {
    id: "katherine-chipGroups", persona: "katherine", sectionType: "chipGroups", sectionKey: "skills",
    envelope: ok({
      groups: [
        { label: "Regulatory & Risk Technology", skills: ["Regulatory Program Delivery", "AML/KYC Technology", "Liquidity & Treasury Systems"] },
        { label: "Delivery Leadership", skills: ["Data Governance & Lineage", "Agile Transformation", "Vendor & Budget Management"] },
      ],
    }),
  },
  {
    id: "jordan-chipGroups", persona: "jordan", sectionType: "chipGroups", sectionKey: "skills",
    envelope: ok({
      groups: [
        { label: "Scaled Agile Delivery & Tooling", skills: ["Scaled Agile (SAFe) Delivery", "Release Train Engineering", "Jira / Confluence"] },
        { label: "Program Leadership & Stakeholder Management", skills: ["Program Roadmapping", "Stakeholder & Executive Communication", "Vendor Management"] },
      ],
    }),
  },
  {
    id: "alicia-chipGroups", persona: "alicia", sectionType: "chipGroups", sectionKey: "skills",
    envelope: ok({
      groups: [
        { label: "Program & Product Leadership", skills: ["Program & Product Roadmapping", "Cross-Enterprise Prioritization", "Team Leadership", "Executive Communication"] },
        { label: "Delivery Governance", skills: ["Risk & Dependency Management", "Program Financials"] },
      ],
    }),
  },
  {
    id: "ben-chipGroups", persona: "ben", sectionType: "chipGroups", sectionKey: "skills",
    envelope: ok({
      groups: [
        { label: "BI & Delivery Methodology", skills: ["Data Warehouse & BI Delivery", "Agile & Waterfall Delivery"] },
        { label: "Program & Stakeholder Operations", skills: ["Vendor Management", "Stakeholder Communication", "Resourcing & Program Financials"] },
      ],
    }),
  },

  // =========================== textAndTimeline ============================
  {
    id: "devon-textAndTimeline", persona: "devon", sectionType: "textAndTimeline", sectionKey: "about",
    reconstructed: true,
    envelope: ok({
      bio: "Devon is a recent Electrical & Controls Engineering graduate with hands-on internship experience in industrial automation. During a summer internship, he supported testing of PLC logic for a conveyor automation retrofit serving a 3-line production facility, documenting 18 test cases and catching 4 wiring discrepancies before commissioning. His capstone project, a small-scale automated PLC-driven sorting line, achieved 95% sort accuracy in final demonstration testing and placed in the top 3 of 22 capstone teams.",
      timeline: [
        { role: "Engineering Intern", company: "Northfield Automation Group", dates: "Jun 2022 – Aug 2022" },
        { role: "Capstone Project — Automated Sorting Line", company: "Ridgeline Institute of Technology", dates: "2022 – 2023" },
      ],
    }),
  },
  {
    id: "priya-textAndTimeline", persona: "priya", sectionType: "textAndTimeline", sectionKey: "about",
    envelope: ok({
      bio: "Priya is a Computer Applications graduate who moved quickly from coursework into production support work, building and maintaining .NET inventory-tracking systems used across 3 warehouse locations. In her first six months on the job she resolved 45+ support tickets, cutting average resolution time by 30%, and partnered with senior developers on a zero-data-loss migration of roughly 40,000 records from Access to SQL Server. Her graduate capstone, a web-based alumni management portal, was piloted with 500+ test users, with Priya leading front-end development for a 3-person student team and delivering two weeks ahead of schedule.",
      timeline: [
        { role: "Junior Developer", company: "Vantage Data Systems", dates: "Aug 2023 – Present" },
        { role: "Graduate Capstone — Campus Alumni Portal", company: "Fairhaven Institute of Technology", dates: "2022 – 2023" },
      ],
    }),
  },
  {
    id: "naomi-textAndTimeline", persona: "naomi", sectionType: "textAndTimeline", sectionKey: "about",
    envelope: ok({
      bio: "Naomi is a Business Analyst with 7 years across investment banking and capital markets technology, spanning global trading, custody, and market-data platforms. She currently leads requirements and UAT coordination for a global trading workstation supporting roughly $8B in assets under management for a top-20 asset manager, having reduced the order-to-execution defect rate by 22% across 4 quarterly releases while serving as primary liaison to a 12-person distributed development team. Earlier, she supported a client account management portal for a global custodian bank serving 200+ institutional clients — work recognized with a Client Impact Award for a release affecting 15,000+ end users — and began her career as an equity research analyst covering 18 mid-cap industrials tickers in support of a $400M fund allocation.",
      timeline: [
        { role: "Senior Business Analyst", company: "Meridian Consulting Partners", dates: "2020 – Present" },
        { role: "Business Analyst", company: "Alderbrook Financial Technologies", dates: "2017 – 2020" },
        { role: "Equity Research Analyst", company: "Brightline Securities", dates: "2016 – 2017" },
      ],
    }),
  },
  {
    id: "marisol-textAndTimeline", persona: "marisol", sectionType: "textAndTimeline", sectionKey: "about",
    reconstructed: true,
    envelope: ok({
      bio: "Marisol is a state-certified Pharmacy Technician with 9+ years of varied experience across pharmacy operations, retail service, and hospitality administration. She currently maintains a 99.8% prescription-accuracy rate while filling 150+ prescriptions weekly, and has cut average insurance-claim resolution time from 4 days to under 2 — performance that consistently ranks her among the top 3 performers in quarterly accuracy audits across a 12-person team. She advanced from deli/bakery associate to pharmacy technician in 18 months at her prior retail employer, reducing out-of-stock incidents by 25% and training 3 new hires along the way. Earlier, she managed vendor ordering and payroll for a 12-person restaurant staff, cutting invoice processing errors by 30%, and volunteered supporting front-desk and transportation coordination for a community disaster-relief unit, scheduling transportation for 50+ patients monthly.",
      timeline: [
        { role: "Pharmacy Technician", company: "Coastal Family Pharmacy", dates: "2023 – Present" },
        { role: "Pharmacy Technician / Deli & Bakery Associate", company: "Brightmart Retail", dates: "2019 – 2023" },
        { role: "Restaurant Administrator", company: "Hilltop Brewhouse", dates: "2017 – 2019" },
        { role: "Volunteer", company: "Regional Disaster Relief Network", dates: "2015" },
      ],
    }),
  },
  {
    id: "farhan-textAndTimeline", persona: "farhan", sectionType: "textAndTimeline", sectionKey: "about",
    envelope: ok({
      bio: "Farhan is a Finance & Accounts leader with over 20 years across SAP FICO/S4HANA, financial process automation, and ERP transformation in the automotive and manufacturing sectors. He currently leads a SAP S/4HANA implementation integrating 4 company codes, projected to cut month-end closing time by 25%, and an RPA automation initiative targeting a 35% reduction in manual reconciliation effort. In his prior role, he took month-end close from 7 days to 3 across 3 business units, cut material variance costs by roughly $1M–$2M annually, and streamlined vendor payment cycles by 30%. Earlier still, he led two full-cycle SAP implementations for a combined 1,800 users and automated tax-compliance workflows that took audit findings from 14 to zero, after beginning his career supporting reconciliation and vendor-payment processing for 200+ vendor accounts across two manufacturing employers.",
      timeline: [
        { role: "Senior Manager, Finance & Accounts (SAP FICO)", company: "Cascade Auto Components", dates: "2024 – Present" },
        { role: "Senior Manager, Finance & Accounts", company: "Harrow Rubber Industries", dates: "2018 – 2024" },
        { role: "Deputy Manager, FICO", company: "Summit Polymers Ltd.", dates: "2010 – 2018" },
        { role: "Finance Executive / Accounts Executive", company: "early-career roles, two manufacturing employers", dates: "2003 – 2010" },
      ],
    }),
  },
  {
    id: "katherine-textAndTimeline", persona: "katherine", sectionType: "textAndTimeline", sectionKey: "about",
    envelope: ok({
      bio: "Katherine is a senior technology delivery leader with 18+ years across banking risk, treasury, and financial-crimes technology, known for leading large, globally distributed teams through complex regulatory remediation and data-governance work. She currently leads remediation of high-impact regulatory findings across the bank's KYC and financial-crimes systems, closing 90% of severity-1 findings within her first 12 months, and has established a global data-governance function spanning 28 applications. Previously, as Director of Treasury Technology, she managed a global team of 45 against a $10M–$15M annual budget, delivered across 6 liquidity-management regulatory mandates spanning the US, Europe, and Asia-Pacific, and led a 220-person program's transformation from waterfall to Agile delivery, cutting release cycles from 10 weeks to 2. Earlier, as a Technology Manager, she led a 15-person platform team through a migration that cut licensing costs by roughly $450,000–$500,000 while improving availability from 97% to 99.5%, after starting her career in technology operations and production support roles supporting a 24x7 operations center.",
      timeline: [
        { role: "Senior Director, Global Banking Technology — Financial Crimes & Data Governance", company: "Featherstone Financial Group", dates: "2021 – Present" },
        { role: "Director, Treasury Technology", company: "Featherstone Financial Group", dates: "2013 – 2021" },
        { role: "Technology Manager, Retail Risk Technology", company: "Featherstone Financial Group", dates: "2010 – 2013" },
        { role: "Consultant / Business Systems Consultant", company: "Ashford Financial Corporation, early-career roles", dates: "2005 – 2010" },
      ],
    }),
  },
  {
    id: "jordan-textAndTimeline", persona: "jordan", sectionType: "textAndTimeline", sectionKey: "about",
    envelope: ok({
      bio: "Jordan is a certified Scaled Agile delivery leader with over two decades of experience delivering large-scale technology programs across healthcare, insurance, and technology domains, with deep experience leading Agile Release Trains and building scaled Agile operating models for complex, regulated programs. He currently leads a 10-team, 95-member Agile Release Train delivering claims-processing and care-management platform capabilities against a $30M+ annual budget across 6 product lines, and has led a payer-system integration program contributing $8M–$10M in projected annual operating savings. Previously, as Senior Release Train Engineer, he led a data-governance valuestream across 26 claims and eligibility systems and an Agile transformation converting a 160-person program from waterfall delivery, cutting release cycles from 90 days to 10, while coaching 8 delivery leads across 4 release trains and improving delivery predictability by roughly 38%. Earlier in his career, he led data-integration and analytics delivery for healthcare and manufacturing clients across 5 engagements worth $10M–$12M combined, and managed an 8-person BI delivery team that built the organization's first mobile BI application, adopted by 2,000+ users in its first year.",
      timeline: [
        { role: "Director, Agile Technology Delivery", company: "Summit Health Partners", dates: "2021 – Present" },
        { role: "VP, Technology Delivery Management", company: "Alderbrook Health Systems", dates: "2016 – 2021" },
        { role: "Digital Delivery Manager", company: "Northbridge Consulting", dates: "2012 – 2016" },
        { role: "Business Intelligence Manager", company: "Fairview Enterprises", dates: "2006 – 2012" },
      ],
    }),
  },
  {
    id: "alicia-textAndTimeline", persona: "alicia", sectionType: "textAndTimeline", sectionKey: "about",
    envelope: ok({
      bio: "Alicia is a program and product management executive who has spent two decades turning complex, regulated technology initiatives into delivery roadmaps that hold up under executive scrutiny. She currently leads a $40M+ multi-year policy-administration and underwriting modernization program at Northstar Insurance Group, managing a team of 10 product and program managers, and previously led a post-acquisition systems integration effort projected to deliver $15M–$20M in annual savings. Earlier in her career, she managed data-governance and digital-integration delivery across insurance, financial services, and healthcare clients.",
      timeline: [
        { role: "Senior Director, Program & Product Management", company: "Northstar Insurance Group", dates: "2021 – Present" },
        { role: "VP, Technology Program Management", company: "Coldharbor Insurance", dates: "2016 – 2021" },
        { role: "Digital Integration Manager", company: "Northbridge Consulting", dates: "2012 – 2016" },
        { role: "Business Intelligence Manager", company: "Fairview Enterprises", dates: "2006 – 2012" },
      ],
    }),
  },
  {
    id: "ben-textAndTimeline", persona: "ben", sectionType: "textAndTimeline", sectionKey: "about",
    envelope: ok({
      bio: "Ben is a technology program manager with 11 years leading data warehousing, BI, and digital analytics delivery for retail and consumer-goods clients, with a strong track record building high-performing teams and managing vendor and stakeholder relationships. He currently leads data-integration and BI delivery across 4 concurrent retail and consumer-goods engagements totaling roughly $5M in annual program value, having improved on-budget delivery rate from 78% to 94% and cut manual reporting effort by 40% through a 6-module reporting rollout for a large specialty retailer. Previously, as a Business Intelligence Team Lead, he managed a data warehouse and reporting team of 6 supporting retail analytics for a $200M-annual-revenue division, delivered the organization's first mobile BI dashboard product — adopted by 300+ field managers within 6 months — and cut report-build time by 35% through new BI architecture standards. He began his career delivering reporting and analytics capabilities for enterprise clients across two employers, supporting a combined $45M–$55M in tracked business metrics.",
      timeline: [
        { role: "Program Manager", company: "Northbridge Consulting", dates: "2019 – Present" },
        { role: "Business Intelligence Team Lead", company: "Fairview Enterprises", dates: "2014 – 2019" },
        { role: "Business Intelligence Analyst / Developer", company: "early-career roles, two employers", dates: "2012 – 2014" },
      ],
    }),
  },

  // ============================ Bonus cases ==============================
  {
    id: "devon-awards-bonus", persona: "devon", sectionType: "cardGrid", sectionKey: "awards",
    // sectionType is nominal here — an insufficient_evidence response's content
    // is empty regardless of type, so which of the 5 types "Awards & Recognition"
    // would have mapped to doesn't affect this fixture's validation at all.
    envelope: {
      status: "insufficient_evidence",
      confidence: "low",
      reason: "No awards, honors, or recognitions appear anywhere in the source resume.",
      userMessage: "We didn't find any awards, honors, or recognitions in your resume for this section. Add a few of your own below, or remove this section if it doesn't apply.",
      injectionWarning: false,
      content: null,
    },
  },
  {
    id: "marisol-leadership-bonus", persona: "marisol", sectionType: "topicGrid", sectionKey: "leadership-philosophy",
    reconstructed: true, // modeled as a narrowly-scoped 1-topic topicGrid; the doc describes the content but doesn't specify a section-type mapping
    envelope: ok(
      {
        topics: [
          {
            title: "Leadership by example, not by title",
            description: "My clearest leadership experience has been training 3 new hires on pharmacy intake procedures and coordinating vendor ordering and payroll for a 12-person restaurant staff — hands-on and small-scale rather than formal people-management.",
          },
        ],
      },
      "low"
    ),
  },
];
