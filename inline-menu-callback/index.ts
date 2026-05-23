// Brick: telegram-inline-menu-callback v0.1.0 (le-GO C-UI)
// Donor: @go_your_relationship_bot (~/Sviluppo/erp/gomyreference)
//
// Barrel re-export. Importare tutto da qui:
//
//   import {
//     buildKeyboard, singleRowKeyboard, emptyKeyboard, backCancelRow,
//     encodeCallbackData, encodeCallbackSimple, isWithinTelegramCallbackLimit,
//     decodeCallbackData, actionKey, payloadActionKey,
//     handleCallback, createRegistry,
//     answerCallbackQuery,
//     updateMessageWithMenu, updateMessageMenuOnly,
//     pushMenuState, popMenuState, resetMenuState,
//     currentMenuFrame, menuDepth, renderBreadcrumb,
//     serializeMenuState, deserializeMenuState,
//     type CallbackPayload, type CallbackContext, type DispatchResult,
//     type MenuActionRegistry, type MenuActionHandler,
//     type InlineKeyboardMarkup, type KeyboardButton,
//     type NestedMenuState, type MenuStateFrame,
//   } from "../_bricks/telegram-inline-menu-callback/index.ts";
//
// Tutti gli helper sono no-throw (lezione globale GOAi #14).

// ---- Builder
export {
  buildKeyboard,
  singleRowKeyboard,
  emptyKeyboard,
  backCancelRow,
  type KeyboardBuilder,
} from "./helpers/build-keyboard.ts";

// ---- Encode / decode callback_data
export {
  encodeCallbackData,
  encodeCallbackSimple,
  isWithinTelegramCallbackLimit,
  TELEGRAM_CALLBACK_MAX_BYTES,
} from "./helpers/encode-callback-data.ts";

export {
  decodeCallbackData,
  actionKey,
  payloadActionKey,
} from "./helpers/decode-callback-data.ts";

// ---- Dispatcher
export {
  handleCallback,
  createRegistry,
  type DispatchOptions,
} from "./helpers/handle-callback.ts";

// ---- Answer callback (toast/alert)
export {
  answerCallbackQuery,
  type AnswerCallbackResult,
  type AnswerCallbackQueryOptions,
} from "./helpers/answer-callback.ts";

// ---- Update message + menu
export {
  updateMessageWithMenu,
  updateMessageMenuOnly,
  type UpdateMessageResult,
} from "./helpers/update-message-with-menu.ts";

// ---- Nested menu breadcrumb
export {
  emptyMenuState,
  pushMenuState,
  popMenuState,
  resetMenuState,
  currentMenuFrame,
  menuDepth,
  renderBreadcrumb,
  serializeMenuState,
  deserializeMenuState,
  MENU_STATE_MAX_DEPTH,
} from "./helpers/nested-menu-state.ts";

// ---- Types
export type {
  KeyboardButton,
  InlineKeyboardMarkup,
  CallbackPayload,
  EncodedCallback,
  DecodedCallback,
  CallbackContext,
  MenuActionHandler,
  MenuActionRegistry,
  KeyboardBuilderState,
  MenuStateFrame,
  NestedMenuState,
  DispatchResult,
} from "./types.ts";
