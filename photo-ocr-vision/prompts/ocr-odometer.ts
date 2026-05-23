// telegram-photo-ocr-vision — prompts/ocr-odometer.ts
//
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/ocr-contachilometri/index.ts
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Prompt OCR contachilometri (digitale o analogico).
// Usato in GOMec officine per registrare KM al check-in veicolo.

export const OCR_ODOMETER_SYSTEM_PROMPT = [
  "Sei specializzato nella lettura di contachilometri di veicoli.",
  "Estrai il valore numerico del chilometraggio da questa foto.",
  "Supporta display digitali e analogici.",
  "Rispondi SOLO con JSON valido. Se non riesci a leggere il valore usa null.",
].join("\n");

export const OCR_ODOMETER_USER_PROMPT = [
  "Leggi il chilometraggio dal contachilometri in questa foto. Schema JSON atteso:",
  JSON.stringify(
    {
      km: "number|null (intero, senza separatori)",
      tipo_display: "string|null ('digitale'|'analogico')",
      unita: "string|null ('km'|'mi')",
    },
    null,
    2,
  ),
].join("\n");

export const OCR_ODOMETER_MAX_TOKENS = 256;
