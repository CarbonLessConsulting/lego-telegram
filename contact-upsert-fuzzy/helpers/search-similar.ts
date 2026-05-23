// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-match.ts
// Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260520080100_goref_find_contact_admin.sql
//   (RPC goref_find_contact_by_embedding_admin)
// Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data)

import type { MatchCandidate, SupabaseLike } from '../types';

/**
 * Top-K match per tenant+owner via pgvector cosine.
 *
 * Richiede RPC `find_contact_by_embedding` (o nome custom configurato) sul DB.
 * La migration template fornisce uno SECURITY DEFINER allineato al donor goref.
 *
 * Soft no-throw: ritorna array vuoto se RPC fallisce o input invalido.
 */
export async function searchSimilarByEmbedding(
  sb: SupabaseLike,
  params: {
    tenant_id: string;
    owner_user_id: string;
    embedding: number[];
    threshold?: number;
    k?: number;
    rpc_name?: string;
  },
): Promise<MatchCandidate[]> {
  if (!params.tenant_id || !params.owner_user_id) return [];
  if (!params.embedding || params.embedding.length === 0) return [];

  const rpcName = params.rpc_name ?? 'find_contact_by_embedding';

  try {
    const { data, error } = await sb.rpc(rpcName, {
      p_tenant_id: params.tenant_id,
      p_owner_user_id: params.owner_user_id,
      p_query_embedding: params.embedding,
      p_match_threshold: params.threshold ?? 0.7,
      p_match_count: params.k ?? 5,
    });

    if (error) {
      console.error('[telegram-contact-upsert-fuzzy] search_similar rpc error', {
        rpc: rpcName,
        error: String(error),
      });
      return [];
    }

    const rows = (data ?? []) as Array<{
      id: string;
      full_name: string;
      similarity: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      similarity: Number(r.similarity ?? 0),
      match_source: 'embedding' as const,
    }));
  } catch (e) {
    console.error('[telegram-contact-upsert-fuzzy] search_similar exception', {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}
