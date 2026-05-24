// Brick: llm-usage-interceptor v0.3.0 (le-GO G-Ops)
//
// Drop-in replacement per fetch() verso API LLM. ZERO TOKEN SFUGGE.
// Ogni chiamata viene loggata su llm_usage_costs del project locale.

export type Provider =
  | "anthropic"
  | "openai"
  | "deepseek"
  | "mistral"
  | "groq"
  | "cerebras"
  | "fireworks"
  | "gemini"
  | "unknown";

export interface UsageMeta {
  /** ID tenant (NULL = agency interna). */
  tenant_id?: string | null;
  /** Edge function chiamante (es. 'sofia-erp', 'mayla-luna'). OBBLIGATORIO. */
  edge_function: string;
  /** Operazione semantica (es. 'reply', 'ocr', 'transcribe', 'embed'). */
  operation?: string;
  /** Task type canonical (per analisi routing). */
  task_type?: string;
  /** Provider noto a priori (se URL ambiguo). Default: auto-detect da URL. */
  provider?: Provider;
  /** Owner utente per breakdown. */
  owner_user_id?: string | null;
  /** Per audio: secondi processati (Whisper). */
  audio_seconds?: number;
  /** Per vision: numero immagini. */
  images_count?: number;
  /** Metadata libera. */
  metadata?: Record<string, unknown>;
  /** Request ID custom (per tracing). */
  request_id?: string;
}

export interface UsageRow {
  tenant_id: string | null;
  owner_user_id: string | null;
  edge_function: string;
  operation: string | null;
  task_type: string | null;
  provider: Provider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  audio_seconds: number;
  images_count: number;
  cost_usd: number;
  cost_eur: number;
  duration_ms: number;
  success: boolean;
  error_message: string | null;
  http_status: number | null;
  metadata: Record<string, unknown>;
  request_id: string | null;
}

/** Minimal Supabase admin client (insert-only). */
export interface SupabaseAdminLike {
  from(table: string): {
    insert(row: unknown): Promise<{ data: unknown; error: unknown }>;
  };
}

export interface InterceptedFetchDeps {
  /** Client Supabase con service_role per insert su llm_usage_costs. */
  supabaseAdmin: SupabaseAdminLike;
  /** EUR/USD rate (default: 0.92 = ~1 EUR/USD assumendo USD->EUR conversion). */
  eurUsdRate?: number;
  /** Override pricing lookup. Default: PRICING table interna. */
  getPricing?: (model: string) => { input_per_mtok: number; output_per_mtok: number; usd_per_audio_second?: number } | undefined;
  /** Fetch globale (override per test). */
  fetch?: typeof fetch;
  /** Logger opzionale. */
  log?: (msg: string, meta?: Record<string, unknown>) => void;
  /** Disabilita logging (es. healthcheck). Default false. */
  skipLogging?: boolean;
}
