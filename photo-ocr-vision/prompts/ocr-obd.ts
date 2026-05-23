// telegram-photo-ocr-vision — prompts/ocr-obd.ts
//
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/ocr-obd/index.ts
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Prompt OCR schermata diagnostica OBD (On-Board Diagnostics) automotive.
// Usato in GOMec officine + GoMapLab per import rapido dati diagnostica.

export const OCR_OBD_SYSTEM_PROMPT = [
  "Sei un esperto di diagnostica OBD automotive.",
  "Estrai i parametri dalla schermata/referto.",
  "Rispondi SOLO con JSON valido, nessun testo aggiuntivo.",
  "Se un valore non e' leggibile usa null.",
].join("\n");

export const OCR_OBD_USER_PROMPT = [
  "Estrai i parametri OBD. Schema JSON atteso:",
  JSON.stringify(
    {
      rpm: "number|null",
      carico_motore_pct: "number|null",
      temp_refrigerante_c: "number|null",
      egt_c: "number|null (exhaust gas temperature)",
      egr_pct: "number|null",
      dpf_mbar: "number|null",
      maf_gs: "number|null (mass air flow)",
      fuel_trim_ltft_pct: "number|null (long term)",
      fuel_trim_stft_pct: "number|null (short term)",
      co_pct: "number|null",
      hc_ppm: "number|null",
      nox_ppm: "number|null",
      lambda: "number|null",
      opacita_k: "number|null",
      warnings: ["string"],
    },
    null,
    2,
  ),
].join("\n");

export const OCR_OBD_MAX_TOKENS = 512;
