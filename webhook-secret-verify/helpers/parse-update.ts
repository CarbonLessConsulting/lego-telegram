// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/goref-telegram-webhook/index.ts
//        (pattern req.json() + narrowing)
// Brick: telegram-webhook-secret-verify v0.1.0 (le-GO F-Integrations)
//
// Parse safe del body JSON di un update Telegram. Ritorno discriminated union:
// nessun throw → caller controlla `result.ok`.
//
// Validazioni:
//  - body non vuoto
//  - body sotto soglia max (default 1 MB — Telegram updates raramente >1 KB,
//    file_id/text restano sotto questo limite)
//  - JSON parsabile
//  - struttura minima `{ update_id: number, ... }` (per scartare body random)

import type { ParseUpdateResult, TgUpdate } from "../types.ts";

/** Limite massimo body request webhook (1 MB di default). */
const MAX_BODY_BYTES = 1_000_000;

/**
 * Parse un Update Telegram dal body JSON della Request.
 *
 * @example
 *   const parsed = await parseUpdate(req);
 *   if (!parsed.ok) {
 *     console.warn({ fn: "webhook", parse_error: parsed.error });
 *     return new Response("Bad Request", { status: 400 });
 *   }
 *   const upd = parsed.update;  // tipato TgUpdate
 */
export async function parseUpdate(
  request: Request,
  opts: { max_body_bytes?: number } = {},
): Promise<ParseUpdateResult> {
  const max = opts.max_body_bytes ?? MAX_BODY_BYTES;

  let raw: string;
  try {
    raw = await request.text();
  } catch (e) {
    return { ok: false, error: "invalid_json", description: `read_error: ${String(e).slice(0, 100)}` };
  }

  if (!raw || raw.length === 0) {
    return { ok: false, error: "empty_body" };
  }
  if (raw.length > max) {
    return {
      ok: false,
      error: "body_too_large",
      description: `${raw.length} > ${max}`,
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: "invalid_json", description: String(e).slice(0, 100) };
  }

  if (
    typeof json !== "object" ||
    json === null ||
    typeof (json as { update_id?: unknown }).update_id !== "number"
  ) {
    return { ok: false, error: "missing_update_id" };
  }

  return { ok: true, update: json as TgUpdate };
}
