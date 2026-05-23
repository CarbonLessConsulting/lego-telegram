// Donor: pattern derivato dal lazy-cache di `src/le-go/brand-white-label/lib/lazy-cache.ts`
//   e dalla cache TTL di `_shared/i18n.ts` (gomyreference) implicita.
// Brick: telegram-white-label-runtime v0.1.0 (le-GO C-UI)

import type { TelegramBrandResolved } from "../types.ts";

interface CacheEntry {
  value: TelegramBrandResolved;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minuti — brand cambia raramente

const cache = new Map<string, CacheEntry>();

function cacheKey(telegramChatId: number, ttlMs: number): string {
  return `${telegramChatId}::${ttlMs}`;
}

/**
 * Get cache entry se ancora valida, altrimenti `null`.
 *
 * Soft no-throw: nessuna eccezione anche se la struttura interna è corrotta.
 */
export function getCachedBrand(
  telegramChatId: number,
  ttlMs: number = DEFAULT_TTL_MS,
): TelegramBrandResolved | null {
  try {
    const entry = cache.get(cacheKey(telegramChatId, ttlMs));
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      cache.delete(cacheKey(telegramChatId, ttlMs));
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

/**
 * Set cache entry con TTL. `ttlMs` deve coincidere con quello di lookup
 * altrimenti la chiave non matcha.
 */
export function setCachedBrand(
  telegramChatId: number,
  value: TelegramBrandResolved,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  try {
    cache.set(cacheKey(telegramChatId, ttlMs), {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  } catch {
    // Silently ignore — in worst case rifacciamo la lookup.
  }
}

/**
 * Invalida cache per un chat specifico (es. dopo update brand admin).
 */
export function invalidateBrandCache(telegramChatId?: number): void {
  if (telegramChatId === undefined) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(`${telegramChatId}::`)) {
      cache.delete(key);
    }
  }
}

/**
 * Stato cache (debug / metrics).
 */
export function brandCacheStats(): { size: number; ttlDefaultMs: number } {
  return { size: cache.size, ttlDefaultMs: DEFAULT_TTL_MS };
}
