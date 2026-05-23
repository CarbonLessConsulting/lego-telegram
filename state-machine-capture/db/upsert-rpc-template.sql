-- Donor: ~/Sviluppo/erp/gomyreference/supabase/migrations/20260520080000_goref_draft_upsert_rpc.sql
-- Brick: telegram-state-machine-capture v0.1.0 (le-GO B-Sofia-Core)
--
-- RPC canonical per upsert atomico del draft attivo per chat.
-- Risolve race conditions tra capture paralleli (es. photo + voice ravvicinati).
-- USO: sostituisci {{TABLE_NAME}} (es. `bot_capture_drafts`).
--   Sostituisci {{RPC_NAME}} con il nome canonical (es. `bot_upsert_capture_draft`).

CREATE OR REPLACE FUNCTION public.{{RPC_NAME}}(
  p_tenant_id        UUID,
  p_owner_user_id    UUID,
  p_telegram_chat_id BIGINT,
  p_payload          JSONB,
  p_source_entry     JSONB,   -- { source, at, meta }
  p_force_replace    BOOLEAN DEFAULT false,
  p_ttl_seconds      INTEGER DEFAULT 86400
) RETURNS TABLE(
  id                 UUID,
  payload            JSONB,
  state              TEXT,
  sources            JSONB,
  preview_message_id BIGINT,
  expires_at         TIMESTAMPTZ,
  was_merged         BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing record;
  v_new_sources jsonb;
  v_new_expires timestamptz := now() + (p_ttl_seconds || ' seconds')::interval;
BEGIN
  -- Lock atomico sulla draft attiva per la chat (se esiste)
  SELECT *
    INTO v_existing
    FROM public.{{TABLE_NAME}}
   WHERE telegram_chat_id = p_telegram_chat_id
     AND state IN ('pending', 'awaiting_note', 'awaiting_edit')
   ORDER BY updated_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_existing.id IS NOT NULL AND NOT p_force_replace THEN
    -- Merge: il payload viene gia' mergiato dal caller (no JSONB recursive merge nel DB).
    v_new_sources := COALESCE(v_existing.sources, '[]'::jsonb) || jsonb_build_array(p_source_entry);

    UPDATE public.{{TABLE_NAME}}
       SET payload    = p_payload,
           state      = 'pending',
           sources    = v_new_sources,
           updated_at = now(),
           expires_at = v_new_expires
     WHERE {{TABLE_NAME}}.id = v_existing.id;

    RETURN QUERY
      SELECT v_existing.id,
             p_payload,
             'pending'::text,
             v_new_sources,
             v_existing.preview_message_id,
             v_new_expires,
             true;
    RETURN;
  END IF;

  IF v_existing.id IS NOT NULL AND p_force_replace THEN
    DELETE FROM public.{{TABLE_NAME}} WHERE {{TABLE_NAME}}.id = v_existing.id;
  END IF;

  -- INSERT nuova draft
  INSERT INTO public.{{TABLE_NAME}} (
    tenant_id, owner_user_id, telegram_chat_id,
    payload, state, sources, expires_at
  )
  VALUES (
    p_tenant_id, p_owner_user_id, p_telegram_chat_id,
    p_payload, 'pending', jsonb_build_array(p_source_entry), v_new_expires
  )
  RETURNING {{TABLE_NAME}}.id,
            {{TABLE_NAME}}.payload,
            {{TABLE_NAME}}.state,
            {{TABLE_NAME}}.sources,
            {{TABLE_NAME}}.preview_message_id,
            {{TABLE_NAME}}.expires_at
       INTO STRICT v_existing;

  RETURN QUERY
    SELECT v_existing.id,
           v_existing.payload,
           v_existing.state,
           v_existing.sources,
           v_existing.preview_message_id,
           v_existing.expires_at,
           false;
END;
$$;

REVOKE ALL ON FUNCTION public.{{RPC_NAME}}(uuid, uuid, bigint, jsonb, jsonb, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.{{RPC_NAME}}(uuid, uuid, bigint, jsonb, jsonb, boolean, integer) TO service_role;

COMMENT ON FUNCTION public.{{RPC_NAME}} IS
  'le-GO telegram-state-machine-capture v0.1.0: upsert atomico draft attivo con SELECT FOR UPDATE. Risolve race conditions photo+voice paralleli.';
