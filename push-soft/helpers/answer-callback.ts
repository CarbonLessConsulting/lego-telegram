// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (righe 141-147 answerCallbackQuery)
// Brick: telegram-push-soft v0.1.0 (le-GO F-Integrations)
//
// answerCallbackQuery soft: rimuove lo "spinner" sui bottoni inline cliccati.
// OBBLIGATORIO chiamarlo entro 15s dal callback_query, altrimenti Telegram
// mostra "Loading..." perpetuo all'utente. Mai throw.

import type { AnswerCallbackOptions, TgSendResult } from "../types.ts";

const TG_API_BASE = "https://api.telegram.org";

/**
 * Risponde a una callback_query Telegram.
 *
 * Caso d'uso obbligatorio: dopo OGNI ricezione di update.callback_query
 * il bot DEVE chiamare answerCallbackQuery per togliere lo spinner client-side
 * (Telegram lo mostra fino al timeout di 15s).
 *
 * Opzioni:
 *  - `text`: toast popup mostrato all'utente (max 200 char)
 *  - `show_alert: true`: il messaggio appare come alert modale invece di toast
 *  - `url`: redirect (solo per game / login_url callback)
 *  - `cache_time`: secondi di cache lato client (default 0)
 *
 * Soft no-throw. Best-effort (1 tentativo + 1 retry su transient).
 */
export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  opts: AnswerCallbackOptions = {},
): Promise<TgSendResult> {
  if (!botToken) return { ok: false, error: "empty_bot_token" };
  if (!callbackQueryId) return { ok: false, error: "empty_callback_query_id" };

  const body: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
    ...(opts.text && { text: opts.text.slice(0, 200) }),
    ...(opts.show_alert && { show_alert: opts.show_alert }),
    ...(opts.url && { url: opts.url }),
    ...(opts.cache_time !== undefined && { cache_time: opts.cache_time }),
  };

  try {
    const resp = await fetch(`${TG_API_BASE}/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      let description: string | undefined;
      try {
        const json = await resp.json() as { description?: string };
        description = json.description;
      } catch { /* ignore */ }
      console.warn({
        fn: "answerCallbackQuery.soft_fail",
        callback_query_id: callbackQueryId,
        http: resp.status,
        description,
      });
      return {
        ok: false,
        error: description ?? `http_${resp.status}`,
        http_status: resp.status,
      };
    }
    return { ok: true };
  } catch (networkErr) {
    console.warn({
      fn: "answerCallbackQuery.network_error",
      callback_query_id: callbackQueryId,
      error: String(networkErr).slice(0, 200),
    });
    return { ok: false, error: "network_error" };
  }
}
