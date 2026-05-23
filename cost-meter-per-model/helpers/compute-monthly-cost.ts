// Brick: telegram-cost-meter-per-model v0.1.0 (le-GO G-Ops)
//
// Computa il costo cumulato del mese corrente (1° giorno mese → ora) per tenant.

interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface MonthlyCostDeps {
  supabase: SupabaseLike;
  table?: string;
}

export interface MonthlyCostInput {
  tenant_id: string;
  owner_user_id?: string;
  /** Mese specifico: YYYY-MM. Default: mese corrente. */
  month?: string;
}

export interface MonthlyCostResult {
  total_usd: number;
  call_count: number;
  month: string;
  error?: string;
}

function firstDayOfMonth(month?: string): { start: string; nextStart: string; label: string } {
  let year: number;
  let monthNum: number;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    year = y;
    monthNum = m;
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    monthNum = now.getUTCMonth() + 1;
  }
  const start = new Date(Date.UTC(year, monthNum - 1, 1)).toISOString();
  const nextStart = new Date(Date.UTC(year, monthNum, 1)).toISOString();
  return { start, nextStart, label: `${year}-${String(monthNum).padStart(2, '0')}` };
}

export async function computeMonthlyCost(
  deps: MonthlyCostDeps,
  input: MonthlyCostInput,
): Promise<MonthlyCostResult> {
  const table = deps.table ?? 'ai_usage_logs';
  const { start, nextStart, label } = firstDayOfMonth(input.month);

  try {
    let qb = deps.supabase.from(table).select('cost_usd').eq('tenant_id', input.tenant_id);
    if (input.owner_user_id) qb = qb.eq('owner_user_id', input.owner_user_id);
    qb = qb.gte('created_at', start).lt('created_at', nextStart);

    const { data, error } = await qb;
    if (error) {
      return { total_usd: 0, call_count: 0, month: label, error: error.message };
    }
    const rows = (data as Array<{ cost_usd: number }>) ?? [];
    const total = rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
    return {
      total_usd: Number(total.toFixed(6)),
      call_count: rows.length,
      month: label,
    };
  } catch (e) {
    return { total_usd: 0, call_count: 0, month: label, error: (e as Error).message };
  }
}
