// Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
// Entry point pubblico.

export { startDraft, type StartDraftDeps } from "./helpers/start-draft.ts";
export {
  loadActiveDraft,
  loadActiveDraftScoped,
  type LoadDraftDeps,
} from "./helpers/load-active-draft.ts";
export {
  appendToDraft,
  defaultMergePayloads,
  type AppendDraftInput,
} from "./helpers/append-to-draft.ts";
export {
  transitionState,
  isTransitionAllowed,
  type TransitionDeps,
} from "./helpers/transition-state.ts";
export {
  abandonDraft,
  abandonExpiredDrafts,
  type AbandonDeps,
} from "./helpers/abandon-draft.ts";
export {
  buildDraftSummary,
  formatSummaryHtml,
  type DraftSummary,
} from "./helpers/draft-summary.ts";

export type {
  DraftState,
  DraftRow,
  DraftSourceEntry,
  StateTransition,
  StartDraftInput,
  AppendDraftResult,
  AbandonResult,
} from "./types.ts";
export { ACTIVE_STATES } from "./types.ts";
