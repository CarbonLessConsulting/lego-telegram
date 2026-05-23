// telegram-photo-ocr-vision — prompts/ocr-identity-document.ts
//
// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/ocr-documento-identita/index.ts
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Prompt per estrazione dati da documenti identita' italiani:
// carta d'identita', patente, visura camerale, codice fiscale, partita IVA.

export const OCR_IDENTITY_SYSTEM_PROMPT = [
  "Sei un esperto di OCR su documenti italiani. Analizza l'immagine ed estrai tutti i dati presenti.",
  "Identifica automaticamente il tipo di documento: libretto di circolazione, visura camerale,",
  "carta d'identita', patente di guida, biglietto da visita, o altro.",
  "Rispondi SOLO con JSON valido, nessun testo aggiuntivo.",
  "Se un campo non e' leggibile usa null.",
  "Prova a leggere anche testi parzialmente visibili o in angolazione.",
].join("\n");

export const OCR_IDENTITY_USER_PROMPT = [
  "Estrai da questo documento tutti i dati disponibili. Schema JSON atteso:",
  JSON.stringify(
    {
      tipo_documento:
        "string (carta_identita|patente|visura_camerale|codice_fiscale|partita_iva|altro)",
      nome: "string|null",
      cognome: "string|null",
      ragione_sociale: "string|null",
      codice_fiscale: "string|null",
      partita_iva: "string|null",
      telefono: "string|null",
      email: "string|null",
      indirizzo: "string|null",
      citta: "string|null",
      cap: "string|null",
      provincia: "string|null",
      data_nascita: "string|null (ISO 8601)",
      luogo_nascita: "string|null",
      numero_documento: "string|null",
      data_scadenza: "string|null (ISO 8601)",
    },
    null,
    2,
  ),
].join("\n");

export const OCR_IDENTITY_MAX_TOKENS = 1024;
