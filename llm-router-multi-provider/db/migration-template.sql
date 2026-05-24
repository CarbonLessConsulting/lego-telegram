-- Brick: llm-router-multi-provider v0.2.0 (le-GO B-Sofia-Core)
--
-- Estende gocotech_holding_usage_daily per supportare il tracking
-- provider × model × task_type del router multi-provider.
--
-- Idempotente: usa IF NOT EXISTS.

-- 1) Aggiungi colonne provider/model/task_type/cost se mancano
ALTER TABLE IF EXISTS gocotech_holding_usage_daily
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS task_type text,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(12,6) DEFAULT 0;

-- 2) Indici per breakdown dashboard
CREATE INDEX IF NOT EXISTS idx_usage_daily_provider
  ON gocotech_holding_usage_daily (provider, day DESC);

CREATE INDEX IF NOT EXISTS idx_usage_daily_task_type
  ON gocotech_holding_usage_daily (task_type, day DESC);

CREATE INDEX IF NOT EXISTS idx_usage_daily_tenant_provider
  ON gocotech_holding_usage_daily (tenant_id, provider, day DESC);

-- 3) View aggregata per dashboard cost-control
CREATE OR REPLACE VIEW v_llm_router_breakdown_30d AS
SELECT
  tenant_id,
  provider,
  model,
  task_type,
  COUNT(*) AS calls,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost_usd) AS total_cost_usd,
  AVG(duration_ms) AS avg_duration_ms,
  MIN(day) AS first_day,
  MAX(day) AS last_day
FROM gocotech_holding_usage_daily
WHERE day >= CURRENT_DATE - INTERVAL '30 days'
  AND provider IS NOT NULL
GROUP BY tenant_id, provider, model, task_type;

COMMENT ON VIEW v_llm_router_breakdown_30d IS
  'Breakdown LLM router 30gg per tenant/provider/model/task_type. Brick llm-router-multi-provider.';
