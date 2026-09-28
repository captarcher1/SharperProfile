// Single source of truth for the product's display name, used in both
// app/layout.tsx (site header, every page) and app/page.tsx (the landing
// page hero/CTAs).
//
// 2026-09-28 — final name picked: "SharperProfile," chosen from a batch
// Pranay proposed (ShinyCV, SharperProfile, SharperEdge, ElevateResume,
// ApexFolio) after 4 earlier rounds of candidates didn't land. Picked over
// the other 4 specifically on collision risk, checked via live web search
// before recommending: ElevateResume and ShinyCV are both names of real,
// existing résumé/CV tools in the same space; SharperEdge is an established
// staffing company; ApexFolio is phonetically near-identical to AppFolio, a
// prominent public company (NYSE: APPF). SharperProfile came back with no
// collision found. Worth being upfront that "no collision found" is a
// search-based signal, not a legal trademark clearance.
export const PRODUCT_NAME = "SharperProfile";
