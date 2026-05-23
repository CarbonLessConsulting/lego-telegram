// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-upsert.ts (UpsertResult)
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-match.ts (ContactMatch)
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-schema.ts (taxonomy)
// Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data)

/**
 * Contatto generico estratto da fonte (foto biglietto / vocale / vCard / form / API).
 *
 * Sotto-set canonical pensato per essere portabile. I prodotti possono estendere
 * con campi specifici (es. `role_taxonomy_id`, `industry_tags`) tramite intersezione
 * di tipo (`ContactCanonical & { ...extra }`) — non aggiungerli qui.
 */
export interface ContactCanonical {
  /** Nome completo, sempre presente (fallback "Sconosciuto" se vuoto). */
  full_name: string;

  /** Display name opzionale (nickname, soprannome). */
  display_name?: string | null;

  /** Email normalizzate lowercased, unique. */
  emails: string[];

  /** Telefoni in formato E.164 quando possibile. */
  phones: string[];

  /** Azienda / organizzazione. */
  company?: string | null;

  /** Titolo / ruolo in chiaro (es. "CFO", "Responsabile acquisti"). */
  role?: string | null;

  /** Linkedin / website (solo http(s) — vCard può portare javascript:/data:). */
  linkedin_url?: string | null;
  website?: string | null;

  /** Note libere / contesto. */
  notes?: string | null;

  /** Lingua preferita del contatto (per future comunicazioni). */
  preferred_language?: 'it' | 'en' | 'es' | 'de' | 'fr' | null;

  /** Espandibile dal consumer per campi product-specific. */
  [key: string]: unknown;
}

/**
 * Sorgente del capture — propaga la provenance fino al DB per audit + dedup.
 */
export type ContactSource =
  | 'business_card'   // foto biglietto OCR
  | 'voice'           // vocale Whisper + extraction LLM
  | 'vcard'           // .vcf allegato
  | 'manual'          // form web
  | 'calendar'        // import calendario
  | 'api'             // integrazione esterna
  | 'unknown';

/**
 * Candidato match restituito da semantic search + fuzzy name.
 */
export interface MatchCandidate {
  id: string;
  full_name: string;
  /** Cosine similarity 0..1 per match pgvector. */
  similarity: number;
  /** Fonte del match: 'embedding' | 'fuzzy_name' | 'email_overlap' | 'phone_overlap'. */
  match_source: 'embedding' | 'fuzzy_name' | 'email_overlap' | 'phone_overlap';
}

/**
 * Risultato della upsert.
 *
 * `action`:
 *   - `inserted` → nuovo record
 *   - `updated`  → match auto-merged (similarity >= high_match_threshold)
 *   - `needs_user_confirmation` → match mid-confidence (mid_match..high_match):
 *     ritorna candidati e lascia decidere all'utente Telegram (callback inline).
 *   - `noop` → nessuna azione (es. input vuoto, soft fail)
 */
export interface UpsertResult {
  action: 'inserted' | 'updated' | 'needs_user_confirmation' | 'noop';
  id: string | null;
  candidates?: MatchCandidate[];
  /** Error message in caso di soft fail (action='noop'). */
  error?: string;
}

/**
 * Configurazione threshold per il match. I default sono prudenti — adatta al
 * prodotto se hai bisogno di maggiore recall vs precisione.
 */
export interface MatchThresholds {
  /** Sopra questa: UPDATE merge automatico. Default 0.90. */
  high_match: number;
  /** Sotto high, sopra questa: ritorna candidati per user confirmation. Default 0.75. */
  mid_match: number;
  /** Sotto questa: ignora il match (treat as nuovo). Default 0.55. */
  low_match: number;
}

export const DEFAULT_THRESHOLDS: MatchThresholds = {
  high_match: 0.90,
  mid_match: 0.75,
  low_match: 0.55,
};

/**
 * Adapter Supabase iniettato dal consumer. Deve avere `.from()` e `.rpc()`
 * compatibili con `@supabase/supabase-js` v2 SupabaseClient.
 *
 * Tipato come `unknown`-shape volutamente per non importare `@supabase/supabase-js`
 * direttamente (questo brick può vivere sia in edge fn Deno che in Node).
 */
export interface SupabaseLike {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        eq?: (col2: string, val2: unknown) => unknown;
        overlaps?: (col2: string, vals: unknown[]) => {
          limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
        };
        limit?: (n: number) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
        maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<{ data: { id: string } | null; error: unknown }>;
      };
    };
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ error: unknown }>;
    };
  };
  rpc: (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
}
