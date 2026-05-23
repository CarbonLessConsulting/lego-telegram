// Brick: telegram-cost-meter-per-model v0.1.0 (le-GO G-Ops)
//
// Group by model + sum cost (per dashboard analytics).

import type { BreakdownRow } from '../types';

interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface BreakdownDeps {
  supabase: SupabaseLike;
  table?: string;
}

export interface BreakdownInput {
  tenant_id: string;
  owner_user_id?: string;
  /** Lookback hours. Default 720 (30 giorni). */
  hours?: number;
}

interface RawRow {
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  audio_seconds: number;
  cost_usd: number;
  duration_ms: number | null;
  success: boolean;
}

/**
 * Aggrega rows per (model, provider). Mai-throw.
 * Per query large-scale conviene usare la view `{{TABLE_NAME}}_summary` lato DB.
 */
export async function breakdownByModel(
  deps: BreakdownDeps,
  input: BreakdownInput,
): Promise<BreakdownRow[]> {
  const table = deps.table ?? 'ai_usage_logs';
  const hours = input.hours ?? 720;
  const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  try {
    let qb = deps.supabase
      .from(table)
      .select('model, provider, input_tokens, output_tokens, audio_seconds, cost_usd, duration_ms, success')
      .eq('tenant_id', input.tenant_id)
      .gte('created_at', sinceIso);
    if (input.owner_user_id) qb = qb.eq('owner_user_id', input.owner_user_id);

    const { data, error } = await qb;
    if (error) {
      console.warn('[cost-meter-per-model] breakdownByModel error', error);
      return [];
    }

    const rows = (data as RawRow[]) ?? [];
    const grouped = new Map<string, BreakdownRow & { _duration_sum: number; _duration_count: number }>();

    for (const r of rows) {
      const key = `${r.model}::${r.provider}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          model: r.model,
          provider: r.provider,
          calls: 0,
          total_input_tokens: 0,
          total_output_tokens: 0,
          total_audio_seconds: 0,
          total_cost_usd: 0,
          avg_duration_ms: 0,
          error_count: 0,
          _duration_sum: 0,
          _duration_count: 0,
        });
      }
      const g = grouped.get(key)!;
      g.calls += 1;
      g.total_input_tokens += Number(r.input_tokens ?? 0);
      g.total_output_tokens += Number(r.output_tokens ?? 0);
      g.total_audio_seconds += Number(r.audio_seconds ?? 0);
      g.total_cost_usd += Number(r.cost_usd ?? 0);
      if (r.duration_ms !== null && r.duration_ms !== undefined) {
        g._duration_sum += Number(r.duration_ms);
        g._duration_count += 1;
      }
      if (!r.success) g.error_count += 1;
    }

    const result: BreakdownRow[] = Array.from(grouped.values()).map((g) => ({
      model: g.model,
      provider: g.provider,
      calls: g.calls,
      total_input_tokens: g.total_input_tokens,
      total_output_tokens: g.total_output_tokens,
      total_audio_seconds: g.total_audio_seconds,
      total_cost_usd: Number(g.total_cost_usd.toFixed(6)),
      avg_duration_ms: g._duration_count > 0 ? Math.round(g._duration_sum / g._duration_count) : 0,
      error_count: g.error_count,
    }));

    return result.sort((a, b) => b.total_cost_usd - a.total_cost_usd);
  } catch (e) {
    console.warn('[cost-meter-per-model] breakdownByModel exception', e);
    return [];
  }
}
