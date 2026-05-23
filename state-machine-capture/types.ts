// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/draft.ts
// Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
//
// Tipi pubblici del brick state machine capture.

export type DraftState =
  | 'pending'        // preview mostrata, aspetto click button
  | 'awaiting_note'  // user ha cliccato "Aggiungi note", prossimo input mergia
  | 'awaiting_edit'  // user ha cliccato "Modifica", prossimo testo applica correzione
  | 'saved'          // salvataggio completato (record verra' cancellato a breve)
  | 'abandoned';     // TTL scaduto o user ha cliccato "Annulla"

export const ACTIVE_STATES: DraftState[] = ['pending', 'awaiting_note', 'awaiting_edit'];

/** Source che ha contribuito al draft (voice/photo/text/vcard/...). Append-only. */
export interface DraftSourceEntry {
  source: string;
  at: string;
  meta?: Record<string, unknown>;
}

/** Una transizione di stato registrata (per audit). */
export interface StateTransition {
  from: DraftState;
  to: DraftState;
  at: string;
  reason?: string;
}

/** Riga DB del draft (schema canonical, vedi migration-template.sql). */
export interface DraftRow {
  id: string;
  tenant_id: string;
  owner_user_id: string;
  telegram_chat_id: number;

  /** Payload estratto cumulato (form i18n / contact / record qualsiasi). */
  payload: Record<string, unknown>;

  state: DraftState;
  sources: DraftSourceEntry[];

  /** ID del messaggio Telegram con la preview (per editMessage al save). */
  preview_message_id: number | null;

  expires_at: string;
  created_at: string;
  updated_at: string;
}

/** Input per startDraft / saveDraft (upsert atomico). */
export interface StartDraftInput {
  tenant_id: string;
  owner_user_id: string;
  telegram_chat_id: number;
  payload: Record<string, unknown>;
  source: string;
  source_meta?: Record<string, unknown>;
  /** Se true, sostituisce il draft attivo invece di mergiarlo. Default false. */
  force_replace?: boolean;
  /** TTL in secondi. Default 86400 (24h). */
  ttl_seconds?: number;
}

/** Risultato append/merge al draft attivo. */
export interface AppendDraftResult {
  draft: DraftRow;
  was_merged: boolean;
}

/** Output abandon-draft helper. */
export interface AbandonResult {
  abandoned_count: number;
  /** Tenant scopes con drafts abbandonati. */
  tenants_touched: string[];
}
