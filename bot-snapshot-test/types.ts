// Brick: telegram-bot-snapshot-test v0.1.0 (le-GO G-Ops)
// Tipi pubblici per snapshot test bot Telegram.

export interface FixtureExpect {
  /** HTTP status code atteso. Default 200. */
  response_status?: number;
  /** Subset di campi attesi nel response JSON. Comparison: subset deep. */
  response_body_subset?: Record<string, unknown>;
  /** Predicati custom (es. "iters >= 1"). Stringa parsata semplice. */
  response_body_predicates?: string[];
}

export interface Fixture {
  /** Identifier univoco del flow (snake_case). */
  name: string;
  /** Descrizione human-readable. */
  description: string;
  /** Payload Telegram update da POSTare al webhook. */
  update: Record<string, unknown>;
  /** Aspettative su response. */
  expect: FixtureExpect;
  /** Skippa questo flow nel run (default false). */
  skip?: boolean;
}

export interface FixtureSet {
  bot_username: string;
  description?: string;
  flows: Fixture[];
}

export interface RunOptions {
  webhookUrl: string;
  webhookSecret: string;
  fixtures: FixtureSet;
  /** Timeout per fixture in ms. Default 30s. */
  timeoutMs?: number;
}

export interface FixtureResult {
  name: string;
  ok: boolean;
  response_status: number;
  response_body: unknown;
  duration_ms: number;
  failed_assertions: string[];
}

export interface SnapshotResult {
  bot_username: string;
  captured_at: string;
  total: number;
  passed: number;
  failed: number;
  results: FixtureResult[];
}

export interface DiffChange {
  fixture: string;
  field: string;
  reference: unknown;
  current: unknown;
}

export interface DiffResult {
  equal: boolean;
  total_fixtures: number;
  changes: DiffChange[];
  /** Campi ignorati per design (rumore). */
  ignored_fields: string[];
}
