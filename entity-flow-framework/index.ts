// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain) · entry pubblico

export {
  DEFAULT_ENGINE_CONFIG,
  type AdvanceResult,
  type CommitContext,
  type CommitResult,
  type EntityFlowDefinition,
  type FlowEngineConfig,
  type FlowFieldSpec,
  type FlowRunRow,
  type FlowRunStatus,
  type FlowStep,
  type SupabaseLike,
} from './types';

export {
  defineFlow,
  getFlow,
  listFlows,
  clearFlowRegistry,
  getNextStep,
} from './helpers/define-flow';

export {
  startFlowRun,
} from './helpers/start-flow-run';

export {
  loadActiveRun,
} from './helpers/load-active-run';

export {
  advanceStep,
} from './helpers/advance-step';

export {
  validateStepInput,
  type ValidationResult,
} from './helpers/validate-step-input';

export {
  renderStepPrompt,
} from './helpers/render-step-prompt';

export {
  abandonRun,
  abandonExpiredRuns,
} from './helpers/abandon-run';

// Example flows (template — il consumer deve override commit_fn)
export { exampleClienteCreateFlow } from './flows/_example-cliente.flow';
export { exampleVeicoloQuickFlow } from './flows/_example-veicolo.flow';
export { examplePreventivoFlow } from './flows/_example-preventivo.flow';
