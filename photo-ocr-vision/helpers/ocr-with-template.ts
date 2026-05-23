// telegram-photo-ocr-vision — ocr-with-template.ts
//
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/ocr-* (5 OCR specializzati)
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/claude-vision.ts
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Dispatcher template → prompt + parsing JSON tollerante.
// Pattern donor: parseJsonFromAI() in gosolution/_shared/ai-failover.ts.

import type { OcrTemplate, ClaudeOcrResult } from "../types.ts";
import {
  ocrClaudeVision,
  type OcrClaudeVisionOptions,
} from "./ocr-claude-vision.ts";
import { OCR_GENERIC_PROMPT, OCR_GENERIC_MAX_TOKENS } from "../prompts/ocr-generic.ts";
import {
  OCR_VCARD_SYSTEM_PROMPT,
  OCR_VCARD_USER_PROMPT,
  OCR_VCARD_MAX_TOKENS,
} from "../prompts/ocr-vcard.ts";
import {
  OCR_IDENTITY_SYSTEM_PROMPT,
  OCR_IDENTITY_USER_PROMPT,
  OCR_IDENTITY_MAX_TOKENS,
} from "../prompts/ocr-identity-document.ts";
import {
  OCR_LIBRETTO_SYSTEM_PROMPT,
  OCR_LIBRETTO_USER_PROMPT,
  OCR_LIBRETTO_MAX_TOKENS,
} from "../prompts/ocr-libretto-veicolo.ts";
import {
  OCR_ODOMETER_SYSTEM_PROMPT,
  OCR_ODOMETER_USER_PROMPT,
  OCR_ODOMETER_MAX_TOKENS,
} from "../prompts/ocr-odometer.ts";
import {
  OCR_OBD_SYSTEM_PROMPT,
  OCR_OBD_USER_PROMPT,
  OCR_OBD_MAX_TOKENS,
} from "../prompts/ocr-obd.ts";
import {
  OCR_GAS_ANALYZER_SYSTEM_PROMPT,
  OCR_GAS_ANALYZER_USER_PROMPT,
  OCR_GAS_ANALYZER_MAX_TOKENS,
} from "../prompts/ocr-gas-analyzer.ts";

interface TemplateDef {
  systemPrompt: string;
  userPrompt?: string;
  maxTokens: number;
  /** Se true → response attesa JSON, va tentato parsing. */
  isStructured: boolean;
}

const TEMPLATES: Record<OcrTemplate, TemplateDef> = {
  generic: {
    systemPrompt: OCR_GENERIC_PROMPT,
    maxTokens: OCR_GENERIC_MAX_TOKENS,
    isStructured: false,
  },
  vcard: {
    systemPrompt: OCR_VCARD_SYSTEM_PROMPT,
    userPrompt: OCR_VCARD_USER_PROMPT,
    maxTokens: OCR_VCARD_MAX_TOKENS,
    isStructured: true,
  },
  "identity-document": {
    systemPrompt: OCR_IDENTITY_SYSTEM_PROMPT,
    userPrompt: OCR_IDENTITY_USER_PROMPT,
    maxTokens: OCR_IDENTITY_MAX_TOKENS,
    isStructured: true,
  },
  "libretto-veicolo": {
    systemPrompt: OCR_LIBRETTO_SYSTEM_PROMPT,
    userPrompt: OCR_LIBRETTO_USER_PROMPT,
    maxTokens: OCR_LIBRETTO_MAX_TOKENS,
    isStructured: true,
  },
  odometer: {
    systemPrompt: OCR_ODOMETER_SYSTEM_PROMPT,
    userPrompt: OCR_ODOMETER_USER_PROMPT,
    maxTokens: OCR_ODOMETER_MAX_TOKENS,
    isStructured: true,
  },
  obd: {
    systemPrompt: OCR_OBD_SYSTEM_PROMPT,
    userPrompt: OCR_OBD_USER_PROMPT,
    maxTokens: OCR_OBD_MAX_TOKENS,
    isStructured: true,
  },
  "gas-analyzer": {
    systemPrompt: OCR_GAS_ANALYZER_SYSTEM_PROMPT,
    userPrompt: OCR_GAS_ANALYZER_USER_PROMPT,
    maxTokens: OCR_GAS_ANALYZER_MAX_TOKENS,
    isStructured: true,
  },
};

export interface OcrWithTemplateInput {
  anthropicApiKey: string;
  imageBase64: string;
  mediaType: string;
  template: OcrTemplate;
  /** Override modello e maxTokens (opzionale). */
  model?: string;
  maxTokens?: number;
}

export interface OcrWithTemplateResult extends ClaudeOcrResult {
  template: OcrTemplate;
  isStructured: boolean;
  /** Solo se template strutturato e parse riuscito. */
  structured?: Record<string, unknown>;
  /** Se true, parse JSON e' fallito (struttura testo libero). */
  parseFailed?: boolean;
}

/**
 * Esegue OCR con template (prompt + parsing). Soft no-throw.
 */
export async function ocrWithTemplate(
  input: OcrWithTemplateInput,
): Promise<OcrWithTemplateResult> {
  const def = TEMPLATES[input.template];
  if (!def) {
    return {
      ok: false,
      text: "",
      template: input.template,
      isStructured: false,
      model: input.model ?? "unknown",
      input_tokens: 0,
      output_tokens: 0,
      duration_ms: 0,
      cost_usd: 0,
      error: `unknown_template: ${input.template}`,
    };
  }

  const visionOpts: OcrClaudeVisionOptions = {
    anthropicApiKey: input.anthropicApiKey,
    imageBase64: input.imageBase64,
    mediaType: input.mediaType,
    systemPrompt: def.systemPrompt,
    userPrompt: def.userPrompt,
    model: input.model,
    maxTokens: input.maxTokens ?? def.maxTokens,
  };

  const res = await ocrClaudeVision(visionOpts);
  const base: OcrWithTemplateResult = {
    ...res,
    template: input.template,
    isStructured: def.isStructured,
  };

  if (!res.ok || !def.isStructured) return base;

  // Tentativo parsing JSON (donor pattern: parseJsonFromAI)
  const parsed = parseJsonFromText(res.text);
  if (parsed) {
    return { ...base, structured: parsed };
  }
  return { ...base, parseFailed: true };
}

/**
 * Parse JSON tollerante a markdown code blocks + testo prima/dopo.
 * Donor: gosolution/_shared/ai-failover.ts parseJsonFromAI.
 */
export function parseJsonFromText(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Rimuovi markdown ```json ... ```
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      // Estrai primo blocco { ... } valido
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
}

export const SUPPORTED_TEMPLATES: OcrTemplate[] = Object.keys(
  TEMPLATES,
) as OcrTemplate[];
