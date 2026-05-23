// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts:149-163
// Brick: telegram-inline-menu-callback v0.1.0 (le-GO C-UI)
//
// editMessageText / editMessageReplyMarkup wrapper soft, con focus sul
// pattern "aggiorna menu corrente con altri bottoni" (nested navigation).
//
// Soft: nessun throw. Telegram a volte ritorna "message is not modified"
// (400 Bad Request) → trattato come ok (no-op success).

import type { InlineKeyboardMarkup } from "../types.ts";

export interface UpdateMessageResult {
  ok: boolean;
  http_status?: number;
  error?: string;
  /** True quando Telegram ha risposto "message is not modified" (no-op). */
  no_op?: boolean;
}

/**
 * Sostituisce text + reply_markup di un messaggio già inviato.
 *
 * Usato tipicamente in handler callback per navigare tra menu nested:
 *  - utente preme bottone "→ Impostazioni" sul main menu
 *  - handler chiama updateMessageWithMenu(chatId, msgId, "Impostazioni…", settingsKeyboard)
 *
 * `parse_mode` default = HTML (consistente con telegram-push-soft).
 */
export async function updateMessageWithMenu(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
  parseMode: "HTML" | "MarkdownV2" = "HTML",
): Promise<UpdateMessageResult> {
  if (!botToken) return { ok: false, error: "empty_bot_token" };
  if (!chatId || !messageId) return { ok: false, error: "invalid_target" };

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/editMessageText`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
      },
    );
    if (resp.ok) return { ok: true, http_status: 200 };

    let desc = "";
    try {
      const j = (await resp.json()) as { description?: string };
      desc = j.description ?? "";
    } catch { /* ignore */ }

    // Telegram restituisce 400 "Bad Request: message is not modified" se il
    // contenuto è identico — trattalo come ok no-op.
    if (resp.status === 400 && /not modified/i.test(desc)) {
      return { ok: true, http_status: 400, no_op: true };
    }

    console.error({
      fn: "updateMessageWithMenu",
      http: resp.status,
      description: desc,
    });
    return { ok: false, http_status: resp.status, error: desc };
  } catch (e) {
    const err = e as Error;
    console.error({
      fn: "updateMessageWithMenu.network",
      error: err?.message ?? String(e),
    });
    return { ok: false, error: err?.message ?? "network_error" };
  }
}

/**
 * Aggiorna SOLO il reply_markup (lascia testo invariato). Utile dopo aver
 * fatto eseguire una callback action (es. "Save" → svuota keyboard).
 */
export async function updateMessageMenuOnly(
  botToken: string,
  chatId: number,
  messageId: number,
  replyMarkup: InlineKeyboardMarkup,
): Promise<UpdateMessageResult> {
  if (!botToken) return { ok: false, error: "empty_bot_token" };
  if (!chatId || !messageId) return { ok: false, error: "invalid_target" };

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        }),
      },
    );
    if (resp.ok) return { ok: true, http_status: 200 };

    let desc = "";
    try {
      const j = (await resp.json()) as { description?: string };
      desc = j.description ?? "";
    } catch { /* ignore */ }

    if (resp.status === 400 && /not modified/i.test(desc)) {
      return { ok: true, http_status: 400, no_op: true };
    }

    console.error({
      fn: "updateMessageMenuOnly",
      http: resp.status,
      description: desc,
    });
    return { ok: false, http_status: resp.status, error: desc };
  } catch (e) {
    const err = e as Error;
    console.error({
      fn: "updateMessageMenuOnly.network",
      error: err?.message ?? String(e),
    });
    return { ok: false, error: err?.message ?? "network_error" };
  }
}
