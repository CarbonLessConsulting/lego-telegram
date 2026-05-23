// Brick: telegram-bot-snapshot-test v0.1.0 (le-GO G-Ops)
// Barrel re-export pubblico.

export { runSnapshot } from "./helpers/runner.ts";
export { diffSnapshots } from "./helpers/diff-engine.ts";
export { loadFixtures, loadFixturesJson } from "./helpers/fixture-loader.ts";
export { isSubset, evaluatePredicate } from "./helpers/assertions.ts";
export type {
  Fixture,
  FixtureExpect,
  FixtureResult,
  FixtureSet,
  RunOptions,
  SnapshotResult,
  DiffResult,
  DiffChange,
} from "./types.ts";
