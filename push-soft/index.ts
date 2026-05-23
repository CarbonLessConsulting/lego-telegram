// Brick: telegram-push-soft v0.1.0 (le-GO F-Integrations)
// Donor: @go_your_relationship_bot (~/Sviluppo/erp/gomyreference)
//
// Barrel re-export pubblico del brick. Tutti i consumer importano da qui:
//
//   import {
//     sendMessage, sendPhoto, sendDocument, sendChatAction,
//     editMessageText, editMessageReplyMarkup, answerCallbackQuery,
//     escapeHtml,
//     type TgSendResult,
//   } from "../_bricks/telegram-push-soft/index.ts";
//
// Tutti gli helper ritornano Promise<TgSendResult>. MAI throw.
// Lezione globale GOAi #14.

// ---- Helpers
export { sendMessage } from "./helpers/send-message.ts";
export { sendPhoto } from "./helpers/send-photo.ts";
export { sendDocument } from "./helpers/send-document.ts";
export { sendChatAction } from "./helpers/send-chat-action.ts";
export { editMessageText, editMessageReplyMarkup } from "./helpers/edit-message.ts";
export { answerCallbackQuery } from "./helpers/answer-callback.ts";

// ---- Utility
export { escapeHtml } from "./helpers/escape-html.ts";
export {
  chunkHtmlSafe,
  TELEGRAM_MAX_MESSAGE_LENGTH,
  TELEGRAM_SAFE_MESSAGE_LENGTH,
} from "./helpers/chunk-html.ts";
export {
  backoffMs,
  isTransient,
  sleep,
} from "./helpers/retry-policy.ts";
export type { RetryOpts, TransientCheck } from "./helpers/retry-policy.ts";

// ---- Types
export type {
  // Result canonical
  TgSendResult,
  SendMessageResult,
  // Send options
  SendMessageOptions,
  SendPhotoOptions,
  SendDocumentOptions,
  EditMessageOptions,
  AnswerCallbackOptions,
  // Misc
  TgParseMode,
  ChatAction,
  // Telegram update minimal (per consumer che non importano il brick gemello)
  TelegramUser,
  TelegramChat,
  TelegramMessage,
  TelegramCallbackQuery,
  TelegramUpdate,
} from "./types.ts";
