// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/draft.ts (mergeExtracted pattern)
// Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
//
// Append (merge) di una nuova source al draft attivo. Multi-source pattern
// (voice + photo + text + vcard aggregati in una singola entry).

import { startDraft, type StartDraftDeps } from "./start-draft.ts";
import { loadActiveDraft } from "./load-active-draft.ts";
import type { AppendDraftResult, DraftSourceEntry, StartDraftInput } from "../types.ts";

/**
 * Merger di default: shallow merge (incoming sovrascrive chiavi esistenti
 * solo se non-null). Array union se entrambi sono array. Per merge custom
 * (es. concatenazione testi long-form) passare `mergePayloads` custom.
 */
export function defaultMergePayloads(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === null || v === undefined) continue;
    const cur = out[k];
    if (Array.isArray(cur) && Array.isArray(v)) {
      out[k] = Array.from(new Set([...(cur as unknown[]), ...(v as unknown[])]));
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface AppendDraftInput {
  tenant_id: string;
  owner_user_id: string;
  telegram_chat_id: number;
  /** Payload incoming da mergiare con quello esistente (se draft attivo). */
  payload: Record<string, unknown>;
  source: string;
  source_meta?: Record<string, unknown>;
  ttl_seconds?: number;
  /** Custom merger. Default: defaultMergePayloads. */
  merge?: (
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
  ) => Record<string, unknown>;
}

/**
 * Pattern canonical multi-source capture:
 *   1. Carica draft attivo (se esiste)
 *   2. Merge payload lato caller (no recursive merge nel DB)
 *   3. startDraft RPC (atomic UPSERT)
 *
 * Mai-throw.
 */
export async function appendToDraft(
  deps: StartDraftDeps & { table?: string },
  input: AppendDraftInput,
): Promise<AppendDraftResult | null> {
  const merger = input.merge ?? defaultMergePayloads;

  // v0.1: SupabaseLike interface mismatch cross-helpers; cast pragmatico, unify in v0.2
  const existing = await loadActiveDraft(
    // deno-lint-ignore no-explicit-any
    { supabase: deps.supabase as any, table: deps.table },
    input.telegram_chat_id,
  );

  const mergedPayload = existing
    ? merger(existing.payload ?? {}, input.payload)
    : input.payload;

  const startInput: StartDraftInput = {
    tenant_id: input.tenant_id,
    owner_user_id: input.owner_user_id,
    telegram_chat_id: input.telegram_chat_id,
    payload: mergedPayload,
    source: input.source,
    source_meta: input.source_meta,
    ttl_seconds: input.ttl_seconds,
    force_replace: false,
  };

  return await startDraft(deps, startInput);
}
