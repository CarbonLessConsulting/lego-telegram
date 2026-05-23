// Donor: nessuno specifico nel donor — pattern best-practice setWebhook canonical
// Brick: telegram-webhook-secret-verify v0.1.0 (le-GO F-Integrations)
//
// Whitelist update types e filtering. Pattern lezione GoNetworker:
// `allowed_updates` di default in Telegram esclude `callback_query` →
// bottoni inline silenziosamente morti.

import type { TgAllowedUpdateType, TgUpdate } from "../types.ts";

/**
 * Whitelist canonical per la maggior parte dei bot agency:
 * messaggi + correzioni + callback_query (inline keyboard).
 *
 * Da passare al payload `setWebhook`:
 *   curl ".../setWebhook" -d "allowed_updates=$(echo $LIST | jq -Rs '.|split(",")')"
 */
export const ALLOWED_UPDATES_CANONICAL: ReadonlyArray<TgAllowedUpdateType> = Object.freeze([
  "message",
  "edited_message",
  "callback_query",
]);

/**
 * Whitelist estesa per bot multi-modale (Sofia, GoYourRelationships):
 * canonical + edited_message + group admin actions.
 */
export const ALLOWED_UPDATES_EXTENDED: ReadonlyArray<TgAllowedUpdateType> = Object.freeze([
  "message",
  "edited_message",
  "callback_query",
  "my_chat_member",
  "chat_member",
]);

/**
 * Whitelist completa (TUTTI gli update types Telegram).
 * Sconsigliato — ogni update non gestito consuma quota webhook.
 */
export const ALLOWED_UPDATES_ALL: ReadonlyArray<TgAllowedUpdateType> = Object.freeze([
  "message",
  "edited_message",
  "channel_post",
  "edited_channel_post",
  "callback_query",
  "inline_query",
  "chosen_inline_result",
  "shipping_query",
  "pre_checkout_query",
  "poll",
  "poll_answer",
  "my_chat_member",
  "chat_member",
  "chat_join_request",
]);

/**
 * Determina il `TgAllowedUpdateType` di un update parsato.
 * Ritorna `null` se nessun tipo previsto è popolato (improbabile su Telegram reale).
 */
export function detectUpdateType(upd: TgUpdate): TgAllowedUpdateType | null {
  if (upd.message) return "message";
  if (upd.edited_message) return "edited_message";
  if (upd.channel_post) return "channel_post";
  if (upd.edited_channel_post) return "edited_channel_post";
  if (upd.callback_query) return "callback_query";
  if (upd.inline_query) return "inline_query";
  if (upd.chosen_inline_result) return "chosen_inline_result";
  if (upd.shipping_query) return "shipping_query";
  if (upd.pre_checkout_query) return "pre_checkout_query";
  if (upd.poll) return "poll";
  if (upd.poll_answer) return "poll_answer";
  if (upd.my_chat_member) return "my_chat_member";
  if (upd.chat_member) return "chat_member";
  if (upd.chat_join_request) return "chat_join_request";
  return null;
}

/**
 * Verifica se l'update è di un tipo whitelist.
 *
 * @example
 *   const parsed = await parseUpdate(req);
 *   if (!parsed.ok) return new Response("Bad Request", { status: 400 });
 *   if (!isAllowedUpdate(parsed.update, ALLOWED_UPDATES_CANONICAL)) {
 *     return new Response("ok"); // ignora silenziosamente, 200 ok lato Telegram
 *   }
 */
export function isAllowedUpdate(
  upd: TgUpdate,
  allowed: ReadonlyArray<TgAllowedUpdateType>,
): boolean {
  const t = detectUpdateType(upd);
  if (t === null) return false;
  return allowed.includes(t);
}

/**
 * Costruisce il payload `allowed_updates` per `setWebhook`.
 * Telegram accetta JSON-encoded array di stringhe.
 *
 * @example
 *   const payload = {
 *     url: "https://<project>.supabase.co/functions/v1/goref-telegram-webhook",
 *     secret_token: env.TELEGRAM_WEBHOOK_SECRET_GOREF,
 *     allowed_updates: buildAllowedUpdatesPayload(ALLOWED_UPDATES_CANONICAL),
 *   };
 *   await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(payload),
 *   });
 */
export function buildAllowedUpdatesPayload(
  allowed: ReadonlyArray<TgAllowedUpdateType>,
): TgAllowedUpdateType[] {
  return [...allowed];
}
