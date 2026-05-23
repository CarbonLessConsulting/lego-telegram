// Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260518110000_goref_fuzzy_name_match.sql
//   (RPC goref_find_similar_by_name + pg_trgm similarity)
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-upsert.ts (fuzzy name fallback)
// Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data)

import type { MatchCandidate, SupabaseLike } from "../types.ts";

/**
 * Fuzzy name match via pg_trgm `similarity()`.
 *
 * Risolve duplicati che embedding semantica può mancare quando il
 * contesto contiene rumore o l'embedding non è stato ancora calcolato
 * (es. contatti pre-pgvector).
 *
 * Threshold default 0.55 (preso dal donor). Sopra 0.85 = match forte;
 * sotto 0.55 = ignora.
 *
 * Soft no-throw: ritorna array vuoto su errore.
 */
export async function fuzzyMatchByName(
  sb: SupabaseLike,
  params: {
    tenant_id: string;
    owner_user_id: string;
    full_name: string;
    min_similarity?: number;
    rpc_name?: string;
  },
): Promise<MatchCandidate[]> {
  if (!params.full_name || params.full_name.trim().length < 3) return [];
  if (!params.tenant_id || !params.owner_user_id) return [];

  const rpcName = params.rpc_name ?? 'find_similar_by_name';

  try {
    const { data, error } = await sb.rpc(rpcName, {
      p_tenant_id: params.tenant_id,
      p_owner_user_id: params.owner_user_id,
      p_full_name: params.full_name.trim(),
      p_min_similarity: params.min_similarity ?? 0.55,
    });

    if (error) {
      console.error('[telegram-contact-upsert-fuzzy] fuzzy_name rpc error', {
        rpc: rpcName,
        error: String(error),
      });
      return [];
    }

    const rows = (data ?? []) as Array<{
      id: string;
      full_name: string;
      similarity?: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      similarity: Number(r.similarity ?? 0.6),
      match_source: 'fuzzy_name' as const,
    }));
  } catch (e) {
    console.error('[telegram-contact-upsert-fuzzy] fuzzy_name exception', {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

/**
 * Helper client-side: trigram similarity approssimata in JS
 * (per dedup batch locale prima di chiamare DB).
 *
 * Algoritmo: ratio di trigrammi comuni / trigrammi totali.
 * Allineato (approssimativamente) a pg_trgm `similarity()` per stringhe corte.
 */
export function jsTrigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const A = a.toLowerCase().trim();
  const B = b.toLowerCase().trim();
  if (A === B) return 1;
  if (A.length < 2 || B.length < 2) return 0;

  const trigrams = (s: string): Set<string> => {
    const padded = `  ${s} `;
    const out = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) {
      out.add(padded.slice(i, i + 3));
    }
    return out;
  };

  const tA = trigrams(A);
  const tB = trigrams(B);

  let intersection = 0;
  tA.forEach((t) => {
    if (tB.has(t)) intersection++;
  });
  const union = tA.size + tB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
