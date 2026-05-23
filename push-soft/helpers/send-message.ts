// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (righe 49-105 sendMessage)
// Brick: telegram-push-soft v0.1.0 (le-GO F-Integrations)
//
// sendMessage soft: ritenta x3 sui transient (429, 5xx), MAI throw.
// Su fail finale ritorna { ok: false, ... } — la edge fn chiamante può
// completare le sue operazioni DB senza stato inconsistente.
//
// Lezione globale #14 (21/05/2026, onboarding Ersilia, 4h debug).

import type { SendMessageOptions, TgSendResult } from "../types.ts";
import { backoffMs, isTransient, sleep } from "./retry-policy.ts";
import { chunkHtmlSafe } from "./chunk-html.ts";

const TG_API_BASE = "https://api.telegram.org";

interface TgApiResponse {
  ok?: boolean;
  error_code?: number;
  description?: string;
  result?: { message_id?: number; [k: string]: unknown };
}

/**
 * Invia un messaggio Telegram con semantica soft no-throw.
 *
 * - `botToken` MAI hardcoded (lezione globale: env var `TELEGRAM_BOT_TOKEN_<BOT_KEY>`).
 * - `chatId` numerico (private chat, group, supergroup).
 * - `text` può contenere markup HTML/MarkdownV2 (vedi opts.parse_mode).
 * - Se `text.length > 4000` viene splittato automaticamente in chunk.
 * - Retry x3 con backoff esponenziale (400/800/1600ms + jitter) su transient.
 * - Su fail finale ritorna `{ok:false, ...}` — caller decide se trattarlo.
 *
 * @returns Promise<TgSendResult> — MAI throw (anche con token vuoto / chatId 0).
 */
export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  opts: SendMessageOptions = {},
): Promise<TgSendResult> {
  if (!botToken) {
    console.error({ fn: "sendMessage.soft_fail", reason: "empty_bot_token" });
    return { ok: false, error: "empty_bot_token" };
  }
  if (!chatId || chatId === 0) {
    console.error({ fn: "sendMessage.soft_fail", reason: "invalid_chat_id", chatId });
    return { ok: false, error: "invalid_chat_id" };
  }
  if (!text || text.length === 0) {
    return { ok: false, error: "empty_text" };
  }

  const parts = chunkHtmlSafe(text);
  const maxAttempts = opts.max_attempts ?? 3;
  const parseMode = opts.parse_mode ?? "HTML";

  let lastResult: TgSendResult = { ok: false, error: "no_attempt_made" };

  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    const body = {
      chat_id: chatId,
      text: parts[i],
      parse_mode: parseMode,
      disable_web_page_preview: opts.disable_web_page_preview ?? true,
      ...(opts.reply_to_message_id && { reply_to_message_id: opts.reply_to_message_id }),
      // reply_markup solo sull'ultimo chunk (bottoni a fine messaggio).
      ...(isLast && opts.reply_markup ? { reply_markup: opts.reply_markup } : {}),
    };

    let parsed: TgApiResponse = {};
    let httpStatus = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const resp = await fetch(`${TG_API_BASE}/bot${botToken}/sendMessage`, {
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
        if (parsed.ok) break;

        const transient = isTransient({
          http_status: resp.status,
          tg_error_code: parsed.error_code,
        });
        console.warn({
          fn: "sendMessage.retry",
          chat_id: chatId,
          attempt,
          http: resp.status,
          tg_error_code: parsed.error_code,
          // GDPR: nessun PII del body (description Telegram puo' contenere chat_id, ok)
          tg_description: parsed.description,
          transient,
        });
        if (!transient) break;
        if (attempt < maxAttempts - 1) await sleep(backoffMs(attempt));
      } catch (networkErr) {
        // Errore di rete: trattalo come transient
        console.warn({
          fn: "sendMessage.network_retry",
          chat_id: chatId,
          attempt,
          error: String(networkErr).slice(0, 200),
        });
        if (attempt < maxAttempts - 1) await sleep(backoffMs(attempt));
        else parsed = { ok: false, description: "network_error" };
      }
    }

    if (parsed.ok) {
      lastResult = {
        ok: true,
        message_id: parsed.result?.message_id,
      };
    } else {
      console.error({
        fn: "sendMessage.gave_up",
        chat_id: chatId,
        http: httpStatus,
        tg_error_code: parsed.error_code,
        tg_description: parsed.description,
      });
      lastResult = {
        ok: false,
        error: parsed.description ?? `http_${httpStatus}`,
        error_code: parsed.error_code,
        http_status: httpStatus,
      };
      // Se un chunk fallisce, non proseguire con i successivi (eviterebbe message split rotti)
      break;
    }
  }

  return lastResult;
}
