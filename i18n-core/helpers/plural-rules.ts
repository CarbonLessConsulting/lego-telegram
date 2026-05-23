// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/i18n.ts (no plural helper present, ricostruito da pattern Intl.PluralRules)
// Brick: telegram-i18n-core v0.1.0 (le-GO C-UI)
//
// Plural rules wrapper. Espone Intl.PluralRules (nativo Deno/Node 18+) con
// fallback graceful se runtime non lo supporta.

import type { Locale, PluralCategory } from "../types.ts";

const cache = new Map<string, Intl.PluralRules | null>();

function getRules(locale: Locale | string): Intl.PluralRules | null {
  if (cache.has(locale)) return cache.get(locale) ?? null;
  try {
    const rules = new Intl.PluralRules(locale);
    cache.set(locale, rules);
    return rules;
  } catch {
    cache.set(locale, null);
    return null;
  }
}

/**
 * Risolve la categoria plurale ICU per `count` nel locale dato.
 *
 * Soft fallback se Intl.PluralRules non disponibile: one se |count|==1, altrimenti other.
 *
 * Categorie possibili:
 *   - zero, one, two, few, many, other
 *
 * Il consumer deve sapere quali categorie produce la sua locale e fornire
 * la PluralMap appropriata (vedi `tPlural()` in `t.ts`).
 */
export function selectPlural(
  count: number,
  locale: Locale | string = "it",
): PluralCategory {
  const rules = getRules(locale);
  if (!rules) {
    return Math.abs(count) === 1 ? "one" : "other";
  }
  return rules.select(count) as PluralCategory;
}

/**
 * Verifica se Intl.PluralRules è disponibile per la locale specificata.
 * Utile in test e per dichiarare requirement deployment.
 */
export function hasPluralRulesSupport(locale: Locale | string = "it"): boolean {
  return getRules(locale) !== null;
}
