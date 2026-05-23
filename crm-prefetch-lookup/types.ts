// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/gomec-telegram-webhook/entities/_shared.ts (searchClienti)
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/gomec-telegram-webhook/entities/crm.ts (CRM search pattern)
// Brick: telegram-crm-prefetch-lookup v0.1.0 (le-GO I-Domain)

/**
 * Tipi di token che il pre-parser può estrarre da testo libero utente.
 */
export type CandidateTokenKind =
  | 'email'
  | 'phone'
  | 'partita_iva'
  | 'codice_fiscale'
  | 'targa'
  | 'name_uppercase'
  | 'company_keyword';

/**
 * Token candidato estratto pre-Sofia turn.
 */
export interface CandidateToken {
  kind: CandidateTokenKind;
  value: string;
  /** Posizione nel testo originale (start, end). Utile per highlight UI. */
  span: [number, number];
}

/**
 * Riga CRM minima ritornata da fuzzy search.
 *
 * Schema generico — il prodotto può estendere via intersection. Non importiamo
 * direttamente i tipi di gosolution (`ClienteRow`) per portabilità.
 */
export interface CrmCandidate {
  id: string;
  display_name: string;
  /** Quale token ha matchato (email/phone/...) per ranking. */
  matched_on: CandidateTokenKind[];
  /** Score 0..1 (1 = match esatto su token critico). */
  score: number;
  /** Campi opzionali. Il consumer adatta al proprio schema. */
  emails?: string[];
  phones?: string[];
  partita_iva?: string | null;
  codice_fiscale?: string | null;
  tipo?: string | null;
  [key: string]: unknown;
}

/**
 * Hints prefetched da iniettare nel system prompt Sofia come context preloaded.
 *
 * Sofia li riceve come JSON e può decidere autonomamente se usarli (no
 * round-trip tool call separato per la lookup CRM).
 */
export interface PrefetchHints {
  /** Testo originale utente. */
  query: string;
  /** Token rilevati nel testo. */
  tokens: CandidateToken[];
  /** Candidati CRM trovati, max 5-10 (clamp). */
  candidates: CrmCandidate[];
  /** Total count senza limit (per "altri N risultati" UI). */
  total_count: number;
  /** Timestamp lookup. */
  fetched_at: string;
}

/**
 * Audit privacy-safe: NO PII in payload.
 *
 * Va loggato via brick `audit-log-immutable` con `action='crm_prefetch'` +
 * `severity='info'`. Il `payload` è solo metrico.
 */
export interface PrefetchAuditPayload {
  query_length: number;
  tokens_kinds: CandidateTokenKind[];
  candidates_returned: number;
  total_count: number;
  elapsed_ms: number;
  /** Esplicitamente assente: query string, candidates ids/names, emails. */
}

/**
 * Adapter Supabase iniettato (loose-typed per Deno + Node compat).
 * Vedi brick `telegram-contact-upsert-fuzzy/types.ts` per la stessa shape.
 */
export interface SupabaseLike {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        or?: (filter: string) => { limit: (n: number) => Promise<{ data: unknown; error: unknown }> };
        limit?: (n: number) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
  rpc?: (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
}

/**
 * Default config per ranking + clamp.
 */
export interface PrefetchConfig {
  /** Limite candidati ritornati (clamp 1..20). Default 5. */
  max_candidates: number;
  /** Tabella CRM target. Default `crm_contatti`. */
  table: string;
  /** Colonne da matchare con ILIKE multi-OR. Default canonical. */
  search_columns: string[];
  /** Min token length per attivare search. Default 2. */
  min_token_length: number;
}

export const DEFAULT_PREFETCH_CONFIG: PrefetchConfig = {
  max_candidates: 5,
  table: 'crm_contatti',
  search_columns: ['ragione_sociale', 'nome', 'cognome', 'email', 'telefono', 'partita_iva'],
  min_token_length: 2,
};
