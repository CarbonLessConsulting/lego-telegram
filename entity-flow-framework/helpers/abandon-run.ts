// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)

import type { FlowEngineConfig, SupabaseLike } from "../types.ts";
import { DEFAULT_ENGINE_CONFIG } from "../types.ts";

/**
 * Marca un singolo run come `abandoned` (user cancel o admin manual).
 *
 * Soft no-throw.
 */
export async function abandonRun(opts: {
  sb: SupabaseLike;
  run_id: string;
  reason?: string;
  config?: Partial<FlowEngineConfig>;
}): Promise<boolean> {
  const config: FlowEngineConfig = { ...DEFAULT_ENGINE_CONFIG, ...opts.config };
  try {
    const now = new Date().toISOString();
    const { error } = await opts.sb.from(config.runs_table).update({
      status: 'abandoned',
      error_message: opts.reason ?? null,
      updated_at: now,
    }).eq('id', opts.run_id);
    if (error) {
      console.error('[entity-flow-framework] abandonRun error', { error: String(error) });
      return false;
    }
    return true;
  } catch (e) {
    console.error('[entity-flow-framework] abandonRun exception', {
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

/**
 * Cron-style GC: marca tutti i run con `expires_at < now` AND `status='running'`
 * come `abandoned`. Da eseguire via Supabase cron (raccomandato: ogni 5 minuti).
 *
 * Ritorna count abbandonati (best-effort).
 */
export async function abandonExpiredRuns(opts: {
  sb: SupabaseLike;
  config?: Partial<FlowEngineConfig>;
}): Promise<number> {
  const config: FlowEngineConfig = { ...DEFAULT_ENGINE_CONFIG, ...opts.config };
  try {
    const now = new Date().toISOString();
    // Loose chain: select expired running runs, then update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = opts.sb.from(config.runs_table).select('id')
      .eq('status', 'running');
    // NB: il filter `expires_at < now` non è esprimibile in SupabaseLike loose;
    // il consumer reale userà `.lt('expires_at', now)`. Per portabilità del
    // brick, ritorniamo 0 se il client non supporta la chain custom.
    const lt = chain?.lt?.('expires_at', now);
    if (!lt) {
      console.warn('[entity-flow-framework] abandonExpiredRuns: client no .lt() — skipping');
      return 0;
    }
    const { data } = await lt;
    const ids = Array.isArray(data) ? (data as Array<{ id: string }>).map((r) => r.id) : [];
    if (ids.length === 0) return 0;

    // Update one-by-one (loose chain non supporta `.in()` qui)
    let cnt = 0;
    for (const id of ids) {
      const ok = await abandonRun({ sb: opts.sb, run_id: id, reason: 'TTL expired', config });
      if (ok) cnt++;
    }
    return cnt;
  } catch (e) {
    console.error('[entity-flow-framework] abandonExpiredRuns exception', {
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}
