// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-upsert.ts
//   (upsertContact orchestrator + match strategy email/phone/embed/name + insert+merge)
// Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data)

import type {
  ContactCanonical,
  ContactSource,
  MatchCandidate,
  MatchThresholds,
  SupabaseLike,
  UpsertResult,
} from '../types';
import { DEFAULT_THRESHOLDS } from '../types';
import { searchSimilarByEmbedding } from './search-similar';
import { fuzzyMatchByName } from './fuzzy-match-name';
import { mergeContactFields } from './merge-contact-fields';

interface UpsertContactOpts {
  /** Adapter Supabase (edge fn service_role o Node service_role). */
  sb: SupabaseLike;
  /** Tabella contacts del prodotto (es. 'goref_contacts', 'gocotech_contacts'). */
  table: string;
  tenant_id: string;
  /** Owner del contatto (multi-utente per tenant: ogni utente vede SOLO i propri). */
  owner_user_id: string;
  source: ContactSource;
  /** Dati estratti dalla fonte (foto/voice/vcard/form). */
  contact: ContactCanonical;
  /** Embedding 1536d (calcolato a monte con `embedContact`). */
  embedding: number[] | null;
  /** Threshold override. Default `DEFAULT_THRESHOLDS`. */
  thresholds?: MatchThresholds;
  /** RPC names override (per prodotti con naming custom). */
  rpc_names?: {
    find_by_embedding?: string;
    find_by_name?: string;
  };
  /** Se true: ritorna candidati mid-confidence senza fare UPDATE; lascia decidere all'utente. Default true. */
  enable_user_confirmation?: boolean;
}

/**
 * Smart upsert: prima cerca match esistente (embedding + fuzzy name + email/phone
 * overlap), poi decide.
 *
 * Decisione:
 *   - sim >= high_match  → UPDATE merge
 *   - sim >= mid_match   → ritorna candidati (caller chiede conferma utente)
 *   - sim <  mid_match   → INSERT nuovo
 *
 * Soft no-throw: in caso di errore inattesto ritorna `{action:'noop', error}`.
 */
