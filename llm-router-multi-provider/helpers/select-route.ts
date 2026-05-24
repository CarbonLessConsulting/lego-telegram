// Brick: llm-router-multi-provider v0.2.0 (le-GO B-Sofia-Core)
//
// Selettore route: applica rule-based + cost-aware + EU residency filter.

import type { ProviderName, RouteSelection, RouterContext } from "../types.ts";
import { PROVIDERS, ROUTING_TABLE } from "../pricing/router-table.ts";

export interface SelectRouteOptions {
  /** Predicate per filtrare provider non disponibili (es. env var missing). */
  isProviderAvailable?: (provider: ProviderName) => boolean;
}

/**
 * Sceglie la route migliore per il task type richiesto.
 * Filtra per data_residency e provider availability.
 *
 * @throws se nessun candidato disponibile dopo i filtri
 */
export function selectRoute(
  ctx: RouterContext,
  opts: SelectRouteOptions = {},
): RouteSelection {
  // Override completo: force_provider + force_model
  if (ctx.force_provider && ctx.force_model) {
    return {
      provider: ctx.force_provider,
      model: ctx.force_model,
      reason: "force override",
    };
  }

  const candidates = ROUTING_TABLE[ctx.task_type];
  if (!candidates || candidates.length === 0) {
    throw new Error(`No routing table entry for task_type=${ctx.task_type}`);
  }

  const isEuStrict = ctx.data_residency === "eu_strict";
  const availabilityCheck = opts.isProviderAvailable ?? (() => true);

  for (const c of candidates) {
    // Override force_provider: salta finché non matcha
    if (ctx.force_provider && c.provider !== ctx.force_provider) continue;

    // EU residency filter
    if (isEuStrict && !PROVIDERS[c.provider].eu_residency) continue;

    // Availability filter
    if (!availabilityCheck(c.provider)) continue;

    return {
      provider: c.provider,
      model: ctx.force_model ?? c.model,
      reason: c.note + (isEuStrict ? " [eu_strict]" : ""),
    };
  }

  throw new Error(
    `No available provider for task_type=${ctx.task_type} ` +
      `(eu_strict=${isEuStrict}, force_provider=${ctx.force_provider ?? "none"})`,
  );
}
