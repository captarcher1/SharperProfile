// Step 4 — public entry point for the prompts module.

export { SYSTEM_PROMPT } from "./systemPrompt";
export { buildSectionInstructions, type SectionPromptContext } from "./sectionPrompts";
export { buildModelResponseSchema } from "./responseSchema";
export {
  formatResumeFactsText,
  buildSectionRequest,
  buildEnvelope,
  type SectionDefinition,
  type ModelSectionResponse,
} from "./buildRequest";
