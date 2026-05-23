// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/draft.ts (getActiveDraft)
// Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
//
// Carica il draft attivo per (chat_id) — uno solo grazie al UNIQUE INDEX parziale.

import { ACTIVE_STATES, type DraftRow } from '../types';

interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface LoadDraftDeps {
  supabase: SupabaseLike;
  /** Nome tabella drafts (default `bot_capture_drafts`). */
  table?: string;
}

/**
 * Ritorna il draft attivo per chat o null. Mai-throw.
 * Filtra anche su `expires_at > now()` per ignorare drafts TTL scaduti.
 */
export async function loadActiveDraft(
  deps: LoadDraftDeps,
  telegram_chat_id: number,
): Promise<DraftRow | null> {
  const table = deps.table ?? 'bot_capture_drafts';
  try {
    const { data, error } = await deps.supabase
      .from(table)
      .select('*')
      .eq('telegram_chat_id', telegram_chat_id)
      .in('state', ACTIVE_STATES)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.warn('[state-machine-capture] loadActiveDraft error', error);
      return null;
    }
    return (data as DraftRow | null) ?? null;
  } catch (e) {
    console.warn('[state-machine-capture] loadActiveDraft exception', e);
    return null;
  }
}

/**
 * Ritorna il draft attivo PER tenant + owner + chat. Utile in multi-bot
 * dove uno user puo' avere drafts su bot diversi.
 */
export async function loadActiveDraftScoped(
  deps: LoadDraftDeps,
  scope: { tenant_id: string; owner_user_id: string; telegram_chat_id: number },
): Promise<DraftRow | null> {
  const table = deps.table ?? 'bot_capture_drafts';
  try {
    const { data, error } = await deps.supabase
      .from(table)
      .select('*')
      .eq('tenant_id', scope.tenant_id)
      .eq('owner_user_id', scope.owner_user_id)
      .eq('telegram_chat_id', scope.telegram_chat_id)
      .in('state', ACTIVE_STATES)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error) {
      console.warn('[state-machine-capture] loadActiveDraftScoped error', error);
      return null;
    }
    return (data as DraftRow | null) ?? null;
  } catch (e) {
    console.warn('[state-machine-capture] loadActiveDraftScoped exception', e);
    return null;
  }
}
