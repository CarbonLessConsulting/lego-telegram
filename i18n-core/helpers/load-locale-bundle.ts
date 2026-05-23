// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/i18n.ts:476-487 (MESSAGES registry + lookup)
// Brick: telegram-i18n-core v0.1.0 (le-GO C-UI)
//
// Loader bundle JSON per locale. Il brick fornisce 6 bundle base
// (it/en/es/de/fr/pt) come stub minimal. I bot consumer ESTENDONO il
// registry caricando i propri bundle (uno per bot) tramite registerBundle().

import type {
  BundleRegistry,
  Locale,
  TranslationBundle,
  TranslationValue,
} from "../types.ts";

// Bundle base shippati col brick. Contengono SOLO chiavi cross-bot canonical
// (errori comuni, comandi di sistema). I bot estendono con le proprie chiavi.
import baseIt from "../locales/it.json" with { type: "json" };
import baseEn from "../locales/en.json" with { type: "json" };
import baseEs from "../locales/es.json" with { type: "json" };
import baseDe from "../locales/de.json" with { type: "json" };
import baseFr from "../locales/fr.json" with { type: "json" };
import basePt from "../locales/pt.json" with { type: "json" };

const BUILTIN: BundleRegistry = {
  it: baseIt as TranslationBundle,
  en: baseEn as TranslationBundle,
  es: baseEs as TranslationBundle,
  de: baseDe as TranslationBundle,
  fr: baseFr as TranslationBundle,
  pt: basePt as TranslationBundle,
};

/**
 * Lookup di una chiave in un bundle specifico. Soft: ritorna `undefined`
 * se chiave mancante (non throw).
 */
export function lookupKey(
  bundle: TranslationBundle | undefined,
  key: string,
): TranslationValue | undefined {
  if (!bundle) return undefined;
  return bundle[key];
}

/**
 * Crea un nuovo registry combinando i bundle builtin con i custom passati.
 * Override granulare per locale: il custom MERGE con builtin chiave-per-chiave
 * (custom wins su collision).
 *
 * Tipico uso: ogni bot fa
 *   const registry = createRegistry({ it: customIt, en: customEn });
 */
export function createRegistry(custom?: BundleRegistry): BundleRegistry {
  const out: BundleRegistry = {};
  for (const loc of Object.keys(BUILTIN) as Locale[]) {
    out[loc] = { ...BUILTIN[loc] };
  }
  if (custom) {
    for (const loc of Object.keys(custom) as Array<keyof BundleRegistry>) {
      const customBundle = custom[loc];
      if (!customBundle) continue;
      out[loc] = { ...(out[loc] ?? {}), ...customBundle };
    }
  }
  return out;
}

/**
 * Carica bundle pubblico per una locale dal registry (con fallback empty se
 * non disponibile). Usato internamente da `t()`.
 */
export function getBundle(
  registry: BundleRegistry,
  locale: Locale | string,
): TranslationBundle | undefined {
  return registry[locale];
}

/**
 * Esporta i bundle builtin (read-only) per debug / test.
 */
export function getBuiltinBundles(): Readonly<BundleRegistry> {
  return BUILTIN;
}
