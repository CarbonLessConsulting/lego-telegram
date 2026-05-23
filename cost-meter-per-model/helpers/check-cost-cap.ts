// Brick: telegram-cost-meter-per-model v0.1.0 (le-GO G-Ops)
//
// Verifica se l'utente / tenant ha superato il cap configurato.
// Ritorna {allowed, current, cap}. Mai-throw.

import { computeDailyCost } from './compute-daily-cost';
import { computeMonthlyCost } from './compute-monthly-cost';
import type { CostCapResult } from '../types';

interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface CheckCostCapDeps {
  supabase: SupabaseLike;
  table?: string;
}

export interface CheckCostCapInput {
  tenant_id: string;
  owner_user_id?: string;
  /** Cap in EUR. */
  cap_eur: number;
  /** Window valutata. Default 'daily'. */
  window?: 'daily' | 'monthly';
  /** Tasso EUR/USD (default 0.92). Env-override via process.env.EUR_USD. */
  eur_usd_rate?: number;
}

/**
 * USD → EUR conversion. Default rate da env EUR_USD oppure 0.92 fallback.
 * (Cross-runtime: Deno usa Deno.env.get, Node usa process.env.)
 */
function getEurUsdRate(override?: number): number {
  if (typeof override === 'number' && override > 0) return override;
  // Deno
  if (typeof (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno !== 'undefined') {
    const v = (globalThis as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno.env.get('EUR_USD');
    if (v) {
      const n = Number(v);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  // Node
  if (typeof (globalThis as { process?: { env?: Record<string, string | undefined> } }).process !== 'undefined') {
    const v = (globalThis as { process: { env: Record<string, string | undefined> } }).process.env.EUR_USD;
    if (v) {
      const n = Number(v);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  return 0.92;
}

export async function checkCostCap(
  deps: CheckCostCapDeps,
  input: CheckCostCapInput,
): Promise<CostCapResult> {
  const window = input.window ?? 'daily';
  const rate = getEurUsdRate(input.eur_usd_rate);

  let usdSpent = 0;
  if (window === 'daily') {
    const d = await computeDailyCost(deps, {
      tenant_id: input.tenant_id,
      owner_user_id: input.owner_user_id,
    });
    usdSpent = d.total_usd;
  } else {
    const m = await computeMonthlyCost(deps, {
      tenant_id: input.tenant_id,
      owner_user_id: input.owner_user_id,
    });
    usdSpent = m.total_usd;
  }

  const eurSpent = usdSpent * rate;
  const remaining = input.cap_eur - eurSpent;

  return {
    allowed: eurSpent < input.cap_eur,
    current_eur: Number(eurSpent.toFixed(4)),
    current_usd: Number(usdSpent.toFixed(6)),
    cap_eur: input.cap_eur,
    window,
    remaining_eur: Number(remaining.toFixed(4)),
  };
}
