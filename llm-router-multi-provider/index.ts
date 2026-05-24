// Brick: llm-router-multi-provider v0.2.0 (le-GO B-Sofia-Core)
// Entry point pubblico.
//
// USAGE:
//
//   import { callLLM } from "jsr:@goai/lego-telegram/llm-router-multi-provider";
//
//   const result = await callLLM({
//     ctx: { task_type: "intent_classification" },
//     messages: [
//       { role: "system", content: "Classify user intent." },
//       { role: "user", content: msg },
//     ],
//     max_tokens: 50,
//   }, { getEnv: (k) => Deno.env.get(k) });
//
//   // result.provider="groq", result.model="llama-3.3-70b-versatile", result.content="..."
//
// EU sovereign clients:
//   ctx: { task_type: "customer_care", data_residency: "eu_strict" }
//   => Mistral Large (France) only
//
// Override esplicito (debug/A-B):
//   ctx: { task_type: "faq", force_provider: "anthropic", force_model: "claude-sonnet-4-6" }

export { callLLM, type CallLLMDeps } from "./helpers/call-llm.ts";
export { selectRoute, type SelectRouteOptions } from "./helpers/select-route.ts";
export { PROVIDERS, ROUTING_TABLE, type Candidate } from "./pricing/router-table.ts";

export type {
  CallLLMInput,
  CallLLMResult,
  ChatMessage,
  DataResidency,
  ProviderConfig,
  ProviderName,
  RouteSelection,
  RouterContext,
  TaskType,
} from "./types.ts";
