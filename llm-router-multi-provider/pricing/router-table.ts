// Brick: llm-router-multi-provider v0.2.0 (le-GO B-Sofia-Core)
//
// Mapping task_type -> ordered candidate list (provider, model).
// Primo candidate = preferito. Fallback automatico sui successivi
// se il primario fallisce (down, rate-limit, error).
//
// Prezzi e modelli verificati 2026-05-24. Aggiornare con cadenza trimestrale.

import type { ProviderConfig, ProviderName, TaskType } from "../types.ts";

export const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  anthropic: {
    name: "anthropic",
    base_url: "https://api.anthropic.com/v1",
    env_var: "ANTHROPIC_API_KEY",
    eu_residency: false, // US-based (Bedrock EU disponibile come variante futura)
  },
  openai: {
    name: "openai",
    base_url: "https://api.openai.com/v1",
    env_var: "OPENAI_API_KEY",
    eu_residency: false,
  },
  deepseek: {
    name: "deepseek",
    base_url: "https://api.deepseek.com/v1",
    env_var: "DEEPSEEK_API_KEY",
    eu_residency: false, // China-based
  },
  mistral: {
    name: "mistral",
    base_url: "https://api.mistral.ai/v1",
    env_var: "MISTRAL_API_KEY",
    eu_residency: true, // France-based, GDPR-native
  },
  groq: {
    name: "groq",
    base_url: "https://api.groq.com/openai/v1",
    env_var: "GROQ_API_KEY",
    eu_residency: false, // US-based
  },
  cerebras: {
    name: "cerebras",
    base_url: "https://api.cerebras.ai/v1",
    env_var: "CEREBRAS_API_KEY",
    eu_residency: false, // US-based
  },
  fireworks: {
    name: "fireworks",
    base_url: "https://api.fireworks.ai/inference/v1",
    env_var: "FIREWORKS_API_KEY",
    eu_residency: false,
  },
};

export interface Candidate {
  provider: ProviderName;
  model: string;
  /** Costo orientativo USD per 1M tok output (per ranking secondario). */
  cost_signal: number;
  /** Note di scelta (per debug). */
  note: string;
}

/**
 * Routing table: per ogni task_type lista ordinata di candidati.
 * Primo = preferito. Successivi = fallback in ordine di preferenza.
 */
export const ROUTING_TABLE: Record<TaskType, Candidate[]> = {
  intent_classification: [
    { provider: "groq", model: "llama-3.3-70b-versatile", cost_signal: 0.79, note: "Groq fastest 1500+ tok/s" },
    { provider: "cerebras", model: "llama3.1-8b", cost_signal: 0.10, note: "Cerebras small ultra-fast" },
    { provider: "deepseek", model: "deepseek-chat", cost_signal: 0.28, note: "DeepSeek economico fallback" },
  ],
  kb_lookup: [
    { provider: "deepseek", model: "deepseek-chat", cost_signal: 0.28, note: "DeepSeek cheap default" },
    { provider: "groq", model: "llama-3.3-70b-versatile", cost_signal: 0.79, note: "Groq fast fallback" },
    { provider: "mistral", model: "mistral-small-latest", cost_signal: 0.30, note: "Mistral small EU fallback" },
  ],
  faq: [
    { provider: "deepseek", model: "deepseek-chat", cost_signal: 0.28, note: "DeepSeek cheap default" },
    { provider: "groq", model: "llama-3.3-70b-versatile", cost_signal: 0.79, note: "Groq fast fallback" },
    { provider: "mistral", model: "mistral-small-latest", cost_signal: 0.30, note: "Mistral small EU fallback" },
  ],
  summary: [
    { provider: "deepseek", model: "deepseek-chat", cost_signal: 0.28, note: "DeepSeek summary cheap" },
    { provider: "groq", model: "llama-3.3-70b-versatile", cost_signal: 0.79, note: "Groq fast fallback" },
  ],
  italian_natural: [
    { provider: "mistral", model: "mistral-large-latest", cost_signal: 6.0, note: "Mistral Large EU sovereign" },
    { provider: "anthropic", model: "claude-sonnet-4-6", cost_signal: 15.0, note: "Claude Sonnet quality" },
    { provider: "openai", model: "gpt-4o", cost_signal: 10.0, note: "GPT-4o quality" },
  ],
  customer_care: [
    { provider: "mistral", model: "mistral-large-latest", cost_signal: 6.0, note: "Mistral Large EU sovereign" },
    { provider: "anthropic", model: "claude-sonnet-4-6", cost_signal: 15.0, note: "Claude Sonnet quality" },
    { provider: "openai", model: "gpt-4o", cost_signal: 10.0, note: "GPT-4o quality" },
  ],
  tool_calling_complex: [
    { provider: "fireworks", model: "accounts/fireworks/models/deepseek-v4-pro", cost_signal: 0.90, note: "DeepSeek V4 Pro on Fireworks tool calling" },
    { provider: "anthropic", model: "claude-sonnet-4-6", cost_signal: 15.0, note: "Claude Sonnet tool master" },
    { provider: "openai", model: "gpt-4o", cost_signal: 10.0, note: "GPT-4o tool calling" },
  ],
  llama_speed: [
    { provider: "cerebras", model: "qwen-3-235b-a22b-instruct-2507", cost_signal: 1.20, note: "Cerebras Qwen 235B flagship fast" },
    { provider: "groq", model: "llama-3.3-70b-versatile", cost_signal: 0.79, note: "Groq fast llama" },
    { provider: "cerebras", model: "llama3.1-8b", cost_signal: 0.10, note: "Cerebras llama 8B ultra-fast fallback" },
  ],
  reasoning_hard: [
    { provider: "anthropic", model: "claude-sonnet-4-6", cost_signal: 15.0, note: "Claude Sonnet reasoning" },
    { provider: "openai", model: "gpt-4o", cost_signal: 10.0, note: "GPT-4o reasoning fallback" },
    { provider: "mistral", model: "mistral-large-latest", cost_signal: 6.0, note: "Mistral large EU fallback" },
  ],
  reasoning_extra_hard: [
    { provider: "anthropic", model: "claude-opus-4-7", cost_signal: 75.0, note: "Opus deep reasoning" },
    { provider: "anthropic", model: "claude-sonnet-4-6", cost_signal: 15.0, note: "Sonnet fallback" },
    { provider: "openai", model: "gpt-4o", cost_signal: 10.0, note: "GPT-4o fallback" },
  ],
  code_gen: [
    { provider: "deepseek", model: "deepseek-chat", cost_signal: 0.28, note: "DeepSeek coder cheap" },
    { provider: "anthropic", model: "claude-sonnet-4-6", cost_signal: 15.0, note: "Claude code fallback" },
    { provider: "openai", model: "gpt-4o", cost_signal: 10.0, note: "GPT-4o code fallback" },
  ],
};
