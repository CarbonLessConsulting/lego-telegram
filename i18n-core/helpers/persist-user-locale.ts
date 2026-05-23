// Donor: ~/Sviluppo/erp/gomyreference/_shared/i18n.ts + tenant.ts (pattern user_settings persistence)
// Brick: telegram-i18n-core v0.1.0 (le-GO C-UI)
//
// Persister contract per locale utente. Il brick NON impone storage:
// fornisce solo l'interfaccia + un in-memory persister default per test/dev.

import { isSupportedLocale } from "./detect-locale.ts";
import type { Locale, LocalePersister, UserLocaleRow } from "../types.ts";

/**
 * In-memory persister default. Soft, mai throw. Stato locale al processo
 * (perso al restart). Adatto per test, dev locale, sviluppo iniziale.
 *
 * PRODUZIONE: il consumer DEVE fornire un persister Supabase / KV.
 */
export function createInMemoryPersister(): LocalePersister {
  const store = new Map<number, Locale | string>();
  return {
    async load(telegram_user_id) {
      const locale = store.get(telegram_user_id);
      if (!locale) return { ok: false, error: "not_found" };
      return { ok: true, locale };
    },
    async save(row) {
      try {
        if (!row.telegram_user_id || row.telegram_user_id <= 0) {
          return { ok: false, error: "invalid_user_id" };
        }
        if (!row.locale || typeof row.locale !== "string") {
          return { ok: false, error: "invalid_locale" };
        }
        store.set(row.telegram_user_id, row.locale);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error)?.message ?? "unknown" };
      }
    },
  };
}

/**
 * Validatore: rifiuta locali non supportati per evitare di scrivere garbage
 * nella tabella user_locales. Soft: ritorna {ok:false, error} se invalida.
 */
export function validateLocaleInput(raw: string): {
  ok: boolean;
  locale?: Locale;
  error?: string;
} {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "empty_locale" };
  }
  const lc = raw.trim().toLowerCase();
  if (!isSupportedLocale(lc)) {
    return { ok: false, error: "unsupported_locale" };
  }
  return { ok: true, locale: lc as Locale };
}

/**
 * Helper convenience: load → fallback → save in un solo flow.
 * Utile per handler comando `/lingua pt`.
 *
 * Soft: tutti gli errori catturati e ritornati in result.
 */
export async function setUserLocale(
  persister: LocalePersister,
  telegram_user_id: number,
  locale_input: string,
): Promise<{ ok: boolean; locale?: Locale; error?: string }> {
  const v = validateLocaleInput(locale_input);
  if (!v.ok) return v;
  const result = await persister.save({
    telegram_user_id,
    locale: v.locale!,
    updated_at: new Date().toISOString(),
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, locale: v.locale };
}

/**
 * Helper convenience: load locale utente, soft. Ritorna `null` se non set.
 */
export async function getUserLocale(
  persister: LocalePersister,
  telegram_user_id: number,
): Promise<Locale | string | null> {
  const r = await persister.load(telegram_user_id);
  return r.ok && r.locale ? r.locale : null;
}

export type { LocalePersister, UserLocaleRow };
