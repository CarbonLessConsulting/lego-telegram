// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/tenant.ts (getTenantContext pattern)
// Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260515180000_goref_fase1.sql (goref_tenants.brand_config)
// Brick: telegram-white-label-runtime v0.1.0 (le-GO C-UI)

import type {
  TelegramBrandConfig,
  TelegramBrandLoader,
  TelegramBrandLoadResult,
  TelegramBrandResolved,
} from '../types';
import { TELEGRAM_NEUTRAL_BRAND } from '../types';
import { getCachedBrand, setCachedBrand } from './lazy-cache';

/**
 * Merge canonical: campi `incoming` non-null sovrascrivono `base`,
 * altrimenti `base` (default). Niente union arrays — i campi sono scalari.
 */
function mergeBrand(
  base: TelegramBrandConfig,
  incoming: TelegramBrandConfig | null | undefined,
): TelegramBrandConfig {
  if (!incoming) return base;
  const result: TelegramBrandConfig = { ...base };
  for (const key of Object.keys(incoming) as Array<keyof TelegramBrandConfig>) {
    const v = incoming[key];
    if (v !== null && v !== undefined && v !== '') {
      (result as Record<string, unknown>)[key as string] = v;
    }
  }
  return result;
}

/**
 * Carica brand del tenant che possiede la chat Telegram.
 *
 * Loader iniettato dal consumer (typicamente fa `SELECT brand_config FROM
 * <tenant_table> JOIN <users> ON telegram_chat_id = ?`).
 *
 * Soft no-throw: in caso di errore loader, ritorna brand neutro GOCOTECH.
 *
 * Cache: 5 minuti TTL via `lazy-cache`. Se loader ritorna `null` (chat non
 * mappata) la cache memorizza comunque il risultato neutro per evitare
 * thundering herd su chat sconosciute / spam.
 */
export async function loadBrandConfig(
  telegramChatId: number,
  loader: TelegramBrandLoader,
  opts: { ttlMs?: number; defaultBrand?: TelegramBrandConfig } = {},
): Promise<TelegramBrandResolved> {
  const cached = getCachedBrand(telegramChatId, opts.ttlMs);
  if (cached) return cached;

  const defaults = opts.defaultBrand ?? TELEGRAM_NEUTRAL_BRAND;

  let raw: TelegramBrandLoadResult | null = null;
  try {
    raw = await loader(telegramChatId);
  } catch (e) {
    console.error('[telegram-white-label-runtime] loader threw', {
      chat_id: telegramChatId,
      error: e instanceof Error ? e.message : String(e),
    });
    raw = null;
  }

  const resolved: TelegramBrandResolved = raw
    ? {
        tenant_id: raw.tenant_id,
        bot_username: raw.bot_username ?? null,
        brand: mergeBrand(defaults, raw.brand_config),
        is_default: !raw.brand_config || Object.keys(raw.brand_config).length === 0,
      }
    : {
        tenant_id: '',
        bot_username: null,
        brand: defaults,
        is_default: true,
      };

  setCachedBrand(telegramChatId, resolved, opts.ttlMs);
  return resolved;
}

export { mergeBrand };
