// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-telegram-webhook/index.ts:1132-1148
// Brick: telegram-inline-menu-callback v0.1.0 (le-GO C-UI)
//
// Safe encoding di callback_data Telegram. Limite hard: 64 byte UTF-8.
//
// Lezione globale GOAi #7 (surrogate orfano UTF-16): `String.prototype.slice`
// taglia su UTF-16 code unit → spezza surrogate pair emoji. Iteriamo per
// code point via `Array.from`, poi tronchiamo se l'encoded byte-length
// supera il margine.

import type { CallbackPayload, EncodedCallback } from "../types.ts";

const MAX_BYTES = 64;
const SEP = ":";

/**
 * Codifica un payload routing in stringa `callback_data` <= 64 byte UTF-8.
 *
 * Formato output: `<namespace>:<action>:<arg1>:<arg2>...`
 *
 * Args sono URL-encoded singolarmente (per preservare il separator `:`).
 * Se la stringa supera 64 byte, gli args vengono troncati dall'ultimo
 * progressivamente — il prefisso `<namespace>:<action>` resta sempre intero
 * (è il routing key, non può essere amputato).
 *
 * Se anche solo `<namespace>:<action>` supera 64 byte, ritorna `truncated=true`
 * con stringa amputata: il chiamante DEVE rifattorizzare gli identificatori.
 *
 * Best-practice quando args grandi (es. testo libero utente):
 *   - salva payload pieno in DB
 *   - codifica solo un id corto (es. UUID short = 8 byte)
 */
export function encodeCallbackData(payload: {
  namespace: string;
  action: string;
  args?: Array<string | number>;
}): EncodedCallback {
  const enc = new TextEncoder();
  const ns = payload.namespace.trim();
  const action = payload.action.trim();
  if (!ns || !action) {
    return { data: "", truncated: true, bytes: 0 };
  }

  const prefix = `${ns}${SEP}${action}`;
  const prefixBytes = enc.encode(prefix).length;

  if (prefixBytes > MAX_BYTES) {
    // Casi limite: il chiamante deve accorciare namespace/action.
    return { data: prefix, truncated: true, bytes: prefixBytes };
  }

  const args = payload.args ?? [];
  if (args.length === 0) {
    return { data: prefix, truncated: false, bytes: prefixBytes };
  }

  // Aggiungiamo args uno alla volta, tronchiamo l'ultimo se necessario.
  let out = prefix;
  let outBytes = prefixBytes;
  let truncated = false;
  let argsEmitted = 0;

  for (let i = 0; i < args.length; i++) {
    const encodedArg = encodeURIComponent(String(args[i]));
    const sepBytes = enc.encode(SEP).length;
    const argBytes = enc.encode(encodedArg).length;
    const remaining = MAX_BYTES - outBytes - sepBytes;
    if (remaining <= 0) {
      // Non c'è nemmeno spazio per il separator + 1 byte arg.
      truncated = true;
      break;
    }
    if (argBytes <= remaining) {
      out += SEP + encodedArg;
      outBytes += sepBytes + argBytes;
      argsEmitted++;
      continue;
    }
    // Tronchiamo l'arg corrente per code-point (no surrogate orfano).
    truncated = true;
    let chunk = "";
    for (const ch of Array.from(encodedArg)) {
      const candidate = chunk + ch;
      if (enc.encode(candidate).length > remaining) break;
      chunk = candidate;
    }
    if (chunk.length > 0) {
      out += SEP + chunk;
      outBytes += sepBytes + enc.encode(chunk).length;
      argsEmitted++;
    }
    break;
  }

  // Se non TUTTI gli arg sono stati emessi → truncated.
  if (argsEmitted < args.length) truncated = true;

  return { data: out, truncated, bytes: outBytes };
}

/**
 * Variante shortcut quando l'unica differenza è l'arg pretty-stringato.
 * Equivalente a encodeCallbackData({namespace, action, args:[arg]}).
 */
export function encodeCallbackSimple(
  namespace: string,
  action: string,
  arg?: string | number,
): EncodedCallback {
  return encodeCallbackData({
    namespace,
    action,
    args: arg !== undefined ? [arg] : [],
  });
}

/**
 * Funzione helper esposta per consumer che vogliono solo verificare se un
 * payload encoded sta entro il limite. Utile in test.
 */
export function isWithinTelegramCallbackLimit(data: string): boolean {
  return new TextEncoder().encode(data).length <= MAX_BYTES;
}

export const TELEGRAM_CALLBACK_MAX_BYTES = MAX_BYTES;
