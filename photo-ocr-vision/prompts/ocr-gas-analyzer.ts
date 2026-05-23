// telegram-photo-ocr-vision — prompts/ocr-gas-analyzer.ts
//
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/ocr-analizzatore-gas/index.ts
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Prompt OCR display analizzatore gas (test CO, opacita', 5 gas).
// Usato in GOMec officine per import rapido test revisione.

export const OCR_GAS_ANALYZER_SYSTEM_PROMPT = [
  "Estrai i valori dall'analizzatore gas 5 in questa immagine.",
  "Identifica il tipo di test (CO/opacita'/5 gas).",
  "Rispondi SOLO con JSON valido.",
].join("\n");

export const OCR_GAS_ANALYZER_USER_PROMPT = [
  "Estrai. Schema JSON atteso:",
  JSON.stringify(
    {
      co_pct: "number|null",
      co2_pct: "number|null",
      o2_pct: "number|null",
      hc_ppm: "number|null",
      nox_ppm: "number|null",
      lambda: "number|null",
      opacita_k: "number|null",
      regime_rpm: "number|null",
      data_misura: "string|null (ISO 8601)",
    },
    null,
    2,
  ),
].join("\n");

export const OCR_GAS_ANALYZER_MAX_TOKENS = 512;
