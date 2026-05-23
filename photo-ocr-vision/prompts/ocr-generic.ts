// telegram-photo-ocr-vision — prompts/ocr-generic.ts
//
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/claude-vision.ts (ocrImageDetailed)
// Brick: telegram-photo-ocr-vision v0.1.0 (le-GO E-Media)
//
// Prompt OCR libero (no schema strutturato). Usato per biglietti da visita,
// foto generiche di testo, screenshot. Ritorna testo raw.

export const OCR_GENERIC_PROMPT = [
  "Estrai TUTTO il testo presente in questa immagine (biglietto da visita, documento, foto di testo).",
  "Output: solo testo raw, una linea per blocco logico.",
  "Nessun commento, nessun markup, nessuna intestazione tipo 'Ecco il testo:'.",
  "Se l'immagine non contiene testo leggibile, rispondi con una stringa vuota.",
].join("\n");

/** Max tokens consigliato per OCR generico (testo libero, no JSON). */
export const OCR_GENERIC_MAX_TOKENS = 1500;
