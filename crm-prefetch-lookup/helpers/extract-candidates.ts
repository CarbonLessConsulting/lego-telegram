// Donor: ~/Sviluppo/erp/gosolution/supabase/functions/gomec-telegram-webhook/entities/crm.ts
//   (token extraction pattern dal Sofia turn input)
// Brick: telegram-crm-prefetch-lookup v0.1.0 (le-GO I-Domain)

import type { CandidateToken } from "../types.ts";

/**
 * Estrae token candidati da testo libero utente.
 *
 * Heuristiche regex pure — nessuna chiamata esterna. Pensate per essere
 * eseguite ad ogni messaggio user PRIMA del Sofia turn (latency ~1ms).
 *
 * Token rilevati:
 *   - `email`         → `mario.rossi@gmail.com`
 *   - `phone`         → `+39 333 1234567` / `333-1234567` / `3331234567`
 *   - `partita_iva`   → 11 cifre consecutive (con o senza prefix IT)
 *   - `codice_fiscale`→ 16 char alfanumerico (pattern CF italiano)
 *   - `targa`         → AA000AA (modern IT) / AA00000 (classic)
 *   - `name_uppercase`→ `MARIO ROSSI` (2+ parole tutte maiuscole)
 *   - `company_keyword`→ `S.r.l.`, `S.p.A.`, `S.a.s.`, `S.n.c.`, `S.s.`, `Soc. Coop.`
 *
 * Output ordinato per posizione di inizio.
 *
 * Soft no-throw: input vuoto/non-stringa → array vuoto.
 */
export function extractCandidates(text: string): CandidateToken[] {
  if (!text || typeof text !== 'string') return [];

  const out: CandidateToken[] = [];

  // EMAIL
  const reEmail = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
  for (const m of text.matchAll(reEmail)) {
    if (m.index === undefined) continue;
    out.push({ kind: 'email', value: m[0].toLowerCase(), span: [m.index, m.index + m[0].length] });
  }

  // PHONE — IT prefix opzionale, 9-10 cifre, separatori vari
  const rePhone = /(?<!\d)(?:\+?39[\s-]?)?(?:\d[\s-]?){8,12}\d(?!\d)/g;
  for (const m of text.matchAll(rePhone)) {
    if (m.index === undefined) continue;
    const cleaned = m[0].replace(/[^\d+]/g, '');
    if (cleaned.length < 9 || cleaned.length > 14) continue;
    out.push({ kind: 'phone', value: cleaned, span: [m.index, m.index + m[0].length] });
  }

  // PARTITA IVA — 11 digit consecutivi (con o senza prefix IT)
  const rePiva = /\b(?:IT)?(\d{11})\b/gi;
  for (const m of text.matchAll(rePiva)) {
    if (m.index === undefined) continue;
    out.push({ kind: 'partita_iva', value: m[1], span: [m.index, m.index + m[0].length] });
  }

  // CODICE FISCALE — 16 char alphanumerico (pattern CF italiano semplificato)
  const reCf = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi;
  for (const m of text.matchAll(reCf)) {
    if (m.index === undefined) continue;
    out.push({ kind: 'codice_fiscale', value: m[0].toUpperCase(), span: [m.index, m.index + m[0].length] });
  }

  // TARGA — modern AB000CD / classic AB00000
  const reTarga = /\b[A-Z]{2}[\s-]?\d{3,5}[\s-]?[A-Z]{0,2}\b/g;
  for (const m of text.matchAll(reTarga)) {
    if (m.index === undefined) continue;
    const compact = m[0].replace(/[\s-]/g, '').toUpperCase();
    if (compact.length < 6 || compact.length > 7) continue;
    out.push({ kind: 'targa', value: compact, span: [m.index, m.index + m[0].length] });
  }

  // NAME UPPERCASE — 2+ parole tutte maiuscole con accenti italiani
  const reNameUp = /\b[A-ZÀÁÉÈÌÍÒÓÙÚ]{2,}(?:\s+[A-ZÀÁÉÈÌÍÒÓÙÚ]{2,}){1,3}\b/g;
  for (const m of text.matchAll(reNameUp)) {
    if (m.index === undefined) continue;
    if (m[0].length < 5) continue;
    out.push({ kind: 'name_uppercase', value: m[0].trim(), span: [m.index, m.index + m[0].length] });
  }

  // COMPANY KEYWORD — S.r.l., S.p.A., S.a.s., Soc. Coop.
  const reCompany = /\b(?:S\.?r\.?l\.?|S\.?p\.?A\.?|S\.?a\.?s\.?|S\.?n\.?c\.?|S\.?s\.?|Soc\.?\s+Coop\.?)\b/gi;
  for (const m of text.matchAll(reCompany)) {
    if (m.index === undefined) continue;
    out.push({ kind: 'company_keyword', value: m[0], span: [m.index, m.index + m[0].length] });
  }

  // Ordina per posizione
  out.sort((a, b) => a.span[0] - b.span[0]);
  return out;
}

/**
 * Filtra solo i token che hanno valore semanticamente utile per CRM lookup.
 * Esclude `name_uppercase` se è troppo corto (false positive su sigle).
 */
export function filterUsefulTokens(tokens: CandidateToken[]): CandidateToken[] {
  return tokens.filter((t) => {
    if (t.kind === 'name_uppercase' && t.value.length < 7) return false;
    if (t.kind === 'phone' && t.value.replace(/[^\d]/g, '').length < 9) return false;
    return true;
  });
}
