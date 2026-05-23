-- Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260518100000_goref_ai_usage_logs.sql
-- Brick: telegram-cost-meter-per-model v0.1.0 (le-GO G-Ops)
--
-- Migration template canonical: ai_usage_logs per-model fine-grained.
-- USO: sostituisci {{TABLE_NAME}} (default `ai_usage_logs`).
-- {{TENANTS_TABLE}} = tabella tenants (default `public.tenants`).

CREATE TABLE IF NOT EXISTS public.{{TABLE_NAME}} (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.{{TENANTS_TABLE}}(id) ON DELETE CASCADE,
  owner_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  edge_function   TEXT NOT NULL,           -- es. 'bot-capture-photo'
  provider        TEXT NOT NULL,           -- 'anthropic' | 'openai' | 'whisper' | 'gemini' | 'groq' | 'cerebras'
  model           TEXT NOT NULL,           -- es. 'claude-sonnet-4-6'
  operation       TEXT,                    -- es. 'ocr', 'extract', 'embed', 'reply', 'transcribe'
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  audio_seconds   NUMERIC(10,2) NOT NULL DEFAULT 0,
  images_count    INTEGER NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  success         BOOLEAN NOT NULL DEFAULT true,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_tenant_time
  ON public.{{TABLE_NAME}} (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_user_time
  ON public.{{TABLE_NAME}} (owner_user_id, created_at DESC)
  WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_fn_provider
  ON public.{{TABLE_NAME}} (edge_function, provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_model_time
  ON public.{{TABLE_NAME}} (model, created_at DESC);

ALTER TABLE public.{{TABLE_NAME}} ENABLE ROW LEVEL SECURITY;

-- SELECT: solo lettura own tenant (no insert/update/delete da utenti)
DROP POLICY IF EXISTS {{TABLE_NAME}}_select_own_tenant ON public.{{TABLE_NAME}};
CREATE POLICY {{TABLE_NAME}}_select_own_tenant
  ON public.{{TABLE_NAME}}
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- service_role bypass
DROP POLICY IF EXISTS {{TABLE_NAME}}_service_role ON public.{{TABLE_NAME}};
CREATE POLICY {{TABLE_NAME}}_service_role
  ON public.{{TABLE_NAME}} FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- View aggregata daily per dashboard
CREATE OR REPLACE VIEW public.{{TABLE_NAME}}_summary AS
SELECT
  tenant_id,
  date_trunc('day', created_at) AS day,
  edge_function,
  provider,
  model,
  COUNT(*) AS calls,
  SUM(input_tokens) AS input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(audio_seconds) AS audio_seconds,
  SUM(images_count) AS images_count,
  SUM(cost_usd)::NUMERIC(10,4) AS cost_usd,
  AVG(duration_ms)::INTEGER AS avg_duration_ms,
  COUNT(*) FILTER (WHERE NOT success) AS errors
FROM public.{{TABLE_NAME}}
GROUP BY tenant_id, day, edge_function, provider, model;

GRANT SELECT ON public.{{TABLE_NAME}}_summary TO authenticated;

COMMENT ON TABLE public.{{TABLE_NAME}} IS
  'le-GO telegram-cost-meter-per-model v0.1.0: per-call LLM cost log. Popolato da edge fn via helper logUsage.';
