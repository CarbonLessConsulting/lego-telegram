// telegram-voice-capture-whisper — persist-audit.ts
//
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/usage-meter.ts (logUsage pattern)
// Brick: telegram-voice-capture-whisper v0.1.0 (le-GO E-Media)
//
// Soft no-throw wrapper su callback di persistenza audit log.
// Il brick NON conosce lo schema DB del consumer — quest'ultimo passa una
// callback async che persiste l'entry dove vuole (Supabase tabella usage_log,
// CloudWatch, file su disco, ecc.).
//
// GDPR data-minimization (art. 5 §1 lett. c):
//   - NIENTE testo trascritto nell'audit (solo char count)
//   - NIENTE audio raw bytes
//   - NIENTE PII utente (Telegram chat_id va aggiunto dal caller se serve)
//   - Solo metriche tecniche: duration, cost, language, length

import type { VoiceAuditEntry } from "../types.ts";

export interface PersistAuditOptions {
  /** Callback fornito dal caller. Soft: se fallisce, brick logga e prosegue. */
  callback?: (entry: VoiceAuditEntry) => Promise<void>;
  /** Se false, skip senza chiamare callback (default: true). */
  enabled?: boolean;
}

/**
 * Persisti un'entry audit. Soft no-throw: se callback fallisce o non è fornita,
 * logga su console.warn e ritorna { ok: false } senza propagare l'errore.
 */
export async function persistAudit(
  entry: VoiceAuditEntry,
  opts: PersistAuditOptions,
): Promise<{ ok: boolean; error?: string }> {
  if (opts.enabled === false) {
    return { ok: true };
  }
  if (!opts.callback) {
    // Caller non ha fornito callback → no-op (non è un errore).
    return { ok: true };
  }

  try {
    await opts.callback(entry);
    return { ok: true };
  } catch (e) {
    const err = String(e);
    console.warn({
      brick: "telegram-voice-capture-whisper",
      fn: "persistAudit",
      error: err,
      // Loggiamo SOLO metadata non-sensibili (no testo)
      duration_sec: entry.duration_sec,
      cost_usd: entry.cost_usd,
      language: entry.language,
    });
    return { ok: false, error: err };
  }
}

/**
 * Costruisce un VoiceAuditEntry minimale dai dati di pipeline.
 * Helper di convenienza per il caller (index.ts).
 */
export function buildAuditEntry(input: {
  durationSeconds: number;
  language: string;
  costUsd: number;
  transcriptionLength: number;
  bytesDownloaded: number;
  whisperModel: string;
  durationMs: number;
}): VoiceAuditEntry {
  return {
    ts: new Date().toISOString(),
    duration_sec: Math.round(input.durationSeconds),
    language: input.language,
    cost_usd: input.costUsd,
    transcription_length: input.transcriptionLength,
    bytes_downloaded: input.bytesDownloaded,
    whisper_model: input.whisperModel,
    duration_ms: input.durationMs,
  };
}
