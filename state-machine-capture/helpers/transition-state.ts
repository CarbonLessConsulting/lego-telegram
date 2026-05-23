// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/draft.ts (setDraftState)
// Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
//
// Transizione di stato del draft: capture -> review (pending) -> save -> done.

import type { DraftState } from '../types';

interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface TransitionDeps {
  supabase: SupabaseLike;
  table?: string;
}

// Whitelist transizioni ammesse (FSM strict).
const ALLOWED_TRANSITIONS: Record<DraftState, DraftState[]> = {
  pending: ['awaiting_note', 'awaiting_edit', 'saved', 'abandoned'],
  awaiting_note: ['pending', 'saved', 'abandoned'],
  awaiting_edit: ['pending', 'saved', 'abandoned'],
  saved: [],
  abandoned: [],
};

export function isTransitionAllowed(from: DraftState, to: DraftState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Cambia lo stato del draft. Mai-throw.
 * Ritorna { success, new_state, error? }.
 */
export async function transitionState(
  deps: TransitionDeps,
  input: {
    draft_id: string;
    from_state: DraftState;
    to_state: DraftState;
    preview_message_id?: number;
    /** Se true skippa la validazione FSM (uso amministrativo). Default false. */
    force?: boolean;
  },
): Promise<{ success: boolean; new_state?: DraftState; error?: string }> {
  if (!input.force && !isTransitionAllowed(input.from_state, input.to_state)) {
    return { success: false, error: `invalid_transition:${input.from_state}->${input.to_state}` };
  }
  const table = deps.table ?? 'bot_capture_drafts';

  const patch: Record<string, unknown> = {
    state: input.to_state,
    updated_at: new Date().toISOString(),
  };
  if (input.preview_message_id !== undefined) {
    patch.preview_message_id = input.preview_message_id;
  }

  try {
    const { error } = await deps.supabase
      .from(table)
      .update(patch)
      .eq('id', input.draft_id);
    if (error) {
      console.warn('[state-machine-capture] transitionState error', error);
      return { success: false, error: error.message };
    }
    return { success: true, new_state: input.to_state };
  } catch (e) {
    console.warn('[state-machine-capture] transitionState exception', e);
    return { success: false, error: (e as Error).message };
  }
}
