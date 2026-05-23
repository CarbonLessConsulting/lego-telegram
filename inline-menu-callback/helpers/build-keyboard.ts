// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-telegram-webhook/index.ts:1172-1183 (keyboard literal patterns)
// Donor secondario: ~/Sviluppo/erp/gosolution/supabase/functions/gomec-telegram-webhook/ (entity menu pattern)
// Brick: telegram-inline-menu-callback v0.1.0 (le-GO C-UI)
//
// Builder fluent per InlineKeyboardMarkup. Verifica auto del limite 64 byte
// sui callback_data al momento dell'add (warn console + truncate, no throw).
//
// API:
//   buildKeyboard()
//     .button("✅ Save", { namespace:"gomec", action:"order_save", args:["abc"] })
//     .button("❌ Cancel", { namespace:"gomec", action:"order_cancel" })
//     .row()  // chiude riga corrente, apre nuova
//     .urlButton("Open PWA", "https://example.com")
//     .build();

import type {
  InlineKeyboardMarkup,
  KeyboardButton,
  KeyboardBuilderState,
} from "../types.ts";
import { encodeCallbackData } from "./encode-callback-data.ts";

export interface KeyboardBuilder {
  /**
   * Aggiunge bottone con callback_data (auto-encoded, warn se truncate).
   * `payload` viene passato a `encodeCallbackData()`.
   */
  button(
    text: string,
    payload: { namespace: string; action: string; args?: Array<string | number> },
  ): KeyboardBuilder;
  /** Aggiunge bottone URL. */
  urlButton(text: string, url: string): KeyboardBuilder;
  /** Aggiunge bottone Web App (Telegram Mini App). */
  webAppButton(text: string, url: string): KeyboardBuilder;
  /**
   * Aggiunge bottone con callback_data raw già preparato.
   * Utile per re-render di payload calcolati a monte (es. da DB).
   */
  rawButton(text: string, callback_data: string): KeyboardBuilder;
  /** Chiude la riga corrente e apre una nuova. */
  row(): KeyboardBuilder;
  /**
   * Produce l'oggetto `InlineKeyboardMarkup` Telegram-shaped.
   * Le righe vuote vengono scartate automaticamente.
   */
  build(): InlineKeyboardMarkup;
  /** Esposto per test / debug. */
  state(): KeyboardBuilderState;
}

const TG_BUTTON_TEXT_MAX = 64; // hard limit Telegram

function safeText(text: string): string {
  // Telegram tronca a 64 char ma per leggibilità accettiamo 64 e tronchiamo.
  // Usa Array.from per non spezzare emoji (lezione #7).
  const chars = Array.from(text);
  if (chars.length <= TG_BUTTON_TEXT_MAX) return text;
  return chars.slice(0, TG_BUTTON_TEXT_MAX).join("");
}

export function buildKeyboard(): KeyboardBuilder {
  const _state: KeyboardBuilderState = {
    rows: [],
    current_row: [],
  };

  const api: KeyboardBuilder = {
    button(text, payload) {
      const encoded = encodeCallbackData(payload);
      if (encoded.truncated) {
        console.warn({
          fn: "buildKeyboard.button",
          warn: "callback_data_truncated",
          namespace: payload.namespace,
          action: payload.action,
          bytes: encoded.bytes,
          hint:
            "Args troppo grossi per il limite 64 byte Telegram. Salva il payload pieno in DB e usa un id corto.",
        });
      }
      _state.current_row.push({
        text: safeText(text),
        callback_data: encoded.data,
      });
      return api;
    },
    urlButton(text, url) {
      _state.current_row.push({ text: safeText(text), url });
      return api;
    },
    webAppButton(text, url) {
      _state.current_row.push({ text: safeText(text), web_app: { url } });
      return api;
    },
    rawButton(text, callback_data) {
      _state.current_row.push({
        text: safeText(text),
        callback_data,
      });
      return api;
    },
    row() {
      if (_state.current_row.length > 0) {
        _state.rows.push(_state.current_row);
        _state.current_row = [];
      }
      return api;
    },
    build() {
      // Chiudi riga corrente se non vuota.
      if (_state.current_row.length > 0) {
        _state.rows.push(_state.current_row);
        _state.current_row = [];
      }
      // Scarta righe vuote (paranoia).
      const inline_keyboard = _state.rows.filter((r) => r.length > 0);
      return { inline_keyboard };
    },
    state() {
      return { ..._state, rows: _state.rows.map((r) => [...r]) };
    },
  };
  return api;
}

/**
 * Shortcut per costruire una keyboard a singola riga di bottoni callback.
 * Utile per yes/no, conferme rapide.
 */
export function singleRowKeyboard(
  buttons: Array<{
    text: string;
    namespace: string;
    action: string;
    args?: Array<string | number>;
  }>,
): InlineKeyboardMarkup {
  const b = buildKeyboard();
  for (const btn of buttons) {
    b.button(btn.text, {
      namespace: btn.namespace,
      action: btn.action,
      args: btn.args,
    });
  }
  return b.build();
}

/**
 * Genera una keyboard "pulita" (vuota) per cancellare i bottoni da un
 * messaggio già inviato. Usare con `editMessageReplyMarkup`.
 */
export function emptyKeyboard(): InlineKeyboardMarkup {
  return { inline_keyboard: [] };
}

/**
 * Costruisce una sola riga "indietro" / "annulla" comune.
 */
export function backCancelRow(opts: {
  back_label?: string;
  back_namespace: string;
  back_action: string;
  back_args?: Array<string | number>;
  cancel_label?: string;
  cancel_namespace?: string;
  cancel_action?: string;
}): KeyboardButton[] {
  const row: KeyboardButton[] = [];
  const back = encodeCallbackData({
    namespace: opts.back_namespace,
    action: opts.back_action,
    args: opts.back_args,
  });
  row.push({
    text: safeText(opts.back_label ?? "← Indietro"),
    callback_data: back.data,
  });
  if (opts.cancel_namespace && opts.cancel_action) {
    const cancel = encodeCallbackData({
      namespace: opts.cancel_namespace,
      action: opts.cancel_action,
    });
    row.push({
      text: safeText(opts.cancel_label ?? "❌ Annulla"),
      callback_data: cancel.data,
    });
  }
  return row;
}
