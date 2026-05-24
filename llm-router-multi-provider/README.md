# llm-router-multi-provider

> Brick le-GO (categoria B-Sofia-Core) — Router intelligente multi-provider per LLM.

**Vision**: Sofia sceglie sempre **il modello migliore al prezzo migliore** per ogni task. Non vincolata a un unico vendor. 7 provider supportati con fallback automatico.

## Provider supportati (v0.2.0)

| Provider | Specialty | EU residency |
|---|---|---|
| **anthropic** | Reasoning hard, Vision, tool calling top | ❌ (Bedrock EU futuro) |
| **openai** | GPT-4o, Whisper, embeddings | ❌ |
| **deepseek** | T0/T1 cheap default | ❌ (CN) |
| **mistral** 🇪🇺 | Italiano sfumato, customer-care EU sovereign | ✅ (FR) |
| **groq** | Llama 70B fastest (~1.500 tok/s) | ❌ |
| **cerebras** | Llama 70B backup speed | ❌ |
| **fireworks** | Qwen 72B tool calling | ❌ |

## Task types canonical

`intent_classification` · `kb_lookup` · `faq` · `summary` · `italian_natural` · `customer_care` · `tool_calling_complex` · `llama_speed` · `reasoning_hard` · `reasoning_extra_hard` · `code_gen`

## Usage

```ts
import { callLLM } from "jsr:@goai/lego-telegram/llm-router-multi-provider";

const result = await callLLM({
  ctx: { task_type: "intent_classification" },
  messages: [
    { role: "system", content: "Classify user intent in 1 word." },
    { role: "user", content: "vorrei prenotare un tagliando" },
  ],
  max_tokens: 50,
}, {
  getEnv: (k) => Deno.env.get(k),
});

// result.provider === "groq"
// result.model === "llama-3.3-70b-versatile"
// result.content === "appointment_booking"
// result.duration_ms ~= 80ms
```

### EU sovereign client

```ts
const result = await callLLM({
  ctx: { task_type: "customer_care", data_residency: "eu_strict" },
  messages: [...],
}, deps);
// Forza Mistral Large (Francia). Salta provider US.
```

### Override esplicito (A-B testing)

```ts
const result = await callLLM({
  ctx: {
    task_type: "faq",
    force_provider: "anthropic",
    force_model: "claude-sonnet-4-6",
  },
  messages: [...],
}, deps);
```

## Fallback automatico

Se il provider primario fallisce (down, rate-limit, 5xx) il router prova in ordine i candidati successivi del task type. Throw solo se TUTTI falliscono.

## Env var richieste

Almeno una delle seguenti deve essere settata; il router filtra automaticamente:
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `FIREWORKS_API_KEY`.

## Integrazione con cost-meter

Il consumer dovrebbe loggare il risultato con `cost-meter-per-model`:

```ts
import { logUsage } from "jsr:@goai/lego-telegram/cost-meter-per-model";

const result = await callLLM({...}, deps);
await logUsage({
  tenant_id, edge_function: "sofia-erp",
  provider: result.provider,
  model: result.model,
  operation: "intent_classification",
  input_tokens: result.usage.input_tokens,
  output_tokens: result.usage.output_tokens,
  duration_ms: result.duration_ms,
  success: true,
}, { supabaseAdmin });
```

## Anti-clone moat

Vedi `compliance/anti-clone.json`.

## Pricing (verificato 2026-05-24)

Vedi `pricing/router-table.ts` campo `cost_signal` (USD per 1M tok output orientativo per ranking secondario).

## Stato

- **v0.2.0** (2026-05-24): bootstrap router 7 provider, 11 task types, fallback automatico, EU residency flag.
- Donor pattern: `cost-meter-per-model` (le-GO G-Ops).
