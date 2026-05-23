// Brick: telegram-crm-prefetch-lookup v0.1.0 (le-GO I-Domain) · entry pubblico

export {
  DEFAULT_PREFETCH_CONFIG,
  type CandidateToken,
  type CandidateTokenKind,
  type CrmCandidate,
  type PrefetchAuditPayload,
  type PrefetchConfig,
  type PrefetchHints,
  type SupabaseLike,
} from "./types.ts";

export {
  extractCandidates,
  filterUsefulTokens,
} from "./helpers/extract-candidates.ts";

export {
  fuzzySearchCrm,
} from "./helpers/fuzzy-search-crm.ts";

export {
  rankCandidates,
  scoreCandidate,
  topK,
} from "./helpers/rank-candidates.ts";

export {
  renderHintsForSystemPrompt,
  buildEmptyHints,
} from "./helpers/render-hints-system-prompt.ts";

export {
  persistPrefetchAudit,
  type LogAuditFn,
} from "./helpers/persist-audit.ts";

// ---------------------------------------------------------------------------
// Convenience orchestrator
// ---------------------------------------------------------------------------

import { extractCandidates, filterUsefulTokens } from "./helpers/extract-candidates.ts";
import { fuzzySearchCrm } from "./helpers/fuzzy-search-crm.ts";
import { rankCandidates, topK } from "./helpers/rank-candidates.ts";
import { buildEmptyHints } from "./helpers/render-hints-system-prompt.ts";
import { persistPrefetchAudit, type LogAuditFn } from "./helpers/persist-audit.ts";
import type { PrefetchConfig, PrefetchHints, SupabaseLike } from "./types.ts";

/**
 * Orchestrator end-to-end: estrai token → fuzzy search → rank → topK → audit.
 *
 * Caller può iniettare `logAudit` per audit privacy-safe (recommended).
 * Se `logAudit` omesso, niente audit (utile in unit test).
 *
 * Soft no-throw: in caso di errore ritorna hints vuoti.
 */
export async function prefetchCrmHints(opts: {
  sb: SupabaseLike;
  tenant_id: string;
  user_message: string;
  config?: Partial<PrefetchConfig>;
  logAudit?: LogAuditFn;
}): Promise<PrefetchHints> {
  const t0 = Date.now();
  const empty = buildEmptyHints(opts.user_message);

  try {
    const tokens = filterUsefulTokens(extractCandidates(opts.user_message));
    if (tokens.length === 0) {
      const hints = { ...empty, tokens: [] };
      if (opts.logAudit) await persistPrefetchAudit(opts.logAudit, hints, Date.now() - t0);
      return hints;
    }

    const raw = await fuzzySearchCrm(opts.sb, {
      tenant_id: opts.tenant_id,
      tokens,
      config: opts.config,
    });
    const ranked = rankCandidates(raw);
    const max = opts.config?.max_candidates ?? 5;
    const top = topK(ranked, max);

    const hints: PrefetchHints = {
      query: opts.user_message,
      tokens,
      candidates: top,
      total_count: ranked.length,
      fetched_at: new Date().toISOString(),
    };

    if (opts.logAudit) await persistPrefetchAudit(opts.logAudit, hints, Date.now() - t0);
    return hints;
  } catch (e) {
    console.error('[telegram-crm-prefetch-lookup] orchestrator soft fail', {
      error: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}
