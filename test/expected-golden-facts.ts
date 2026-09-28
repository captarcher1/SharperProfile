// Ground truth derived directly from /tmp/gen_golden_set.js's `resumes` array —
// the same script that generated the golden-set .docx files themselves. This
// is NOT a second, independently-authored source of truth; it's the same
// facts read back out, which is the right comparison for testing whether B2
// correctly recovers what's actually in the document (a parsing-correctness
// test), as distinct from testing generation quality (which is what the
// golden-set's expected-outputs.md rubric already covers for B1).

export type ExpectedEntry = {
  title: string;
  company: string;
  datesRaw: string;
  expectAmbiguous?: boolean; // only set true for the 2 known combined-employer blocks
};

export type ExpectedPersona = {
  file: string;
  name: string;
  skillCount: number;
  entries: ExpectedEntry[];
};

export const EXPECTED: ExpectedPersona[] = [
  {
    file: "golden-01-entry-level-controls-engineer.docx",
    name: "Devon Okafor",
    skillCount: 6,
    entries: [
      { title: "Engineering Intern", company: "Northfield Automation Group", datesRaw: "Jun 2022 – Aug 2022" },
      { title: "Capstone Project — Automated Sorting Line", company: "Ridgeline Institute of Technology", datesRaw: "2022 – 2023" },
    ],
  },
  {
    file: "golden-02-entry-level-dotnet-developer.docx",
    name: "Priya Chandran",
    skillCount: 6,
    entries: [
      { title: "Junior Developer", company: "Vantage Data Systems", datesRaw: "Aug 2023 – Present" },
      { title: "Graduate Capstone — Campus Alumni Portal", company: "Fairhaven Institute of Technology", datesRaw: "2022 – 2023" },
    ],
  },
  {
    file: "golden-03-midcareer-business-analyst.docx",
    name: "Naomi Whitfield",
    skillCount: 6,
    entries: [
      { title: "Senior Business Analyst", company: "Meridian Consulting Partners", datesRaw: "2020 – Present" },
      { title: "Business Analyst", company: "Alderbrook Financial Technologies", datesRaw: "2017 – 2020" },
      { title: "Equity Research Analyst", company: "Brightline Securities", datesRaw: "2016 – 2017" },
    ],
  },
  {
    file: "golden-04-midcareer-pharmacy-technician.docx",
    name: "Marisol Dominguez",
    skillCount: 6,
    entries: [
      { title: "Pharmacy Technician", company: "Coastal Family Pharmacy", datesRaw: "2023 – Present" },
      { title: "Pharmacy Technician / Deli & Bakery Associate", company: "Brightmart Retail", datesRaw: "2019 – 2023" },
      { title: "Restaurant Administrator", company: "Hilltop Brewhouse", datesRaw: "2017 – 2019" },
      { title: "Volunteer", company: "Regional Disaster Relief Network", datesRaw: "2015" },
    ],
  },
  {
    file: "golden-05-senior-manager-finance-erp.docx",
    name: "Farhan Qureshi",
    skillCount: 6,
    entries: [
      { title: "Senior Manager, Finance & Accounts (SAP FICO)", company: "Cascade Auto Components", datesRaw: "2024 – Present" },
      { title: "Senior Manager, Finance & Accounts", company: "Harrow Rubber Industries", datesRaw: "2018 – 2024" },
      { title: "Deputy Manager, FICO", company: "Summit Polymers Ltd.", datesRaw: "2010 – 2018" },
      { title: "Finance Executive / Accounts Executive", company: "early-career roles, two manufacturing employers", datesRaw: "2003 – 2010", expectAmbiguous: true },
    ],
  },
  {
    file: "golden-06-senior-director-banking-tech.docx",
    name: "Katherine Boyle",
    skillCount: 6,
    entries: [
      { title: "Senior Director, Global Banking Technology — Financial Crimes & Data Governance", company: "Featherstone Financial Group", datesRaw: "2021 – Present" },
      { title: "Director, Treasury Technology", company: "Featherstone Financial Group", datesRaw: "2013 – 2021" },
      { title: "Technology Manager, Retail Risk Technology", company: "Featherstone Financial Group", datesRaw: "2010 – 2013" },
      { title: "Consultant / Business Systems Consultant", company: "Ashford Financial Corporation, early-career roles", datesRaw: "2005 – 2010", expectAmbiguous: true },
    ],
  },
  {
    file: "golden-07-director-agile-delivery-healthcare.docx",
    name: "Jordan Vasquez",
    skillCount: 6,
    entries: [
      { title: "Director, Agile Technology Delivery", company: "Summit Health Partners", datesRaw: "2021 – Present" },
      { title: "VP, Technology Delivery Management", company: "Alderbrook Health Systems", datesRaw: "2016 – 2021" },
      { title: "Digital Delivery Manager", company: "Northbridge Consulting", datesRaw: "2012 – 2016" },
      { title: "Business Intelligence Manager", company: "Fairview Enterprises", datesRaw: "2006 – 2012" },
    ],
  },
  {
    file: "golden-08-senior-director-program-mgmt-insurance.docx",
    name: "Alicia Ferreira",
    skillCount: 6,
    entries: [
      { title: "Senior Director, Program & Product Management", company: "Northstar Insurance Group", datesRaw: "2021 – Present" },
      { title: "VP, Technology Program Management", company: "Coldharbor Insurance", datesRaw: "2016 – 2021" },
      { title: "Digital Integration Manager", company: "Northbridge Consulting", datesRaw: "2012 – 2016" },
      { title: "Business Intelligence Manager", company: "Fairview Enterprises", datesRaw: "2006 – 2012" },
    ],
  },
  {
    file: "golden-09-midcareer-program-manager-retail-bi.docx",
    name: "Ben Okonkwo",
    skillCount: 5,
    entries: [
      { title: "Program Manager", company: "Northbridge Consulting", datesRaw: "2019 – Present" },
      { title: "Business Intelligence Team Lead", company: "Fairview Enterprises", datesRaw: "2014 – 2019" },
      { title: "Business Intelligence Analyst / Developer", company: "early-career roles, two employers", datesRaw: "2012 – 2014", expectAmbiguous: true },
    ],
  },
  {
    // golden-10 — Riley Faulkner. Not from gen_golden_set.js; generated
    // separately by gen_golden_10.js to stress-test document STRUCTURE
    // (table-based company/dates rows, two nested subroles sharing one table
    // context, an unrecognized-but-real section header) rather than B1
    // content quality. See gen_golden_10.js for full design rationale.
    //
    // Titles for the two Thornfield subroles include the full bold run text
    // as authored — the generator wrote each subrole title as a single bold
    // TextRun with no separate plain-text company remainder (unlike golden-
    // 01..09's "bold title + plain ' — Company' suffix" pattern), so B2
    // correctly has no remainder to split out and the company comes from the
    // table context instead. This is expected extractor behavior given how
    // the fixture is authored, not a defect.
    file: "golden-10-messy-table-format-office-admin.docx",
    name: "Riley Faulkner",
    skillCount: 8,
    entries: [
      { title: "Senior Administrative Coordinator", company: "Bramwell Logistics Group", datesRaw: "2021 – Present" },
      { title: "Office Coordinator — Thornfield Realty Partners (Suite 400)", company: "Thornfield Realty Partners", datesRaw: "Jun 2019 – Jan 2021" },
      { title: "Administrative Assistant", company: "Thornfield Realty Partners", datesRaw: "Dec 2017 – May 2019" },
      // Sterling Staffing Agency (client placements) — a temp-agency framing
      // for a single subrole covering multiple client placements. Left as
      // expectAmbiguous: false (i.e. NOT flagged) because the current
      // looksLikeCombinedEntry() heuristic only catches "roles/employers/
      // various/multiple" keywords or comma-separated multi-employer lists —
      // neither pattern matches this company field. Whether a staffing-
      // agency-with-client-placements phrasing SHOULD trip the ambiguity
      // heuristic is an open, undecided design question (documented in
      // README.md), not a claim that this is definitely correct behavior.
      { title: "Front Desk / Office Support (temporary placements)", company: "Sterling Staffing Agency (client placements)", datesRaw: "2015 – 2017" },
    ],
  },
  {
    // golden-11 — Casey Lindqvist. Companion to golden-10: generated
    // separately by gen_golden_11.js specifically to stress-test PLAIN,
    // mixed-case section headers (no bold, no ALL-CAPS — every header here
    // uses the exact plain/title-case convention a real spot-check found on
    // Shraddha Srivastava's actual resume) and PLAIN (non-bold) experience
    // title lines following a table row (mirroring Sunanda Srivastava's
    // actual resume). See gen_golden_11.js for full design rationale.
    file: "golden-11-plain-mixedcase-header-format-facilities.docx",
    name: "Casey Lindqvist",
    skillCount: 6,
    entries: [
      { title: "Facilities Coordinator", company: "Meridian Property Group", datesRaw: "2020 – Present" },
      { title: "Maintenance Technician", company: "Redwood Business Park Management", datesRaw: "Aug 2017 – Dec 2019" },
      { title: "Groundskeeper", company: "Redwood Business Park Management", datesRaw: "Jun 2016 – Jul 2017" },
      // Same open, documented "temp agency with client placements" ambiguity
      // gap as golden-10's Sterling Staffing entry — expectAmbiguous: false
      // reflects current looksLikeCombinedEntry() behavior, not a claim that
      // it's definitely the right call.
      { title: "Facilities Support Technician (temporary placements)", company: "Vantage Facilities Services (client sites)", datesRaw: "2013 – 2016" },
    ],
  },
];
