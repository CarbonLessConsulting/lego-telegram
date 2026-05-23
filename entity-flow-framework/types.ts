// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/gomec-telegram-webhook/entities/_shared.ts
//   (FieldSpec + CLIENTE_SCHEMA + VEICOLO_SCHEMA + nextMissingField + applyCorrection)
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/gomec-telegram-webhook/_session.ts
//   (session persistence multi-tenant TTL 30min)
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/gomec-telegram-webhook/entities/*.ts
//   (9 entity flows declarativi: cliente, veicolo, preventivo, tagliando, intervento, fap, magazzino, crm)
// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)

/**
 * Specifica di un campo dentro uno step del flow.
 *
 * Pattern donor `FieldSpec` da `_shared.ts:166-178`.
 */
export interface FlowFieldSpec {
  /** Chiave nel payload accumulato del flow run. */
  key: string;
  /** Etichetta UI (Telegram HTML). */
  label: string;
  /** Emoji per riepilogo. */
  emoji?: string;
  /** Se true: warning soft se manca alla conferma. */
  required: boolean;
  /** Prompt per chiedere il valore in manual-walk. */
  prompt?: string;
  /** Tipo input (default 'text'). */
  type?: 'text' | 'phone' | 'email' | 'integer' | 'date' | 'enum';
  /** Per type='enum': valori ammessi. */
  enum_values?: string[];
  /** Validator opzionale (ritorna message error o null). */
  validate?: (value: unknown) => string | null;
  /** Visibilità condizionale: mostra solo se predicate true sul draft corrente. */
  visible_if?: (draft: Record<string, unknown>) => boolean;
}

/**
 * Step di un entity flow.
 *
 * I tipi di step canonical sono:
 *   - `capture`: chiede uno o più campi all'utente (manual o auto-extract)
 *   - `review`: mostra preview dei dati accumulati, attende conferma
 *   - `commit`: persiste su DB (insert/update), callback custom
 *   - `branch`: scelta condizionale, salta a step diverso
 */
export interface FlowStep {
  /** ID step univoco nel flow (es. 'ask_name', 'review_data', 'commit_cliente'). */
  id: string;
  /** Tipo step. */
  type: 'capture' | 'review' | 'commit' | 'branch';
  /** Etichetta per UI / log. */
  label: string;
  /** Per type='capture': fields da raccogliere in questo step. */
  fields?: FlowFieldSpec[];
  /** Prompt template per il messaggio user (usa `{{var}}` interpolation). */
  prompt_template?: string;
  /** Per type='branch': funzione che ritorna ID step destinazione. */
  branch_fn?: (draft: Record<string, unknown>) => string;
  /** Per type='commit': callback che persiste il payload (consumer-side). */
  commit_fn?: (draft: Record<string, unknown>, ctx: CommitContext) => Promise<CommitResult>;
  /** ID step successivo (override default). Se omesso: usa l'ordine `flow.steps`. */
  next_step?: string;
  /** Skip step se predicate true. */
  skip_if?: (draft: Record<string, unknown>) => boolean;
}

/**
 * Context passato al commit_fn.
 */
export interface CommitContext {
  tenant_id: string;
  owner_user_id: string;
  telegram_chat_id: number;
  flow_id: string;
  run_id: string;
}

/**
 * Risultato del commit step.
 */
export interface CommitResult {
  /** ID del record creato/aggiornato. */
  record_id?: string;
  /** Errore (se presente, il flow va in stato 'failed'). */
  error?: string;
  /** Messaggio HTML opzionale da mostrare all'utente. */
  user_message?: string;
}

/**
 * Definizione canonical declarative di un entity flow.
 *
 * Esempio: cliente_create_flow ha 4 step: ask_tipo → ask_dati_base → review → commit.
 */
export interface EntityFlowDefinition {
  /** ID flow univoco a livello prodotto (es. 'cliente_create', 'veicolo_quick'). */
  id: string;
  /** Versione semver — incrementa se cambi step (in-flight runs gestite con migration). */
  version: string;
  /** Entity target (es. 'cliente', 'veicolo', 'preventivo'). */
  entity_type: string;
  /** Etichetta human-readable. */
  label: string;
  /** Steps ordinati. */
  steps: FlowStep[];
  /** Step iniziale (default: primo step di `steps`). */
  initial_step?: string;
  /** TTL del run in minuti (default 30). */
  ttl_minutes?: number;
}

/**
 * Stato runtime di un flow run.
 */
export type FlowRunStatus =
  | 'running'
  | 'completed'
  | 'abandoned'   // TTL scaduto o user ha cancellato
  | 'failed';     // commit_fn ha ritornato error

/**
 * Riga DB di un flow run.
 */
export interface FlowRunRow {
  id: string;
  flow_id: string;
  flow_version: string;
  tenant_id: string;
  owner_user_id: string;
  telegram_chat_id: number;
  entity_type: string;
  current_step_id: string;
  status: FlowRunStatus;
  /** Payload accumulato. */
  draft: Record<string, unknown>;
  /** History transizioni step (audit). */
  step_history: Array<{ step_id: string; entered_at: string; payload_patch?: Record<string, unknown> }>;
  /** Telegram message_id della preview corrente (per editMessage). */
  preview_message_id: number | null;
  /** Record_id creato dal commit step (se completed). */
  result_record_id: string | null;
  /** Error message (se failed). */
  error_message: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Risultato di `advanceStep`.
 */
export interface AdvanceResult {
  /** Run dopo l'avanzamento. */
  run: FlowRunRow;
  /** Step corrente DOPO l'avanzamento (può essere lo stesso se validation failed). */
  current_step: FlowStep;
  /** Se `true`: il flow è terminato (status != 'running'). */
  is_terminal: boolean;
  /** Messaggio utente HTML da inviare (rendering completo dello step prompt). */
  user_message?: string;
  /** Inline keyboard Telegram da allegare (passthrough — consumer responsible). */
  keyboard?: unknown;
  /** Validation error in caso di input invalido. */
  validation_error?: string;
}

/**
 * Adapter Supabase loose-typed (Deno + Node compat).
 */
export interface SupabaseLike {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        eq?: (col2: string, val2: unknown) => {
          eq?: (col3: string, val3: unknown) => {
            maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
          };
          maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
        };
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
}

/**
 * Configurazione DB del brick — adattabile per prodotto.
 */
export interface FlowEngineConfig {
  /** Tabella runs. Default `entity_flow_runs`. */
  runs_table: string;
  /** Default TTL minuti. */
  default_ttl_minutes: number;
}

export const DEFAULT_ENGINE_CONFIG: FlowEngineConfig = {
  runs_table: 'entity_flow_runs',
  default_ttl_minutes: 30,
};
