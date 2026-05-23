-- Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260515180000_goref_fase1.sql
-- Pattern: goref_tenants.brand_config JSONB NOT NULL DEFAULT '{}'::jsonb
-- Brick: telegram-white-label-runtime v0.1.0 (le-GO C-UI)
--
-- Migration TEMPLATE — drop-in: adatta <tenant_table> al tuo schema (es.
-- `tenants`, `goref_tenants`, `gocotech_tenants`, ecc.).
--
-- Aggiunge `brand_config` JSONB sulla tabella tenant esistente. Idempotente.
-- NON applica vincoli sullo shape JSON — la convalida runtime sta nel
-- TypeScript del brick (`types.ts` + `load-brand-config.ts`).

-- ============================================================================
-- 1. Colonna brand_config su tenant table
-- ============================================================================

ALTER TABLE public.tenants  -- ← sostituire con il nome reale della tabella
  ADD COLUMN IF NOT EXISTS brand_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenants.brand_config IS
  'le-GO telegram-white-label-runtime v0.1.0 — brand JSONB (vedi types.ts TelegramBrandConfig). Lookup runtime via loadBrandConfig().';

-- ============================================================================
-- 2. Index su brand_config se serve query frequenti (opzionale)
-- ============================================================================

-- CREATE INDEX IF NOT EXISTS idx_tenants_brand_config_gin
--   ON public.tenants USING GIN (brand_config);

-- ============================================================================
-- 3. Seed esempio brand white-label (NON eseguire in produzione senza review)
-- ============================================================================

-- INSERT INTO public.tenants(name, brand_config)
-- VALUES (
--   'Esempio S.r.l. white-label',
--   jsonb_build_object(
--     'brand_name', 'Esempio',
--     'assistant_name', 'Luna',
--     'locale_default', 'it',
--     'primary_color', '#1A4D5C',
--     'accent_color', '#EE7C3C',
--     'logo_url_light', '/icons/esempio-logo-light.png',
--     'logo_url_dark', '/icons/esempio-logo-dark.png',
--     'welcome_template', '<b>Ciao {{user_name}}! Benvenuto in {{brand_name}}.</b>',
--     'signature', '— {{assistant_name}}, by {{brand_name}}',
--     'cta_url', 'https://esempio.com/app',
--     'bot_footer_text', 'Powered by GOAi&digital Agency'
--   )
-- );

-- ============================================================================
-- 4. RLS — il brand_config è leggibile dai membri del tenant
-- ============================================================================

-- ESEMPIO (se RLS è già abilitato sulla tabella tenants):
-- CREATE POLICY tenants_brand_read_member ON public.tenants
--   FOR SELECT TO authenticated
--   USING (id = public.get_my_tenant_id());

-- NB: per lookup da edge fn (service_role), nessuna policy serve — service_role
-- bypassa RLS. La sicurezza sta nel filtraggio applicativo (`tenant_id` derivato
-- da `telegram_chat_id` via `users.tenant_id`).
