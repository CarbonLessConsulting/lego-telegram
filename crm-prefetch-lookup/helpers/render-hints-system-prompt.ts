// Brick: telegram-crm-prefetch-lookup v0.1.0 (le-GO I-Domain)

import type { PrefetchHints } from '../types';

/**
 * Render hints come blocco JSON da iniettare nel system prompt Sofia.
 *
 * Convenzione canonical le-GO: usa `<crm_prefetch_hints>` tag XML attorno
 * al JSON così Sofia (e qualsiasi LLM) sa che è context tooling-derivato
 * e NON input utente (riduce confusione + facilita prompt injection guard).
 *
 * Output esempio:
 * ```xml
 * <crm_prefetch_hints>
 * {
 *   "query": "Mario Rossi 3331234567",
 *   "tokens": [{"kind":"phone","value":"3331234567"}],
 *   "candidates": [
 *     {"id":"abc","display_name":"Mario Rossi","score":0.9,"matched_on":["phone"]}
 *   ],
 *   "total_count": 1
 * }
 * </crm_prefetch_hints>
 * ```
 *
 * Sofia può fare reasoning "ho già 1 candidato matched on phone, propongo
 * conferma utente senza nuova lookup".
 */
export function renderHintsForSystemPrompt(hints: PrefetchHints): string {
  if (!hints.candidates.length) {
    // Nessun match → segnale esplicito che NON serve cercare CRM
    return `<crm_prefetch_hints>
{
  "query_length": ${hints.query.length},
  "tokens": ${JSON.stringify(hints.tokens.map((t) => ({ kind: t.kind })))},
  "candidates": [],
  "total_count": 0,
  "note": "Nessun candidato CRM esistente per i token rilevati. Sofia può procedere con creazione nuova o richiesta dati."
}
</crm_prefetch_hints>`;
  }

  // Compact JSON: tronca campi pesanti, espone solo display_name + score + matched_on
  const compactCandidates = hints.candidates.map((c) => ({
    id: c.id,
    display_name: c.display_name,
    score: Number(c.score.toFixed(2)),
    matched_on: c.matched_on,
    tipo: c.tipo ?? undefined,
    // emails/phones DELIBERATAMENTE OMESSI dal prompt — Sofia li chiederà via
    // tool call dedicato se serve, riducendo PII nei token context.
  }));

  return `<crm_prefetch_hints>
${JSON.stringify(
  {
    query_length: hints.query.length,
    tokens: hints.tokens.map((t) => ({ kind: t.kind })),
    candidates: compactCandidates,
    total_count: hints.total_count,
    note:
      hints.candidates.length === hints.total_count
        ? 'Tutti i candidati CRM mostrati. Se Sofia individua match alta-fiducia, può proporre conferma utente.'
        : `Mostrati top ${hints.candidates.length} su ${hints.total_count} totali. Se nessuno è il giusto, Sofia può richiedere clarification.`,
  },
  null,
  2,
)}
</crm_prefetch_hints>`;
}

/**
 * Costruisce hints "vuoti" — utile quando il pre-parser non rileva token
 * o quando il consumer vuole esplicitamente segnalare "skip prefetch".
 */
export function buildEmptyHints(query: string): PrefetchHints {
  return {
    query,
    tokens: [],
    candidates: [],
    total_count: 0,
    fetched_at: new Date().toISOString(),
  };
}
