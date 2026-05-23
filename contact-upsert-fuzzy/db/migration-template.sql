-- Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260515180000_goref_fase1.sql
--   (schema goref_contacts + embedding pgvector + indici HNSW)
-- Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260520080100_goref_find_contact_admin.sql
--   (RPC find_contact_by_embedding SECURITY DEFINER)
-- Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260518110000_goref_fuzzy_name_match.sql
--   (RPC find_similar_by_name + pg_trgm)
-- Brick: telegram-contact-upsert-fuzzy v0.1.0 (le-GO C-Data)
--
-- Migration TEMPLATE — drop-in. Adatta:
--   <contacts_table>  → es. `goref_contacts`, `gocotech_contacts`, `tenant_contacts`
--   <tenants_table>   → es. `tenants`, `goref_tenants`
--   <users_table>     → es. `users`, `goref_users`
--
-- Idempotente. NON applicare in produzione senza review project Supabase target.

-- ============================================================================
-- 1. Extension: pgvector + pg_trgm
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 2. Tabella contacts canonical (esempio MINIMALE — il consumer estende)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_user_id   UUID NOT NULL,  -- FK opzionale a users (l'app sa quale tabella)
  full_name       TEXT NOT NULL,
  display_name    TEXT,
  emails          TEXT[] NOT NULL DEFAULT '{}',
  phones          TEXT[] NOT NULL DEFAULT '{}',
  company         TEXT,
  role            TEXT,
  linkedin_url    TEXT,
  website         TEXT,
  notes           TEXT,
  preferred_language TEXT CHECK (preferred_language IN ('it','en','es','de','fr') OR preferred_language IS NULL),
  source          TEXT NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('business_card','voice','vcard','manual','calendar','api','unknown')),
  embedding       vector(1536),
  raw_capture     JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Indici
-- ============================================================================

-- Lookup per tenant + owner + nome (fuzzy)
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_owner
  ON public.contacts (tenant_id, owner_user_id);

-- Trigram per fuzzy name match RPC
CREATE INDEX IF NOT EXISTS idx_contacts_full_name_trgm
  ON public.contacts USING GIN (full_name gin_trgm_ops);

-- pgvector HNSW per cosine similarity (1536d)
CREATE INDEX IF NOT EXISTS idx_contacts_embedding_hnsw
  ON public.contacts USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Array overlap (email/phone exact match)
CREATE INDEX IF NOT EXISTS idx_contacts_emails_gin
  ON public.contacts USING GIN (emails);
CREATE INDEX IF NOT EXISTS idx_contacts_phones_gin
  ON public.contacts USING GIN (phones);

-- ============================================================================
-- 4. RLS — 4 policy granulari (lezione globale #1)
-- ============================================================================

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- SELECT: owner vede SOLO i propri contatti del tenant
CREATE POLICY contacts_select_own ON public.contacts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND owner_user_id = auth.uid()
  );

-- INSERT: stesso scope (solo propri)
CREATE POLICY contacts_insert_own ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND owner_user_id = auth.uid()
  );

-- UPDATE
CREATE POLICY contacts_update_own ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND owner_user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND owner_user_id = auth.uid()
  );

-- DELETE
CREATE POLICY contacts_delete_own ON public.contacts
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND owner_user_id = auth.uid()
  );

-- ============================================================================
-- 5. RPC: find_contact_by_embedding (top-K cosine via pgvector)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_contact_by_embedding(
  p_tenant_id        UUID,
  p_owner_user_id    UUID,
  p_query_embedding  vector(1536),
  p_match_threshold  FLOAT DEFAULT 0.7,
  p_match_count      INT DEFAULT 5
) RETURNS TABLE(
  id          UUID,
  full_name   TEXT,
  similarity  FLOAT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count     INT   := LEAST(GREATEST(p_match_count, 1), 20);
  v_threshold FLOAT := GREATEST(LEAST(p_match_threshold, 0.99), 0.3);
BEGIN
  IF p_tenant_id IS NULL OR p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id e owner_user_id obbligatori';
  END IF;

  RETURN QUERY
    SELECT c.id,
           c.full_name,
           1 - (c.embedding <=> p_query_embedding) AS similarity
      FROM public.contacts c
     WHERE c.tenant_id = p_tenant_id
       AND c.owner_user_id = p_owner_user_id
       AND c.embedding IS NOT NULL
       AND 1 - (c.embedding <=> p_query_embedding) > v_threshold
     ORDER BY c.embedding <=> p_query_embedding
     LIMIT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.find_contact_by_embedding FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_contact_by_embedding TO service_role;

COMMENT ON FUNCTION public.find_contact_by_embedding IS
  'le-GO telegram-contact-upsert-fuzzy v0.1.0 — top-K cosine pgvector. Solo service_role (clamp count<=20 threshold>=0.3).';

-- ============================================================================
-- 6. RPC: find_similar_by_name (pg_trgm fallback)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_similar_by_name(
  p_tenant_id       UUID,
  p_owner_user_id   UUID,
  p_full_name       TEXT,
  p_min_similarity  REAL DEFAULT 0.55
) RETURNS TABLE(
  id          UUID,
  full_name   TEXT,
  similarity  REAL
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id,
         c.full_name,
         similarity(c.full_name, p_full_name) AS similarity
    FROM public.contacts c
   WHERE c.tenant_id = p_tenant_id
     AND c.owner_user_id = p_owner_user_id
     AND similarity(c.full_name, p_full_name) > p_min_similarity
   ORDER BY similarity(c.full_name, p_full_name) DESC
   LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_by_name TO service_role;

COMMENT ON FUNCTION public.find_similar_by_name IS
  'le-GO telegram-contact-upsert-fuzzy v0.1.0 — pg_trgm fuzzy name fallback. Solo service_role.';
