// Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data) · entry pubblico

export {
  DEFAULT_THRESHOLDS,
  type ContactCanonical,
  type ContactSource,
  type MatchCandidate,
  type MatchThresholds,
  type SupabaseLike,
  type UpsertResult,
} from "./types.ts";

export {
  embedContact,
  buildContactEmbedText,
} from "./helpers/embed-contact.ts";

export {
  searchSimilarByEmbedding,
} from "./helpers/search-similar.ts";

export {
  fuzzyMatchByName,
  jsTrigramSimilarity,
} from "./helpers/fuzzy-match-name.ts";

export {
  mergeContactFields,
  setUnion,
  pickNonNull,
} from "./helpers/merge-contact-fields.ts";

export {
  upsertContactFuzzy,
} from "./helpers/upsert-contact.ts";

export {
  buildDedupPlan,
  applyDedupPlan,
  type DedupPlan,
} from "./helpers/dedup-batch.ts";

export {
  SYSTEM_PROMPT_EXTRACT_CONTACT,
  USER_PROMPT_TEMPLATE,
  RECOMMENDED_LLM_PARAMS,
  buildExtractPrompt,
} from "./prompts/extract-contact-from-message.ts";
