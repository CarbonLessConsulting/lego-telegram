-- Donor: ~/Sviluppo/erp/gosolution/.../gomec-telegram-webhook/_session.ts (gomec_bot_sessions TTL pattern)
-- Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)
--
-- Migration TEMPLATE — drop-in. Adatta:
--   <runs_table>     → es. `entity_flow_runs`, `gomec_flow_runs`, ...
--   <tenants_table>  → es. `tenants`, `goref_tenants`
--
-- Idempotente. NON applicare in produzione senza review.

CREATE TABLE IF NOT EXISTS public.entity_flow_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  owner_user_id       UUID NOT NULL,
  telegram_chat_id    BIGINT NOT NULL,

  -- Flow identity
  flow_id             TEXT NOT NULL,
  flow_version        TEXT NOT NULL,
  entity_type         TEXT NOT NULL,

  -- Runtime state
  current_step_id     TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','abandoned','failed')),
  draft               JSONB NOT NULL DEFAULT '{}'::jsonb,
  step_history        JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_message_id  BIGINT,
  result_record_id    UUID,
  error_message       TEXT,

  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indici
-- ============================================================================

-- Lookup canonical: 1 run attivo per (tenant, chat, entity_type)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_entity_flow_runs_active
  ON public.entity_flow_runs (tenant_id, telegram_chat_id, entity_type)
  WHERE status = 'running';

-- GC expired
CREATE INDEX IF NOT EXISTS idx_entity_flow_runs_expired
  ON public.entity_flow_runs (expires_at)
  WHERE status = 'running';

-- Telemetry by flow
CREATE INDEX IF NOT EXISTS idx_entity_flow_runs_flow_status
  ON public.entity_flow_runs (flow_id, status, created_at DESC);

-- ============================================================================
-- RLS — 4 policy granulari
-- ============================================================================

ALTER TABLE public.entity_flow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_flow_runs_select_own ON public.entity_flow_runs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND owner_user_id = auth.uid()
  );

CREATE POLICY entity_flow_runs_insert_own ON public.entity_flow_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND owner_user_id = auth.uid()
  );

CREATE POLICY entity_flow_runs_update_own ON public.entity_flow_runs
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND owner_user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND owner_user_id = auth.uid()
  );

CREATE POLICY entity_flow_runs_delete_own ON public.entity_flow_runs
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND owner_user_id = auth.uid()
  );

-- ============================================================================
-- updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.entity_flow_runs_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entity_flow_runs_touch ON public.entity_flow_runs;
CREATE TRIGGER trg_entity_flow_runs_touch
  BEFORE UPDATE ON public.entity_flow_runs
  FOR EACH ROW EXECUTE FUNCTION public.entity_flow_runs_touch_updated_at();

-- ============================================================================
-- Comment per documentazione
-- ============================================================================

COMMENT ON TABLE public.entity_flow_runs IS
  'le-GO telegram-entity-flow-framework v0.1.0 — run di flow declarativo multi-step per entity (cliente/veicolo/preventivo/...). 1 run attivo per (tenant+chat+entity).';
