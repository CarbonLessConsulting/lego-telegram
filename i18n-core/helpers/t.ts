// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/i18n.ts:27-33, 489-513 (interpolate + tr/tArr)
// Brick: telegram-i18n-core v0.1.0 (le-GO C-UI)
//
// Translation helper canonical. Soft: chiave mancante → ritorna chiave + log warn.
//
// Fallback chain:
//   locale richiesto → UNIVERSAL_FALLBACK (en) → DEFAULT (it) → key

import {
  DEFAULT_LOCALE,
  type BundleRegistry,
  type Locale,
  type PluralCategory,
  type PluralMap,
  type TranslateResult,
  type TranslationVars,
  UNIVERSAL_FALLBACK_LOCALE,
} from "../types.ts";
import { getBundle, lookupKey } from "./load-locale-bundle.ts";
import { normalizeLocale } from "./detect-locale.ts";

/**
 * Interpolazione `{{var}}` → vars[var]. Mancante → lascia placeholder.
 * No HTML escape: i bundle contengono già tag HTML inline; il consumer è
 * responsabile di passare vars già escapate dove serve (vedi escapeHtml
 * del brick telegram-push-soft).
 */
function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? m : String(v);
  });
}

/**
 * t() canonical. Ritorna string direttamente per ergonomia.
 *
 * Per accesso al risultato esteso (fallback_used, missing) usare `tWithMeta()`.
 */
export function t(
  registry: BundleRegistry,
  locale: Locale | string | undefined,
  key: string,
  vars?: TranslationVars,
): string {
  return tWithMeta(registry, locale, key, vars).text;
}

/**
 * t() con metadata. Stesso comportamento di `t()` ma ritorna anche fallback_used,
 * resolved_locale, missing. Utile per audit / metrics.
 */
export function tWithMeta(
  registry: BundleRegistry,
  locale: Locale | string | undefined,
  key: string,
  vars?: TranslationVars,
): TranslateResult {
  const target = normalizeLocale(locale ?? null);
  // 1. Try target locale
  let raw = lookupKey(getBundle(registry, target), key);
  let resolved: Locale | string = target;
  let fallback_used = false;

  // 2. Try universal fallback (EN)
  if (raw === undefined && target !== UNIVERSAL_FALLBACK_LOCALE) {
    raw = lookupKey(getBundle(registry, UNIVERSAL_FALLBACK_LOCALE), key);
    if (raw !== undefined) {
      resolved = UNIVERSAL_FALLBACK_LOCALE;
      fallback_used = true;
    }
  }

  // 3. Try default (IT, source)
  if (raw === undefined && target !== DEFAULT_LOCALE) {
    raw = lookupKey(getBundle(registry, DEFAULT_LOCALE), key);
    if (raw !== undefined) {
      resolved = DEFAULT_LOCALE;
      fallback_used = true;
    }
  }

  if (raw === undefined) {
    // Soft no-throw: ritorna la chiave + log warn (OWASP A09 observability).
    console.warn({
      fn: "i18n.t",
      missing_key: key,
      locale: target,
    });
    return {
      text: key,
      fallback_used: true,
      resolved_locale: target,
      missing: true,
    };
  }

  // Array → join multiline.
  const flat = Array.isArray(raw) ? raw.join("\n") : raw;
  return {
    text: interpolate(flat, vars),
    fallback_used,
    resolved_locale: resolved,
    missing: false,
  };
}

/**
 * tArr() — ritorna array di stringhe per chiavi che memorizzano liste
 * (es. bullet points). Se la chiave è string singola, wrap in [text].
 */
export function tArr(
  registry: BundleRegistry,
  locale: Locale | string | undefined,
  key: string,
): string[] {
  const target = normalizeLocale(locale ?? null);
  let raw = lookupKey(getBundle(registry, target), key);
  if (raw === undefined && target !== UNIVERSAL_FALLBACK_LOCALE) {
    raw = lookupKey(getBundle(registry, UNIVERSAL_FALLBACK_LOCALE), key);
  }
  if (raw === undefined && target !== DEFAULT_LOCALE) {
    raw = lookupKey(getBundle(registry, DEFAULT_LOCALE), key);
  }
  if (raw === undefined) {
    console.warn({ fn: "i18n.tArr", missing_key: key, locale: target });
    return [];
  }
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * tPlural() — selettore plurale ICU-like.
 *
 * Esempio:
 *   tPlural(registry, "it", 3, {
 *     one: "1 contatto",
 *     other: "{{count}} contatti"
 *   }, { count: 3 });
 *   // → "3 contatti"
 *
 * Soft: se la categoria selezionata manca, fallback su "other", poi su key empty.
 * Auto-iniezione `count` in vars.
 */
export function tPlural(
  count: number,
  forms: PluralMap,
  vars?: TranslationVars,
  locale?: Locale | string,
): string {
  const category = selectPluralCategory(count, locale);
  const template = forms[category] ?? forms.other ?? "";
  const merged: TranslationVars = { count, ...(vars ?? {}) };
  return interpolate(template, merged);
}

/**
 * Selettore categoria plurale per locale. Implementazione MINIMAL one/other.
 * Per lingue slave/baltiche estendere via Intl.PluralRules upstream.
 */
function selectPluralCategory(
  count: number,
  _locale?: Locale | string,
): PluralCategory {
  // Convenzione comune (IT/EN/ES/DE/FR/PT): 1 → one, altrimenti other.
  // Per ar/ru/pl il consumer fornirà categoria diversa (zero/few/many).
  return Math.abs(count) === 1 ? "one" : "other";
}
