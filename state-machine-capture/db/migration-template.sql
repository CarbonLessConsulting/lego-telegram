-- Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260518140000_goref_capture_drafts.sql
-- Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
--
-- Migration template canonical: state machine capture multi-step per chat Telegram.
-- USO: sostituisci {{TABLE_NAME}} con il nome scelto (es. `bot_capture_drafts`,
-- `gomec_capture_drafts`, `tgl_capture_drafts`, `sofia_drafts`).
-- {{TENANTS_TABLE}} = tabella tenants (default `public.tenants`).
-- {{USERS_TABLE}} = tabella users (default `public.users`).

CREATE TABLE IF NOT EXISTS public.{{TABLE_NAME}} (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.{{TENANTS_TABLE}}(id) ON DELETE CASCADE,
  owner_user_id       UUID NOT NULL REFERENCES public.{{USERS_TABLE}}(id) ON DELETE CASCADE,
  telegram_chat_id    BIGINT NOT NULL,

  -- Payload cumulato (estratto da multi-source: voice + photo + text + vcard).
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,

  state               TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'awaiting_note', 'awaiting_edit', 'saved', 'abandoned')),

  -- Append-only tracciamento sorgenti per audit + summary
  sources             JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ID messaggio Telegram preview (per editMessage al save)
  preview_message_id  BIGINT,

  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo 1 draft attivo per chat alla volta (UPSERT pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_one_active_per_chat
  ON public.{{TABLE_NAME}} (telegram_chat_id)
  WHERE state IN ('pending', 'awaiting_note', 'awaiting_edit');

CREATE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_expires
  ON public.{{TABLE_NAME}} (expires_at)
  WHERE state NOT IN ('saved', 'abandoned');

CREATE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_tenant_owner
  ON public.{{TABLE_NAME}} (tenant_id, owner_user_id, updated_at DESC);

ALTER TABLE public.{{TABLE_NAME}} ENABLE ROW LEVEL SECURITY;

-- SELECT: owner del draft o tenant member
DROP POLICY IF EXISTS {{TABLE_NAME}}_select_own ON public.{{TABLE_NAME}};
CREATE POLICY {{TABLE_NAME}}_select_own
  ON public.{{TABLE_NAME}} FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- service_role: bypass (edge function backend)
DROP POLICY IF EXISTS {{TABLE_NAME}}_service_role ON public.{{TABLE_NAME}};
CREATE POLICY {{TABLE_NAME}}_service_role
  ON public.{{TABLE_NAME}} FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.{{TABLE_NAME}} IS
  'le-GO telegram-state-machine-capture v0.1.0: draft conversazionali multi-step. Una sola riga attiva per chat. TTL 24h.';
