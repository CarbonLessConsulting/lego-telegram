// Brick: llm-usage-interceptor v0.3.0 (le-GO G-Ops)
//
// Auto-detect provider da URL endpoint.

import type { Provider } from "../types.ts";

export function detectProvider(url: string | URL): Provider {
  const u = typeof url === "string" ? url : url.toString();
  if (u.includes("api.anthropic.com")) return "anthropic";
  if (u.includes("api.openai.com")) return "openai";
  if (u.includes("api.deepseek.com")) return "deepseek";
  if (u.includes("api.mistral.ai")) return "mistral";
  if (u.includes("api.groq.com")) return "groq";
  if (u.includes("api.cerebras.ai")) return "cerebras";
  if (u.includes("api.fireworks.ai")) return "fireworks";
  if (u.includes("generativelanguage.googleapis.com")) return "gemini";
  return "unknown";
}

/**
 * Indica se l'endpoint è audio (Whisper-like). Cost si calcola con
 * audio_seconds, non token.
 */
export function isAudioEndpoint(url: string | URL): boolean {
  const u = typeof url === "string" ? url : url.toString();
  return u.includes("/audio/transcriptions") || u.includes("/audio/translations");
}

/** Indica se l'endpoint è embeddings (no output tokens). */
export function isEmbeddingsEndpoint(url: string | URL): boolean {
  const u = typeof url === "string" ? url : url.toString();
  return u.includes("/embeddings");
}

/** Indica se l'endpoint è image generation (no usage in response). */
export function isImageGenEndpoint(url: string | URL): boolean {
  const u = typeof url === "string" ? url : url.toString();
  return u.includes("/images/generations") || u.includes("/images/edits");
}
