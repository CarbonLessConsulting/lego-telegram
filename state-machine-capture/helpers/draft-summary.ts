// Donor: pattern ispirato a goref preview pre-review
// Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
//
// Riassunto draft pre-review: sintesi delle source che hanno contribuito
// + key fields del payload per UX preview Telegram.

import type { DraftRow } from "../types.ts";

export interface DraftSummary {
  /** Numero di source che hanno contribuito al draft. */
  source_count: number;
  /** Tipi di source unici (es. ['photo', 'voice', 'text']). */
  source_types: string[];
  /** Numero di key non-null nel payload. */
  field_count: number;
  /** Lista delle key non-null (per UI preview). */
  filled_keys: string[];
  /** Eta' del draft in secondi (now - created_at). */
  age_seconds: number;
  /** Secondi rimasti prima del TTL expire. */
  ttl_remaining_seconds: number;
}

export function buildDraftSummary(draft: DraftRow): DraftSummary {
  const sources = draft.sources ?? [];
  const sourceTypes = Array.from(new Set(sources.map((s) => s.source))).sort();

  const filled: string[] = [];
  for (const [k, v] of Object.entries(draft.payload ?? {})) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    filled.push(k);
  }

  const nowMs = Date.now();
  const createdMs = new Date(draft.created_at).getTime();
  const expiresMs = new Date(draft.expires_at).getTime();

  return {
    source_count: sources.length,
    source_types: sourceTypes,
    field_count: filled.length,
    filled_keys: filled.sort(),
    age_seconds: Math.max(0, Math.floor((nowMs - createdMs) / 1000)),
    ttl_remaining_seconds: Math.max(0, Math.floor((expiresMs - nowMs) / 1000)),
  };
}

/**
 * Formatta il summary per Telegram HTML (uso in preview pre-review).
 */
export function formatSummaryHtml(summary: DraftSummary): string {
  const sources = summary.source_types.length > 0
    ? summary.source_types.join(', ')
    : '(none)';
  const fields = summary.filled_keys.length > 0
    ? summary.filled_keys.slice(0, 8).join(', ') +
      (summary.filled_keys.length > 8 ? ` +${summary.filled_keys.length - 8} altri` : '')
    : '(none)';
  const ttlMin = Math.floor(summary.ttl_remaining_seconds / 60);
  return [
    `📋 <b>Draft attivo</b>`,
    `Sorgenti: <i>${sources}</i> (${summary.source_count})`,
    `Campi: <i>${fields}</i> (${summary.field_count})`,
    `Scade tra ${ttlMin} min`,
  ].join('\n');
}
