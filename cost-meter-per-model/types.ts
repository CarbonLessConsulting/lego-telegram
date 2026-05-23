// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/usage-meter.ts
// Brick: telegram-cost-meter-per-model v0.1.0 (le-GO G-Ops)
//
// Tipi pubblici del brick cost meter per-model.

export type AiProvider = 'anthropic' | 'openai' | 'whisper' | 'gemini' | 'groq' | 'cerebras' | string;

/** Entry di logging per una singola chiamata LLM/Whisper/Vision. */
export interface AiUsageEntry {
  tenant_id: string;
  owner_user_id?: string | null;
  /** Edge function chiamante (es. 'bot-capture-photo', 'sofia-erp'). */
  edge_function: string;
  provider: AiProvider;
  /** Modello canonical (es. 'claude-sonnet-4-6', 'whisper-1'). */
  model: string;
  /** Operazione semantica (es. 'ocr', 'transcribe', 'reply', 'embed'). */
  operation?: string;
  input_tokens?: number;
  output_tokens?: number;
  /** Per Whisper: secondi audio. */
  audio_seconds?: number;
  /** Per Vision: numero immagini processate. */
  images_count?: number;
  duration_ms?: number;
  success?: boolean;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

/** Pricing canonical per un singolo modello. */
export interface ModelPricing {
  model: string;
  provider: AiProvider;
  /** USD per 1M token in input. */
  input_per_mtok: number;
  /** USD per 1M token in output (0 per embeddings). */
  output_per_mtok: number;
  /** USD per secondo audio (per Whisper). 0 se non audio. */
  usd_per_audio_second?: number;
  /** Fonte URL ufficiale. */
  source_url: string;
  verified_at: string;
  note?: string;
}

/** Output computeUsageCost. */
export interface CostComputation {
  cost_usd: number;
  model: string;
  provider: AiProvider;
  breakdown: {
    input_cost: number;
    output_cost: number;
    audio_cost: number;
  };
}

/** Risposta check-cost-cap helper. */
export interface CostCapResult {
  allowed: boolean;
  current_eur: number;
  current_usd: number;
  cap_eur: number;
  /** Window valutata (es. 'daily', 'monthly'). */
  window: 'daily' | 'monthly' | 'custom';
  /** Quanto manca prima del cap (eur). */
  remaining_eur: number;
}

/** Breakdown by model (per dashboard). */
export interface BreakdownRow {
  model: string;
  provider: AiProvider;
  calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_audio_seconds: number;
  total_cost_usd: number;
  avg_duration_ms: number;
  error_count: number;
}
