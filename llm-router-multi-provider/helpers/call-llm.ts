// Brick: llm-router-multi-provider v0.2.0 (le-GO B-Sofia-Core)
//
// Dispatcher unico: chiama il provider selezionato.
// 6 provider OpenAI-compatible (openai, deepseek, mistral, groq, cerebras, fireworks)
// + 1 endpoint dedicato (anthropic /v1/messages).
//
// Fallback automatico: se il primo candidato fallisce, prova il successivo.

import type {
  CallLLMInput,
  CallLLMResult,
  ProviderName,
  RouteSelection,
} from "../types.ts";
import { PROVIDERS, ROUTING_TABLE } from "../pricing/router-table.ts";
import { selectRoute, type SelectRouteOptions } from "./select-route.ts";

export interface CallLLMDeps {
  /** Env getter (Deno.env.get, process.env, ecc). */
  getEnv: (name: string) => string | undefined;
  /** Fetch globale (override per test). */
  fetch?: typeof fetch;
  /** Logger opzionale per debug. */
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

/**
 * Chiama l'LLM scegliendo provider best-for-task con fallback automatico.
 */
export async function callLLM(
  input: CallLLMInput,
  deps: CallLLMDeps,
): Promise<CallLLMResult> {
  const fetchFn = deps.fetch ?? fetch;
  const log = deps.log ?? (() => {});

  const isAvailable = (p: ProviderName): boolean => {
    const cfg = PROVIDERS[p];
    return !!deps.getEnv(cfg.env_var);
  };

  const opts: SelectRouteOptions = { isProviderAvailable: isAvailable };

  // Lista candidati per fallback
  const candidates = ROUTING_TABLE[input.ctx.task_type] ?? [];
  const tried: ProviderName[] = [];
  let lastError: Error | undefined;

  // Tentativo primario via selectRoute
  let primary: RouteSelection;
  try {
    primary = selectRoute(input.ctx, opts);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }

  // Fallback iteration: primary + restanti candidati validi
  const attemptOrder: RouteSelection[] = [primary];
  for (const c of candidates) {
    if (c.provider === primary.provider && c.model === primary.model) continue;
    if (input.ctx.data_residency === "eu_strict" && !PROVIDERS[c.provider].eu_residency) continue;
    if (!isAvailable(c.provider)) continue;
    attemptOrder.push({ provider: c.provider, model: c.model, reason: "fallback: " + c.note });
  }

  for (const route of attemptOrder) {
    tried.push(route.provider);
    try {
      const start = Date.now();
      const result = await dispatchProvider(route, input, deps, fetchFn);
      result.duration_ms = Date.now() - start;
      log(`llm-router OK provider=${route.provider} model=${route.model}`, {
        task_type: input.ctx.task_type,
        tokens_in: result.usage.input_tokens,
        tokens_out: result.usage.output_tokens,
        duration_ms: result.duration_ms,
      });
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log(
        `llm-router FAIL provider=${route.provider} model=${route.model}: ${lastError.message}`,
        { task_type: input.ctx.task_type },
      );
    }
  }

  throw new Error(
    `llm-router all providers failed for task=${input.ctx.task_type}. ` +
      `Tried: ${tried.join(", ")}. Last error: ${lastError?.message ?? "unknown"}`,
  );
}

async function dispatchProvider(
  route: RouteSelection,
  input: CallLLMInput,
  deps: CallLLMDeps,
  fetchFn: typeof fetch,
): Promise<CallLLMResult> {
  const cfg = PROVIDERS[route.provider];
  const apiKey = deps.getEnv(cfg.env_var);
  if (!apiKey) {
    throw new Error(`Missing env var ${cfg.env_var} for provider ${route.provider}`);
  }

  if (route.provider === "anthropic") {
    return callAnthropic(route, input, apiKey, fetchFn);
  }
  return callOpenAICompatible(route, input, apiKey, cfg.base_url, fetchFn);
}

async function callOpenAICompatible(
  route: RouteSelection,
  input: CallLLMInput,
  apiKey: string,
  baseUrl: string,
  fetchFn: typeof fetch,
): Promise<CallLLMResult> {
  const body: Record<string, unknown> = {
    model: route.model,
    messages: input.messages,
  };
  if (input.max_tokens) body.max_tokens = input.max_tokens;
  if (typeof input.temperature === "number") body.temperature = input.temperature;
  if (input.tools && input.tools.length > 0) body.tools = input.tools;
  if (input.stop && input.stop.length > 0) body.stop = input.stop;

  const res = await fetchFn(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `${route.provider} ${res.status} ${res.statusText}: ${text.slice(0, 500)}`,
    );
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const message = choice?.message ?? {};

  return {
    provider: route.provider,
    model: route.model,
    content: message.content ?? "",
    tool_calls: message.tool_calls,
    finish_reason: choice?.finish_reason,
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
    duration_ms: 0, // riempito dal chiamante
    raw: data,
  };
}

async function callAnthropic(
  route: RouteSelection,
  input: CallLLMInput,
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<CallLLMResult> {
  // Estrai system message dal OpenAI-style messages
  const systemMsgs = input.messages.filter((m) => m.role === "system");
  const otherMsgs = input.messages.filter((m) => m.role !== "system");
  const system = systemMsgs.map((m) => m.content).join("\n\n") || undefined;

  const body: Record<string, unknown> = {
    model: route.model,
    max_tokens: input.max_tokens ?? 1024,
    messages: otherMsgs.map((m) => ({
      role: m.role === "tool" ? "user" : m.role,
      content: m.content,
    })),
  };
  if (system) body.system = system;
  if (typeof input.temperature === "number") body.temperature = input.temperature;
  if (input.tools && input.tools.length > 0) body.tools = input.tools;
  if (input.stop && input.stop.length > 0) body.stop_sequences = input.stop;

  const res = await fetchFn("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `anthropic ${res.status} ${res.statusText}: ${text.slice(0, 500)}`,
    );
  }

  const data = await res.json();
  const content = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  const toolUses = (data.content ?? []).filter((b: { type: string }) => b.type === "tool_use");

  return {
    provider: "anthropic",
    model: route.model,
    content,
    tool_calls: toolUses.length > 0 ? toolUses : undefined,
    finish_reason: data.stop_reason,
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
    duration_ms: 0,
    raw: data,
  };
}
