// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts (righe 29-47)
// Brick: telegram-push-soft v0.1.0 (le-GO F-Integrations)
//
// Spezza testo HTML sul boundary safe più vicino (paragrafo → riga → spazio)
// per rispettare il limite Telegram di 4096 caratteri per messaggio.
//
// Lezione globale #7 (surrogate orfano UTF-16): NON usiamo `string.slice(0, N)`
// raw sul boundary perché taglierebbe a metà le surrogate pair degli emoji.
// chunkHtmlSafe usa lastIndexOf di separatori multi-byte-safe.

const TG_MAX = 4096;
/** Margine per emoji multi-byte + tag open/close paired. */
const TG_SAFE = 4000;

/**
 * Divide `html` in chunk safe per Telegram sendMessage.
 *
 * - 0 chunk se input vuoto
 * - 1 chunk se input <= TG_SAFE
 * - n chunk altrimenti, ciascuno <= TG_SAFE
 *
 * Cerca boundary nel seguente ordine: `\n\n` (paragrafo), `\n` (riga), ` ` (spazio).
 * Se nessuno disponibile entro la finestra, taglia hard al TG_SAFE.
 */
export function chunkHtmlSafe(html: string): string[] {
  if (html.length === 0) return [];
  if (html.length <= TG_SAFE) return [html];

  const chunks: string[] = [];
  let rest = html;
  while (rest.length > TG_SAFE) {
    let cut = rest.lastIndexOf("\n\n", TG_SAFE);
    if (cut < TG_SAFE / 2) cut = rest.lastIndexOf("\n", TG_SAFE);
    if (cut < TG_SAFE / 2) cut = rest.lastIndexOf(" ", TG_SAFE);
    if (cut < 0) cut = TG_SAFE;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

/**
 * Limite Telegram puro (4096). Esposto per consumer che vogliono validare upstream.
 */
export const TELEGRAM_MAX_MESSAGE_LENGTH = TG_MAX;
/**
 * Soglia interna safe (4000). Sotto cui non viene chunked.
 */
export const TELEGRAM_SAFE_MESSAGE_LENGTH = TG_SAFE;
