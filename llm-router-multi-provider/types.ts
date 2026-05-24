// Brick: llm-router-multi-provider v0.2.0 (le-GO B-Sofia-Core)
//
// Tipi pubblici del router intelligente multi-provider.
// Sofia sceglie best modello x best prezzo per ogni task type.

export type ProviderName =
  | "anthropic"
  | "openai"
  | "deepseek"
  | "mistral"
  | "groq"
  | "cerebras"
  | "fireworks";

export type TaskType =
  | "intent_classification"
  | "kb_lookup"
  | "faq"
  | "summary"
  | "italian_natural"
  | "customer_care"
  | "tool_calling_complex"
  | "llama_speed"
  | "reasoning_hard"
  | "reasoning_extra_hard"
  | "code_gen";

export type DataResidency = "any" | "eu_strict";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

export interface RouteSelection {
  provider: ProviderName;
  model: string;
  reason: string;
}

export interface RouterContext {
  task_type: TaskType;
  data_residency?: DataResidency;
  /** Forza un provider specifico (override). */
  force_provider?: ProviderName;
  /** Forza un modello specifico (override completo). */
  force_model?: string;
}

export interface CallLLMInput {
  ctx: RouterContext;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  tools?: unknown[];
  /** Stop sequences (OpenAI-compatible). */
  stop?: string[];
}

export interface CallLLMResult {
  provider: ProviderName;
  model: string;
  content: string;
  tool_calls?: unknown[];
  finish_reason?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  duration_ms: number;
  /** Provider raw response per debug. */
  raw?: unknown;
}

export interface ProviderConfig {
  name: ProviderName;
  /** Base URL OpenAI-compatible (per anthropic ignorato, usa endpoint dedicato). */
  base_url: string;
  /** Env var name dove leggere la API key. */
  env_var: string;
  /** Disponibile in EU strict mode? */
  eu_residency: boolean;
}
