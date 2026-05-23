// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-telegram-webhook/index.ts (callback patterns)
// Brick: telegram-inline-menu-callback v0.1.0 (le-GO C-UI)
//
// Tipi pubblici del brick. Lo stesso shape di Telegram Bot API ma con
// estensioni convenienti (CallbackPayload, MenuAction).

// ============================================================================
// Inline keyboard primitives (Telegram-shaped)
// ============================================================================

/**
 * Singolo bottone inline. Mirror del Bot API InlineKeyboardButton ma
 * limitato ai campi che usiamo nell'agency. `callback_data` ha limite hard
 * di 64 byte UTF-8 (Telegram Bot API) — il builder valida questo.
 */
export interface KeyboardButton {
  /** Etichetta visibile (max 64 char Telegram, ma stiamo entro 32). */
  text: string;
  /** Callback data: routing payload. Max 64 byte. Auto-encoded dal builder. */
  callback_data?: string;
  /** URL HTTPS aperto al tap (alternativo a callback_data). */
  url?: string;
  /** Web app URL (Telegram Mini App). */
  web_app?: { url: string };
  /** Switch inline query nello stesso chat. */
  switch_inline_query_current_chat?: string;
}

/**
 * Inline keyboard nel formato accettato da Telegram (`reply_markup`).
 * Array di righe, ogni riga è un array di bottoni.
 */
export interface InlineKeyboardMarkup {
  inline_keyboard: KeyboardButton[][];
}

// ============================================================================
// Callback payload (routing)
// ============================================================================

/**
 * Payload di routing del callback. Formato canonical:
 *
 *     <namespace>:<action>[:<arg1>[:<arg2>...]]
 *
 * Esempi:
 *   - "gomec:order:confirm:abc123"
 *   - "goref:disamb:query:Mario%20Rossi"
 *   - "menu:nav:settings"
 *
 * `namespace` separa più bot/contesti che convivono sulla stessa chat (es.
 * un bot multi-tenant può prefissare con tenant_id slug).
 */
export interface CallbackPayload {
  namespace: string;
  action: string;
  args: string[];
  /** Payload originale raw (per debug / log). */
  raw: string;
}

/**
 * Risultato encode: stringa pronta per `callback_data` + flag che indica
 * se gli args sono stati troncati per rispettare il limite 64 byte.
 *
 * Best-practice: se `truncated`, il chiamante dovrebbe salvare il payload
 * pieno in DB (es. tabella telegram_callback_payloads) e usare un id corto.
 */
export interface EncodedCallback {
  data: string;
  truncated: boolean;
  bytes: number;
}

/**
 * Risultato decode: payload parsato + validità.
 * Soft: non lancia eccezione, ritorna `ok: false` se schema invalido.
 */
export type DecodedCallback =
  | { ok: true; payload: CallbackPayload }
  | { ok: false; error: string; raw: string };

// ============================================================================
// Menu action (dispatcher)
// ============================================================================

/**
 * Handler per una singola action del dispatcher. Riceve il payload decodificato
 * + il contesto callback (per accedere a chatId, messageId, callbackQueryId, user).
 *
 * Soft: il dispatcher cattura eventuali throw degli handler e logga, non
 * propaga. Il chiamante (webhook) resta sano.
 */
export interface CallbackContext {
  callback_query_id: string;
  chat_id: number;
  message_id?: number;
  user_id: number;
  user_language_code?: string;
  /** Raw callback_data ricevuto da Telegram. */
  raw_data: string;
}

export type MenuActionHandler = (
  payload: CallbackPayload,
  ctx: CallbackContext,
) => Promise<void> | void;

/**
 * Registry action → handler.
 * Key formato: `<namespace>:<action>` (es. "gomec:order_confirm").
 * Si match esatto, no wildcard (per ora).
 */
export type MenuActionRegistry = Record<string, MenuActionHandler>;

// ============================================================================
// Builder fluent state
// ============================================================================

/**
 * Stato interno builder. Esposto SOLO per debug / test, l'uso normale è
 * `buildKeyboard().row(...).button(...).build()`.
 */
export interface KeyboardBuilderState {
  rows: KeyboardButton[][];
  current_row: KeyboardButton[];
}

// ============================================================================
// Nested menu state (breadcrumb)
// ============================================================================

/**
 * Stato breadcrumb per menu nested. Permette di tornare al menu precedente
 * tramite bottone "indietro" senza rebuild da zero.
 *
 * Convenzione: salvato lato consumer (tabella DB o KV), non gestito dal brick.
 * Il brick fornisce solo i tipi + helper `pushMenuState` / `popMenuState`.
 */
export interface MenuStateFrame {
  /** Identificatore menu (es. "main", "settings.language"). */
  menu_id: string;
  /** Args opzionali (es. id record visualizzato). */
  args?: Record<string, string | number>;
}

export interface NestedMenuState {
  /** Stack di frame. Top = corrente, top-1 = parent. */
  frames: MenuStateFrame[];
}

// ============================================================================
// Result canonical (no-throw)
// ============================================================================

/**
 * Risultato dispatcher. Soft, mai throw.
 * - `ok: true`  → action trovata + handler eseguito senza eccezioni.
 * - `ok: false` → no handler (`unknown_action`) o handler ha throw'd.
 */
export type DispatchResult =
  | { ok: true; action_key: string }
  | { ok: false; error: string; action_key?: string; raw_data: string };
