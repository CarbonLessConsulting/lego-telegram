// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)

import type { EntityFlowDefinition, FlowStep } from '../types';

/**
 * Registry in-memory di flow definitions, indicizzato per `flow_id`.
 *
 * Pattern: i prodotti chiamano `defineFlow(...)` a startup-time per ogni
 * flow. Il runtime fa `getFlow(id)` quando deve gestire un run.
 */
const REGISTRY = new Map<string, EntityFlowDefinition>();

/**
 * Registra (o sovrascrive) una flow definition.
 *
 * Validazione minima:
 *   - id non vuoto
 *   - steps non vuoto
 *   - step IDs univoci nel flow
 *   - initial_step (se specificato) deve esistere
 *   - next_step (se specificato) deve esistere
 *   - branch_fn: il chiamante è responsabile della validità dei target
 *
 * Soft no-throw: in caso di errore validazione → console.error + return false.
 */
export function defineFlow(def: EntityFlowDefinition): boolean {
  try {
    if (!def.id?.trim()) {
      console.error('[entity-flow-framework] defineFlow: empty id');
      return false;
    }
    if (!def.steps?.length) {
      console.error('[entity-flow-framework] defineFlow: empty steps', { id: def.id });
      return false;
    }

    const ids = new Set<string>();
    for (const s of def.steps) {
      if (!s.id?.trim()) {
        console.error('[entity-flow-framework] defineFlow: empty step id', { flow: def.id });
        return false;
      }
      if (ids.has(s.id)) {
        console.error('[entity-flow-framework] defineFlow: duplicate step id', { flow: def.id, step: s.id });
        return false;
      }
      ids.add(s.id);
    }

    if (def.initial_step && !ids.has(def.initial_step)) {
      console.error('[entity-flow-framework] defineFlow: initial_step not in steps', {
        flow: def.id,
        initial: def.initial_step,
      });
      return false;
    }

    for (const s of def.steps) {
      if (s.next_step && !ids.has(s.next_step)) {
        console.error('[entity-flow-framework] defineFlow: invalid next_step', {
          flow: def.id,
          step: s.id,
          next: s.next_step,
        });
        return false;
      }
    }

    REGISTRY.set(def.id, def);
    return true;
  } catch (e) {
    console.error('[entity-flow-framework] defineFlow exception', {
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

/**
 * Lookup flow definition. Ritorna `null` se non registrato.
 */
export function getFlow(flow_id: string): EntityFlowDefinition | null {
  return REGISTRY.get(flow_id) ?? null;
}

/**
 * Lista tutti i flow_id registrati (debug / health).
 */
export function listFlows(): string[] {
  return Array.from(REGISTRY.keys());
}

/**
 * Reset registry (usato in test).
 */
export function clearFlowRegistry(): void {
  REGISTRY.clear();
}

/**
 * Helper: dato un flow + step corrente, ritorna lo step successivo.
 *
 * Logica:
 *   1. Se step ha `next_step` esplicito → usa quello
 *   2. Altrimenti: prossimo nell'array `steps` (ordine declarativo)
 *   3. Se è l'ultimo step → null (fine flow)
 *
 * Skip dei step con `skip_if(draft) === true`.
 */
export function getNextStep(
  flow: EntityFlowDefinition,
  current: FlowStep,
  draft: Record<string, unknown>,
): FlowStep | null {
  // 1. next_step esplicito
  let candidate: FlowStep | null = null;
  if (current.next_step) {
    candidate = flow.steps.find((s) => s.id === current.next_step) ?? null;
  } else {
    // 2. ordine declarativo
    const idx = flow.steps.findIndex((s) => s.id === current.id);
    candidate = idx >= 0 && idx + 1 < flow.steps.length ? flow.steps[idx + 1] : null;
  }

  // 3. skip_if
  while (candidate && candidate.skip_if && candidate.skip_if(draft)) {
    if (candidate.next_step) {
      candidate = flow.steps.find((s) => s.id === candidate!.next_step) ?? null;
    } else {
      const idx = flow.steps.findIndex((s) => s.id === candidate!.id);
      candidate = idx >= 0 && idx + 1 < flow.steps.length ? flow.steps[idx + 1] : null;
    }
  }

  return candidate;
}
