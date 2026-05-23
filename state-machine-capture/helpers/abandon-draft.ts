// Donor: pattern ispirato a goref TTL cleanup
// Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
//
// Helper: marca come 'abandoned' o cancella drafts con expires_at scaduto.
// Idempotente. Chiamabile da cron / scheduled fn.

import type { AbandonResult } from "../types.ts";

interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface AbandonDeps {
  supabase: SupabaseLike;
  table?: string;
}

/**
 * Marca come 'abandoned' tutti i drafts con TTL scaduto (default).
 * Se `hard_delete=true`, li cancella fisicamente invece (preferito per GDPR
 * minimization se i drafts contengono dati personali).
 *
 * Mai-throw. Ritorna count + tenant scopes touched.
 */
export async function abandonExpiredDrafts(
  deps: AbandonDeps,
  opts: { hard_delete?: boolean; batch_limit?: number } = {},
): Promise<AbandonResult> {
  const table = deps.table ?? 'bot_capture_drafts';
  const limit = opts.batch_limit ?? 1000;

  try {
    const nowIso = new Date().toISOString();
    const { data: expired, error: selErr } = await deps.supabase
      .from(table)
      .select('id, tenant_id')
      .lt('expires_at', nowIso)
      .in('state', ['pending', 'awaiting_note', 'awaiting_edit'])
      .limit(limit);

    if (selErr) {
      console.warn('[state-machine-capture] abandonExpiredDrafts select error', selErr);
      return { abandoned_count: 0, tenants_touched: [] };
    }

    const rows = (expired ?? []) as Array<{ id: string; tenant_id: string }>;
    if (rows.length === 0) {
      return { abandoned_count: 0, tenants_touched: [] };
    }
    const ids = rows.map((r) => r.id);
    const tenantSet = new Set(rows.map((r) => r.tenant_id));

    if (opts.hard_delete) {
      const { error: delErr } = await deps.supabase.from(table).delete().in('id', ids);
      if (delErr) {
        console.warn('[state-machine-capture] abandonExpiredDrafts delete error', delErr);
        return { abandoned_count: 0, tenants_touched: [] };
      }
    } else {
      const { error: updErr } = await deps.supabase
        .from(table)
        .update({ state: 'abandoned', updated_at: nowIso })
        .in('id', ids);
      if (updErr) {
        console.warn('[state-machine-capture] abandonExpiredDrafts update error', updErr);
        return { abandoned_count: 0, tenants_touched: [] };
      }
    }

    return {
      abandoned_count: rows.length,
      tenants_touched: Array.from(tenantSet),
    };
  } catch (e) {
    console.warn('[state-machine-capture] abandonExpiredDrafts exception', e);
    return { abandoned_count: 0, tenants_touched: [] };
  }
}

/**
 * Marca come 'abandoned' un singolo draft (es. user ha cliccato "Annulla").
 */
export async function abandonDraft(
  deps: AbandonDeps,
  draft_id: string,
): Promise<{ success: boolean; error?: string }> {
  const table = deps.table ?? 'bot_capture_drafts';
  try {
    const { error } = await deps.supabase
      .from(table)
      .update({ state: 'abandoned', updated_at: new Date().toISOString() })
      .eq('id', draft_id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
