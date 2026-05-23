// Brick: telegram-i18n-core v0.1.0 (le-GO C-UI)
// Donor: @go_your_relationship_bot (~/Sviluppo/erp/gomyreference)
//
// Barrel re-export. Importare tutto da qui:
//
//   import {
//     t, tArr, tPlural, tWithMeta,
//     detectLocale, normalizeLocale, isSupportedLocale,
//     createRegistry, getBundle, getBuiltinBundles,
//     selectPlural, hasPluralRulesSupport,
//     formatCurrency, formatDate,
//     createInMemoryPersister, validateLocaleInput,
//     setUserLocale, getUserLocale,
//     DEFAULT_LOCALE, UNIVERSAL_FALLBACK_LOCALE, SUPPORTED_LOCALES,
//     type Locale, type TranslationBundle, type BundleRegistry,
//     type LocalePersister, type FormatCurrencyOptions, type FormatDateOptions,
//   } from "../_bricks/telegram-i18n-core/index.ts";
//
// Tutti gli helper sono no-throw. Chiave mancante → log warn + ritorna chiave.

// ---- Translate
export { t, tArr, tPlural, tWithMeta } from "./helpers/t.ts";

// ---- Detect / normalize
export {
  detectLocale,
  isSupportedLocale,
  normalizeLocale,
} from "./helpers/detect-locale.ts";

// ---- Bundle registry
export {
  createRegistry,
  getBuiltinBundles,
  getBundle,
  lookupKey,
} from "./helpers/load-locale-bundle.ts";

// ---- Plural
export {
  hasPluralRulesSupport,
  selectPlural,
} from "./helpers/plural-rules.ts";

// ---- Format
export { formatCurrency } from "./helpers/format-currency.ts";
export { formatDate } from "./helpers/format-date.ts";

// ---- Persister
export {
  createInMemoryPersister,
  getUserLocale,
  setUserLocale,
  validateLocaleInput,
} from "./helpers/persist-user-locale.ts";

// ---- Costanti
export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  UNIVERSAL_FALLBACK_LOCALE,
} from "./types.ts";

// ---- Types
export type {
  BundleRegistry,
  FormatCurrencyOptions,
  FormatDateOptions,
  Locale,
  LocalePersister,
  PluralCategory,
  PluralMap,
  TranslateResult,
  TranslationBundle,
  TranslationValue,
  TranslationVars,
  UserLocaleRow,
} from "./types.ts";
