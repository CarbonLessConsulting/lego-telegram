// telegram-photo-ocr-vision — entry point.
//
// Brick le-GO v0.1.0 — categoria E-Media
// Payoff GOCOTECH: "Piu' performance. Meno impatto."
//
// Pipeline canonica:
//   Telegram photo|document → getFile/download → base64 chunked encode
//   → Claude vision OCR (con prompt template) → parse JSON (opt) → audit log
//
// Donor primary: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-capture-photo/index.ts
// Donor primary helpers: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/claude-vision.ts
// Donor secondary: ~/Sviluppo/erp/gosolution/supabase/functions/ocr-* (5 OCR specializzati GOMec)
//
// USO TIPICO:
// ```ts
// import { captureOcr } from "../_bricks/telegram-photo-ocr-vision/index.ts";
//
// // 1. Photo (biglietto da visita, foto generica)
// const result = await captureOcr({
//   kind: "photo",
//   photos: update.message.photo!,
// }, {
//   botToken: Deno.env.get("TELEGRAM_BOT_TOKEN")!,
//   anthropicApiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
//   template: "vcard",
//   auditCallback: (entry) => sb.from("usage_log").insert({ tenant_id, ...entry }),
// });
//
// // 2. Document (PDF garanzia, file allegato)
// const result = await captureOcr({
//   kind: "document",
//   document: update.message.document!,
// }, {
//   botToken,
//   anthropicApiKey,
//   template: "identity-document",
// });
//
// if (!result.ok) {
//   await sendMessageSoft(chatId, "Non sono riuscito a leggere il file.");
//   return;
// }
//
// console.log(result.extracted_text);   // sempre presente
// console.log(result.structured);        // solo per template strutturati
// console.log(result.cost_usd);          // costo USD reale
// ```

import { downloadPhoto, pickBestPhotoSize } from "./helpers/download-photo.ts";
import {
  downloadDocument,
  isSupportedDocumentMime,
} from "./helpers/download-document.ts";
import {
  encodeBase64Chunked,
  bytesToKb,
  estimateBase64Size,
} from "./helpers/encode-base64-chunked.ts";
import {
  ocrWithTemplate,
  parseJsonFromText,
  SUPPORTED_TEMPLATES,
} from "./helpers/ocr-with-template.ts";
import {
  ocrClaudeVision,
  computeClaudeVisionCostUsd,
  DEFAULT_CLAUDE_VISION_MODEL,
  CLAUDE_SONNET_PRICE_INPUT_PER_MTOK,
  CLAUDE_SONNET_PRICE_OUTPUT_PER_MTOK,
  CLAUDE_VISION_IMAGE_TOKENS_APPROX,
} from "./helpers/ocr-claude-vision.ts";
import { persistAudit, buildAuditEntry } from "./helpers/persist-audit.ts";
import type {
  OcrCaptureConfig,
  OcrCaptureResult,
  TelegramPhotoSize,
  TelegramDocument,
} from "./types.ts";

/**
 * Discriminated union: o photo[] da Telegram (array) o document singolo.
 */
export type OcrInput =
  | { kind: "photo"; photos: TelegramPhotoSize[] }
  | { kind: "document"; document: TelegramDocument };

/**
 * Pipeline end-to-end: download da Telegram → OCR via Claude → audit.
 * Soft no-throw.
 */
