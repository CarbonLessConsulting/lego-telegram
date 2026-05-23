// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (interfaces)
// Brick: telegram-push-soft v0.1.0 (le-GO F-Integrations)
//
// Tipi pubblici esposti dal brick telegram-push-soft.
// Tipati in modo CONSERVATIVO: tutto ciò che non è strettamente necessario
// rimane `unknown` o opzionale. Edge function downstream possono fare
// narrowing dove serve.

// ============================================================================
// Common
// ============================================================================

/**
 * Risultato canonical per TUTTI gli helper send* / edit* / answer*.
 *
 * MAI ritornato con throw: il caller può controllare `ok` se gli interessa.
 *
 * `ok: true`  → Telegram ha accettato. `message_id` presente se applicabile.
 * `ok: false` → fail dopo retry. `error` sempre presente; `error_code`,
 *               `http_status` presenti se Telegram ha risposto con un codice.
 *               Il DB del chiamante NON deve rollbackare per questo: la
 *               business transaction è gia' coerente (lezione globale #14).
 */
export interface TgSendResult {
  ok: boolean;
  /** Codice errore Telegram (es. 429 rate-limit, 403 bot bloccato). */
  error_code?: number;
  /** Codice errore HTTP del gateway / fetch. */
  http_status?: number;
  /** Descrizione errore (Telegram description o tipo errore interno). */
  error?: string;
  /** message_id Telegram restituito su successo (sendMessage / sendPhoto / ...). */
  message_id?: number;
}

/**
 * `parse_mode` Telegram supportati. HTML è default per il brick (escapeHtml).
 */
export type TgParseMode = "HTML" | "MarkdownV2";

// ============================================================================
// sendMessage
// ============================================================================

export interface SendMessageOptions {
  /** Default: HTML. */
  parse_mode?: TgParseMode;
  /** Default: true (link preview disabilitata per messaggi compatti). */
  disable_web_page_preview?: boolean;
  /** Inline keyboard / reply keyboard. Telegram-shaped. */
  reply_markup?: unknown;
  /** Reply al message_id specifico. */
  reply_to_message_id?: number;
  /** Override numero max retry transient. Default 3. */
  max_attempts?: number;
}

// ============================================================================
// sendPhoto
// ============================================================================

export interface SendPhotoOptions {
  /** Caption opzionale (max 1024 char Telegram). */
  caption?: string;
  parse_mode?: TgParseMode;
  reply_markup?: unknown;
  reply_to_message_id?: number;
  disable_notification?: boolean;
  /** Override numero max retry transient. Default 3. */
  max_attempts?: number;
}

// ============================================================================
// sendDocument
// ============================================================================

export interface SendDocumentOptions {
  caption?: string;
  parse_mode?: TgParseMode;
  reply_markup?: unknown;
  reply_to_message_id?: number;
  disable_notification?: boolean;
  /** URL HTTPS o file_id Telegram di un'immagine thumbnail. */
  thumbnail?: string;
  max_attempts?: number;
}

// ============================================================================
// sendChatAction
// ============================================================================

/**
 * Tipi di "azione" Telegram supportati per indicatore UX.
 * https://core.telegram.org/bots/api#sendchataction
 */
export type ChatAction =
  | "typing"
  | "upload_photo"
  | "record_video"
  | "upload_video"
  | "record_voice"
  | "upload_voice"
  | "upload_document"
  | "choose_sticker"
  | "find_location"
  | "record_video_note"
  | "upload_video_note";

// ============================================================================
// editMessage
// ============================================================================

export interface EditMessageOptions {
  parse_mode?: TgParseMode;
  disable_web_page_preview?: boolean;
  reply_markup?: unknown;
  max_attempts?: number;
}

// ============================================================================
// answerCallbackQuery
// ============================================================================

export interface AnswerCallbackOptions {
  /** Toast / alert text (max 200 char Telegram). */
  text?: string;
  /** Se true mostra alert modale invece di toast. */
  show_alert?: boolean;
  /** URL redirect (solo per game / login_url callback). */
  url?: string;
  /** Secondi di cache lato client. */
  cache_time?: number;
}

// ============================================================================
// Telegram update minimal types (compat existing consumers)
// ============================================================================
// I tipi completi del Telegram Bot API stanno nel brick gemello
// `telegram-webhook-secret-verify` (re-esportati anche da qui via deep import).

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    width: number;
    height: number;
  }>;
  voice?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  reply_to_message?: TelegramMessage;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// Backward-compat alias (vecchio brick esportava SendMessageResult).
export type SendMessageResult = TgSendResult;
