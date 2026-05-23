// Brick: telegram-bot-snapshot-test v0.1.0 (le-GO G-Ops)
// Diff engine: confronta 2 snapshot result + ignora campi rumore.

import type { DiffChange, DiffResult, SnapshotResult } from "../types.ts";

/**
 * Campi che cambiano tra run anche su bot identico (rumore).
 * Vengono normalizzati prima del diff.
 */
const IGNORED_FIELDS_DEFAULT = [
  "captured_at",
  "duration_ms",
  "cost_eur",          // varia leggermente per LLM non-deterministico
  "cost_usd",
  "iters",             // può variare 1-3 per query analoga
  "message_id",        // Telegram assegna runtime
  "update_id",         // monotonic Telegram
  "elapsed_ms",
  "conversation_id",   // UUID generato runtime
];

/**
 * Confronta 2 snapshot, ignorando campi rumore.
 *
 * Reference = snapshot pre-refactor (atteso).
 * Current = snapshot post-refactor (osservato).
 */
export function diffSnapshots(
  reference: SnapshotResult,
  current: SnapshotResult,
  ignoredFields: string[] = IGNORED_FIELDS_DEFAULT,
): DiffResult {
  const changes: DiffChange[] = [];

  // Verifica fixture count
  if (reference.total !== current.total) {
    changes.push({
      fixture: "<meta>",
      field: "total_fixtures",
      reference: reference.total,
      current: current.total,
    });
  }

  // Index by fixture name
  const refByName = new Map(reference.results.map((r) => [r.name, r]));
  const curByName = new Map(current.results.map((r) => [r.name, r]));

  // Check fixtures missing in current
  for (const refName of refByName.keys()) {
    if (!curByName.has(refName)) {
      changes.push({
        fixture: refName,
        field: "<missing>",
        reference: "present",
        current: "missing",
      });
    }
  }

  // Compare existing fixtures
  for (const [name, refResult] of refByName.entries()) {
    const curResult = curByName.get(name);
    if (!curResult) continue;

    // ok
    if (refResult.ok !== curResult.ok) {
      changes.push({
        fixture: name,
        field: "ok",
        reference: refResult.ok,
        current: curResult.ok,
      });
    }

    // response_status
    if (refResult.response_status !== curResult.response_status) {
      changes.push({
        fixture: name,
        field: "response_status",
        reference: refResult.response_status,
        current: curResult.response_status,
      });
    }

    // failed_assertions diff
    const refAssertions = JSON.stringify(refResult.failed_assertions.sort());
    const curAssertions = JSON.stringify(curResult.failed_assertions.sort());
    if (refAssertions !== curAssertions) {
      changes.push({
        fixture: name,
        field: "failed_assertions",
        reference: refResult.failed_assertions,
        current: curResult.failed_assertions,
      });
    }

    // response_body deep diff (skip ignored fields)
    const refBody = stripIgnored(refResult.response_body, ignoredFields);
    const curBody = stripIgnored(curResult.response_body, ignoredFields);
    if (JSON.stringify(refBody) !== JSON.stringify(curBody)) {
      changes.push({
        fixture: name,
        field: "response_body",
        reference: refBody,
        current: curBody,
      });
    }
  }

  return {
    equal: changes.length === 0,
    total_fixtures: reference.total,
    changes,
    ignored_fields: ignoredFields,
  };
}

function stripIgnored(obj: unknown, ignored: string[]): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => stripIgnored(item, ignored));
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (ignored.includes(key)) continue;
    result[key] = stripIgnored(val, ignored);
  }
  return result;
}
