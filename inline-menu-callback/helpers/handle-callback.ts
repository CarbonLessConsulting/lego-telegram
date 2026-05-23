// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-telegram-webhook/index.ts:1193-1228 (runCallbackBranch + handleDraftCallback dispatcher)
// Brick: telegram-inline-menu-callback v0.1.0 (le-GO C-UI)
//
// Dispatcher routing callback_query → handler registrato.
//
// Soft: cattura throw dell'handler, logga, ritorna `{ok:false}`. Mai propaga
// (rule globale GOAi #14: webhook deve restare alive, lo stato DB no rollback).

import type {
  CallbackContext,
  CallbackPayload,
  DispatchResult,
  MenuActionHandler,
  MenuActionRegistry,
} from "../types.ts";
import { decodeCallbackData, payloadActionKey } from "./decode-callback-data.ts";

export interface DispatchOptions {
  /**
   * Handler chiamato quando nessuna action matcha. Utile per loggare /
   * mandare un "azione sconosciuta" all'utente.
   * Riceve il payload decodificato (se decode è andato a buon fine) o
   * `null` (se decode è fallito).
   */
  on_unknown?: (
    payload: CallbackPayload | null,
    ctx: CallbackContext,
  ) => Promise<void> | void;
  /**
   * Hook eseguito PRIMA di ogni handler (es. metrics, audit log).
   * Eccezioni qui sono soft-catch e loggate.
   */
  before_dispatch?: (
    payload: CallbackPayload,
    ctx: CallbackContext,
  ) => Promise<void> | void;
  /** Hook AFTER dispatch (anche se handler fallisce). */
  after_dispatch?: (
    result: DispatchResult,
    ctx: CallbackContext,
  ) => Promise<void> | void;
}

/**
 * Dispatcher principale.
 *
 * Flow:
 * 1. Decode `ctx.raw_data` → `CallbackPayload` (se fail → `on_unknown(null, ctx)` + `{ok:false}`)
 * 2. Lookup `registry["namespace:action"]`
 * 3. Se trovato → invoke handler (soft-catch throw)
 * 4. Se non trovato → `on_unknown(payload, ctx)`
 *
 * Telegram impone `answerCallbackQuery` entro 15s — il consumer del brick
 * DEVE chiamarlo (vedi `helpers/answer-callback.ts`) prima/dopo dispatch.
 */
export async function handleCallback(
  ctx: CallbackContext,
  registry: MenuActionRegistry,
  opts: DispatchOptions = {},
): Promise<DispatchResult> {
  const decoded = decodeCallbackData(ctx.raw_data);
  if (!decoded.ok) {
    console.warn({
      fn: "handleCallback.decode_failed",
      error: decoded.error,
      raw: ctx.raw_data,
      callback_query_id: ctx.callback_query_id,
    });
    try {
      await opts.on_unknown?.(null, ctx);
    } catch (e) {
      console.error({
        fn: "handleCallback.on_unknown_threw",
        error: (e as Error)?.message ?? String(e),
      });
    }
    const result: DispatchResult = {
      ok: false,
      error: decoded.error,
      raw_data: ctx.raw_data,
    };
    await safeAfter(opts.after_dispatch, result, ctx);
    return result;
  }

  const payload = decoded.payload;
  const key = payloadActionKey(payload);
  const handler: MenuActionHandler | undefined = registry[key];

  if (!handler) {
    console.warn({
      fn: "handleCallback.unknown_action",
      action_key: key,
      raw: ctx.raw_data,
    });
    try {
      await opts.on_unknown?.(payload, ctx);
    } catch (e) {
      console.error({
        fn: "handleCallback.on_unknown_threw",
        error: (e as Error)?.message ?? String(e),
      });
    }
    const result: DispatchResult = {
      ok: false,
      error: "unknown_action",
      action_key: key,
      raw_data: ctx.raw_data,
    };
    await safeAfter(opts.after_dispatch, result, ctx);
    return result;
  }

  // before_dispatch hook (soft).
  try {
    await opts.before_dispatch?.(payload, ctx);
  } catch (e) {
    console.error({
      fn: "handleCallback.before_dispatch_threw",
      action_key: key,
      error: (e as Error)?.message ?? String(e),
    });
  }

  // Esegui handler con soft-catch (GOAi lezione #14).
  let result: DispatchResult;
  try {
    await handler(payload, ctx);
    result = { ok: true, action_key: key };
  } catch (e) {
    const err = e as Error;
    console.error({
      fn: "handleCallback.handler_threw",
      action_key: key,
      raw: ctx.raw_data,
      message: err?.message ?? String(e),
      stack: err?.stack?.slice(0, 500),
    });
    result = {
      ok: false,
      error: `handler_threw: ${err?.message ?? "unknown"}`,
      action_key: key,
      raw_data: ctx.raw_data,
    };
  }

  await safeAfter(opts.after_dispatch, result, ctx);
  return result;
}

async function safeAfter(
  hook: DispatchOptions["after_dispatch"],
  result: DispatchResult,
  ctx: CallbackContext,
): Promise<void> {
  if (!hook) return;
  try {
    await hook(result, ctx);
  } catch (e) {
    console.error({
      fn: "handleCallback.after_dispatch_threw",
      error: (e as Error)?.message ?? String(e),
    });
  }
}

/**
 * Helper per costruire un registry da una lista [actionKey, handler].
 * Utile per builder pattern lato consumer.
 */
export function createRegistry(
  entries: Array<[string, MenuActionHandler]>,
): MenuActionRegistry {
  const reg: MenuActionRegistry = {};
  for (const [k, h] of entries) {
    if (reg[k]) {
      console.warn({
        fn: "createRegistry.duplicate_key",
        key: k,
        warn: "handler precedente sovrascritto",
      });
    }
    reg[k] = h;
  }
  return reg;
}
