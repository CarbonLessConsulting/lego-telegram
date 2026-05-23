// Brick: telegram-white-label-runtime v0.1.0 (le-GO C-UI) · entry pubblico

export {
  TELEGRAM_NEUTRAL_BRAND,
  type BotLang,
  type BrandTemplateVars,
  type TelegramBrandConfig,
  type TelegramBrandLoader,
  type TelegramBrandLoadResult,
  type TelegramBrandResolved,
} from "./types.ts";

export {
  loadBrandConfig,
  mergeBrand,
} from "./helpers/load-brand-config.ts";

export {
  applyBrandTemplate,
  buildBrandVars,
} from "./helpers/apply-brand-template.ts";

export {
  renderWelcomeMessage,
} from "./helpers/render-welcome-message.ts";

export {
  renderSignature,
  appendSignature,
} from "./helpers/render-signature.ts";

export {
  generateCssVars,
  toHslVar,
} from "./helpers/css-vars-generator.ts";

export {
  getCachedBrand,
  setCachedBrand,
  invalidateBrandCache,
  brandCacheStats,
} from "./helpers/lazy-cache.ts";
