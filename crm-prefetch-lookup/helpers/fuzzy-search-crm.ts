// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/gomec-telegram-webhook/entities/_shared.ts
//   (searchClienti pattern ILIKE multi-column con or filter)
// Brick: telegram-crm-prefetch-lookup v0.1.0 (le-GO I-Domain)

import type {
  CandidateToken,
  CrmCandidate,
  PrefetchConfig,
  SupabaseLike,
} from '../types';
import { DEFAULT_PREFETCH_CONFIG } from '../types';

/**
 * Escape LIKE wildcard (`_`, `%`) per evitare full-table scan da utente
 * (lezione contact-upsert `escapeLike`).
 */
function escapeLike(s: string): string {
  return s.replace(/([%_\\])/g, '\\$1');
}

/**
 * Fuzzy search CRM via ILIKE multi-column (donor pattern `searchClienti`).
 *
 * Costruisce un `or()` filter Supabase con ILIKE su ogni colonna di
 * `search_columns`. Per ogni token rilevante (email, phone, name) genera
 * un branch; le clausole sono unite logically OR a livello DB.
 *
 * Tenant-scoped: filter `tenant_id = ?` obbligatorio.
 *
 * Soft no-throw: ritorna array vuoto su errore.
 */
export async function fuzzySearchCrm(
  sb: SupabaseLike,
  params: {
    tenant_id: string;
    tokens: CandidateToken[];
    /** Override config canonical. */
    config?: Partial<PrefetchConfig>;
  },
): Promise<CrmCandidate[]> {
  const config: PrefetchConfig = {
    ...DEFAULT_PREFETCH_CONFIG,
    ...params.config,
  };

  if (!params.tenant_id || !params.tokens.length) return [];

  // Estraggo valori unici per kind, applico minLength + escape
  const queryValues = new Set<string>();
  for (const t of params.tokens) {
    const v = t.value.trim();
    if (v.length < config.min_token_length) continue;
    queryValues.add(escapeLike(v));
  }
  if (queryValues.size === 0) return [];

  // Costruisco or() filter: per ogni valore, ILIKE su ogni colonna
  const orParts: string[] = [];
  for (const v of queryValues) {
    for (const col of config.search_columns) {
      orParts.push(`${col}.ilike.%${v}%`);
    }
  }
  if (orParts.length === 0) return [];

  // Clamp max_candidates 1..20
  const limit = Math.min(Math.max(1, config.max_candidates), 20);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = sb.from(config.table).select('*').eq('tenant_id', params.tenant_id);
    const { data, error } = await chain.or(orParts.join(','))?.limit?.(limit) ?? { data: null, error: 'no_or_support' };

    if (error) {
      console.error('[telegram-crm-prefetch-lookup] fuzzy_search error', { error: String(error) });
      return [];
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return rows.map((row) => toCrmCandidate(row, params.tokens));
  } catch (e) {
    console.error('[telegram-crm-prefetch-lookup] fuzzy_search exception', {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

/**
 * Converte una row CRM generica in `CrmCandidate`, derivando display_name
 * e quali token hanno matchato.
 */
function toCrmCandidate(
  row: Record<string, unknown>,
  tokens: CandidateToken[],
): CrmCandidate {
  const displayName =
    (row.ragione_sociale as string | null) ||
    [row.nome, row.cognome].filter(Boolean).join(' ') ||
    (row.display_name as string | null) ||
    '(senza nome)';

  const emails = ensureArray(row.emails) ?? (row.email ? [String(row.email)] : []);
  const phones = ensureArray(row.phones) ?? (row.telefono ? [String(row.telefono)] : []);

  // Determina quali token hanno matchato confrontando con i campi della row
  const matchedOn = new Set<CrmCandidate['matched_on'][number]>();
  for (const t of tokens) {
    const v = t.value.toLowerCase();
    if (t.kind === 'email' && emails.some((e) => e.toLowerCase().includes(v))) matchedOn.add('email');
    if (t.kind === 'phone' && phones.some((p) => p.replace(/\D/g, '').includes(v.replace(/\D/g, '')))) matchedOn.add('phone');
    if (t.kind === 'partita_iva' && String(row.partita_iva ?? '').includes(v)) matchedOn.add('partita_iva');
    if (t.kind === 'codice_fiscale' && String(row.codice_fiscale ?? '').toLowerCase().includes(v.toLowerCase())) matchedOn.add('codice_fiscale');
    if ((t.kind === 'name_uppercase' || t.kind === 'company_keyword') && displayName.toLowerCase().includes(v.toLowerCase())) matchedOn.add(t.kind);
  }

  return {
    id: String(row.id),
    display_name: displayName,
    matched_on: Array.from(matchedOn),
    score: 0, // ranking calcolato in rank-candidates
    emails,
    phones,
    partita_iva: (row.partita_iva as string | null) ?? null,
    codice_fiscale: (row.codice_fiscale as string | null) ?? null,
    tipo: (row.tipo as string | null) ?? null,
  };
}

function ensureArray(v: unknown): string[] | null {
  if (Array.isArray(v)) return v.map(String);
  return null;
}
