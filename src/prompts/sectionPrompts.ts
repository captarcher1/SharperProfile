// Step 4 — per-section-type instructions, appended to the shared system
// prompt's rules for the user turn. Each function takes only the numbers
// this project's own B2 extraction already computed (entry count, skill
// list) — never left for the model to count itself from prose, since an
// explicit "there are exactly N of these" instruction is far more reliable
// than hoping the model counts list items correctly on its own.

import type { SectionType } from "../schema";

export interface SectionPromptContext {
  /** Number of real experience entries B2 extracted — drives cardGrid/textAndTimeline cardinality (AC-CG1, AC-TT1). */
  sourceEntryCount: number;
  /** The exact skill list B2 extracted — drives chipGroups coverage (AC-CHG1). Ignored by other section types. */
  skillList: string[];
}

function cardGridInstructions(ctx: SectionPromptContext): string {
  return `Produce exactly ${ctx.sourceEntryCount} card${ctx.sourceEntryCount === 1 ? "" : "s"} — one per real experience entry listed in the resume facts below, in the same order they appear there (AC-CG1). Never omit an entry for being less impressive, and never merge two entries into one card. This also means never splitting a single entry into more than one card, even if that entry's bullets cover several distinct, substantial accomplishments (e.g. a role with both a major delivery achievement and a separate transformation initiative) — combine everything from that one entry into its single card's description instead of giving it two cards. The count of cards must equal the count of real entries exactly, in both directions: not fewer (no merging) and not more (no splitting). Each card needs a short, specific "title" (what the achievement or role was about, not just the job title) and a 1-2 sentence "description" grounded in that entry's actual bullets/facts. Match tone to career stage: plain, factual language for an early-career resume; a more confident, executive register for a senior one — but never inflate either one with claims the facts don't support (AC-CG4). A single entry's description will sometimes cite more than one dollar figure (e.g. a savings figure and a separate recovered-value figure from the same role) — apply the dollar-figure ranging rule to each one individually; do not range the first figure in a card and then revert to the source's bare number for a second figure in that same card.`;
}

function processStepsInstructions(): string {
  return `Produce exactly 3 steps describing this person's general working approach or process, synthesized from patterns across their experience (not one step per job). If the resume facts are thin, it's fine for two steps to draw on the same underlying evidence from different angles — but never invent an unstated methodology, framework, named process, or certification to fill out a third step (AC-PS2). Each step needs a short "title" (a named phase or principle of how they work) and a 1-2 sentence "description" grounded in real facts.`;
}

function topicGridInstructions(): string {
  return `Produce between 2 and 4 topics — use 2 for a sparse resume with limited distinct evidence, more only if the facts genuinely support additional distinct topics; never pad to a fixed count with a generic or fabricated interest (AC-TG1). Write every "description" in first person, as if this person is describing their own interest on their own portfolio site — never in third person. This applies whether the topic is a direct fact or an inference: a direct fact reads like "I've long been focused on X, as reflected in my work on Y"; an inference still owns it in first person rather than asserting it as a flatly-stated fact — "My path suggests a real interest in X" or "This reflects my own focus on X," not "her path suggests..." or "this reflects his focus on..." (AC-TG2). Concrete example of the required voice: WRONG — "This reflects a dedicated focus on augmenting alert investigations and driving client retention through specific technologies. The candidate is actively shipping AI use-cases for AML, KYC, and Sanctions/Screening..." → CORRECT — "This reflects my dedicated focus on augmenting alert investigations and driving client retention through specific technologies. I'm actively shipping AI use-cases for AML, KYC, and Sanctions/Screening..." Never write "the candidate," "her," "his," or a third-person name once the topic list begins — every sentence should read as this person talking about themselves. Prefer topics that are specific to this person's actual path over generic statements that could describe almost any candidate in their field. A pattern-across-roles topic will often cite more than one figure from different entries in the same sentence (e.g. two different savings numbers) — apply the dollar-figure ranging rule to every single one of them individually; ranging the first figure you mention and then reverting to the source's bare number for a second or third figure in the same sentence is still a rule violation.`;
}

function chipGroupsInstructions(ctx: SectionPromptContext): string {
  const skillListText = ctx.skillList.length > 0 ? ctx.skillList.map((s) => `"${s}"`).join(", ") : "(no skills were extracted — see the escape hatch rule)";
  return `Group this exact list of ${ctx.skillList.length} skills into labeled groups: ${skillListText}. Every one of these skills must appear in exactly one group — none dropped, none invented, none duplicated across groups (AC-CHG1). If a skill could reasonably fit more than one group, pick a single best-fit group and commit to it rather than leaving it ambiguous (AC-CHG2). Choose group labels and groupings that make sense for this person's actual skill set — there's no fixed number of groups or fixed group size. This list of skills is itself the evidence for this section — you do not need the resume to also explain why these skills belong together, which ones matter most, or how they relate to each other; that reasoning is your job, not something to look for in the source. If you genuinely can't find a natural finer-grained split, it is completely acceptable to use broader, more general group labels, a small number of groups, or even a single group covering all of them — that is always the right move instead of declining to answer. Do not invoke the escape hatch for this section for any reason other than the skill list itself being empty; "I'm not sure how best to group these" is never a reason to return insufficient_evidence here.`;
}

function textAndTimelineInstructions(ctx: SectionPromptContext): string {
  return `Write a short bio (2-4 sentences) summarizing this person's career, and a timeline with exactly ${ctx.sourceEntryCount} entries — one per real experience entry listed below, including any that are short stints, career changes, or less senior roles (never omit one for being less flattering) (AC-TT1). Each timeline entry needs "role", "company", and "dates" (use the same date-range text given in the facts). Match the bio's tone to career stage — promising and grounded for early-career, executive register for senior — without compressing multiple distinct employers into one vague sentence (AC-TT3). Remember the dollar-figure rule: figures describing THIS person's own claimed impact must be ranged/"X+"; figures that are purely descriptive of a business/division they supported may stay exact (AC-TT2).`;
}

/**
 * Returns the section-type-specific instruction block for the user turn.
 * Combined with the shared SYSTEM_PROMPT (system turn) and the delimited
 * resume facts (also user turn, via buildRequest.ts) to form the full
 * request.
 */
export function buildSectionInstructions(sectionType: SectionType, ctx: SectionPromptContext): string {
  switch (sectionType) {
    case "cardGrid":
      return cardGridInstructions(ctx);
    case "processSteps":
      return processStepsInstructions();
    case "topicGrid":
      return topicGridInstructions();
    case "chipGroups":
      return chipGroupsInstructions(ctx);
    case "textAndTimeline":
      return textAndTimelineInstructions(ctx);
    default: {
      const _exhaustive: never = sectionType;
      throw new Error(`Unknown section type: ${_exhaustive}`);
    }
  }
}
