# llm-usage-interceptor

> 🚨 **ZERO TOKEN SFUGGE** 🚨 — Brick le-GO (categoria G-Ops). Drop-in replacement per `fetch()` verso API LLM. Logga ogni call su `llm_usage_costs` del project locale.

## Vision

> *Ogni singolo token deve essere intercettato e memorizzato. Non ne deve sfuggire nemmeno uno. Qui stanno i nostri soldi e i nostri business.* — Giuseppe Di Gregorio, 24/05/2026

## Cosa fa

Per ogni call HTTP verso `api.anthropic.com`, `api.openai.com`, `api.deepseek.com`, `api.mistral.ai`, `api.groq.com`, `api.cerebras.ai`, `api.fireworks.ai`, `generativelanguage.googleapis.com`:

1. Esegue la fetch
2. Parsea `usage` dalla response JSON (provider-specific)
3. Lookup pricing da `PRICING` table (verificata)
4. Calcola `cost_usd` e `cost_eur`
5. Insert riga su `llm_usage_costs` (Supabase locale)
6. Ritorna la Response originale al chiamante

Tutto in sequenza, no fire-and-forget. **Zero perdita anche su crash o rate-limit Supabase**.

## Usage

```ts
import { interceptedFetch } from "jsr:@goai/lego-telegram/llm-usage-interceptor";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// PRIMA (leak):
// const res = await fetch("https://api.anthropic.com/v1/messages", {...});

// DOPO (tracciato):
const res = await interceptedFetch(
  "https://api.anthropic.com/v1/messages",
  {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Ciao" }],
      max_tokens: 100,
    }),
  },
  {
    tenant_id: ctx.tenant_id,
    edge_function: "sofia-erp",
    operation: "reply",
    task_type: "reasoning_hard",
  },
  { supabaseAdmin },
);

const data = await res.json();
```

## Modi endpoint supportati

| Mode | Detect | Drivers cost |
|---|---|---|
| **chat** | `/v1/messages`, `/v1/chat/completions` | input_tokens + output_tokens |
| **embeddings** | `/v1/embeddings` | input_tokens only |
| **audio** | `/v1/audio/transcriptions`, `/v1/audio/translations` | `meta.audio_seconds` |
| **image gen** | `/v1/images/generations`, `/v1/images/edits` | `meta.images_count` |

Per audio/image passa `audio_seconds` o `images_count` in `meta` (response non li contiene).

## Prerequisito DB

Applica `db/migration-template.sql` sul project Supabase. Crea:
- Tabella `public.llm_usage_costs` (append-only, RLS service-role)
- View `public.v_llm_usage_breakdown_30d`
- 5 indici per breakdown (created_at, tenant, provider, task_type, edge_function)

## Provider auto-detect

L'URL determina il provider. Override con `meta.provider` se necessario.

## Pricing table

Vedi `pricing/pricing-table.ts`. Verificata 2026-05-24. Aggiornare trimestralmente.

Modello sconosciuto → `cost_usd=0` + `metadata.unknown_model_pricing=true`. **Mai throw**.

## CI guard (anti-regressione)

Vedi `.github/workflows/zero-leak-guard.yml`: ogni PR che introduce `fetch(...api.<provider>.com)` fuori da `interceptedFetch` → fail.

## Anti-clone

Vedi `compliance/anti-clone.json`.

## Stato

**v0.3.0** (2026-05-24): bootstrap brick. 8 provider supportati (Anthropic, OpenAI, DeepSeek, Mistral, Groq, Cerebras, Fireworks, Gemini). 4 endpoint mode (chat, embeddings, audio, image gen). Migration template DB. Donor pattern: `cost-meter-per-model` (G-Ops).
