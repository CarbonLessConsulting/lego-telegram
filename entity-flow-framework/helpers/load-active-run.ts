// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)

import type { FlowEngineConfig, FlowRunRow, SupabaseLike } from "../types.ts";
import { DEFAULT_ENGINE_CONFIG } from "../types.ts";

/**
 * Carica il flow run attivo per (tenant_id, telegram_chat_id, entity_type).
 *
 * Filtra `status='running'` + `expires_at > now`. Se non trovato ritorna null.
 *
 * Soft no-throw.
 */
export async function loadActiveRun(opts: {
  sb: SupabaseLike;
  tenant_id: string;
  telegram_chat_id: number;
  /** Optional: filtra per entity_type. Se omesso, qualsiasi entity. */
  entity_type?: string;
  config?: Partial<FlowEngineConfig>;
}): Promise<FlowRunRow | null> {
  const config: FlowEngineConfig = { ...DEFAULT_ENGINE_CONFIG, ...opts.config };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = opts.sb.from(config.runs_table).select('*')
      .eq('tenant_id', opts.tenant_id);

    const c2 = chain.eq?.('telegram_chat_id', opts.telegram_chat_id);
    const c3 = c2?.eq?.('status', 'running');

    // Optional entity_type filter
    let final = c3;
    if (opts.entity_type && final?.eq) {
      final = final.eq('entity_type', opts.entity_type);
    }

    const { data, error } = await (final?.maybeSingle?.() ?? Promise.resolve({ data: null, error: 'no_chain' }));
    if (error || !data) return null;

    const row = data as FlowRunRow;

    // Check expires
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      // Stale run — il consumer chiamerà abandonRun se necessario
      return null;
    }

    return row;
  } catch (e) {
    console.error('[entity-flow-framework] loadActiveRun exception', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
