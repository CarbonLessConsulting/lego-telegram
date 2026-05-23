// Brick: telegram-webhook-secret-verify v0.1.0 (le-GO F-Integrations)
// Donor: @go_your_relationship_bot (~/Sviluppo/erp/gomyreference)
//
// Barrel re-export pubblico del brick. Consumer typical pattern:
//
//   import {
//     verifySecretToken,
//     parseUpdate,
//     isAllowedUpdate,
//     ALLOWED_UPDATES_CANONICAL,
//     isHealthcheckRequest,
//     healthcheckResponse,
//     type TgUpdate,
//   } from "../_bricks/telegram-webhook-secret-verify/index.ts";

// ---- Helpers
export {
  verifySecretToken,
  constantTimeEqual,
  TG_SECRET_HEADER,
} from "./helpers/verify-secret-token.ts";
export { parseUpdate } from "./helpers/parse-update.ts";
export {
  detectUpdateType,
  isAllowedUpdate,
  buildAllowedUpdatesPayload,
  ALLOWED_UPDATES_CANONICAL,
  ALLOWED_UPDATES_EXTENDED,
  ALLOWED_UPDATES_ALL,
} from "./helpers/allowed-update-types.ts";
export {
  isHealthcheckRequest,
  healthcheckResponse,
} from "./helpers/healthcheck-handler.ts";

// ---- Types (Telegram Bot API canonical)
export type {
  // Root
  TgUpdate,
  TgAllowedUpdateType,
  ParseUpdateResult,
  // User / Chat
  TgUser,
  TgChat,
  TgChatType,
  // Message
  TgMessage,
  TgMessageEntity,
  // Media
  TgPhotoSize,
  TgVoice,
  TgAudio,
  TgVideo,
  TgDocument,
  TgContact,
  TgLocation,
  // Callback / Inline
  TgCallbackQuery,
  TgInlineQuery,
  TgChosenInlineResult,
  // Payments
  TgShippingQuery,
  TgShippingAddress,
  TgPreCheckoutQuery,
  TgOrderInfo,
  // Polls
  TgPoll,
  TgPollOption,
  TgPollAnswer,
  // Chat member updates
  TgChatMember,
  TgChatMemberStatus,
  TgChatMemberUpdated,
} from "./types.ts";
