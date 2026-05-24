// Brick: llm-usage-interceptor v0.3.0 (le-GO G-Ops)
// Entry point pubblico.
//
// 🚨 ZERO TOKEN SFUGGE 🚨
//
// USAGE:
//
//   import { interceptedFetch } from "jsr:@goai/lego-telegram/llm-usage-interceptor";
//   import { createClient } from "jsr:@supabase/supabase-js@2";
//
//   const supabaseAdmin = createClient(
//     Deno.env.get("SUPABASE_URL")!,
//     Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
//   );
//
//   // Drop-in replacement per fetch verso API LLM:
//   const res = await interceptedFetch(
//     "https://api.anthropic.com/v1/messages",
//     {
//       method: "POST",
//       headers: { "x-api-key": ..., "anthropic-version": "2023-06-01" },
//       body: JSON.stringify({ model: "claude-sonnet-4-6", messages: [...], max_tokens: 1024 }),
//     },
//     { tenant_id, edge_function: "sofia-erp", operation: "reply", task_type: "reasoning_hard" },
//     { supabaseAdmin },
//   );
//
//   const data = await res.json();
//
// PREREQUISITO: tabella public.llm_usage_costs nel project Supabase.
// Vedi db/migration-template.sql.

export { interceptedFetch } from "./helpers/intercepted-fetch.ts";
export { detectProvider, isAudioEndpoint, isEmbeddingsEndpoint, isImageGenEndpoint } from "./helpers/detect-provider.ts";
export { parseUsageFromResponse, parseModelFromRequest } from "./helpers/parse-usage.ts";
export { PRICING, getPricing, computeCostUsd, type ModelPrice } from "./pricing/pricing-table.ts";
export type {
  InterceptedFetchDeps,
  Provider,
  SupabaseAdminLike,
  UsageMeta,
  UsageRow,
} from "./types.ts";
