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
} from "./types.ts";

export {
  defineFlow,
  getFlow,
  listFlows,
  clearFlowRegistry,
  getNextStep,
} from "./helpers/define-flow.ts";

export {
  startFlowRun,
} from "./helpers/start-flow-run.ts";

export {
  loadActiveRun,
} from "./helpers/load-active-run.ts";

export {
  advanceStep,
} from "./helpers/advance-step.ts";

export {
  validateStepInput,
  type ValidationResult,
} from "./helpers/validate-step-input.ts";

export {
  renderStepPrompt,
} from "./helpers/render-step-prompt.ts";

export {
  abandonRun,
  abandonExpiredRuns,
} from "./helpers/abandon-run.ts";

// Example flows (template — il consumer deve override commit_fn)
export { exampleClienteCreateFlow } from "./flows/_example-cliente.flow.ts";
export { exampleVeicoloQuickFlow } from "./flows/_example-veicolo.flow.ts";
export { examplePreventivoFlow } from "./flows/_example-preventivo.flow.ts";
