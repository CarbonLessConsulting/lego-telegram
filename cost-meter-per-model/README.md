# brick: telegram-cost-meter-per-model

> Versione: 0.1.0 · Categoria: G-Ops · Data: 23/05/2026
> Donor PRIMARY: `gomyreference/_shared/usage-meter.ts`

Cost meter **fine-grained per-call** per bot Telegram (e qualsiasi edge fn LLM).
Ledger append-only `ai_usage_logs` con breakdown per modello, provider, operation.
Helper drop-in: `logUsage`, `meteredCall`, `computeDailyCost`, `computeMonthlyCost`,
`checkCostCap`, `breakdownByModel`.

## Cosa risolve

**Problema**: nei bot Telegram agency (24 bot identificati) ogni chiamata LLM,
Whisper, Vision è un costo invisibile. Senza tracking per-call:
- Impossibile diagnosticare "perché questo tenant spende €X/mese?"
- Impossibile enforce quota per piano (free/pro/enterprise).
- Cost shock a fine mese.

**Soluzione**: pattern canonical da GoMyReference (`goref_ai_usage_logs` +
`_shared/usage-meter.ts`). Ledger append-only + helper soft no-throw.

## Differenza con `cost-meter-sofia` (NO duplicazione)

| Brick | Cosa fa | Granularità | Tabella |
|---|---|---|---|
| **`cost-meter-sofia`** | Cumulativo PER CONVERSAZIONE | conversation_id | `sofia_conversations.cost_total_usd` |
| **`telegram-cost-meter-per-model`** | Per-call ledger CON breakdown | per chiamata | `ai_usage_logs` (riga per call) |

Sono complementari: in produzione si usano insieme. Sofia mostra "questa conversation = €0.06". Il per-model ledger ti dice "di cui €0.04 sonnet + €0.01 whisper + €0.01 gpt-4o-mini".

## Quando usarlo

- Qualsiasi edge fn che chiama LLM / Whisper / Vision / embeddings.
- Bot Telegram multi-step (capture-photo → capture-voice → draft-message).
- Enforcement quota (piano free vs pro, cap giornaliero/mensile).
- Dashboard cost agency cross-tenant.

## Drop-in 3-step

### Step 1 — DB migration
```bash
sed -e 's/{{TABLE_NAME}}/ai_usage_logs/g' \
    -e 's/{{TENANTS_TABLE}}/tenants/g' \
  src/le-go/telegram-cost-meter-per-model/db/migration-template.sql \
  > supabase/migrations/$(date +%Y%m%d%H%M%S)_ai_usage_logs.sql
supabase db push --linked
```

### Step 2 — Edge function: log ogni LLM call
```ts
import { logUsage, meteredCall } from '@/le-go/telegram-cost-meter-per-model';

// Pattern A: manual log dopo call
const result = await callClaude(...);
void logUsage({ supabase }, {
  tenant_id, owner_user_id,
  edge_function: 'bot-capture-photo',
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  operation: 'ocr',
  input_tokens: result.usage.input_tokens,
  output_tokens: result.usage.output_tokens,
  duration_ms: t1 - t0,
});

// Pattern B: wrap call (preferito — auto-timing)
const ocrResult = await meteredCall(
  { supabase },
  {
    tenant_id, owner_user_id,
    edge_function: 'bot-capture-photo',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    operation: 'ocr',
  },
  async () => {
    const r = await callClaude(...);
    return {
      result: r.parsed,
      input_tokens: r.usage.input_tokens,
      output_tokens: r.usage.output_tokens,
    };
  },
);
```

### Step 3 — Quota enforcement
```ts
import { checkCostCap } from '@/le-go/telegram-cost-meter-per-model';

const cap = await checkCostCap(
  { supabase },
  { tenant_id, owner_user_id, cap_eur: 5.0, window: 'daily' },
);

if (!cap.allowed) {
  return { error: 'daily_cost_cap_exceeded', detail: cap };
}
// cap.current_eur / cap.remaining_eur disponibili per UI badge
```

## API pubblica

| Helper | Cosa |
|---|---|
| `logUsage(deps, entry)` | Soft insert `ai_usage_logs`. Mai-throw. |
| `meteredCall(deps, entry, fn)` | Wrap call + auto-log duration + success/error. |
| `computeUsageCost(entry)` | Calcola cost USD da tokens/audio + pricing table (no DB). |
| `computeDailyCost(deps, input)` | Sum cost ultime 24h (configurabile). |
| `computeMonthlyCost(deps, input)` | Sum cost mese corrente (o specifico YYYY-MM). |
| `checkCostCap(deps, input)` | Verifica cap EUR (daily/monthly). Ritorna {allowed, current, remaining}. |
| `breakdownByModel(deps, input)` | Group by model + provider (per dashboard). |
| `getPricing(model)` | Lookup ModelPricing. |
| `listSupportedModels()` | Lista modelli con pricing. |

