// Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
// Entry point pubblico.

export { startDraft, type StartDraftDeps } from './helpers/start-draft';
export {
  loadActiveDraft,
  loadActiveDraftScoped,
  type LoadDraftDeps,
} from './helpers/load-active-draft';
export {
  appendToDraft,
  defaultMergePayloads,
  type AppendDraftInput,
} from './helpers/append-to-draft';
export {
  transitionState,
  isTransitionAllowed,
  type TransitionDeps,
} from './helpers/transition-state';
export {
  abandonDraft,
  abandonExpiredDrafts,
  type AbandonDeps,
} from './helpers/abandon-draft';
export {
  buildDraftSummary,
  formatSummaryHtml,
  type DraftSummary,
} from './helpers/draft-summary';

export type {
  DraftState,
  DraftRow,
  DraftSourceEntry,
  StateTransition,
  StartDraftInput,
  AppendDraftResult,
  AbandonResult,
} from './types';
export { ACTIVE_STATES } from './types';
