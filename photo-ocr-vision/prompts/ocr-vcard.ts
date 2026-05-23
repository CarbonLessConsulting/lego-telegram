// telegram-photo-ocr-vision — prompts/ocr-vcard.ts
//
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-schema.ts
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-capture-photo/index.ts
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Prompt per estrarre i campi standard di un biglietto da visita (vCard-like).
// Schema minimale + estensibile.

export const OCR_VCARD_SYSTEM_PROMPT = [
  "Sei un esperto di OCR su biglietti da visita professionali (italiani e internazionali).",
  "Estrai i dati strutturati dal biglietto. Rispondi SOLO con JSON valido, nessun testo aggiuntivo.",
  "Se un campo non e' presente o non leggibile usa null. Non inventare.",
  "Normalizza email a lowercase. Normalizza telefoni a formato E.164 quando possibile (+39...).",
].join("\n");

export const OCR_VCARD_USER_PROMPT = [
  "Estrai i dati dal biglietto da visita in questa immagine.",
  "Schema JSON atteso:",
  JSON.stringify(
    {
      full_name: "string|null",
      first_name: "string|null",
      last_name: "string|null",
      role: "string|null (es. CEO, Sales Manager)",
      company: "string|null",
      emails: ["string"],
      phones: ["string (E.164 quando possibile)"],
      websites: ["string"],
      address: "string|null",
      city: "string|null",
      country: "string|null",
      linkedin: "string|null",
      notes: "string|null (testo non categorizzato)",
    },
    null,
    2,
  ),
].join("\n");

export const OCR_VCARD_MAX_TOKENS = 1024;
