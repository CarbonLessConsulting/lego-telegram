// telegram-photo-ocr-vision — types.
//
// Brick le-GO v0.1.0 — categoria E-Media
// Donor primary: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-capture-photo/index.ts
// Donor primary helpers: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/claude-vision.ts
// Donor secondary: ~/Sviluppo/erp/gosolution/supabase/functions/ocr-* (5 OCR specializzati)

/**
 * PhotoSize come arriva in update.message.photo[i].
 * Telegram fornisce 4 size: thumb, small, medium, large (l'ultimo = best).
 */
export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

/**
 * Document come arriva in update.message.document.
 * Supportiamo immagini inviate come "file" (no compressione Telegram) + PDF.
 */
export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

/**
 * Template OCR disponibili. Ogni template ha un prompt + JSON schema atteso.
 * GENERIC = OCR libero (donor GMR).
 * Altri = OCR strutturati da gosolution.
 */
export type OcrTemplate =
  | "generic"
  | "vcard"
  | "identity-document"
  | "libretto-veicolo"
  | "odometer"
  | "obd"
  | "gas-analyzer";

/**
 * Configurazione passata a captureOcr() per personalizzare il comportamento.
 */
export interface OcrCaptureConfig {
  /** Bot token Telegram. */
  botToken: string;
  /** Anthropic API key (Claude Sonnet vision). */
  anthropicApiKey: string;
  /** Template OCR (vedi OcrTemplate). Default "generic". */
  template?: OcrTemplate;
  /**
   * Modello Claude vision da usare (override default).
   * Default: "claude-sonnet-4-5" (sub a "claude-sonnet-4-6" se disponibile).
   */
  claudeModel?: string;
  /**
   * Max tokens nella response Claude.
   * Default: 1500 (generic), 1024 (template strutturato).
   */
  maxTokens?: number;
  /**
   * Se true, persiste audit log via callback.
   * Default: true (compliance GDPR art.30).
   */
  persistAuditLog?: boolean;
  /**
   * Callback per persistere audit log.
   * Soft no-throw: brick continua anche se callback fallisce.
   */
  auditCallback?: (entry: OcrAuditEntry) => Promise<void>;
  /**
   * Se true, ritorna anche il JSON parsato (solo per template strutturati).
   * Se false, ritorna solo `extracted_text` raw.
   * Default: true.
   */
  parseStructured?: boolean;
  /**
   * Limite dimensione file accettato (KB).
   * Default: 20480 (20 MB) — limite Claude vision API.
   */
  maxFileKb?: number;
}

/**
 * Risultato della pipeline photo/document → OCR.
 * Soft no-throw: in caso di errore ritorna { ok: false } + reason.
 */
export type OcrCaptureResult =
  | {
      ok: true;
      template: OcrTemplate;
      /** Testo OCR raw (sempre presente). */
      extracted_text: string;
      /** JSON strutturato (solo se template strutturato + parseStructured: true). */
      structured?: Record<string, unknown>;
      /** Lunghezza testo estratto (per UI / audit). */
      extracted_chars: number;
      /** Dimensione file processato (KB). */
      file_size_kb: number;
      /** Costo USD computato (vedi pricing in README). */
      cost_usd: number;
      claude_model: string;
      input_tokens: number;
      output_tokens: number;
      duration_ms: number;
    }
  | {
      ok: false;
      reason:
        | "file_too_large"
        | "download_failed"
        | "ocr_failed"
        | "json_parse_failed"
        | "unsupported_format"
        | "invalid_config";
      detail?: string;
      file_size_kb?: number;
    };

/**
 * Entry audit log persistita via auditCallback.
 * GDPR data-minimization: NIENTE image raw, NIENTE testo estratto raw.
 * Solo metriche tecniche + template usato + costo.
 */
export interface OcrAuditEntry {
  ts: string;
  template: OcrTemplate;
  file_size_kb: number;
  /** Numero di caratteri estratti (NO il testo). */
  extracted_chars: number;
  cost_usd: number;
  claude_model: string;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
}

/**
 * Risultato interno di downloadPhoto / downloadDocument.
 */
export interface MediaDownloadResult {
  ok: boolean;
  bytes?: Uint8Array;
  contentType?: string;
  filePath?: string;
  fileName?: string;
  error?: string;
}

/**
 * Risultato interno di ocrClaudeVision.
 */
export interface ClaudeOcrResult {
  ok: boolean;
  text: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  cost_usd: number;
  error?: string;
}
