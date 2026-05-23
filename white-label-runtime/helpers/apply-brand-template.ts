// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/i18n.ts (interpolate pattern)
// Brick: telegram-white-label-runtime v0.1.0 (le-GO C-UI)

import type { BrandTemplateVars, TelegramBrandConfig } from "../types.ts";

/**
 * Interpolazione canonical: sostituisce `{{var}}` nel template con `vars[var]`.
 *
 * Allineato a `_shared/i18n.ts` di gomyreference:
 *   - Solo `{{var}}` (no espressioni complesse, no logica condizionale)
 *   - Var mancante = placeholder lasciato intatto (visibile, debug-friendly)
 *   - Niente HTML escape: l'output può contenere tag inline `<b>` `<i>` `<a>`
 *     come da pipeline `sendMessage(parse_mode='HTML')` Telegram.
 *
 * Soft no-throw: input invalido ritorna stringa vuota.
 */
export function applyBrandTemplate(
  template: string | undefined,
  vars?: BrandTemplateVars,
): string {
  if (!template || typeof template !== 'string') return '';
  if (!vars) return template;

  try {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      const v = vars[key];
      return v === undefined || v === null ? match : String(v);
    });
  } catch {
    return template;
  }
}

/**
 * Costruisce le variabili canonical dal brand resolved.
 * Espandibile dal caller con override puntuali.
 */
export function buildBrandVars(
  brand: TelegramBrandConfig,
  override?: BrandTemplateVars,
): BrandTemplateVars {
  return {
    brand_name: brand.brand_name ?? brand.app_name ?? 'GOCOTECH',
    assistant_name: brand.assistant_name ?? 'Sofia',
    cta_url: brand.cta_url,
    ...override,
  };
}
