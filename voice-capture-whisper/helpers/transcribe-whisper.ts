// telegram-voice-capture-whisper — transcribe-whisper.ts
//
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/whisper.ts
// Brick: telegram-voice-capture-whisper v0.1.0 (le-GO E-Media)
//
// Trascrive audio bytes via OpenAI Whisper API (model "whisper-1").
//
// PRICING UFFICIALE OpenAI (rif: https://openai.com/pricing — sezione "Audio models"):
//   whisper-1: $0.006 per minuto di audio (billing arrotondato al secondo).
//   Aggiornato: 2026-05-23. Verificare periodicamente.
//
// Soft no-throw: ritorna { ok: false, error } su 4xx/5xx Whisper, network error,
// missing key. NIENTE throw → la edge fn chiamante non muore a metà.

import type { WhisperTranscriptionResult } from "../types.ts";

const WHISPER_MODEL = "whisper-1";
/** USD per minuto audio (pricing ufficiale OpenAI 2026-05). */
const WHISPER_PRICE_USD_PER_MINUTE = 0.006;
const OPENAI_API_URL = "https://api.openai.com/v1/audio/transcriptions";

/**
 * Pattern noti di hallucination Whisper (donor: GMR whisper.ts).
 * Su audio troppo brevi/silenziosi/ambigui Whisper restituisce frasi viste in
 * training (closing card di video Amara, "thank you for watching", ecc.).
 */
const HALLUCINATION_PATTERNS: RegExp[] = [
  /amara\s*\.\s*org/i,
  /\bsottotitoli\b[\s\S]{0,80}\b(amara|comunit[àa]|creati|sincronizzati)\b/i,
  /^\s*sottotitoli\b/i,
  /^\s*subtitles\b/i,
  /^\s*\[?\s*m[uú]sic[ao]?\s*\]?\s*$/i,
  /^\s*\[?\s*music\s*\]?\s*$/i,
  /^\s*thank you for (watching|so much|the)/i,
  /^\s*untertitel/i,
  /^\s*sous-titres/i,
];

/** True se il testo ha pattern di hallucination → trattare come trascrizione vuota. */
export function looksLikeHallucination(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 10) return true;
  return HALLUCINATION_PATTERNS.some((re) => re.test(t));
}

/**
 * Calcola costo USD di una trascrizione Whisper.
 * @param durationSeconds Durata audio in secondi (da Telegram voice.duration o
 *                        da Whisper response.duration come fallback).
 */
export function computeWhisperCostUsd(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  const minutes = durationSeconds / 60;
  // 6 decimali (cent di centesimo) per evitare arrotondamenti aggressivi su clip brevi
  return Math.round(minutes * WHISPER_PRICE_USD_PER_MINUTE * 1_000_000) / 1_000_000;
}

export interface TranscribeOptions {
  openaiApiKey: string;
  /** Hint lingua ISO-639-1 (es. "it"). Se omesso, auto-detect. */
  language?: string;
  /** MIME type da spedire a Whisper (default "audio/ogg" — formato Telegram). */
  mimeType?: string;
  /** Nome file da spedire (default "audio.ogg"). Whisper ignora ma serve a multipart. */
  filename?: string;
  /**
   * Prompt context Whisper (anti-hallucination + lessico custom).
   * Default: stringa vuota.
   */
  prompt?: string;
  /**
   * Durata audio in secondi (preferibilmente da Telegram voice.duration).
   * Usata per cost calc + fallback su `response.duration`.
   */
  durationSecondsHint?: number;
}

/**
 * Trascrive audioBytes via Whisper-1.
 * Retry interno: 2 retry su 429/5xx con backoff 400ms/1200ms.
 */
export async function transcribeWhisper(
  audioBytes: Uint8Array,
  opts: TranscribeOptions,
): Promise<WhisperTranscriptionResult> {
  const t0 = Date.now();

  if (!opts.openaiApiKey) {
    return {
      ok: false,
      text: "",
      language: "unknown",
      duration_seconds: opts.durationSecondsHint ?? 0,
      duration_ms: 0,
      model: WHISPER_MODEL,
      cost_usd: 0,
      error: "missing_openai_api_key",
    };
  }

  const mimeType = opts.mimeType ?? "audio/ogg";
  const filename = opts.filename ?? "audio.ogg";

  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    // FormData ricreata ad ogni tentativo (i Blob possono essere già letti).
    const fd = new FormData();
    const blob = new Blob([new Uint8Array(audioBytes).buffer as ArrayBuffer], { type: mimeType });
    fd.append("file", blob, filename);
    fd.append("model", WHISPER_MODEL);
    fd.append("response_format", "verbose_json");
    fd.append("temperature", "0");
    if (opts.prompt) fd.append("prompt", opts.prompt);
    if (opts.language) fd.append("language", opts.language);

    let resp: Response;
    try {
      resp = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.openaiApiKey}` },
        body: fd,
      });
    } catch (e) {
      lastError = `network_error_attempt_${attempt}: ${String(e)}`;
      await backoff(attempt);
      continue;
    }

    if (resp.ok) {
      let data: { text?: string; language?: string; duration?: number };
      try {
        data = await resp.json();
      } catch (e) {
        return {
          ok: false,
          text: "",
          language: "unknown",
          duration_seconds: opts.durationSecondsHint ?? 0,
          duration_ms: Date.now() - t0,
          model: WHISPER_MODEL,
          cost_usd: 0,
          error: `invalid_json_response: ${String(e)}`,
        };
      }

      const durationFromApi = Number(data.duration ?? 0);
      const durationSeconds =
        durationFromApi > 0 ? durationFromApi : opts.durationSecondsHint ?? 0;

      return {
        ok: true,
        text: data.text ?? "",
        language: data.language ?? "unknown",
        duration_seconds: durationSeconds,
        duration_ms: Date.now() - t0,
        model: WHISPER_MODEL,
        cost_usd: computeWhisperCostUsd(durationSeconds),
      };
    }

    // Errore HTTP
    let errBody = "";
    try {
      errBody = await resp.text();
    } catch {
      errBody = "<no body>";
    }
    lastError = `http_${resp.status}: ${errBody.slice(0, 200)}`;

    // Retry solo su transient
    const transient =
      resp.status === 429 ||
      resp.status === 500 ||
      resp.status === 502 ||
      resp.status === 503 ||
      resp.status === 504;
    if (!transient) break;
    await backoff(attempt);
  }

  return {
    ok: false,
    text: "",
    language: "unknown",
    duration_seconds: opts.durationSecondsHint ?? 0,
    duration_ms: Date.now() - t0,
    model: WHISPER_MODEL,
    cost_usd: 0,
    error: lastError || "unknown_error",
  };
}

async function backoff(attempt: number): Promise<void> {
  const ms = attempt === 0 ? 400 : attempt === 1 ? 1200 : 2400;
  await new Promise((r) => setTimeout(r, ms));
}

export { WHISPER_MODEL, WHISPER_PRICE_USD_PER_MINUTE };
