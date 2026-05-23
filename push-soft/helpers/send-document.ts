// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (pattern fetch + retry)
// Brick: telegram-push-soft v0.1.0 (le-GO F-Integrations)
//
// sendDocument soft: invia documento (URL o file_id Telegram) con retry + no throw.

import type { SendDocumentOptions, TgSendResult } from "../types.ts";
import { backoffMs, isTransient, sleep } from "./retry-policy.ts";

const TG_API_BASE = "https://api.telegram.org";

interface TgApiResponse {
  ok?: boolean;
  error_code?: number;
  description?: string;
  result?: { message_id?: number; [k: string]: unknown };
}

/**
 * Invia documento Telegram con semantica soft no-throw.
 *
 * `document` può essere:
 *  - URL HTTPS pubblico (PDF, DOCX, ...)
 *  - file_id Telegram (di un upload precedente)
 *
 * Per upload diretto bytes (multipart/form-data) il consumer deve costruire il
 * proprio body — questo helper copre URL + file_id riuso (caso prevalente).
 */
export async function sendDocument(
  botToken: string,
  chatId: number,
  document: string,
  opts: SendDocumentOptions = {},
): Promise<TgSendResult> {
  if (!botToken) return { ok: false, error: "empty_bot_token" };
  if (!chatId || chatId === 0) return { ok: false, error: "invalid_chat_id" };
  if (!document) return { ok: false, error: "empty_document" };

  const body: Record<string, unknown> = {
    chat_id: chatId,
    document,
    ...(opts.caption && { caption: opts.caption }),
    ...(opts.parse_mode && { parse_mode: opts.parse_mode }),
    ...(opts.reply_markup ? { reply_markup: opts.reply_markup as Record<string, unknown> } : {}),
    ...(opts.reply_to_message_id && { reply_to_message_id: opts.reply_to_message_id }),
    ...(opts.disable_notification && { disable_notification: opts.disable_notification }),
    ...(opts.thumbnail && { thumbnail: opts.thumbnail }),
  };

  const maxAttempts = opts.max_attempts ?? 3;
  let parsed: TgApiResponse = {};
  let httpStatus = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(`${TG_API_BASE}/bot${botToken}/sendDocument`, {
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
      if (parsed.ok) {
        return { ok: true, message_id: parsed.result?.message_id };
      }
      const transient = isTransient({
        http_status: resp.status,
        tg_error_code: parsed.error_code,
      });
      console.warn({
        fn: "sendDocument.retry",
        chat_id: chatId,
        attempt,
        http: resp.status,
        tg_error_code: parsed.error_code,
        transient,
      });
      if (!transient) break;
      if (attempt < maxAttempts - 1) await sleep(backoffMs(attempt));
    } catch (networkErr) {
      console.warn({
        fn: "sendDocument.network_retry",
        chat_id: chatId,
        attempt,
        error: String(networkErr).slice(0, 200),
      });
      if (attempt < maxAttempts - 1) await sleep(backoffMs(attempt));
      else parsed = { ok: false, description: "network_error" };
    }
  }

  console.error({
    fn: "sendDocument.gave_up",
    chat_id: chatId,
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
