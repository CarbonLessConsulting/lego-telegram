// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/usage-meter.ts (PRICING)
// Brick: telegram-cost-meter-per-model v0.1.0 (le-GO G-Ops)
//
// Pricing table canonical USD per 1M tokens. Fonti: docs ufficiali Anthropic + OpenAI.
// ⚠️ NON inventare prezzi — se aggiungi modelli verifica `source_url` + aggiorna `verified_at`.
// ⚠️ Whisper: USD/secondo audio (calcolato separatamente).

import type { ModelPricing } from '../types';

/**
 * Whisper costo per secondo audio: $0.0001/sec = $0.006/min = $6/1000min.
 * Fonte: https://openai.com/api/pricing/
 */
export const WHISPER_USD_PER_AUDIO_SECOND = 0.0001;

export const PRICING: Record<string, ModelPricing> = {
  // ─── Anthropic Claude 4.x ─────────────────────────────────────────────────
  'claude-opus-4-7': {
    model: 'claude-opus-4-7',
    provider: 'anthropic',
    input_per_mtok: 15.0,
    output_per_mtok: 75.0,
    source_url: 'https://docs.anthropic.com/en/docs/about-claude/models',
    verified_at: '2026-05-23',
  },
  'claude-sonnet-4-6': {
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    input_per_mtok: 3.0,
    output_per_mtok: 15.0,
    source_url: 'https://docs.anthropic.com/en/docs/about-claude/models',
    verified_at: '2026-05-23',
  },
  'claude-sonnet-4-5-20250929': {
    model: 'claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    input_per_mtok: 3.0,
    output_per_mtok: 15.0,
    source_url: 'https://www.anthropic.com/pricing#anthropic-api',
    verified_at: '2026-05-23',
    note: 'Donor goref baseline (era usage-meter PRICING).',
  },
  'claude-haiku-4-5-20251001': {
    model: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    input_per_mtok: 1.0,
    output_per_mtok: 5.0,
    source_url: 'https://docs.anthropic.com/en/docs/about-claude/models',
    verified_at: '2026-05-23',
    note: 'Donor goref usage-meter usa $1/$5 — alignato qui per consistency con telegram bot.',
  },

  // ─── Anthropic Claude 3.5 (legacy) ────────────────────────────────────────
  'claude-3-5-sonnet-20241022': {
    model: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    input_per_mtok: 3.0,
    output_per_mtok: 15.0,
    source_url: 'https://www.anthropic.com/pricing#anthropic-api',
    verified_at: '2026-05-23',
    note: 'Legacy 3.5: stessi prezzi 4-6.',
  },

  // ─── OpenAI GPT-4o ────────────────────────────────────────────────────────
  'gpt-4o': {
    model: 'gpt-4o',
    provider: 'openai',
    input_per_mtok: 2.5,
    output_per_mtok: 10.0,
    source_url: 'https://openai.com/api/pricing/',
    verified_at: '2026-05-23',
  },
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    provider: 'openai',
    input_per_mtok: 0.15,
    output_per_mtok: 0.6,
    source_url: 'https://openai.com/api/pricing/',
    verified_at: '2026-05-23',
  },

  // ─── OpenAI Whisper (audio) ───────────────────────────────────────────────
  'whisper-1': {
    model: 'whisper-1',
    provider: 'whisper',
    input_per_mtok: 0,
    output_per_mtok: 0,
    usd_per_audio_second: WHISPER_USD_PER_AUDIO_SECOND,
    source_url: 'https://openai.com/api/pricing/',
    verified_at: '2026-05-23',
    note: 'Costo per secondo audio, NON per token. Vedi WHISPER_USD_PER_AUDIO_SECOND.',
  },

  // ─── OpenAI Embeddings ────────────────────────────────────────────────────
  'text-embedding-3-small': {
    model: 'text-embedding-3-small',
    provider: 'openai',
    input_per_mtok: 0.02,
    output_per_mtok: 0,
    source_url: 'https://openai.com/api/pricing/',
    verified_at: '2026-05-23',
    note: 'Embeddings: solo input cost, no output.',
  },
  'text-embedding-3-large': {
    model: 'text-embedding-3-large',
    provider: 'openai',
    input_per_mtok: 0.13,
    output_per_mtok: 0,
    source_url: 'https://openai.com/api/pricing/',
    verified_at: '2026-05-23',
    note: 'Embeddings: solo input cost, no output.',
  },

  // ─── Google Gemini (per donor parity) ─────────────────────────────────────
  'gemini-2.0-flash': {
    model: 'gemini-2.0-flash',
    provider: 'gemini',
    input_per_mtok: 0.1,
    output_per_mtok: 0.4,
    source_url: 'https://ai.google.dev/pricing',
    verified_at: '2026-05-23',
    note: 'Da donor goref usage-meter PRICING.',
  },
};

/**
 * Modello sconosciuto: ritorna undefined. Il chiamante decide se loggare
 * cost=0 + warning (default goref) o usare un fallback baseline.
 */
export function getPricing(model: string): ModelPricing | undefined {
  return PRICING[model];
}

export function listSupportedModels(): string[] {
  return Object.keys(PRICING);
}
