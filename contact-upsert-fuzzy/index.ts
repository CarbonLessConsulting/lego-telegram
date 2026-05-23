// Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data) · entry pubblico

export {
  DEFAULT_THRESHOLDS,
  type ContactCanonical,
  type ContactSource,
  type MatchCandidate,
  type MatchThresholds,
  type SupabaseLike,
  type UpsertResult,
} from './types';

export {
  embedContact,
  buildContactEmbedText,
} from './helpers/embed-contact';

export {
  searchSimilarByEmbedding,
} from './helpers/search-similar';

export {
  fuzzyMatchByName,
  jsTrigramSimilarity,
} from './helpers/fuzzy-match-name';

export {
  mergeContactFields,
  setUnion,
  pickNonNull,
} from './helpers/merge-contact-fields';

export {
  upsertContactFuzzy,
} from './helpers/upsert-contact';

export {
  buildDedupPlan,
  applyDedupPlan,
  type DedupPlan,
} from './helpers/dedup-batch';

export {
  SYSTEM_PROMPT_EXTRACT_CONTACT,
  USER_PROMPT_TEMPLATE,
  RECOMMENDED_LLM_PARAMS,
  buildExtractPrompt,
} from './prompts/extract-contact-from-message';
