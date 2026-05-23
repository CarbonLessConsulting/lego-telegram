// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/i18n.ts
// Brick: telegram-i18n-core v0.1.0 (le-GO C-UI)
//
// Tipi pubblici del brick i18n.

// ============================================================================
// Locale
// ============================================================================

/**
 * Locale supportati dal brick. Lista canonical agency GOAi&digital:
 * IT default, EN universal fallback, ES/DE/FR/PT clienti reali.
 *
 * Lo schema dei bundle è OPEN: consumer possono usare locale extra (es. "ja")
 * caricando bundle custom — il brick fa best-effort fallback.
 */
export type Locale = "it" | "en" | "es" | "de" | "fr" | "pt";

export const SUPPORTED_LOCALES: readonly Locale[] = [
  "it",
  "en",
  "es",
  "de",
  "fr",
  "pt",
] as const;

/** Default locale (sorgente delle chiavi). */
export const DEFAULT_LOCALE: Locale = "it";

/** Fallback intermediate (universal). */
export const UNIVERSAL_FALLBACK_LOCALE: Locale = "en";

// ============================================================================
// Bundle (translation map)
// ============================================================================

/**
 * Bundle traduzione. Chiavi gerarchiche separate da `.`:
 *   - "welcome.title"
 *   - "error.unauthorized"
 *   - "bot.draft.button_save"
 *
 * Valori: string (testo singolo) o string[] (multiline, joined da `\n`).
 * I valori contengono i tag HTML inline (<b>, <i>, <code>, <a>) come da
 * pipeline `sendMessage(parse_mode='HTML')` agency standard.
 */
export type TranslationValue = string | string[];

export type TranslationBundle = Record<string, TranslationValue>;

/**
 * Mappa di tutti i bundle indicizzati per locale.
 * Locale "it"/"en" obbligatori (fallback chain), altri opzionali.
 */
export type BundleRegistry = Partial<Record<Locale | string, TranslationBundle>>;

// ============================================================================
// Format options (interpolation + plural + currency + date)
// ============================================================================

/**
 * Variabili per interpolazione `{{name}}`. Valori convertiti via `String()`.
 * Per i numeri valutare `formatCurrency()` / `Intl.NumberFormat` upstream.
 */
export type TranslationVars = Record<string, string | number | boolean>;

/**
 * Opzioni `format-currency`. Locale Intl + ISO 4217 code.
 * Default agency: EUR, locale auto da utente Telegram.
 */
export interface FormatCurrencyOptions {
  currency?: "EUR" | "USD" | "GBP" | "CHF" | string;
  locale?: Locale | string;
  /** Numero di decimali. Default 2. */
  fraction_digits?: number;
}

/**
 * Opzioni `format-date`. Style preset + locale.
 */
export interface FormatDateOptions {
  locale?: Locale | string;
  /**
   * - "short"   → 23/05/26
   * - "medium"  → 23 mag 2026
   * - "long"    → 23 maggio 2026
   * - "iso"     → 2026-05-23
   * - "relative" → "3 giorni fa", "ieri", "tra 2 ore"
   */
  style?: "short" | "medium" | "long" | "iso" | "relative";
  /** Includere ora? default false. */
  include_time?: boolean;
}

// ============================================================================
// Plural rules
// ============================================================================

/**
 * Categoria plurale ICU-like. Convenzione minimal:
 *   - `one`   → singolare
 *   - `other` → plurale (default)
 *
 * Extension: alcune lingue (es. ru, pl) hanno `few`, `many`. Per ora il brick
 * implementa solo one/other; consumer per quelle lingue userà API custom.
 */
export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * Map per t-plural: `{ one: "1 contatto", other: "{{count}} contatti" }`.
 * `{{count}}` viene auto-interpolato col numero passato.
 */
export type PluralMap = Partial<Record<PluralCategory, string>>;

// ============================================================================
// User locale persistence (per-user setting)
// ============================================================================

/**
 * Shape minimale di una row utente per persistere locale.
 * Il brick NON impone una tabella specifica; il consumer fornisce un
 * persister (vedi `helpers/persist-user-locale.ts`).
 */
export interface UserLocaleRow {
  telegram_user_id: number;
  locale: Locale | string;
  /** Audit. */
  updated_at?: string;
}

/**
 * Persister contract. Implementato dal consumer (es. Supabase, KV, in-memory).
 *
 * Soft: tutti i metodi ritornano Result soft, mai throw.
 */
export interface LocalePersister {
  load(telegram_user_id: number): Promise<{ ok: boolean; locale?: Locale | string; error?: string }>;
  save(row: UserLocaleRow): Promise<{ ok: boolean; error?: string }>;
}

// ============================================================================
// Translate result
// ============================================================================

/**
 * Risultato `t()`. Soft, mai throw.
 * Se chiave mancante anche dopo fallback chain → ritorna la chiave + flag.
 */
export interface TranslateResult {
  text: string;
  /** True se la chiave è stata risolta tramite fallback (non locale richiesto). */
  fallback_used: boolean;
  /** Locale effettivamente usato per risolvere la chiave. */
  resolved_locale: Locale | string;
  /** True se la chiave non esiste in nessun bundle (text === key). */
  missing: boolean;
}
