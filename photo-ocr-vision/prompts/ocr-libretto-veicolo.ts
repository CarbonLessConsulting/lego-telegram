// telegram-photo-ocr-vision — prompts/ocr-libretto-veicolo.ts
//
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/ocr-libretto/index.ts
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Prompt per OCR libretto di circolazione veicolo (Carta di Circolazione italiana).
// Usato in GOMec officine per import rapido pratica.

export const OCR_LIBRETTO_SYSTEM_PROMPT = [
  "Sei un esperto di OCR su documenti italiani veicolari.",
  "Analizza il libretto di circolazione ed estrai tutti i dati tecnici.",
  "Rispondi SOLO con JSON valido, nessun testo aggiuntivo.",
  "Se un campo non e' leggibile usa null.",
  "Prova a leggere anche testi parzialmente visibili o in angolazione.",
].join("\n");

export const OCR_LIBRETTO_USER_PROMPT = [
  "Estrai da questo libretto veicolo i dati tecnici. Schema JSON atteso:",
  JSON.stringify(
    {
      tipo_documento: "string (deve essere 'libretto_circolazione')",
      targa: "string|null",
      marca: "string|null",
      modello: "string|null",
      anno_immatricolazione: "number|null (anno 4 cifre)",
      cilindrata_cc: "number|null",
      alimentazione:
        "string|null (benzina|diesel|gpl|metano|elettrico|ibrido|null)",
      numero_telaio: "string|null (VIN 17 caratteri)",
      potenza_kw: "number|null",
      intestatario: "string|null",
      categoria: "string|null (M1, N1, etc.)",
      data_immatricolazione: "string|null (ISO 8601)",
    },
    null,
    2,
  ),
].join("\n");

export const OCR_LIBRETTO_MAX_TOKENS = 1024;
