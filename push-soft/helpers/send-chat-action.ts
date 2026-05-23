// Donor: pattern fire-and-forget Telegram (UX typing indicator)
// Brick: telegram-push-soft v0.1.0 (le-GO F-Integrations)
//
// sendChatAction soft: invia indicatore "typing" / "upload_photo" / ... a UX.
// Best-effort: 1 solo tentativo (no retry), mai throw. Se fallisce l'UX
// non vede l'indicatore ma il flusso prosegue.

import type { ChatAction, TgSendResult } from "../types.ts";

const TG_API_BASE = "https://api.telegram.org";

/**
 * Invia un "chat action" (typing indicator etc.) Telegram in modo best-effort.
 *
 * Telegram mostra l'indicatore per ~5 secondi. Per indicatori più lunghi
 * il consumer deve richiamare sendChatAction in loop ogni 4 secondi.
 *
 * Non fa retry: è un'azione UX di puro decoro, non vale la pena consumare
 * budget di tempo della edge fn. Mai throw.
 */
export async function sendChatAction(
  botToken: string,
  chatId: number,
  action: ChatAction,
): Promise<TgSendResult> {
  if (!botToken) return { ok: false, error: "empty_bot_token" };
  if (!chatId || chatId === 0) return { ok: false, error: "invalid_chat_id" };

  try {
    const resp = await fetch(`${TG_API_BASE}/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
    if (!resp.ok) {
      let description: string | undefined;
      try {
        const json = await resp.json() as { description?: string };
        description = json.description;
      } catch { /* ignore */ }
      return {
        ok: false,
        error: description ?? `http_${resp.status}`,
        http_status: resp.status,
      };
    }
    return { ok: true };
  } catch (networkErr) {
    console.warn({
      fn: "sendChatAction.network_error",
      chat_id: chatId,
      error: String(networkErr).slice(0, 200),
    });
    return { ok: false, error: "network_error" };
  }
}
