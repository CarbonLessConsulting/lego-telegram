// telegram-voice-capture-whisper — entry point.
//
// Brick le-GO v0.1.0 — categoria E-Media
// Payoff GOCOTECH: "Piu' performance. Meno impatto."
//
// Pipeline canonica:
//   Telegram voice message → getFile/download → Whisper transcribe → audit log
//
// Donor primary: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-capture-voice/index.ts
// Donor primary helpers: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/whisper.ts
// Donor primary helpers: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts
//
// USO TIPICO:
// ```ts
// import { captureVoice } from "../_bricks/telegram-voice-capture-whisper/index.ts";
//
// const result = await captureVoice(update.message.voice, {
//   botToken: Deno.env.get("TELEGRAM_BOT_TOKEN")!,
//   openaiApiKey: Deno.env.get("OPENAI_API_KEY")!,
//   maxDurationSeconds: 60,
//   languageHint: "it",
//   auditCallback: async (entry) => {
//     await sb.from("usage_log").insert({ ...entry, tenant_id, user_id });
//   },
// });
//
// if (!result.ok) {
//   await sendMessageSoft(chatId, `Non sono riuscito a trascrivere: ${result.reason}`);
//   return;
// }
// console.log(result.transcription, result.cost_usd);
// ```

import { downloadVoice } from "./helpers/download-voice.ts";
import {
  transcribeWhisper,
  looksLikeHallucination,
  computeWhisperCostUsd,
  WHISPER_MODEL,
} from "./helpers/transcribe-whisper.ts";
import { normalizeLanguage } from "./helpers/language-detect.ts";
import { persistAudit, buildAuditEntry } from "./helpers/persist-audit.ts";
import type {
  TelegramVoice,
  VoiceCaptureConfig,
  VoiceCaptureResult,
} from "./types.ts";

/**
 * Cattura + trascrizione voice message Telegram.
 * Soft no-throw: ritorna sempre VoiceCaptureResult (ok | reason).
 *
 * @param voice Oggetto voice da Telegram update.message.voice
 * @param config Configurazione (token, key, durata max, audit callback)
 */
export async function captureVoice(
  voice: TelegramVoice,
  config: VoiceCaptureConfig,
): Promise<VoiceCaptureResult> {
  const t0 = Date.now();

  // 1. Validazione config minimale (soft → no throw)
  if (!config.botToken || !config.openaiApiKey) {
    return {
      ok: false,
      reason: "invalid_config",
      detail: !config.botToken ? "missing_bot_token" : "missing_openai_api_key",
    };
  }

  const declaredDuration = Math.max(0, Math.round(voice.duration ?? 0));

  // 2. Enforcing durata max (cost guard + abuse prevention)
  const maxDuration = config.maxDurationSeconds ?? 60;
  if (maxDuration > 0 && declaredDuration > maxDuration) {
    return {
      ok: false,
      reason: "duration_exceeded",
      detail: `audio ${declaredDuration}s > max ${maxDuration}s`,
      duration_seconds: declaredDuration,
    };
  }

  // 3. Download binary da Telegram
  const dl = await downloadVoice(config.botToken, voice.file_id);
  if (!dl.ok || !dl.bytes) {
    return {
      ok: false,
      reason: "download_failed",
      detail: dl.error,
      duration_seconds: declaredDuration,
    };
  }

  // 4. Trascrizione Whisper (con retry interno + cost calc)
  const transcription = await transcribeWhisper(dl.bytes, {
    openaiApiKey: config.openaiApiKey,
    language: config.languageHint,
    mimeType: dl.contentType ?? voice.mime_type ?? "audio/ogg",
    filename: dl.filePath?.split("/").pop() ?? "audio.ogg",
    prompt: config.whisperPrompt,
    durationSecondsHint: declaredDuration,
  });

  if (!transcription.ok) {
    return {
      ok: false,
      reason: "transcription_failed",
      detail: transcription.error,
      duration_seconds: declaredDuration,
    };
  }

  // 5. Filtro hallucination (audio troppo brevi/silenziosi → Whisper inventa)
  const cleanText = (transcription.text ?? "").trim();
  if (!cleanText || looksLikeHallucination(cleanText)) {
    // Audit anche le hallucination (cost reale comunque sostenuto)
    void persistAudit(
      buildAuditEntry({
        durationSeconds: transcription.duration_seconds,
        language: normalizeLanguage(transcription.language),
        costUsd: transcription.cost_usd,
        transcriptionLength: 0,
        bytesDownloaded: dl.bytes.byteLength,
        whisperModel: transcription.model,
        durationMs: Date.now() - t0,
      }),
      {
        callback: config.auditCallback,
        enabled: config.persistAuditLog !== false,
      },
    );

    return {
      ok: false,
      reason: "empty_transcription",
      detail: cleanText ? "hallucination_detected" : "empty",
      duration_seconds: transcription.duration_seconds,
    };
  }

  const language = normalizeLanguage(transcription.language);
  const finalCost = computeWhisperCostUsd(transcription.duration_seconds);

  // 6. Audit log (privacy-safe: NIENTE testo trascritto)
  void persistAudit(
    buildAuditEntry({
      durationSeconds: transcription.duration_seconds,
      language,
      costUsd: finalCost,
      transcriptionLength: cleanText.length,
      bytesDownloaded: dl.bytes.byteLength,
      whisperModel: transcription.model,
      durationMs: Date.now() - t0,
    }),
    {
      callback: config.auditCallback,
      enabled: config.persistAuditLog !== false,
    },
  );

  return {
    ok: true,
    transcription: cleanText,
    language,
    duration_seconds: transcription.duration_seconds,
    cost_usd: finalCost,
    bytes_downloaded: dl.bytes.byteLength,
    whisper_model: transcription.model,
    duration_ms: Date.now() - t0,
  };
}

// Re-export helpers per consumer avanzati
export { downloadVoice } from "./helpers/download-voice.ts";
export {
  transcribeWhisper,
  looksLikeHallucination,
  computeWhisperCostUsd,
  WHISPER_MODEL,
} from "./helpers/transcribe-whisper.ts";
export { normalizeLanguage, isAllowedLanguage } from "./helpers/language-detect.ts";
export { persistAudit, buildAuditEntry } from "./helpers/persist-audit.ts";

export type {
  TelegramVoice,
  VoiceCaptureConfig,
  VoiceCaptureResult,
  VoiceAuditEntry,
  WhisperTranscriptionResult,
  VoiceDownloadResult,
} from "./types.ts";
