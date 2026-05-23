// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (retry loop righe 70-94)
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/retry.ts (pattern exp backoff + jitter)
// Brick: telegram-push-soft v0.1.0 (le-GO F-Integrations)
//
// Retry policy canonical per Telegram Bot API.
// Strategy: exponential backoff con jitter random, max attempts configurabile,
// retry solo su transient (429 rate-limit, 500/502/503/504 gateway).
//
// Tutti i 4xx non-429 sono "client error" definitivi: NO retry, fail-fast soft.

export interface TransientCheck {
  http_status?: number;
  tg_error_code?: number;
}

/**
 * Determina se uno status HTTP / Telegram error_code va retentato.
 * Transient = 429 (rate limit) oppure 5xx (gateway / upstream issue).
 * Tutto il resto = no retry (4xx client error → "bot bloccato", "chat not found", ...).
 */
export function isTransient({ http_status, tg_error_code }: TransientCheck): boolean {
  const code = tg_error_code ?? http_status ?? 0;
  if (code === 429) return true;
  if (code >= 500 && code <= 599) return true;
  return false;
}

/**
 * Backoff esponenziale: 400ms * 2^attempt + jitter casuale 0-200ms.
 * attempt=0 → 400-600ms
 * attempt=1 → 800-1000ms
 * attempt=2 → 1600-1800ms
 */
export function backoffMs(attempt: number, baseMs = 400): number {
  return baseMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
}

export interface RetryOpts {
  /** Tentativi totali (incluso il primo). Default 3. */
  max_attempts?: number;
  /** Base millisecondi per il backoff. Default 400. */
  base_ms?: number;
}

/**
 * Sleep helper isolato (testabile separatamente).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
