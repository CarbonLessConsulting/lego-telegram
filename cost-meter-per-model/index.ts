// Brick: telegram-cost-meter-per-model v0.1.0 (le-GO G-Ops)
// Entry point pubblico.

export { logUsage, meteredCall, computeUsageCost, type LogUsageDeps } from "./helpers/log-usage.ts";
export {
  computeDailyCost,
  type DailyCostDeps,
  type DailyCostInput,
  type DailyCostResult,
} from "./helpers/compute-daily-cost.ts";
export {
  computeMonthlyCost,
  type MonthlyCostDeps,
  type MonthlyCostInput,
  type MonthlyCostResult,
} from "./helpers/compute-monthly-cost.ts";
export {
  checkCostCap,
  type CheckCostCapDeps,
  type CheckCostCapInput,
} from "./helpers/check-cost-cap.ts";
export {
  breakdownByModel,
  type BreakdownDeps,
  type BreakdownInput,
} from "./helpers/breakdown-by-model.ts";

export {
  PRICING,
  WHISPER_USD_PER_AUDIO_SECOND,
  getPricing,
  listSupportedModels,
} from "./pricing/model-prices.ts";

export type {
  AiProvider,
  AiUsageEntry,
  ModelPricing,
  CostComputation,
  CostCapResult,
  BreakdownRow,
} from "./types.ts";
