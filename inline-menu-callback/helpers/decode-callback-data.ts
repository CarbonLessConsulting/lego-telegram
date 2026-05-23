// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-telegram-webhook/index.ts:1246-1251
// Brick: telegram-inline-menu-callback v0.1.0 (le-GO C-UI)
//
// Decode + validation di callback_data.
//
// Soft: nessun throw. Schema invalido → `{ok:false, error}`.
//
// Validazione:
// - non vuoto
// - <= 64 byte UTF-8 (Telegram non manda mai data oltre questo, ma defensive)
// - almeno `<namespace>:<action>` presente
// - namespace + action contengono solo [a-zA-Z0-9_-] (no injection in match registry)
// - args URL-decoded per il consumer

import type { CallbackPayload, DecodedCallback } from "../types.ts";

const MAX_BYTES = 64;
const SAFE_KEY_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const SEP = ":";

/**
 * Decodifica una stringa `callback_data` ricevuta da Telegram in payload
 * strutturato.
 *
 * OWASP A03 (injection): namespace/action validati contro whitelist regex.
 * Args lasciati raw URL-decoded — il consumer è responsabile di sanitizzarli
 * (es. SQL escaping, HTML escaping) prima dell'uso.
 */
export function decodeCallbackData(raw: string | undefined | null): DecodedCallback {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "empty_data", raw: String(raw ?? "") };
  }
  // Difensiva: verifica byte length.
  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > MAX_BYTES) {
    return { ok: false, error: "exceeds_64_bytes", raw };
  }
  const parts = raw.split(SEP);
  if (parts.length < 2) {
    return { ok: false, error: "missing_action", raw };
  }
  const namespace = parts[0];
  const action = parts[1];
  if (!SAFE_KEY_RE.test(namespace)) {
    return { ok: false, error: "invalid_namespace", raw };
  }
  if (!SAFE_KEY_RE.test(action)) {
    return { ok: false, error: "invalid_action", raw };
  }
  const args: string[] = [];
  for (let i = 2; i < parts.length; i++) {
    try {
      args.push(decodeURIComponent(parts[i]));
    } catch {
      // Sequenza % invalida — preserviamo raw per il consumer.
      args.push(parts[i]);
    }
  }
  const payload: CallbackPayload = { namespace, action, args, raw };
  return { ok: true, payload };
}

/**
 * Helper per costruire la chiave del registry handler.
 * Convenzione canonical: `<namespace>:<action>`.
 */
export function actionKey(namespace: string, action: string): string {
  return `${namespace}${SEP}${action}`;
}

/**
 * Estrai action key (`namespace:action`) da CallbackPayload, utile per
 * lookup diretto in registry senza ricomporre.
 */
export function payloadActionKey(payload: CallbackPayload): string {
  return actionKey(payload.namespace, payload.action);
}
