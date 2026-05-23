// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/i18n.ts:21-25 (normalizeLang)
// Brick: telegram-i18n-core v0.1.0 (le-GO C-UI)
//
// Auto-detect locale a partire dai metadati Telegram update + user setting.
//
// Priority:
//   1. user_override (caricato da DB / KV)
//   2. update.message.from.language_code
//   3. DEFAULT_LOCALE

import {
  DEFAULT_LOCALE,
  type Locale,
  SUPPORTED_LOCALES,
} from "../types.ts";

const supportedSet = new Set<string>(SUPPORTED_LOCALES);

/**
 * Normalizza un raw language_code (es. "it-IT", "en-US", "PT_BR") a `Locale`.
 * Se non supportato, ritorna `DEFAULT_LOCALE`.
 *
 * Tecnica: prendiamo i primi 2 char lowercase. Telegram passa codici nel
 * formato BCP-47 (es. "it", "it-IT", "pt-BR").
 */
export function normalizeLocale(raw: string | undefined | null): Locale {
  if (!raw || typeof raw !== "string") return DEFAULT_LOCALE;
  const lc = raw.trim().toLowerCase().slice(0, 2);
  if (supportedSet.has(lc)) return lc as Locale;
  return DEFAULT_LOCALE;
}

/**
 * Detect locale combinando user override + Telegram language_code + fallback.
 *
 * @param user_override - locale persistita per utente (priority 1)
 * @param telegram_language_code - `update.message.from.language_code` (priority 2)
 * @returns Locale supportata (mai null)
 */
export function detectLocale(
  user_override?: string | null,
  telegram_language_code?: string | null,
): Locale {
  if (user_override) {
    const norm = normalizeLocale(user_override);
    // user_override è autoritativo SOLO se valido. Se invalido, prova
    // language_code Telegram come fallback prima di DEFAULT.
    if (supportedSet.has(norm)) return norm;
  }
  if (telegram_language_code) {
    return normalizeLocale(telegram_language_code);
  }
  return DEFAULT_LOCALE;
}

/**
 * Verifica se una locale string è formalmente supportata dal brick.
 * Utile per validare input utente (es. comando `/lingua pt`).
 */
export function isSupportedLocale(raw: string): raw is Locale {
  return supportedSet.has(raw.toLowerCase());
}
