// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/usage-meter.ts (logUsage + meteredCall)
// Brick: telegram-cost-meter-per-model v0.1.0 (le-GO G-Ops)
//
// Helper canonical: insert ai_usage_logs (soft, no-throw). Fire-and-forget.

import { getPricing, WHISPER_USD_PER_AUDIO_SECOND } from '../pricing/model-prices';
import type { AiUsageEntry, CostComputation } from '../types';

interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface LogUsageDeps {
  supabase: SupabaseLike;
  /** Nome tabella ai_usage_logs (default `ai_usage_logs`). */
  table?: string;
}

/**
 * Calcola cost USD per una singola chiamata.
 * - Whisper / audio_seconds > 0 → audio cost separato (usd_per_audio_second).
 * - LLM → input + output per 1M token.
 * - Modello sconosciuto → cost=0 (no fallback, donor pattern).
 */
export function computeUsageCost(entry: AiUsageEntry): CostComputation {
  if (entry.audio_seconds && entry.audio_seconds > 0) {
    const audioCost = entry.audio_seconds * WHISPER_USD_PER_AUDIO_SECOND;
    return {
      cost_usd: Number(audioCost.toFixed(6)),
      model: entry.model,
      provider: entry.provider,
      breakdown: { input_cost: 0, output_cost: 0, audio_cost: audioCost },
    };
  }
  const p = getPricing(entry.model);
  if (!p) {
    return {
      cost_usd: 0,
      model: entry.model,
      provider: entry.provider,
      breakdown: { input_cost: 0, output_cost: 0, audio_cost: 0 },
    };
  }
  const inputCost = ((entry.input_tokens ?? 0) / 1_000_000) * p.input_per_mtok;
  const outputCost = ((entry.output_tokens ?? 0) / 1_000_000) * p.output_per_mtok;
  const total = inputCost + outputCost;
  return {
    cost_usd: Number(total.toFixed(6)),
    model: p.model,
    provider: p.provider,
    breakdown: { input_cost: inputCost, output_cost: outputCost, audio_cost: 0 },
  };
}

/**
 * Registra una chiamata LLM nel ledger. Non blocca: errore di logging
 * NON deve mai abortire la pipeline business.
 *
 * Pattern fire-and-forget: usa `void logUsage(...)` lato edge function.
 */
export async function logUsage(deps: LogUsageDeps, entry: AiUsageEntry): Promise<void> {
  const table = deps.table ?? 'ai_usage_logs';
  try {
    const cost = computeUsageCost(entry);
    const { error } = await deps.supabase.from(table).insert({
      tenant_id: entry.tenant_id,
      owner_user_id: entry.owner_user_id ?? null,
      edge_function: entry.edge_function,
      provider: entry.provider,
      model: entry.model,
      operation: entry.operation ?? null,
      input_tokens: entry.input_tokens ?? 0,
      output_tokens: entry.output_tokens ?? 0,
      audio_seconds: entry.audio_seconds ?? 0,
      images_count: entry.images_count ?? 0,
      cost_usd: cost.cost_usd,
      duration_ms: entry.duration_ms ?? null,
      success: entry.success !== false,
      error_message: entry.error_message ?? null,
      metadata: entry.metadata ?? {},
    });
    if (error) {
      console.warn({ fn: 'cost-meter-per-model', warning: 'insert_failed', err: error.message });
    }
  } catch (e) {
    console.warn({ fn: 'cost-meter-per-model', warning: 'exception', err: String(e) });
  }
}

/**
 * Helper wrapper: esegue una funzione LLM + logga automaticamente
 * duration_ms + success/error. Donor: meteredCall.
 */
export async function meteredCall<T>(
  deps: LogUsageDeps,
  entry: Omit<AiUsageEntry, 'duration_ms' | 'success' | 'error_message'>,
  fn: () => Promise<{ result: T; input_tokens?: number; output_tokens?: number; audio_seconds?: number }>,
): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await fn();
    void logUsage(deps, {
      ...entry,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      audio_seconds: r.audio_seconds,
      duration_ms: Date.now() - t0,
      success: true,
    });
    return r.result;
  } catch (err) {
    void logUsage(deps, {
      ...entry,
      duration_ms: Date.now() - t0,
      success: false,
      error_message: String(err).slice(0, 500),
    });
    throw err;
  }
}
