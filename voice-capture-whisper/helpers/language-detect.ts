// telegram-voice-capture-whisper — language-detect.ts
//
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/whisper.ts (response.language)
// Brick: telegram-voice-capture-whisper v0.1.0 (le-GO E-Media)
//
// Helper di normalizzazione lingua dal `verbose_json` response Whisper.
// Whisper può restituire lingua in due formati: ISO-639-1 ("it") o nome esteso
// ("italian"). Normalizza tutto a ISO-639-1 per pipeline downstream.

const LANG_NAME_TO_ISO: Record<string, string> = {
  italian: "it",
  english: "en",
  spanish: "es",
  german: "de",
  french: "fr",
  portuguese: "pt",
  russian: "ru",
  arabic: "ar",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
  dutch: "nl",
  polish: "pl",
  turkish: "tr",
  romanian: "ro",
  greek: "el",
  swedish: "sv",
  norwegian: "no",
  danish: "da",
  finnish: "fi",
  ukrainian: "uk",
  bulgarian: "bg",
  czech: "cs",
};

/**
 * Normalizza una stringa lingua da Whisper response a codice ISO-639-1 lowercase.
 * @param raw Lingua come ritornata da Whisper (es. "italian", "it", "ITALIAN").
 * @returns ISO-639-1 lowercase (es. "it") o "unknown" se non riconosciuta.
 */
export function normalizeLanguage(raw: string | undefined): string {
  if (!raw) return "unknown";
  const lower = raw.trim().toLowerCase();
  if (!lower) return "unknown";
  // Già ISO-639-1 (2 lettere)
  if (lower.length === 2 && /^[a-z]{2}$/.test(lower)) return lower;
  // Nome esteso → mapping
  if (LANG_NAME_TO_ISO[lower]) return LANG_NAME_TO_ISO[lower];
  // Sconosciuto: ritorna raw lowercase (debugging) ma marcato unknown se >3 char
  return lower.length === 3 ? lower : "unknown";
}

/**
 * True se la lingua rilevata è una delle "ammesse" per il brick consumer.
 * Se allowedLanguages è vuoto/undefined → sempre true (no filtro).
 */
export function isAllowedLanguage(
  detected: string,
  allowedLanguages?: string[],
): boolean {
  if (!allowedLanguages || allowedLanguages.length === 0) return true;
  return allowedLanguages.includes(normalizeLanguage(detected));
}
