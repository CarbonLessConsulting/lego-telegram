// Donor: ~/Sviluppo/erp/gomyreference/src/lib/brand-config.ts
// Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260515180000_goref_fase1.sql (goref_tenants.brand_config)
// Brick: telegram-white-label-runtime v0.1.0 (le-GO C-UI)
//
// Inline ReactBrandConfig (estratto dal brick brand-white-label canonical le-GO)
// per evitare dipendenza cross-brick non pubblicata su JSR.

interface ReactBrandConfig {
  app_name?: string;
  assistant_name?: string;
  primary_color?: string;
  accent_color?: string;
  logo_url?: string;
  favicon_url?: string;
  signup_url?: string;
  support_email?: string;
  locale_default?: string;
  [key: string]: unknown;
}

/**
 * Locale supportate per bot Telegram le-GO.
 * Sotto-set ISO-639-1 — allineato a donor `_shared/i18n.ts` (BotLang).
 */
export type BotLang = 'it' | 'en' | 'es' | 'de' | 'fr';

/**
 * BrandConfig esteso per runtime Telegram.
 *
 * Estende il `BrandConfig` React del brick `brand-white-label` con campi
 * specifici per la presenza del bot Telegram: welcome message, signature,
 * lingua di default, nome assistente, link CTA verso la PWA compagna.
 *
 * Persistito come JSONB su `<tenant_table>.brand_config` (vedi migration
 * template). Tipicamente popolato a mano dal Marco CC al deploy di un nuovo
 * white-label, oppure via UI admin in futuro.
 */
export interface TelegramBrandConfig extends Partial<ReactBrandConfig> {
  /**
   * Nome del bot Telegram visibile (es. "Crea", "Luna", "SARA").
   * Sostituisce `{{brand_name}}` in template.
   */
  brand_name?: string;

  /**
   * Locale di default per chat senza preferenza esplicita su `users.language`.
   * Fallback all'inferenza Telegram `from.language_code`, poi `'it'`.
   */
  locale_default?: BotLang;

  /**
   * Template del messaggio welcome `/start`.
   * Placeholder supportati: `{{brand_name}}`, `{{user_name}}`, `{{assistant_name}}`, `{{cta_url}}`.
   * Se vuoto: usa il default del brick.
   */
  welcome_template?: string;

  /**
   * Signature opzionale aggiunta in fondo ai messaggi assistant.
   * Esempi: `"\n\n— Crea, by GoYourRelationships"`, `"\n— Sofia · GOMec"`.
   */
  signature?: string;

  /**
   * URL della PWA compagna o landing brandizzata (mostrata nei messaggi
   * onboarding via inline-button "Apri {{brand_name}}").
   */
  cta_url?: string;

  /**
   * Path o URL del logo per signature (usato dalla UI compagna React via
   * `BrandedLogo` del brick `brand-white-label`). Non inviato al bot.
   */
  logo_path?: string;

  /**
   * Footer text aggiuntivo per messaggi formali (es. notifiche email-like
   * inviate via Telegram). Esempio: `"GoYourRelationships · IP GOAi&digital Agency"`.
   */
  bot_footer_text?: string;
}

/**
 * Risultato del loader brand: brand config + telegram bot ID che è stato
 * usato per risolverlo (utile per debug e audit log).
 */
export interface TelegramBrandResolved {
  tenant_id: string;
  bot_username: string | null;
  brand: TelegramBrandConfig;
  /** Indica se la lookup ha restituito brand custom o ha usato il default. */
  is_default: boolean;
}

/**
 * Risultato lookup grezzo dal DB — payload tale e quale prima di merge con
 * default. Restituito da `BrandLoader`.
 */
export interface TelegramBrandLoadResult {
  tenant_id: string;
  bot_username?: string | null;
  brand_config: TelegramBrandConfig | null;
}

/**
 * Loader iniettato dal consumer. Riceve un identificatore di sessione
 * Telegram (chat_id) e ritorna il brand del tenant che possiede quella chat.
 *
 * Tipica implementazione: lookup `users.tenant_id` da `telegram_chat_id`,
 * poi `tenants.brand_config` JOIN.
 */
export type TelegramBrandLoader = (
  telegramChatId: number,
) => Promise<TelegramBrandLoadResult | null>;

/**
 * Variabili interpolabili dentro `welcome_template` / `signature`.
 */
export interface BrandTemplateVars {
  brand_name?: string;
  user_name?: string;
  assistant_name?: string;
  cta_url?: string;
  /** Espandibile dal consumer per template custom. */
  [key: string]: string | number | undefined;
}

/**
 * Default brand neutro GOCOTECH (fallback hardcoded).
 * NON è il default `brand-white-label` React — è il default minimo per Telegram
 * (no React deps).
 */
export const TELEGRAM_NEUTRAL_BRAND: TelegramBrandConfig = {
  brand_name: 'GOCOTECH',
  app_name: 'GOCOTECH',
  assistant_name: 'Sofia',
  locale_default: 'it',
  primary_color: '192 71% 21%',
  accent_color: '19 84% 49%',
  bot_footer_text: 'Powered by GOAi&digital Agency',
};
