// Brick: llm-usage-interceptor v0.3.0 (le-GO G-Ops)
//
// Pricing table USD per 1M token. Verificato 2026-05-24.
// Aggiornare con cadenza trimestrale.

export interface ModelPrice {
  input_per_mtok: number;
  output_per_mtok: number;
  usd_per_audio_second?: number;
  usd_per_image?: number;
}

export const PRICING: Record<string, ModelPrice> = {
  // Anthropic
  "claude-opus-4-7": { input_per_mtok: 15.0, output_per_mtok: 75.0 },
  "claude-sonnet-4-6": { input_per_mtok: 3.0, output_per_mtok: 15.0 },
  "claude-sonnet-4-5-20250929": { input_per_mtok: 3.0, output_per_mtok: 15.0 },
  "claude-haiku-4-5-20251001": { input_per_mtok: 1.0, output_per_mtok: 5.0 },
  "claude-3-5-sonnet-20241022": { input_per_mtok: 3.0, output_per_mtok: 15.0 },
  "claude-3-haiku-20240307": { input_per_mtok: 0.25, output_per_mtok: 1.25 },

  // OpenAI
  "gpt-4o": { input_per_mtok: 2.5, output_per_mtok: 10.0 },
  "gpt-4o-mini": { input_per_mtok: 0.15, output_per_mtok: 0.6 },
  "gpt-4-turbo": { input_per_mtok: 10.0, output_per_mtok: 30.0 },
  "whisper-1": { input_per_mtok: 0, output_per_mtok: 0, usd_per_audio_second: 0.0001 },
  "text-embedding-3-small": { input_per_mtok: 0.02, output_per_mtok: 0 },
  "text-embedding-3-large": { input_per_mtok: 0.13, output_per_mtok: 0 },
  "text-embedding-ada-002": { input_per_mtok: 0.1, output_per_mtok: 0 },
  "dall-e-3": { input_per_mtok: 0, output_per_mtok: 0, usd_per_image: 0.04 },

  // DeepSeek
  "deepseek-chat": { input_per_mtok: 0.14, output_per_mtok: 0.28 },
  "deepseek-coder": { input_per_mtok: 0.14, output_per_mtok: 0.28 },
  "deepseek-reasoner": { input_per_mtok: 0.55, output_per_mtok: 2.19 },
  "deepseek-v4-flash": { input_per_mtok: 0.14, output_per_mtok: 0.28 },
  "deepseek-v4-pro": { input_per_mtok: 0.9, output_per_mtok: 0.9 },
  "deepseek-v3": { input_per_mtok: 0.14, output_per_mtok: 0.28 },
  "deepseek-v3.2": { input_per_mtok: 0.14, output_per_mtok: 0.28 },

  // Mistral
  "mistral-large-latest": { input_per_mtok: 2.0, output_per_mtok: 6.0 },
  "mistral-small-latest": { input_per_mtok: 0.2, output_per_mtok: 0.6 },
  "mistral-medium-latest": { input_per_mtok: 2.7, output_per_mtok: 8.1 },
  "open-mistral-7b": { input_per_mtok: 0.25, output_per_mtok: 0.25 },
  "open-mixtral-8x7b": { input_per_mtok: 0.7, output_per_mtok: 0.7 },

  // Groq
  "llama-3.3-70b-versatile": { input_per_mtok: 0.59, output_per_mtok: 0.79 },
  "llama-3.1-70b-versatile": { input_per_mtok: 0.59, output_per_mtok: 0.79 },
  "llama-3.1-8b-instant": { input_per_mtok: 0.05, output_per_mtok: 0.08 },
  "mixtral-8x7b-32768": { input_per_mtok: 0.24, output_per_mtok: 0.24 },

  // Cerebras
  "llama3.1-8b": { input_per_mtok: 0.1, output_per_mtok: 0.1 },
  "llama3.1-70b": { input_per_mtok: 0.85, output_per_mtok: 1.2 },
  "qwen-3-235b-a22b-instruct-2507": { input_per_mtok: 0.8, output_per_mtok: 1.2 },
  "gpt-oss-120b": { input_per_mtok: 0.5, output_per_mtok: 0.8 },

  // Fireworks (alcuni esempi - prefisso accounts/fireworks/models/ strippato in lookup)
  "qwen2p5-72b-instruct": { input_per_mtok: 0.88, output_per_mtok: 0.88 },
  "deepseek-v4-pro": { input_per_mtok: 0.9, output_per_mtok: 0.9 },
  "kimi-k2p6": { input_per_mtok: 0.6, output_per_mtok: 0.6 },
  "llama-v3p1-70b-instruct": { input_per_mtok: 0.9, output_per_mtok: 0.9 },

  // Google Gemini
  "gemini-2.0-flash": { input_per_mtok: 0.1, output_per_mtok: 0.4 },
  "gemini-1.5-pro": { input_per_mtok: 1.25, output_per_mtok: 5.0 },
  "gemini-1.5-flash": { input_per_mtok: 0.075, output_per_mtok: 0.3 },
};

/**
 * Lookup pricing. Per Fireworks (account/path) strippa prefisso.
 * Per modello sconosciuto ritorna undefined.
 */
export function getPricing(model: string): ModelPrice | undefined {
  if (PRICING[model]) return PRICING[model];
  // Fireworks: accounts/fireworks/models/X -> X
  const fireworksMatch = model.match(/\/([^/]+)$/);
  if (fireworksMatch && PRICING[fireworksMatch[1]]) {
    return PRICING[fireworksMatch[1]];
  }
  return undefined;
}

/**
 * Computa cost USD da usage.
 */
export function computeCostUsd(
  pricing: ModelPrice,
  inputTokens: number,
  outputTokens: number,
  audioSeconds = 0,
  imagesCount = 0,
): number {
  let cost = 0;
  cost += (inputTokens / 1_000_000) * pricing.input_per_mtok;
  cost += (outputTokens / 1_000_000) * pricing.output_per_mtok;
  if (audioSeconds && pricing.usd_per_audio_second) {
    cost += audioSeconds * pricing.usd_per_audio_second;
  }
  if (imagesCount && pricing.usd_per_image) {
    cost += imagesCount * pricing.usd_per_image;
  }
  return Math.round(cost * 100_000_000) / 100_000_000; // 8 decimali
}
