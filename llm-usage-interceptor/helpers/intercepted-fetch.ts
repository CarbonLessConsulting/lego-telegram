// Brick: llm-usage-interceptor v0.3.0 (le-GO G-Ops)
//
// 🚨 ZERO TOKEN SFUGGE 🚨
// Drop-in replacement per fetch() verso API LLM. Logga su llm_usage_costs.

import type {
  InterceptedFetchDeps,
  Provider,
  UsageMeta,
  UsageRow,
} from "../types.ts";
import {
  detectProvider,
  isAudioEndpoint,
  isEmbeddingsEndpoint,
  isImageGenEndpoint,
} from "./detect-provider.ts";
import { parseModelFromRequest, parseUsageFromResponse } from "./parse-usage.ts";
import { computeCostUsd, getPricing as defaultGetPricing } from "../pricing/pricing-table.ts";

/**
 * Drop-in replacement per `fetch()` verso API LLM.
 *
 * Esegue la fetch, parsea usage dalla response, inserisce una riga su
 * `llm_usage_costs` del project locale, poi ritorna la response originale
 * al chiamante. Tutto in sequenza (no fire-and-forget) per garantire
 * ZERO TOKEN LEAK.
 *
 * USAGE:
 *   const res = await interceptedFetch(
 *     "https://api.anthropic.com/v1/messages",
 *     { method: "POST", headers: {...}, body: JSON.stringify({...}) },
 *     { tenant_id, edge_function: "sofia-erp", operation: "reply" },
 *     { supabaseAdmin },
 *   );
 *   const data = await res.json();
 */
export async function interceptedFetch(
  url: string | URL,
  init: RequestInit,
  meta: UsageMeta,
  deps: InterceptedFetchDeps,
): Promise<Response> {
  const fetchFn = deps.fetch ?? fetch;
  const log = deps.log ?? (() => {});
  const eurUsdRate = deps.eurUsdRate ?? 0.92;
  const getPricing = deps.getPricing ?? defaultGetPricing;
  const provider: Provider = meta.provider ?? detectProvider(url);
  const audioMode = isAudioEndpoint(url);
  const embeddingsMode = isEmbeddingsEndpoint(url);
  const imageMode = isImageGenEndpoint(url);
  const modelFromReq = parseModelFromRequest(init.body);

  const start = Date.now();
  let response: Response;
  let networkError: Error | undefined;

  try {
    response = await fetchFn(url, init);
  } catch (err) {
    networkError = err instanceof Error ? err : new Error(String(err));
    // Crea Response synthetic per uniformare il return contract
    response = new Response(
      JSON.stringify({ error: networkError.message }),
      { status: 599, headers: { "content-type": "application/json" } },
    );
  }

  const duration_ms = Date.now() - start;
  const http_status = response.status;
  const success = response.ok && !networkError;

  // Clone per parsare body senza consumare lo stream del chiamante
  let parsedBody: unknown = null;
  let errorMessage: string | null = networkError?.message ?? null;
  let model = modelFromReq ?? "unknown";
  let input_tokens = 0;
  let output_tokens = 0;

  if (!networkError) {
    try {
      const clone = response.clone();
      const ct = response.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        parsedBody = await clone.json();
        if (success) {
          const parsed = parseUsageFromResponse(provider, parsedBody, modelFromReq);
          model = parsed.model;
          input_tokens = parsed.input_tokens;
          output_tokens = parsed.output_tokens;
        } else {
          // Errore HTTP: estraggo messaggio errore
          const errObj = parsedBody as Record<string, unknown>;
          errorMessage =
            typeof errObj?.error === "string"
              ? errObj.error
              : JSON.stringify(errObj?.error ?? errObj).slice(0, 500);
        }
      } else {
        // Response non-JSON (es. audio response per Whisper sync, image binary)
        // Non parsiamo usage; model + audio_seconds via meta override
      }
    } catch (err) {
      log("interceptor: parse failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Embeddings: input_tokens valido, output_tokens=0 (OK)
  // Audio: meta.audio_seconds è il driver, tokens=0
  // Images: meta.images_count è il driver, tokens=0

  const pricing = getPricing(model);
  const cost_usd = pricing
    ? computeCostUsd(
        pricing,
        input_tokens,
        output_tokens,
        audioMode ? (meta.audio_seconds ?? 0) : 0,
        imageMode ? (meta.images_count ?? 0) : 0,
      )
    : 0;
  const cost_eur = cost_usd * eurUsdRate;

  const row: UsageRow = {
    tenant_id: meta.tenant_id ?? null,
    owner_user_id: meta.owner_user_id ?? null,
    edge_function: meta.edge_function,
    operation: meta.operation ?? null,
    task_type: meta.task_type ?? null,
    provider,
    model,
    input_tokens,
    output_tokens,
    audio_seconds: audioMode ? (meta.audio_seconds ?? 0) : 0,
    images_count: imageMode ? (meta.images_count ?? 0) : 0,
    cost_usd,
    cost_eur,
    duration_ms,
    success,
    error_message: errorMessage,
    http_status,
    metadata: {
      ...(meta.metadata ?? {}),
      endpoint_mode: audioMode
        ? "audio"
        : embeddingsMode
          ? "embeddings"
          : imageMode
            ? "image_gen"
            : "chat",
      ...(pricing ? {} : { unknown_model_pricing: true }),
    },
    request_id: meta.request_id ?? null,
  };

  if (!deps.skipLogging) {
    try {
      const { error } = await deps.supabaseAdmin.from("llm_usage_costs").insert(row);
      if (error) {
        log("interceptor: insert llm_usage_costs FAILED", {
          err: typeof error === "object" && error !== null
            ? (error as Record<string, unknown>).message
            : String(error),
          provider,
          model,
        });
      }
    } catch (err) {
      log("interceptor: insert throw", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (networkError) {
    // Re-throw per uniformità: chiamante si aspetta network error come throw
    throw networkError;
  }
  return response;
}
