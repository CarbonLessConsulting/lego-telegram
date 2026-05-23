// Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data)
//
// Batch cleanup duplicati esistenti (opzionale, eseguibile come maintenance job).
// NON applicare automaticamente in produzione senza review umana — il merge
// distruttivo non è reversibile.

import type { ContactCanonical, MatchCandidate, SupabaseLike } from '../types';
import { searchSimilarByEmbedding } from './search-similar';
import { mergeContactFields } from './merge-contact-fields';

export interface DedupPlan {
  /** Coppie (keep_id, drop_id, similarity). */
  pairs: Array<{
    keep_id: string;
    drop_id: string;
    similarity: number;
    keep_name: string;
    drop_name: string;
  }>;
  /** Quanti contatti analizzati. */
  analyzed: number;
  /** Quanti duplicati candidati trovati. */
  duplicate_candidates: number;
}

/**
 * Scansiona contatti di un (tenant, owner) e produce un PLAN di dedup
 * (no auto-merge). Esegue match pgvector contro se stesso, filtra coppie
 * con similarity >= threshold.
 *
 * Esecuzione del plan → `applyDedupPlan` separato (umano-confermato).
 */
export async function buildDedupPlan(
  sb: SupabaseLike,
  params: {
    table: string;
    tenant_id: string;
    owner_user_id: string;
    threshold?: number;
    rpc_name_find_by_embedding?: string;
    sample_size?: number;
  },
): Promise<DedupPlan> {
  const threshold = params.threshold ?? 0.92;
  const sampleSize = params.sample_size ?? 200;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = sb.from(params.table).select('id, full_name, embedding')
    .eq('tenant_id', params.tenant_id)
    .eq('owner_user_id', params.owner_user_id);
  const { data, error } = await chain.limit?.(sampleSize)?.maybeSingle?.() ?? { data: null, error: null };

  // Loose typing: il PostgREST .limit().select() ritorna array, ma il SupabaseLike
  // typing è semplificato. Il consumer reale userà il client tipato.
  const rows = Array.isArray(data) ? data : data ? [data] : [];

  if (error || rows.length === 0) {
    return { pairs: [], analyzed: 0, duplicate_candidates: 0 };
  }

  const seen = new Set<string>();
  const pairs: DedupPlan['pairs'] = [];

  for (const row of rows as Array<{ id: string; full_name: string; embedding: number[] | null }>) {
    if (seen.has(row.id)) continue;
    if (!row.embedding) continue;

    const matches: MatchCandidate[] = await searchSimilarByEmbedding(sb, {
      tenant_id: params.tenant_id,
      owner_user_id: params.owner_user_id,
      embedding: row.embedding,
      threshold,
      k: 5,
      rpc_name: params.rpc_name_find_by_embedding,
    });

    for (const m of matches) {
      if (m.id === row.id) continue;
      if (seen.has(m.id)) continue;
      pairs.push({
        keep_id: row.id,
        drop_id: m.id,
        similarity: m.similarity,
        keep_name: row.full_name,
        drop_name: m.full_name,
      });
      seen.add(m.id);
    }
    seen.add(row.id);
  }

  return {
    pairs,
    analyzed: rows.length,
    duplicate_candidates: pairs.length,
  };
}

/**
 * Applica un dedup plan: per ogni coppia, merge fields di `drop` in `keep`
 * e cancella `drop`.
 *
 * ⚠️ DISTRUTTIVO. Eseguire SOLO dopo review umana del `DedupPlan`.
 *
 * Soft no-throw: ritorna { applied, errors[] }.
 */
export async function applyDedupPlan(
  sb: SupabaseLike,
  params: {
    table: string;
    plan: DedupPlan;
  },
): Promise<{ applied: number; errors: string[] }> {
  const errors: string[] = [];
  let applied = 0;

  for (const pair of params.plan.pairs) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chainKeep: any = sb.from(params.table).select('*').eq('id', pair.keep_id);
      const { data: keep } = await chainKeep.maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chainDrop: any = sb.from(params.table).select('*').eq('id', pair.drop_id);
      const { data: drop } = await chainDrop.maybeSingle();

      if (!keep || !drop) {
        errors.push(`pair ${pair.keep_id}+${pair.drop_id}: row missing`);
        continue;
      }

      const merged = mergeContactFields(keep as ContactCanonical, drop as ContactCanonical);
      const { error: uErr } = await sb.from(params.table)
        .update({ ...merged, updated_at: new Date().toISOString() })
        .eq('id', pair.keep_id);
      if (uErr) {
        errors.push(`update ${pair.keep_id}: ${String(uErr)}`);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chainDel: any = sb.from(params.table);
      const delResp = await chainDel.delete?.()?.eq?.('id', pair.drop_id);
      if (delResp?.error) {
        errors.push(`delete ${pair.drop_id}: ${String(delResp.error)}`);
        continue;
      }
      applied++;
    } catch (e) {
      errors.push(`pair ${pair.keep_id}+${pair.drop_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { applied, errors };
}