export async function captureOcr(
  input: OcrInput,
  config: OcrCaptureConfig,
): Promise<OcrCaptureResult> {
  const t0 = Date.now();

  // 1. Validazione config
  if (!config.botToken || !config.anthropicApiKey) {
    return {
      ok: false,
      reason: "invalid_config",
      detail: !config.botToken ? "missing_bot_token" : "missing_anthropic_api_key",
    };
  }

  const template = config.template ?? "generic";
  const maxFileKb = config.maxFileKb ?? 20_480; // 20 MB

  // 2. Download
  let bytes: Uint8Array;
  let mediaType: string;
  if (input.kind === "photo") {
    const dl = await downloadPhoto(config.botToken, input.photos);
    if (!dl.ok || !dl.bytes) {
      return {
        ok: false,
        reason: "download_failed",
        detail: dl.error,
      };
    }
    bytes = dl.bytes;
    mediaType = dl.contentType ?? "image/jpeg";
  } else {
    if (!isSupportedDocumentMime(input.document.mime_type)) {
      return {
        ok: false,
        reason: "unsupported_format",
        detail: `mime: ${input.document.mime_type ?? "<undefined>"}`,
      };
    }
    const dl = await downloadDocument(config.botToken, input.document);
    if (!dl.ok || !dl.bytes) {
      return {
        ok: false,
        reason: "download_failed",
        detail: dl.error,
      };
    }
    bytes = dl.bytes;
    mediaType = dl.contentType ?? input.document.mime_type ?? "application/octet-stream";
  }

  const fileSizeKb = bytesToKb(bytes);

  // 3. Size guard
  if (fileSizeKb > maxFileKb) {
    return {
      ok: false,
      reason: "file_too_large",
      detail: `${fileSizeKb}KB > ${maxFileKb}KB limit`,
      file_size_kb: fileSizeKb,
    };
  }

  // 4. Base64 encoding (CHUNKED — lezione globale #11)
  const imageBase64 = encodeBase64Chunked(bytes);

  // 5. OCR via Claude vision (con template prompt)
  const ocr = await ocrWithTemplate({
    anthropicApiKey: config.anthropicApiKey,
    imageBase64,
    mediaType,
    template,
    model: config.claudeModel,
    maxTokens: config.maxTokens,
  });

  if (!ocr.ok) {
    return {
      ok: false,
      reason: "ocr_failed",
      detail: ocr.error,
      file_size_kb: fileSizeKb,
    };
  }

  const extractedText = ocr.text;
  const extractedChars = extractedText.length;

  // 6. Parse strutturato (se template lo supporta + config.parseStructured)
  const parseStructured = config.parseStructured !== false;
  let structured: Record<string, unknown> | undefined;
  let parseFailed = false;

  if (parseStructured && ocr.isStructured) {
    structured = ocr.structured;
    parseFailed = !!ocr.parseFailed;
    if (parseFailed) {
      // Fail-soft: ritorniamo comunque il testo raw, segnalando il parse fail
      // tramite reason 'json_parse_failed' SOLO se l'utente vuole structured
      // strict (default: ritorniamo ok comunque, structured undefined).
    }
  }

  // 7. Audit log
  void persistAudit(
    buildAuditEntry({
      template,
      fileSizeKb,
      extractedChars,
      costUsd: ocr.cost_usd,
      claudeModel: ocr.model,
      inputTokens: ocr.input_tokens,
      outputTokens: ocr.output_tokens,
      durationMs: Date.now() - t0,
    }),
    {
      callback: config.auditCallback,
      enabled: config.persistAuditLog !== false,
    },
  );

  return {
    ok: true,
    template,
    extracted_text: extractedText,
    structured,
    extracted_chars: extractedChars,
    file_size_kb: fileSizeKb,
    cost_usd: ocr.cost_usd,
    claude_model: ocr.model,
    input_tokens: ocr.input_tokens,
    output_tokens: ocr.output_tokens,
    duration_ms: Date.now() - t0,
  };
}

// Re-export helpers per consumer avanzati
export { downloadPhoto, pickBestPhotoSize } from "./helpers/download-photo.ts";
export {
  downloadDocument,
  isSupportedDocumentMime,
} from "./helpers/download-document.ts";
export {
  encodeBase64Chunked,
  bytesToKb,
  estimateBase64Size,
} from "./helpers/encode-base64-chunked.ts";
export {
  ocrClaudeVision,
  computeClaudeVisionCostUsd,
  DEFAULT_CLAUDE_VISION_MODEL,
  CLAUDE_SONNET_PRICE_INPUT_PER_MTOK,
  CLAUDE_SONNET_PRICE_OUTPUT_PER_MTOK,
  CLAUDE_VISION_IMAGE_TOKENS_APPROX,
} from "./helpers/ocr-claude-vision.ts";
export {
  ocrWithTemplate,
  parseJsonFromText,
  SUPPORTED_TEMPLATES,
} from "./helpers/ocr-with-template.ts";
export { persistAudit, buildAuditEntry } from "./helpers/persist-audit.ts";

// Re-export prompts (per consumer custom)
export { OCR_GENERIC_PROMPT } from "./prompts/ocr-generic.ts";
export {
  OCR_VCARD_SYSTEM_PROMPT,
  OCR_VCARD_USER_PROMPT,
} from "./prompts/ocr-vcard.ts";
export {
  OCR_IDENTITY_SYSTEM_PROMPT,
  OCR_IDENTITY_USER_PROMPT,
} from "./prompts/ocr-identity-document.ts";
export {
  OCR_LIBRETTO_SYSTEM_PROMPT,
  OCR_LIBRETTO_USER_PROMPT,
} from "./prompts/ocr-libretto-veicolo.ts";
export {
  OCR_ODOMETER_SYSTEM_PROMPT,
  OCR_ODOMETER_USER_PROMPT,
} from "./prompts/ocr-odometer.ts";
export {
  OCR_OBD_SYSTEM_PROMPT,
  OCR_OBD_USER_PROMPT,
} from "./prompts/ocr-obd.ts";
export {
  OCR_GAS_ANALYZER_SYSTEM_PROMPT,
  OCR_GAS_ANALYZER_USER_PROMPT,
} from "./prompts/ocr-gas-analyzer.ts";

export type {
  TelegramPhotoSize,
  TelegramDocument,
  OcrTemplate,
  OcrCaptureConfig,
  OcrCaptureResult,
  OcrAuditEntry,
  MediaDownloadResult,
  ClaudeOcrResult,
} from "./types.ts";
