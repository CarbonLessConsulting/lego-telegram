// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (righe 149-163 editMessageText + editMessageReplyMarkup)
// Brick: telegram-push-soft v0.1.0 (le-GO F-Integrations)
//
// editMessageText / editMessageReplyMarkup soft.
// Pattern usato per streaming-style updates (correzioni Sofia, draft preview).

import type { EditMessageOptions, TgSendResult } from "../types.ts";
import { backoffMs, isTransient, sleep } from "./retry-policy.ts";

const TG_API_BASE = "https://api.telegram.org";

interface TgApiResponse {
  ok?: boolean;
  error_code?: number;
  description?: string;
  result?: { message_id?: number; [k: string]: unknown };
}

/**
 * Aggiorna il testo di un messaggio Telegram esistente.
 *
 * Caso d'uso tipico: streaming LLM (Sofia che "scrive" progressivamente),
 * correzione di un draft, refresh inline keyboard preserving body.
 *
 * Telegram restituisce errore se:
 *  - il testo non è cambiato (description: "message is not modified")
 *  - il messaggio ha più di 48h (per non-bot messages)
 *  - il bot non ha permessi su quella chat
 *
 * Soft no-throw: tutti gli errori ritornano `{ok:false}`.
 */
export async function editMessageText(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  opts: EditMessageOptions = {},
): Promise<TgSendResult> {
  if (!botToken) return { ok: false, error: "empty_bot_token" };
  if (!chatId || chatId === 0) return { ok: false, error: "invalid_chat_id" };
  if (!messageId || messageId === 0) return { ok: false, error: "invalid_message_id" };
  if (!text) return { ok: false, error: "empty_text" };

  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: opts.parse_mode ?? "HTML",
    disable_web_page_preview: opts.disable_web_page_preview ?? true,
    ...(opts.reply_markup ? { reply_markup: opts.reply_markup as Record<string, unknown> } : {}),
  };

  const maxAttempts = opts.max_attempts ?? 3;
  let parsed: TgApiResponse = {};
  let httpStatus = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(`${TG_API_BASE}/bot${botToken}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      httpStatus = resp.status;
      try {
        parsed = (await resp.json()) as TgApiResponse;
      } catch {
        parsed = { ok: false };
      }
      if (parsed.ok) return { ok: true, message_id: messageId };

      // Eccezione: "message is not modified" non è un errore reale, è no-op
      if (parsed.description?.includes("message is not modified")) {
        return { ok: true, message_id: messageId };
      }

      const transient = isTransient({
        http_status: resp.status,
        tg_error_code: parsed.error_code,
      });
      if (!transient) break;
      if (attempt < maxAttempts - 1) await sleep(backoffMs(attempt));
    } catch (networkErr) {
      console.warn({
        fn: "editMessageText.network_retry",
        chat_id: chatId,
        attempt,
        error: String(networkErr).slice(0, 200),
      });
      if (attempt < maxAttempts - 1) await sleep(backoffMs(attempt));
      else parsed = { ok: false, description: "network_error" };
    }
  }

  console.error({
    fn: "editMessageText.gave_up",
    chat_id: chatId,
    message_id: messageId,
    http: httpStatus,
    tg_error_code: parsed.error_code,
    tg_description: parsed.description,
  });
  return {
    ok: false,
    error: parsed.description ?? `http_${httpStatus}`,
    error_code: parsed.error_code,
    http_status: httpStatus,
  };
}

/**
 * Aggiorna solo la inline keyboard di un messaggio (preserva il body).
 *
 * Caso d'uso: disabilitare bottoni dopo che l'utente ha scelto un'opzione.
 */
export async function editMessageReplyMarkup(
  botToken: string,
  chatId: number,
  messageId: number,
  replyMarkup: unknown,
): Promise<TgSendResult> {
  if (!botToken) return { ok: false, error: "empty_bot_token" };
  if (!chatId || chatId === 0) return { ok: false, error: "invalid_chat_id" };
  if (!messageId || messageId === 0) return { ok: false, error: "invalid_message_id" };

  try {
    const resp = await fetch(`${TG_API_BASE}/bot${botToken}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup,
      }),
    });
    if (!resp.ok) {
      let description: string | undefined;
      try {
        const json = await resp.json() as { description?: string };
        description = json.description;
      } catch { /* ignore */ }
      // "message is not modified" = no-op success
      if (description?.includes("message is not modified")) {
        return { ok: true, message_id: messageId };
      }
      return {
        ok: false,
        error: description ?? `http_${resp.status}`,
        http_status: resp.status,
      };
    }
    return { ok: true, message_id: messageId };
  } catch (networkErr) {
    console.warn({
      fn: "editMessageReplyMarkup.network_error",
      chat_id: chatId,
      message_id: messageId,
      error: String(networkErr).slice(0, 200),
    });
    return { ok: false, error: "network_error" };
  }
}
