// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/types.ts (TgUpdate, TgMessage, ...)
// Brick: telegram-webhook-secret-verify v0.1.0 (le-GO F-Integrations)
//
// Tipi completi del Telegram Bot API per webhook update handling.
// Riferimento ufficiale: https://core.telegram.org/bots/api#update
//
// Tutti i campi opzionali sono marcati `?` — il consumer deve fare narrowing
// per accedere a una sezione specifica (message, callback_query, ...).

// ============================================================================
// User / Chat
// ============================================================================

export interface TgUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export type TgChatType = "private" | "group" | "supergroup" | "channel";

export interface TgChat {
  id: number;
  type: TgChatType;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_forum?: boolean;
}

// ============================================================================
// Media + entities
// ============================================================================

export interface TgPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TgVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TgAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TgPhotoSize;
}

export interface TgVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumbnail?: TgPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TgDocument {
  file_id: string;
  file_unique_id: string;
  thumbnail?: TgPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TgContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
}

export interface TgLocation {
  longitude: number;
  latitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

export interface TgMessageEntity {
  type:
    | "mention"
    | "hashtag"
    | "cashtag"
    | "bot_command"
    | "url"
    | "email"
    | "phone_number"
    | "bold"
    | "italic"
    | "underline"
    | "strikethrough"
    | "spoiler"
    | "blockquote"
    | "code"
    | "pre"
    | "text_link"
    | "text_mention"
    | "custom_emoji";
  offset: number;
  length: number;
  url?: string;
  user?: TgUser;
  language?: string;
  custom_emoji_id?: string;
}

// ============================================================================
// Message
// ============================================================================

export interface TgMessage {
  message_id: number;
  message_thread_id?: number;
  from?: TgUser;
  sender_chat?: TgChat;
  date: number;
  chat: TgChat;
  forward_from?: TgUser;
  forward_from_chat?: TgChat;
  forward_from_message_id?: number;
  forward_date?: number;
  reply_to_message?: TgMessage;
  edit_date?: number;
  text?: string;
  entities?: TgMessageEntity[];
  caption?: string;
  caption_entities?: TgMessageEntity[];
  photo?: TgPhotoSize[];
  voice?: TgVoice;
  audio?: TgAudio;
  video?: TgVideo;
  document?: TgDocument;
  contact?: TgContact;
  location?: TgLocation;
  new_chat_members?: TgUser[];
  left_chat_member?: TgUser;
  new_chat_title?: string;
  group_chat_created?: boolean;
  pinned_message?: TgMessage;
  // Note: per esigenze specifiche aggiungere campi qui — preferito narrowing
  // esplicito a `unknown` per non rompere consumer downstream.
}

// ============================================================================
// Callback Query
// ============================================================================

export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

// ============================================================================
// Inline Query / Chosen
// ============================================================================

export interface TgInlineQuery {
  id: string;
  from: TgUser;
  query: string;
  offset: string;
  chat_type?: TgChatType | "sender";
  location?: TgLocation;
}

export interface TgChosenInlineResult {
  result_id: string;
  from: TgUser;
  location?: TgLocation;
  inline_message_id?: string;
  query: string;
}

// ============================================================================
// Payments
// ============================================================================

export interface TgShippingAddress {
  country_code: string;
  state: string;
  city: string;
  street_line1: string;
  street_line2: string;
  post_code: string;
}

export interface TgOrderInfo {
  name?: string;
  phone_number?: string;
  email?: string;
  shipping_address?: TgShippingAddress;
}

export interface TgShippingQuery {
  id: string;
  from: TgUser;
  invoice_payload: string;
  shipping_address: TgShippingAddress;
}

export interface TgPreCheckoutQuery {
  id: string;
  from: TgUser;
  currency: string;
  total_amount: number;
  invoice_payload: string;
  shipping_option_id?: string;
  order_info?: TgOrderInfo;
}

// ============================================================================
// Polls
// ============================================================================

export interface TgPollOption {
  text: string;
  voter_count: number;
}

export interface TgPoll {
  id: string;
  question: string;
  options: TgPollOption[];
  total_voter_count: number;
  is_closed: boolean;
  is_anonymous: boolean;
  type: "regular" | "quiz";
  allows_multiple_answers: boolean;
  correct_option_id?: number;
  open_period?: number;
  close_date?: number;
}

export interface TgPollAnswer {
  poll_id: string;
  user?: TgUser;
  voter_chat?: TgChat;
  option_ids: number[];
}

// ============================================================================
// Chat Member updates
// ============================================================================

export type TgChatMemberStatus =
  | "creator"
  | "administrator"
  | "member"
  | "restricted"
  | "left"
  | "kicked";

export interface TgChatMember {
  status: TgChatMemberStatus;
  user: TgUser;
  // Restanti campi differiscono per status — lasciato a `unknown` extra.
  [key: string]: unknown;
}

export interface TgChatMemberUpdated {
  chat: TgChat;
  from: TgUser;
  date: number;
  old_chat_member: TgChatMember;
  new_chat_member: TgChatMember;
  invite_link?: unknown;
  via_chat_folder_invite_link?: boolean;
}

// ============================================================================
// Update (root)
// ============================================================================

/**
 * Update Telegram canonical. Esattamente UNO dei campi opzionali è popolato
 * per ogni update — il consumer deve fare narrowing esplicito.
 *
 * Riferimento: https://core.telegram.org/bots/api#update
 */
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  channel_post?: TgMessage;
  edited_channel_post?: TgMessage;
  inline_query?: TgInlineQuery;
  chosen_inline_result?: TgChosenInlineResult;
  callback_query?: TgCallbackQuery;
  shipping_query?: TgShippingQuery;
  pre_checkout_query?: TgPreCheckoutQuery;
  poll?: TgPoll;
  poll_answer?: TgPollAnswer;
  my_chat_member?: TgChatMemberUpdated;
  chat_member?: TgChatMemberUpdated;
  chat_join_request?: unknown;
}

// ============================================================================
// Brick output types
// ============================================================================

export type ParseUpdateResult =
  | { ok: true; update: TgUpdate }
  | { ok: false; error: "invalid_json" | "missing_update_id" | "empty_body" | "body_too_large"; description?: string };

/**
 * Tipi update accettati dal `setWebhook` payload Telegram.
 * Whitelist canonical raccomandata per ogni bot agency:
 *  - message: comandi /start, /help, testo
 *  - edited_message: utente corregge un messaggio (Sofia ri-processa)
 *  - callback_query: bottoni inline cliccati
 *
 * Non-canonical (di solito non servono — abilitare esplicitamente nel consumer):
 *  - channel_post, edited_channel_post (bot in canale)
 *  - inline_query, chosen_inline_result (bot inline)
 *  - shipping_query, pre_checkout_query (e-commerce Telegram Payments)
 *  - poll, poll_answer (bot sondaggi)
 *  - my_chat_member, chat_member, chat_join_request (bot admin gruppo)
 */
export type TgAllowedUpdateType =
  | "message"
  | "edited_message"
  | "channel_post"
  | "edited_channel_post"
  | "callback_query"
  | "inline_query"
  | "chosen_inline_result"
  | "shipping_query"
  | "pre_checkout_query"
  | "poll"
  | "poll_answer"
  | "my_chat_member"
  | "chat_member"
  | "chat_join_request";
