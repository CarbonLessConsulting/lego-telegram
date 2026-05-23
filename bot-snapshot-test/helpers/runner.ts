// Brick: telegram-bot-snapshot-test v0.1.0 (le-GO G-Ops)
// Runner: esegue ogni fixture come POST al webhook + cattura response.

import type { Fixture, FixtureResult, RunOptions, SnapshotResult } from "../types.ts";
import { evaluatePredicate, isSubset } from "./assertions.ts";

const DEFAULT_TIMEOUT_MS = 30_000;

async function runFixture(
  opts: RunOptions,
  fixture: Fixture,
): Promise<FixtureResult> {
  const t0 = Date.now();
  const failed: string[] = [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const res = await fetch(opts.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": opts.webhookSecret,
      },
      body: JSON.stringify(fixture.update),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const body = await res.json().catch(() => ({}));
    const duration = Date.now() - t0;

    // Asserzioni
    const expectStatus = fixture.expect.response_status ?? 200;
    if (res.status !== expectStatus) {
      failed.push(`response_status: expected ${expectStatus}, got ${res.status}`);
    }

    if (fixture.expect.response_body_subset) {
      const subsetCheck = isSubset(fixture.expect.response_body_subset, body);
      if (!subsetCheck.ok) {
        failed.push(`response_body_subset: ${subsetCheck.reason}`);
      }
    }

    if (fixture.expect.response_body_predicates) {
      for (const pred of fixture.expect.response_body_predicates) {
        const result = evaluatePredicate(pred, body);
        if (!result.ok) failed.push(`predicate "${pred}": ${result.reason}`);
      }
    }

    return {
      name: fixture.name,
      ok: failed.length === 0,
      response_status: res.status,
      response_body: body,
      duration_ms: duration,
      failed_assertions: failed,
    };
  } catch (e) {
    return {
      name: fixture.name,
      ok: false,
      response_status: 0,
      response_body: null,
      duration_ms: Date.now() - t0,
      failed_assertions: [`fetch_error: ${(e as Error).message}`],
    };
  }
}

export async function runSnapshot(opts: RunOptions): Promise<SnapshotResult> {
  const results: FixtureResult[] = [];
  for (const fixture of opts.fixtures.flows) {
    if (fixture.skip) continue;
    const result = await runFixture(opts, fixture);
    results.push(result);
  }

  return {
    bot_username: opts.fixtures.bot_username,
    captured_at: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