## Pricing supportati (10 modelli)

Vedi `pricing/model-prices.ts`. Tutti con `source_url` ufficiale + `verified_at`.

| Model | Provider | Input \$/M | Output \$/M | Note |
|---|---|---|---|---|
| claude-opus-4-7 | anthropic | 15.00 | 75.00 | |
| claude-sonnet-4-6 | anthropic | 3.00 | 15.00 | |
| claude-sonnet-4-5-20250929 | anthropic | 3.00 | 15.00 | |
| claude-haiku-4-5-20251001 | anthropic | 1.00 | 5.00 | |
| claude-3-5-sonnet-20241022 | anthropic | 3.00 | 15.00 | legacy |
| gpt-4o | openai | 2.50 | 10.00 | |
| gpt-4o-mini | openai | 0.15 | 0.60 | |
| whisper-1 | openai | 0 | 0 | \$0.0001/sec audio |
| text-embedding-3-small | openai | 0.02 | 0 | embeddings |
| text-embedding-3-large | openai | 0.13 | 0 | embeddings |
| gemini-2.0-flash | gemini | 0.10 | 0.40 | |

Modello sconosciuto → `cost_usd=0` (loggato comunque per traccia). Pattern donor goref.

## Schema DB

Tabella `{{TABLE_NAME}}` (default `ai_usage_logs`):

| Colonna | Tipo | Note |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK | CASCADE |
| `owner_user_id` | UUID FK auth.users | SET NULL on user delete |
| `edge_function` | TEXT | Es. 'bot-capture-photo' |
| `provider` | TEXT | enum anthropic/openai/whisper/gemini/groq/cerebras |
| `model` | TEXT | Es. 'claude-sonnet-4-6' |
| `operation` | TEXT | Es. 'ocr', 'transcribe', 'reply' |
| `input_tokens`, `output_tokens` | INTEGER | |
| `audio_seconds`, `images_count` | NUMERIC/INTEGER | |
| `cost_usd` | NUMERIC(10,6) | Pre-calcolato dal client |
| `duration_ms`, `success`, `error_message` | | |
| `metadata` | JSONB | |
| `created_at` | TIMESTAMPTZ | |

View aggregata `{{TABLE_NAME}}_summary` (group by tenant/day/fn/provider/model).

## EUR/USD conversion

`checkCostCap` accetta `cap_eur` in euro. Conversion rate:
- Override esplicito via `eur_usd_rate` parametro.
- Env var `EUR_USD` (Deno o Node).
- Fallback 0.92 (rate baseline 2026).

## Compliance

Vedi `compliance/controls.json`. Stato baseline:
- **GDPR art.5** transparency: per-call ledger esposto via view summary.
- **GDPR art.32** security: RLS strict + service_role bypass.
- **EU AI Act art.13** transparency, **art.15** accuracy.
- **ISO 27001 A.12.4.1** event logging.
- **OWASP A09** logging failures.

No PII nei record (solo `user_id` UUID + `tenant_id` UUID).

## Portabilità (ADK Mod 1)

✅ Zero hardcode tenant_id / project_ref / bot_username
✅ Table name parametric (`{{TABLE_NAME}}`)
✅ EUR/USD rate env-configurable
✅ Pricing table estendibile (add modelli)

## Donor attribution

- Primary: `gomyreference/supabase/functions/_shared/usage-meter.ts` (PRICING + logUsage + meteredCall)
- Migration: `gomyreference/supabase/migrations/20260518100000_goref_ai_usage_logs.sql` (table + view + RLS)

## Changelog

### v0.1.0 — 23/05/2026
- Estrazione canonical da donor GoMyReference (92% conforme).
- 7 helper TS (logUsage + meteredCall + computeUsageCost + computeDailyCost + computeMonthlyCost + checkCostCap + breakdownByModel).
- Pricing table 10 modelli verificati.
- View aggregata `{{TABLE_NAME}}_summary` per dashboard.
- EUR/USD env-configurable.
- Mai-throw helper (lezione canonical #14).
- Complementare a `cost-meter-sofia` (no duplicazione).

### TODO v0.2.0
- RPC server-side per top-N expensive users / models.
- Real-time alert via Telegram quando cap raggiunto 80%.
- Multi-currency support (USD/EUR/GBP).
- Pricing aggiornati trimestrale via cron fetch.
