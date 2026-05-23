// telegram-photo-ocr-vision — persist-audit.ts
//
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/usage-meter.ts (logUsage)
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/_shared/llm-meter.ts (registerLlmUsage)
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Soft no-throw audit log wrapper.
// GDPR data-minimization (art. 5 §1 lett. c):
//   - NIENTE image raw bytes
//   - NIENTE testo OCR estratto (solo char count)
//   - Solo metriche tecniche (template, file_size_kb, cost_usd, token usage)

import type { OcrAuditEntry, OcrTemplate } from "../types.ts";

export interface PersistAuditOptions {
  callback?: (entry: OcrAuditEntry) => Promise<void>;
  enabled?: boolean;
}

export async function persistAudit(
  entry: OcrAuditEntry,
  opts: PersistAuditOptions,
): Promise<{ ok: boolean; error?: string }> {
  if (opts.enabled === false) return { ok: true };
  if (!opts.callback) return { ok: true };

  try {
    await opts.callback(entry);
    return { ok: true };
  } catch (e) {
    const err = String(e);
    console.warn({
      brick: "telegram-photo-ocr-vision",
      fn: "persistAudit",
      error: err,
      template: entry.template,
      cost_usd: entry.cost_usd,
    });
    return { ok: false, error: err };
  }
}

export function buildAuditEntry(input: {
  template: OcrTemplate;
  fileSizeKb: number;
  extractedChars: number;
  costUsd: number;
  claudeModel: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}): OcrAuditEntry {
  return {
    ts: new Date().toISOString(),
    template: input.template,
    file_size_kb: input.fileSizeKb,
    extracted_chars: input.extractedChars,
    cost_usd: input.costUsd,
    claude_model: input.claudeModel,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    duration_ms: input.durationMs,
  };
}
