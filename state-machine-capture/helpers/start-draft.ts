// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/draft.ts (saveDraft)
// Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
//
// Crea o sostituisce il draft attivo per chat ATOMICAMENTE via RPC.

import type { AppendDraftResult, DraftRow, StartDraftInput } from "../types.ts";

interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc(fn: string, args: Record<string, unknown>): any;
}

export interface StartDraftDeps {
  supabase: SupabaseLike;
  /** Nome RPC canonical (default `bot_upsert_capture_draft`). */
  rpc_name?: string;
}

/**
 * Crea un nuovo draft o sostituisce/merga quello attivo per la chat.
 * Mai-throw: errori del DB ritornano `null` + log warning.
 */
export async function startDraft(
  deps: StartDraftDeps,
  input: StartDraftInput,
): Promise<AppendDraftResult | null> {
  const rpcName = deps.rpc_name ?? 'bot_upsert_capture_draft';
  const sourceEntry = {
    source: input.source,
    at: new Date().toISOString(),
    meta: input.source_meta ?? {},
  };

  try {
    const { data, error } = await deps.supabase.rpc(rpcName, {
      p_tenant_id: input.tenant_id,
      p_owner_user_id: input.owner_user_id,
      p_telegram_chat_id: input.telegram_chat_id,
      p_payload: input.payload,
      p_source_entry: sourceEntry,
      p_force_replace: input.force_replace ?? false,
      p_ttl_seconds: input.ttl_seconds ?? 86400,
    });

    if (error) {
      console.warn('[state-machine-capture] startDraft RPC error', error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      console.warn('[state-machine-capture] startDraft empty RPC response');
      return null;
    }

    const draft: DraftRow = {
      id: row.id as string,
      tenant_id: input.tenant_id,
      owner_user_id: input.owner_user_id,
      telegram_chat_id: input.telegram_chat_id,
      payload: row.payload as Record<string, unknown>,
      state: row.state,
      sources: row.sources ?? [],
      preview_message_id: (row.preview_message_id as number | null) ?? null,
      expires_at: row.expires_at as string,
      created_at: row.created_at ?? new Date().toISOString(),
      updated_at: row.updated_at ?? new Date().toISOString(),
    };

    return { draft, was_merged: Boolean(row.was_merged) };
  } catch (e) {
    console.warn('[state-machine-capture] startDraft exception', e);
    return null;
  }
}
