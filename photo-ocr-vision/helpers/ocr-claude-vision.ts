// telegram-photo-ocr-vision — ocr-claude-vision.ts
//
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/claude-vision.ts (ocrImageDetailed)
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/_shared/ai-failover.ts (callClaudeVision)
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Wrapper Anthropic Messages API per OCR via Claude vision.
// Modello default: claude-sonnet-4-5-20250929 (donor GMR).
//
// PRICING UFFICIALE Anthropic Claude 3.5 Sonnet:
//   Input:  $3.00 / 1M token
//   Output: $15.00 / 1M token
//   Immagine (1568x1568 max): ~1.15K token input fissi + testo prompt
//   (rif: https://docs.anthropic.com/en/docs/build-with-claude/vision#image-cost-calculations
//    e https://www.anthropic.com/pricing).
//   Verificato 2026-05-23.
//
// Soft no-throw.

import type { ClaudeOcrResult } from "../types.ts";

const DEFAULT_CLAUDE_VISION_MODEL = "claude-sonnet-4-5-20250929";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** USD per 1M token Claude 3.5 Sonnet (pricing ufficiale 2026-05). */
export const CLAUDE_SONNET_PRICE_INPUT_PER_MTOK = 3.0;
export const CLAUDE_SONNET_PRICE_OUTPUT_PER_MTOK = 15.0;
/**
 * Token approssimati per un'immagine standard (Claude vision).
 * Anthropic: tokens = (width * height) / 750. Per immagine tipica
 * Telegram large (1280x720) → ~1228 token. Approssimazione 1100 in donor
 * gosolution. Manteniamo 1100 come media (l'API ritorna il valore reale
 * comunque in `usage.input_tokens`).
 */
export const CLAUDE_VISION_IMAGE_TOKENS_APPROX = 1100;

export interface OcrClaudeVisionOptions {
  anthropicApiKey: string;
  /** Bytes immagine gia' encodati base64 (no data URI prefix). */
  imageBase64: string;
  /** MIME type (image/jpeg|image/png|image/webp|image/gif|application/pdf). */
  mediaType: string;
  /** Prompt sistema (es. OCR_GENERIC_PROMPT, OCR_VCARD_SYSTEM_PROMPT). */
  systemPrompt: string;
  /** Prompt utente. Se vuoto, usato solo systemPrompt come content. */
  userPrompt?: string;
  /** Override modello (default DEFAULT_CLAUDE_VISION_MODEL). */
  model?: string;
  /** Max output tokens (default 1500). */
  maxTokens?: number;
}

/**
 * Calcola costo USD per una chiamata Claude vision.
 * @param inputTokens token input reali (da response.usage.input_tokens)
 * @param outputTokens token output reali (da response.usage.output_tokens)
 */
export function computeClaudeVisionCostUsd(
  inputTokens: number,
  outputTokens: number,
): number {
  const input = (inputTokens / 1_000_000) * CLAUDE_SONNET_PRICE_INPUT_PER_MTOK;
  const output =
    (outputTokens / 1_000_000) * CLAUDE_SONNET_PRICE_OUTPUT_PER_MTOK;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}

/**
 * Chiama Anthropic Messages API con immagine + prompt. Soft no-throw.
 *
 * Per PDF: Anthropic accetta media_type "application/pdf" come source type
 * "base64" o "url" (Claude Sonnet 4+). Il chiamante passa direttamente i bytes
 * PDF encodati base64 con mediaType "application/pdf".
 */
export async function ocrClaudeVision(
  opts: OcrClaudeVisionOptions,
): Promise<ClaudeOcrResult> {
  const t0 = Date.now();
  const model = opts.model || DEFAULT_CLAUDE_VISION_MODEL;
  const maxTokens = opts.maxTokens ?? 1500;

  if (!opts.anthropicApiKey) {
    return {
      ok: false,
      text: "",
      model,
      input_tokens: 0,
      output_tokens: 0,
      duration_ms: 0,
      cost_usd: 0,
      error: "missing_anthropic_api_key",
    };
  }
  if (!opts.imageBase64) {
    return {
      ok: false,
      text: "",
      model,
      input_tokens: 0,
      output_tokens: 0,
      duration_ms: 0,
      cost_usd: 0,
      error: "missing_image_base64",
    };
  }

  // Anthropic source type: "document" per PDF, "image" per immagine
  const isPdf = opts.mediaType === "application/pdf";
  const contentBlock = isPdf
    ? {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: opts.imageBase64,
        },
      }
    : {
        type: "image",
        source: {
          type: "base64",
          media_type: opts.mediaType,
          data: opts.imageBase64,
        },
      };

  const userText = opts.userPrompt ?? "Estrai il contenuto come richiesto.";

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let resp: Response;
    try {
      resp = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "x-api-key": opts.anthropicApiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: opts.systemPrompt,
          messages: [
            {
              role: "user",
              content: [contentBlock, { type: "text", text: userText }],
            },
          ],
        }),
      });
    } catch (e) {
      lastError = `network_error_attempt_${attempt}: ${String(e)}`;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      continue;
    }

    if (resp.ok) {
      let data: {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      try {
        data = await resp.json();
      } catch (e) {
        return {
          ok: false,
          text: "",
          model,
          input_tokens: 0,
          output_tokens: 0,
          duration_ms: Date.now() - t0,
          cost_usd: 0,
          error: `invalid_json_response: ${String(e)}`,
        };
      }

      const block = (data?.content ?? []).find((c) => c.type === "text");
      const text = typeof block?.text === "string" ? block.text.trim() : "";
      const inputTokens = data?.usage?.input_tokens ?? 0;
      const outputTokens = data?.usage?.output_tokens ?? 0;

      return {
        ok: true,
        text,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        duration_ms: Date.now() - t0,
        cost_usd: computeClaudeVisionCostUsd(inputTokens, outputTokens),
      };
    }

    // Errore HTTP — retry solo su 429/5xx
    let errBody = "";
    try {
      errBody = await resp.text();
    } catch {
      errBody = "<no body>";
    }
    lastError = `http_${resp.status}: ${errBody.slice(0, 200)}`;
    const transient =
      resp.status === 429 ||
      resp.status === 500 ||
      resp.status === 502 ||
      resp.status === 503 ||
      resp.status === 504;
    if (!transient) break;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
  }

  return {
    ok: false,
    text: "",
    model,
    input_tokens: 0,
    output_tokens: 0,
    duration_ms: Date.now() - t0,
    cost_usd: 0,
    error: lastError || "unknown_error",
  };
}

export { DEFAULT_CLAUDE_VISION_MODEL };
