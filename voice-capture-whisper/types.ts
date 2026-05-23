// telegram-voice-capture-whisper — types.
//
// Brick le-GO v0.1.0 — categoria E-Media
// Donor primary: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-capture-voice/index.ts
// Donor primary helpers: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/whisper.ts
// Donor primary helpers: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts

/**
 * Voice payload come arriva da Telegram update.message.voice.
 * Solo i campi che usiamo nel brick (Telegram ne fornisce altri irrilevanti qui).
 */
export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  /** Durata audio in secondi (intero, fornito da Telegram). */
  duration: number;
  /** MIME dichiarato da Telegram (tipicamente "audio/ogg"). */
  mime_type?: string;
  file_size?: number;
}

/**
 * Configurazione passata a captureVoice() per personalizzare il comportamento.
 * Tutti i parametri sono opzionali (defaults adatti al caso GoYourRelationships).
 */
export interface VoiceCaptureConfig {
  /** Bot token Telegram (necessario per getFile + download bytes). */
  botToken: string;
  /** OpenAI API key (necessario per chiamata Whisper). */
  openaiApiKey: string;
  /**
   * Durata massima audio ammessa in secondi.
   * Default: 60 (UX: forza note vocali brevi, riduce costo).
   * Set a 0 per disabilitare il limite (sconsigliato).
   */
  maxDurationSeconds?: number;
  /**
   * Lingua hint per Whisper (codice ISO-639-1 es. "it", "en").
   * Se omesso Whisper auto-detect (più lento + meno accurato).
   */
  languageHint?: string;
  /**
   * Prompt opzionale per Whisper (context window per anti-hallucination).
   * Default: stringa vuota. Donor GMR usa contesto "nota professionale".
   */
  whisperPrompt?: string;
  /**
   * Se true, scrive entry audit via persistAudit callback.
   * Default: true (compliance GDPR art.30 record-keeping).
   */
  persistAuditLog?: boolean;
  /**
   * Callback chiamato per persistere l'audit log entry.
   * Brick non-presume schema DB — il caller scrive dove vuole.
   * Soft no-throw: se callback fallisce, il brick logga e continua.
   */
  auditCallback?: (entry: VoiceAuditEntry) => Promise<void>;
}

/**
 * Risultato della pipeline voice → trascrizione.
 * Soft no-throw: in caso di errore ritorna { ok: false } + reason.
 */
export type VoiceCaptureResult =
  | {
      ok: true;
      transcription: string;
      language: string;
      duration_seconds: number;
      cost_usd: number;
      bytes_downloaded: number;
      whisper_model: string;
      duration_ms: number;
    }
  | {
      ok: false;
      reason:
        | "duration_exceeded"
        | "download_failed"
        | "transcription_failed"
        | "empty_transcription"
        | "invalid_config";
      detail?: string;
      duration_seconds?: number;
    };

/**
 * Entry audit log persistita via auditCallback.
 * GDPR data-minimization: NIENTE testo trascritto (privacy), NIENTE audio raw.
 * Solo metriche tecniche per usage tracking + cost monitoring + abuse detection.
 */
export interface VoiceAuditEntry {
  /** ISO 8601 timestamp. */
  ts: string;
  /** Durata audio in secondi. */
  duration_sec: number;
  /** Lingua rilevata (ISO-639-1) o "unknown". */
  language: string;
  /** Costo USD computato (vedi pricing in README). */
  cost_usd: number;
  /** Lunghezza testo trascritto (NO il testo, solo char count). */
  transcription_length: number;
  /** Bytes audio downloadati (per analisi traffico). */
  bytes_downloaded: number;
  /** Modello Whisper usato. */
  whisper_model: string;
  /** Durata pipeline end-to-end in ms. */
  duration_ms: number;
}

/**
 * Risultato interno di transcribeWhisper (helper).
 */
export interface WhisperTranscriptionResult {
  ok: boolean;
  text: string;
  language: string;
  duration_seconds: number;
  duration_ms: number;
  model: string;
  cost_usd: number;
  error?: string;
}

/**
 * Risultato interno di downloadVoice (helper).
 */
export interface VoiceDownloadResult {
  ok: boolean;
  bytes?: Uint8Array;
  contentType?: string;
  filePath?: string;
  error?: string;
}
