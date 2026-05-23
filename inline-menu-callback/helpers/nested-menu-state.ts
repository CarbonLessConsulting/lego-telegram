// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-telegram-webhook/index.ts (state machine pattern)
// Brick: telegram-inline-menu-callback v0.1.0 (le-GO C-UI)
//
// Helper per gestire stack breadcrumb di menu nested.
//
// Il brick NON persiste lo state: lo riceve dal consumer (es. tabella DB
// `telegram_user_menu_states` o KV) e lo restituisce mutato dopo
// push/pop/reset. Il consumer è responsabile di save/load.

import type { MenuStateFrame, NestedMenuState } from "../types.ts";

const MAX_DEPTH = 16;

/**
 * Costruisce uno state vuoto (menu principale all'apertura).
 */
export function emptyMenuState(): NestedMenuState {
  return { frames: [] };
}

/**
 * Push un nuovo frame in cima allo stack (entra in un sotto-menu).
 * Se lo stack raggiunge MAX_DEPTH, drop del frame più vecchio (no overflow).
 */
export function pushMenuState(
  state: NestedMenuState,
  frame: MenuStateFrame,
): NestedMenuState {
  const frames = [...state.frames, frame];
  if (frames.length > MAX_DEPTH) frames.shift();
  return { frames };
}

/**
 * Pop frame in cima (torna al menu precedente).
 * Se stack vuoto/un solo frame, ritorna empty (nessun parent disponibile).
 *
 * Convenzione: il chiamante decide cosa renderizzare. Pop restituisce il
 * NUOVO state, il frame "corrente" è `result.frames[result.frames.length-1]`.
 */
export function popMenuState(state: NestedMenuState): NestedMenuState {
  if (state.frames.length <= 1) return { frames: [] };
  return { frames: state.frames.slice(0, -1) };
}

/**
 * Reset completo dello state (root menu).
 */
export function resetMenuState(): NestedMenuState {
  return { frames: [] };
}

/**
 * Frame corrente (top dello stack) o `null` se vuoto.
 */
export function currentMenuFrame(state: NestedMenuState): MenuStateFrame | null {
  if (state.frames.length === 0) return null;
  return state.frames[state.frames.length - 1];
}

/**
 * Profondità corrente (utile per render breadcrumb).
 */
export function menuDepth(state: NestedMenuState): number {
  return state.frames.length;
}

/**
 * Render breadcrumb leggibile per debug / footer del messaggio.
 * Es. "main > settings > language"
 */
export function renderBreadcrumb(
  state: NestedMenuState,
  separator = " > ",
): string {
  if (state.frames.length === 0) return "main";
  return state.frames.map((f) => f.menu_id).join(separator);
}

/**
 * Serializza state in stringa JSON compatta per persistere in DB / KV.
 * Validate parse round-trip dal consumer (zod, etc.) se serve robustezza.
 */
export function serializeMenuState(state: NestedMenuState): string {
  try {
    return JSON.stringify(state);
  } catch {
    return "{\"frames\":[]}";
  }
}

/**
 * Deserializza state da stringa JSON. Soft: ritorna empty su errore.
 */
export function deserializeMenuState(raw: string | null | undefined): NestedMenuState {
  if (!raw) return emptyMenuState();
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.frames)
    ) {
      // Filtra frame validi (defensive contro DB corrotto).
      const frames = (parsed.frames as unknown[])
        .filter(
          (f): f is MenuStateFrame =>
            !!f &&
            typeof f === "object" &&
            typeof (f as MenuStateFrame).menu_id === "string",
        )
        .slice(-MAX_DEPTH);
      return { frames };
    }
  } catch {
    /* fallthrough */
  }
  return emptyMenuState();
}

export const MENU_STATE_MAX_DEPTH = MAX_DEPTH;
