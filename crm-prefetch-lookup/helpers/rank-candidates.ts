// Brick: telegram-crm-prefetch-lookup v0.1.0 (le-GO I-Domain)

import type { CandidateTokenKind, CrmCandidate } from '../types';

/**
 * Score base per kind di token matchato. Più "preciso" = score più alto.
 *
 * codice_fiscale e partita_iva sono identificatori univoci → match forte.
 * email e phone sono molto specifici ma possono essere shared (es. info@azienda).
 * name_uppercase e company_keyword sono deboli → rank basso.
 */
const KIND_WEIGHT: Record<CandidateTokenKind, number> = {
  codice_fiscale: 1.0,
  partita_iva: 1.0,
  email: 0.95,
  phone: 0.90,
  targa: 0.85,
  company_keyword: 0.45,
  name_uppercase: 0.40,
};

/**
 * Score canonical: somma dei pesi dei `matched_on` (cap a 1.0).
 *
 * Se la row matcha codice_fiscale → score=1.0 (massima fiducia).
 * Se matcha solo "name_uppercase" → score=0.40.
 * Se matcha email+phone → score=min(1.0, 0.95+0.90) = 1.0 (cap).
 *
 * Tie-break: row con più campi matched_on viene prima.
 */
export function scoreCandidate(c: CrmCandidate): number {
  if (!c.matched_on?.length) return 0;
  let s = 0;
  for (const k of c.matched_on) {
    s += KIND_WEIGHT[k] ?? 0;
  }
  return Math.min(1.0, s);
}

/**
 * Ordina candidati per score desc (con tie-break su matched_on.length).
 * Mutates input array. Ritorna lo stesso array per chaining.
 */
export function rankCandidates(candidates: CrmCandidate[]): CrmCandidate[] {
  for (const c of candidates) {
    c.score = scoreCandidate(c);
  }
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.matched_on?.length ?? 0) - (a.matched_on?.length ?? 0);
  });
  return candidates;
}

/**
 * Riduce candidati a top-K con score >= min_score.
 *
 * Default min_score = 0.40 (esclude name_uppercase puro che è troppo
 * ambiguo).
 */
export function topK(
  candidates: CrmCandidate[],
  k: number,
  min_score: number = 0.40,
): CrmCandidate[] {
  return candidates.filter((c) => c.score >= min_score).slice(0, k);
}