export async function upsertContactFuzzy(opts: UpsertContactOpts): Promise<UpsertResult> {
  const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const enableConfirm = opts.enable_user_confirmation ?? true;

  if (!opts.contact.full_name?.trim()) {
    return { action: 'noop', id: null, error: 'empty_full_name' };
  }

  try {
    // 1) Match strategy: prima exact overlap (email/phone), poi embedding, poi fuzzy name
    const candidates: MatchCandidate[] = [];

    // 1a) Exact email overlap (similarity = 1)
    if (opts.contact.emails && opts.contact.emails.length > 0) {
      const exact = await findByOverlap(opts.sb, opts.table, {
        tenant_id: opts.tenant_id,
        owner_user_id: opts.owner_user_id,
        column: 'emails',
        values: opts.contact.emails,
      });
      if (exact) {
        candidates.push({
          id: exact.id,
          full_name: exact.full_name ?? '(unknown)',
          similarity: 1.0,
          match_source: 'email_overlap',
        });
      }
    }

    // 1b) Exact phone overlap
    if (candidates.length === 0 && opts.contact.phones && opts.contact.phones.length > 0) {
      const exact = await findByOverlap(opts.sb, opts.table, {
        tenant_id: opts.tenant_id,
        owner_user_id: opts.owner_user_id,
        column: 'phones',
        values: opts.contact.phones,
      });
      if (exact) {
        candidates.push({
          id: exact.id,
          full_name: exact.full_name ?? '(unknown)',
          similarity: 1.0,
          match_source: 'phone_overlap',
        });
      }
    }

    // 1c) Embedding similarity (pgvector)
    if (candidates.length === 0 && opts.embedding) {
      const embedMatches = await searchSimilarByEmbedding(opts.sb, {
        tenant_id: opts.tenant_id,
        owner_user_id: opts.owner_user_id,
        embedding: opts.embedding,
        threshold: thresholds.low_match,
        k: 5,
        rpc_name: opts.rpc_names?.find_by_embedding,
      });
      candidates.push(...embedMatches);
    }

    // 1d) Fuzzy name (pg_trgm) — fallback per contatti senza embedding
    if (candidates.length === 0) {
      const nameMatches = await fuzzyMatchByName(opts.sb, {
        tenant_id: opts.tenant_id,
        owner_user_id: opts.owner_user_id,
        full_name: opts.contact.full_name,
        min_similarity: thresholds.low_match,
        rpc_name: opts.rpc_names?.find_by_name,
      });
      candidates.push(...nameMatches);
    }

    // 2) Decisione
    const top = candidates[0];

    if (top && top.similarity >= thresholds.high_match) {
      // UPDATE merge
      return await updateMerge(opts.sb, opts.table, top.id, opts.contact, opts.embedding);
    }

    if (top && top.similarity >= thresholds.mid_match && enableConfirm) {
      // Ritorna candidati per conferma utente
      return {
        action: 'needs_user_confirmation',
        id: null,
        candidates: candidates.slice(0, 3),
      };
    }

    // INSERT
    return await insertNew(opts.sb, opts.table, {
      tenant_id: opts.tenant_id,
      owner_user_id: opts.owner_user_id,
      source: opts.source,
      contact: opts.contact,
      embedding: opts.embedding,
    });
  } catch (e) {
    console.error('[telegram-contact-upsert-fuzzy] upsertContactFuzzy soft fail', {
      error: e instanceof Error ? e.message : String(e),
    });
    return { action: 'noop', id: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

async function findByOverlap(
  sb: SupabaseLike,
  table: string,
  params: {
    tenant_id: string;
    owner_user_id: string;
    column: string;
    values: string[];
  },
): Promise<{ id: string; full_name?: string } | null> {
  try {
    // Costruisce manualmente la query via .from(...).select(...).eq(...).overlaps(...)
    // Il tipo SupabaseLike è loose; usiamo cast minimo per accedere alla chain reale.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = sb.from(table).select('id, full_name')
      .eq('tenant_id', params.tenant_id)
      .eq('owner_user_id', params.owner_user_id);
    const { data, error } = await chain
      .overlaps(params.column, params.values)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as { id: string; full_name?: string };
  } catch {
    return null;
  }
}

async function updateMerge(
  sb: SupabaseLike,
  table: string,
  id: string,
  contact: ContactCanonical,
  embedding: number[] | null,
): Promise<UpsertResult> {
  try {
    // Read existing per merge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = sb.from(table).select('*').eq('id', id);
    const { data: existing, error: rErr } = await chain.maybeSingle();
    if (rErr || !existing) {
      return { action: 'noop', id: null, error: 'existing_row_lookup_failed' };
    }

    const merged = mergeContactFields(existing as ContactCanonical, contact);
    const patch: Record<string, unknown> = {
      ...merged,
      updated_at: new Date().toISOString(),
    };
    if (embedding) patch.embedding = embedding;

    const { error: uErr } = await sb.from(table).update(patch).eq('id', id);
    if (uErr) {
      return { action: 'noop', id: null, error: String(uErr) };
    }
    return { action: 'updated', id };
  } catch (e) {
    return { action: 'noop', id: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function insertNew(
  sb: SupabaseLike,
  table: string,
  opts: {
    tenant_id: string;
    owner_user_id: string;
    source: ContactSource;
    contact: ContactCanonical;
    embedding: number[] | null;
  },
): Promise<UpsertResult> {
  try {
    const row: Record<string, unknown> = {
      tenant_id: opts.tenant_id,
      owner_user_id: opts.owner_user_id,
      source: opts.source,
      ...opts.contact,
      emails: opts.contact.emails ?? [],
      phones: opts.contact.phones ?? [],
    };
    if (opts.embedding) row.embedding = opts.embedding;

    const { data, error } = await sb.from(table).insert(row).select('id').single();
    if (error || !data) {
      return { action: 'noop', id: null, error: String(error) };
    }
    return { action: 'inserted', id: data.id };
  } catch (e) {
    return { action: 'noop', id: null, error: e instanceof Error ? e.message : String(e) };
  }
}
