// Donor: ~/Sviluppo/erp/gosolution/.../gomec-telegram-webhook/_session.ts (TTL pattern)
// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)

import type { FlowEngineConfig, FlowRunRow, SupabaseLike } from '../types';
import { DEFAULT_ENGINE_CONFIG } from '../types';
import { getFlow } from './define-flow';

/**
 * Avvia un nuovo flow run per un (tenant, owner, chat).
 *
 * Convenzione canonical: 1 run attivo per (tenant_id + telegram_chat_id +
 * entity_type). Se ne esiste già uno con status='running', il vecchio viene
 * abbandonato (status='abandoned') prima di crearne uno nuovo — il consumer
 * può cambiare comportamento con `replace_active=false`.
 *
 * Soft no-throw: in caso di errore ritorna `null`.
 */
export async function startFlowRun(opts: {
  sb: SupabaseLike;
  flow_id: string;
  tenant_id: string;
  owner_user_id: string;
  telegram_chat_id: number;
  initial_payload?: Record<string, unknown>;
  config?: Partial<FlowEngineConfig>;
  replace_active?: boolean;
}): Promise<FlowRunRow | null> {
  const config: FlowEngineConfig = { ...DEFAULT_ENGINE_CONFIG, ...opts.config };
  const flow = getFlow(opts.flow_id);
  if (!flow) {
    console.error('[entity-flow-framework] startFlowRun: flow not registered', { id: opts.flow_id });
    return null;
  }

  const initialStepId = flow.initial_step ?? flow.steps[0]?.id;
  if (!initialStepId) {
    console.error('[entity-flow-framework] startFlowRun: no initial step', { id: opts.flow_id });
    return null;
  }

  const ttlMin = flow.ttl_minutes ?? config.default_ttl_minutes;
  const expires_at = new Date(Date.now() + ttlMin * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  try {
    // Replace active: marca come 'abandoned' eventuali run esistenti
    if (opts.replace_active !== false) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = opts.sb.from(config.runs_table)
        .update({ status: 'abandoned', updated_at: now })
        .eq('tenant_id', opts.tenant_id);
      // Loose chain — il consumer reale userà supabase-js tipato
      if (chain?.eq) {
        const c2 = chain.eq('telegram_chat_id', opts.telegram_chat_id);
        if (c2?.eq) await c2.eq('status', 'running');
      }
    }

    const row: Record<string, unknown> = {
      flow_id: flow.id,
      flow_version: flow.version,
      tenant_id: opts.tenant_id,
      owner_user_id: opts.owner_user_id,
      telegram_chat_id: opts.telegram_chat_id,
      entity_type: flow.entity_type,
      current_step_id: initialStepId,
      status: 'running',
      draft: opts.initial_payload ?? {},
      step_history: [{ step_id: initialStepId, entered_at: now }],
      preview_message_id: null,
      result_record_id: null,
      error_message: null,
      expires_at,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await opts.sb
      .from(config.runs_table)
      .insert(row)
      .select('*')
      .single();
    if (error || !data) {
      console.error('[entity-flow-framework] startFlowRun insert error', {
        error: String(error),
      });
      return null;
    }
    // Cast: il select '*' ritorna l'intera row, anche se SupabaseLike è loose
    return data as unknown as FlowRunRow;
  } catch (e) {
    console.error('[entity-flow-framework] startFlowRun exception', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
