// Brick: telegram-cost-meter-per-model v0.1.0 (le-GO G-Ops)
//
// Computa il costo cumulato nelle ultime 24h per (tenant, user opzionale).

interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface DailyCostDeps {
  supabase: SupabaseLike;
  table?: string;
}

export interface DailyCostInput {
  tenant_id: string;
  /** Opzionale: filtra per singolo utente. */
  owner_user_id?: string;
  /** Lookback hours. Default 24. */
  hours?: number;
}

export interface DailyCostResult {
  total_usd: number;
  call_count: number;
  /** Errore opzionale (mai-throw). */
  error?: string;
}

/**
 * Somma cost nelle ultime N ore. Mai-throw.
 */
export async function computeDailyCost(
  deps: DailyCostDeps,
  input: DailyCostInput,
): Promise<DailyCostResult> {
  const table = deps.table ?? 'ai_usage_logs';
  const hours = input.hours ?? 24;
  const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  try {
    let qb = deps.supabase.from(table).select('cost_usd').eq('tenant_id', input.tenant_id);
    if (input.owner_user_id) qb = qb.eq('owner_user_id', input.owner_user_id);
    qb = qb.gte('created_at', sinceIso);

    const { data, error } = await qb;
    if (error) {
      return { total_usd: 0, call_count: 0, error: error.message };
    }
    const rows = (data as Array<{ cost_usd: number }>) ?? [];
    const total = rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
    return { total_usd: Number(total.toFixed(6)), call_count: rows.length };
  } catch (e) {
    return { total_usd: 0, call_count: 0, error: (e as Error).message };
  }
}
