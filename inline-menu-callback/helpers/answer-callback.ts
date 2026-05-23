// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts:141-147
// Brick: telegram-inline-menu-callback v0.1.0 (le-GO C-UI)
//
// answerCallbackQuery — feedback al tap del bottone inline.
//
// Telegram OBBLIGA a chiamare questa entro 15s dalla ricezione del
// `callback_query`, altrimenti il client mostra "loading…" indefinitamente.
//
// Soft: nessun throw. Toast troncato a 200 char (limite Telegram).

const TG_TOAST_MAX = 200;

export interface AnswerCallbackResult {
  ok: boolean;
  http_status?: number;
  error?: string;
}

export interface AnswerCallbackQueryOptions {
  /** Testo toast (max 200 char). Se >200 truncate per code-point (no surrogate orfano). */
  text?: string;
  /** True = alert modale, False = toast popup ai piedi (default false). */
  show_alert?: boolean;
  /** URL redirect (per game/login_url callback). */
  url?: string;
  /** Cache lato client in secondi. */
  cache_time?: number;
}

/**
 * Chiama Telegram `answerCallbackQuery`. Soft, mai throw.
 *
 * Convenzione portabilità ADK Mod 1: bot token passato esplicitamente,
 * zero env-baked all'interno del brick.
 */
export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  opts: AnswerCallbackQueryOptions = {},
): Promise<AnswerCallbackResult> {
  if (!botToken) {
    console.error({ fn: "answerCallbackQuery", error: "empty_bot_token" });
    return { ok: false, error: "empty_bot_token" };
  }
  if (!callbackQueryId) {
    console.error({ fn: "answerCallbackQuery", error: "empty_callback_id" });
    return { ok: false, error: "empty_callback_id" };
  }

  // Truncate toast preservando emoji (lezione #7).
  let text = opts.text;
  if (text && Array.from(text).length > TG_TOAST_MAX) {
    text = Array.from(text).slice(0, TG_TOAST_MAX).join("");
  }

  const body: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
    ...(opts.show_alert ? { show_alert: true } : {}),
    ...(opts.url ? { url: opts.url } : {}),
    ...(opts.cache_time !== undefined ? { cache_time: opts.cache_time } : {}),
  };

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!resp.ok) {
      let desc = "";
      try {
        const j = (await resp.json()) as { description?: string };
        desc = j.description ?? "";
      } catch {
        /* ignore */
      }
      console.error({
        fn: "answerCallbackQuery",
        http: resp.status,
        description: desc,
      });
      return { ok: false, http_status: resp.status, error: desc };
    }
    return { ok: true, http_status: 200 };
  } catch (e) {
    const err = e as Error;
    console.error({
      fn: "answerCallbackQuery.network",
      error: err?.message ?? String(e),
    });
    return { ok: false, error: err?.message ?? "network_error" };
  }
}
