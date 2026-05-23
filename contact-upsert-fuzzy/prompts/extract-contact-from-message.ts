// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-schema.ts
//   (taxonomy + ExtractedContact shape)
// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/claude.ts
//   (Anthropic call pattern + JSON extraction)
// Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data)

/**
 * Prompt LLM canonical per estrarre un contatto da testo libero (vocale Whisper,
 * trascrizione foto biglietto, messaggio Telegram free-form).
 *
 * Output JSON allineato a `ContactCanonical`. L'estensione product-specific
 * (es. taxonomy ruolo, industry tags) va aggiunta dal consumer come prompt
 * suffix custom.
 */

export const SYSTEM_PROMPT_EXTRACT_CONTACT = `\
Sei un estrattore strutturato di contatti professionali. Ricevi testo libero (in italiano, inglese o altre lingue) e devi estrarre un singolo contatto in formato JSON.

REGOLE:
1. Output: SOLO un oggetto JSON valido, senza commenti, senza markdown, senza testo prima o dopo.
2. Se mancano campi → ometti (NON inventare).
3. Se il testo non contiene un contatto chiaro → ritorna {"full_name":"Sconosciuto"}.
4. Email/telefoni: normalizza (lowercase email, E.164 phone se possibile, mai testo).
5. Se il testo dice "Mario punto Rossi at gmail punto com" → "mario.rossi@gmail.com".
6. linkedin_url e website: SOLO http/https. NO javascript: o data: (XSS).
7. NON inferire ruolo/azienda se non esplicitamente menzionati.

SCHEMA JSON di output:
{
  "full_name": string,           // obbligatorio
  "display_name": string?,       // nickname / soprannome
  "emails": string[],            // lowercase
  "phones": string[],            // E.164 se possibile
  "company": string?,
  "role": string?,               // titolo/ruolo in chiaro
  "linkedin_url": string?,
  "website": string?,
  "notes": string?,              // contesto, dove incontrato, dettagli
  "preferred_language": "it"|"en"|"es"|"de"|"fr"?
}`;

export const USER_PROMPT_TEMPLATE = `\
Testo da analizzare:
"""
{{TEXT}}
"""

Estrai il contatto in formato JSON come da schema. Solo JSON, nient'altro.`;

/**
 * Build prompt finale sostituendo `{{TEXT}}` con il testo input.
 *
 * NON applica HTML escape — il testo è racchiuso in triple-quote per delimitazione
 * sicura lato LLM (anti prompt injection minimo). Il caller può rinforzare la
 * difesa con il brick `prompt-injection-guard`.
 */
export function buildExtractPrompt(text: string): {
  system: string;
  user: string;
} {
  return {
    system: SYSTEM_PROMPT_EXTRACT_CONTACT,
    user: USER_PROMPT_TEMPLATE.replace('{{TEXT}}', text),
  };
}

/**
 * Configurazione consigliata per chiamata LLM (Anthropic Claude).
 *
 * Model: claude-haiku-4-5 (veloce, sufficiente per estrazione).
 * Temperature: 0 (deterministic).
 * Max tokens: 1024 (un contatto JSON sta in <500 tok).
 */
export const RECOMMENDED_LLM_PARAMS = {
  model: 'claude-haiku-4-5',
  temperature: 0,
  max_tokens: 1024,
  response_format: { type: 'json_object' as const },
} as const;
