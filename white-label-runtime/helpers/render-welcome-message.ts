// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/i18n.ts
//   (chiavi `bot.onboarding.greeting_named` + `greeting_anon`)
// Brick: telegram-white-label-runtime v0.1.0 (le-GO C-UI)

import type { BotLang, TelegramBrandConfig } from '../types';
import { applyBrandTemplate, buildBrandVars } from './apply-brand-template';

/**
 * Default welcome message multi-lingua (HTML-safe per Telegram `parse_mode='HTML'`).
 *
 * Estratto dalle chiavi `bot.onboarding.greeting_*` di gomyreference,
 * generalizzato con `{{brand_name}}`.
 */
const DEFAULT_WELCOME: Record<BotLang, { named: string; anon: string }> = {
  it: {
    named:
      '<b>Ciao {{user_name}}! Benvenuto in {{brand_name}} 👋</b>',
    anon:
      '<b>Benvenuto in {{brand_name}} 👋</b>',
  },
  en: {
    named: '<b>Hi {{user_name}}! Welcome to {{brand_name}} 👋</b>',
    anon: '<b>Welcome to {{brand_name}} 👋</b>',
  },
  es: {
    named: '<b>¡Hola {{user_name}}! Bienvenido a {{brand_name}} 👋</b>',
    anon: '<b>Bienvenido a {{brand_name}} 👋</b>',
  },
  de: {
    named: '<b>Hallo {{user_name}}! Willkommen bei {{brand_name}} 👋</b>',
    anon: '<b>Willkommen bei {{brand_name}} 👋</b>',
  },
  fr: {
    named: '<b>Bonjour {{user_name}} ! Bienvenue sur {{brand_name}} 👋</b>',
    anon: '<b>Bienvenue sur {{brand_name}} 👋</b>',
  },
};

/**
 * Render welcome message per `/start`.
 *
 * Se il brand ha `welcome_template` lo usa (HTML inline ammesso).
 * Altrimenti il default lingua-aware (`it/en/es/de/fr`).
 *
 * `user_name`: nome utente Telegram (`message.from.first_name`), null se anonimo.
 */
export function renderWelcomeMessage(
  brand: TelegramBrandConfig,
  opts: { lang?: BotLang; user_name?: string | null } = {},
): string {
  const lang = (opts.lang ?? brand.locale_default ?? 'it') as BotLang;
  const userName = opts.user_name?.trim() || null;

  const template =
    brand.welcome_template ??
    (userName ? DEFAULT_WELCOME[lang].named : DEFAULT_WELCOME[lang].anon);

  return applyBrandTemplate(template, buildBrandVars(brand, {
    user_name: userName ?? '',
  }));
}
