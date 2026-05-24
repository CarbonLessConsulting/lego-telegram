// Brick: llm-usage-interceptor v0.3.0 (le-GO G-Ops)
//
// Parser provider-specific dell'usage da response JSON.

import type { Provider } from "../types.ts";

export interface ParsedUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
}

/**
 * Estrae usage dal JSON response del provider.
 * Provider OpenAI-compatible: data.usage.prompt_tokens / completion_tokens / model
 * Anthropic /v1/messages: data.usage.input_tokens / output_tokens / model
 * Gemini: data.usageMetadata.promptTokenCount / candidatesTokenCount / modelVersion
 */
export function parseUsageFromResponse(
  provider: Provider,
  body: unknown,
  modelFromRequest?: string,
): ParsedUsage {
  if (!body || typeof body !== "object") {
    return { model: modelFromRequest ?? "unknown", input_tokens: 0, output_tokens: 0 };
  }
  const data = body as Record<string, unknown>;

  if (provider === "anthropic") {
    const usage = (data.usage ?? {}) as Record<string, number>;
    return {
      model: (data.model as string) ?? modelFromRequest ?? "unknown",
      input_tokens: Number(usage.input_tokens ?? 0),
      output_tokens: Number(usage.output_tokens ?? 0),
    };
  }

  if (provider === "gemini") {
    const um = (data.usageMetadata ?? {}) as Record<string, number>;
    return {
      model: (data.modelVersion as string) ?? modelFromRequest ?? "unknown",
      input_tokens: Number(um.promptTokenCount ?? 0),
      output_tokens: Number(um.candidatesTokenCount ?? 0),
    };
  }

  // OpenAI-compatible (openai, deepseek, mistral, groq, cerebras, fireworks)
  const usage = (data.usage ?? {}) as Record<string, number>;
  return {
    model: (data.model as string) ?? modelFromRequest ?? "unknown",
    input_tokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
    output_tokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0),
  };
}

/**
 * Estrae il modello dal body REQUEST (per quando la response 4xx/5xx
 * non lo torna).
 */
export function parseModelFromRequest(initBody: unknown): string | undefined {
  if (!initBody) return undefined;
  if (typeof initBody === "string") {
    try {
      const json = JSON.parse(initBody);
      return typeof json.model === "string" ? json.model : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof initBody === "object" && initBody !== null) {
    const m = (initBody as Record<string, unknown>).model;
    return typeof m === "string" ? m : undefined;
  }
  return undefined;
}
