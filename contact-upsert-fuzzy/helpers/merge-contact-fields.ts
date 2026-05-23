// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-upsert.ts
//   (setUnion + pickNonNull + merge logic righe ~324-389)
// Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data)

import type { ContactCanonical } from "../types.ts";

/**
 * Unione di array senza duplicati, lato JS (non DB).
 * Mantiene ordine di inserimento.
 */
export function setUnion<T>(a?: T[] | null, b?: T[] | null): T[] {
  return Array.from(new Set<T>([...(a ?? []), ...(b ?? [])]));
}

/**
 * Pick `b` se non-null altrimenti `a`. Equivalente a
 * `b ?? a ?? null` ma con semantica chiara.
 *
 * Regola business le-GO: il NUOVO dato (b) prevale solo se non-null;
 * non sovrascriviamo MAI un valore esistente con `null` o stringa vuota.
 */
export function pickNonNull<T>(a: T | null | undefined, b: T | null | undefined): T | null {
  if (b !== null && b !== undefined && (typeof b !== 'string' || b.trim().length > 0)) {
    return b;
  }
  return a ?? null;
}

/**
 * Merge canonical di due ContactCanonical.
 *
 * `existing`: row corrente DB
 * `incoming`: dati appena estratti (foto/voice/vcard)
 *
 * Strategia:
 *   - emails, phones → union
 *   - full_name → preferisci nuovo se non vuoto, altrimenti esistente
 *   - scalari (role, company, notes, ecc.) → pickNonNull
 *   - campi product-specific (estesi via index signature) → preferisci nuovo
 *     se truthy
 */
export function mergeContactFields(
  existing: ContactCanonical,
  incoming: Partial<ContactCanonical>,
): ContactCanonical {
  const merged: ContactCanonical = {
    ...existing,
    full_name: incoming.full_name?.trim() || existing.full_name,
    display_name: pickNonNull(existing.display_name, incoming.display_name),
    emails: setUnion(existing.emails, incoming.emails ?? []),
    phones: setUnion(existing.phones, incoming.phones ?? []),
    company: pickNonNull(existing.company, incoming.company),
    role: pickNonNull(existing.role, incoming.role),
    linkedin_url: pickNonNull(existing.linkedin_url, incoming.linkedin_url),
    website: pickNonNull(existing.website, incoming.website),
    notes: mergeNotes(existing.notes ?? null, incoming.notes ?? null),
    preferred_language: pickNonNull(existing.preferred_language, incoming.preferred_language),
  };

  // Campi product-specific: union/pickNonNull intelligente
  for (const [key, value] of Object.entries(incoming)) {
    if (key in merged) continue; // già gestito sopra
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      const existingArr = Array.isArray(existing[key]) ? (existing[key] as unknown[]) : [];
      merged[key] = setUnion(existingArr, value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Append note nuovo a note esistenti con separatore + timestamp.
 * Non sovrascrive note esistenti (audit trail-friendly).
 */
function mergeNotes(existing: string | null, incoming: string | null): string | null {
  if (!incoming || !incoming.trim()) return existing;
  if (!existing || !existing.trim()) return incoming.trim();
  // De-dup: se incoming è già contenuto in existing, non aggiungere
  if (existing.includes(incoming.trim())) return existing;
  const ts = new Date().toISOString().slice(0, 10);
  return `${existing.trim()}\n[${ts}] ${incoming.trim()}`;
}
