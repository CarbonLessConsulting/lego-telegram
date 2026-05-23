// Brick: telegram-crm-prefetch-lookup v0.1.0 (le-GO I-Domain)
// Dep: audit-log-immutable (brick le-GO esistente)

import type { PrefetchAuditPayload, PrefetchHints } from "../types.ts";

/**
 * Logga audit privacy-safe del prefetch.
 *
 * **Privacy regola**: il payload NON contiene:
 *   - query originale (potrebbe avere PII)
 *   - candidates id/name/email/phone (sono i target della lookup)
 *
 * Solo:
 *   - lunghezza query (metric)
 *   - kinds di token rilevati (telemetry su quali pattern attivano lookup)
 *   - count candidati ritornati + total (efficienza)
 *   - elapsed_ms (perf)
 *
 * Adapter `logAudit` iniettato dal consumer. Tipica firma:
 * ```ts
 * logAudit(action: string, payload: object, opts?: { severity?, resource_type? }) => Promise<void>
 * ```
 *
 * Soft no-throw: errori di audit log NON bloccano il flusso prefetch.
 */
export type LogAuditFn = (
  action: string,
  payload: Record<string, unknown>,
  opts?: { severity?: 'info' | 'notice' | 'warning' | 'critical'; resource_type?: string },
) => Promise<void> | void;

export async function persistPrefetchAudit(
  logAudit: LogAuditFn,
  hints: PrefetchHints,
  elapsed_ms: number,
): Promise<void> {
  try {
    const payload: PrefetchAuditPayload = {
      query_length: hints.query.length,
      tokens_kinds: hints.tokens.map((t) => t.kind),
      candidates_returned: hints.candidates.length,
      total_count: hints.total_count,
      elapsed_ms,
    };
    await logAudit('crm_prefetch', payload as unknown as Record<string, unknown>, {
      severity: 'info',
      resource_type: 'crm_lookup',
    });
  } catch (e) {
    console.error('[telegram-crm-prefetch-lookup] audit log failed (soft)', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
