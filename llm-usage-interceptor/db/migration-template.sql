-- Brick: llm-usage-interceptor v0.3.0 (le-GO G-Ops)
--
-- Tabella atomica APPEND-ONLY per ogni evento LLM (Anthropic/OpenAI/DeepSeek/
-- Mistral/Groq/Cerebras/Fireworks/Gemini). Da applicare su OGNI project
-- Supabase che ospita edge fn LLM caller.
--
-- L'interceptor scrive qui in modo sincrono. Il pull-mode notturno su Green
-- aggrega da N project in gocotech_holding_usage_daily.
--
-- REGOLA NON NEGOZIABILE: zero token sfugge. Append-only, no UPDATE/DELETE
-- ammessi da role non-service.

CREATE TABLE IF NOT EXISTS public.llm_usage_costs (
  log_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identità chiamata
  tenant_id       uuid,
  owner_user_id   uuid,
  edge_function   text NOT NULL,
  operation       text,
  task_type       text,
  -- Provider + modello
  provider        text NOT NULL,
  model           text NOT NULL,
  -- Consumo
  input_tokens    integer DEFAULT 0,
  output_tokens   integer DEFAULT 0,
  audio_seconds   numeric(10,3) DEFAULT 0,
  images_count    integer DEFAULT 0,
  cost_usd        numeric(14,8) DEFAULT 0,
  cost_eur        numeric(14,8) DEFAULT 0,
  -- Esito
  duration_ms     integer,
  success         boolean DEFAULT true,
  error_message   text,
  http_status     integer,
  -- Tracciabilità
  metadata        jsonb DEFAULT '{}'::jsonb,
  request_id      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indici per breakdown dashboard
CREATE INDEX IF NOT EXISTS idx_llm_usage_costs_created
  ON public.llm_usage_costs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_costs_tenant
  ON public.llm_usage_costs (tenant_id, created_at DESC) WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_llm_usage_costs_provider
  ON public.llm_usage_costs (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_costs_task_type
  ON public.llm_usage_costs (task_type, created_at DESC) WHERE task_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_llm_usage_costs_edge_fn
  ON public.llm_usage_costs (edge_function, created_at DESC);

-- RLS: service_role può tutto. authenticated SOLO SELECT proprio tenant.
ALTER TABLE public.llm_usage_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "llm_usage_costs_service_all" ON public.llm_usage_costs;
CREATE POLICY "llm_usage_costs_service_all"
  ON public.llm_usage_costs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "llm_usage_costs_authenticated_select" ON public.llm_usage_costs;
-- Auth users vedono solo le proprie righe (helper get_my_tenant_id() opzionale)
CREATE POLICY "llm_usage_costs_authenticated_select"
  ON public.llm_usage_costs FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR (
      EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'get_my_tenant_id'
      )
      AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );

-- NIENTE policy INSERT/UPDATE/DELETE per authenticated: solo service_role scrive.

-- View aggregata 30 gg (per dashboard locale del project)
CREATE OR REPLACE VIEW public.v_llm_usage_breakdown_30d AS
SELECT
  tenant_id,
  provider,
  model,
  task_type,
  edge_function,
  date_trunc('day', created_at)::date AS day,
  COUNT(*) AS calls,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost_usd) AS total_cost_usd,
  SUM(cost_eur) AS total_cost_eur,
  AVG(duration_ms) AS avg_duration_ms,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END) AS error_count
FROM public.llm_usage_costs
WHERE created_at >= now() - INTERVAL '30 days'
GROUP BY tenant_id, provider, model, task_type, edge_function, date_trunc('day', created_at);

COMMENT ON TABLE public.llm_usage_costs IS
  'ZERO TOKEN LEAK — tabella atomica append-only per ogni call LLM. Scritta dal brick @goai/lego-telegram/llm-usage-interceptor. Aggregata su gocotech_holding_usage_daily (Green) via pull notturno.';

COMMENT ON VIEW public.v_llm_usage_breakdown_30d IS
  'Breakdown 30 gg LLM usage del project. Per dashboard cross-project gocotech.com/erp/consumi.';
