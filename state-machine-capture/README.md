# brick: telegram-state-machine-capture

> Versione: 0.1.0 · Categoria: B-Sofia-Core · Data: 23/05/2026
> Donor PRIMARY: `gomyreference` (92%)

State machine canonical multi-step per bot Telegram. Una sola riga attiva
per chat, draft lifecycle `capture → review → save → done`, multi-source
aggregation (voice + photo + text + vcard), TTL 24h, race condition resolved
via SELECT FOR UPDATE atomico.

## Cosa risolve

**Problema**: ogni bot Telegram agency (24 bot identificati) implementa il
proprio "draft di capture" — re-inventando wheel: race condition tra capture
paralleli, TTL bugs, cleanup mancante, RLS scoperta.

**Soluzione**: estrazione canonical del pattern GoMyReference (`goref_capture_drafts`)
in brick drop-in. 6 helper TypeScript + 2 migration template parametrizzabili
+ compliance JSON.

## Quando usarlo

Quando il tuo bot Telegram (o web chat) deve:
- Accumulare input multi-source (es. user manda foto + vocale + testo separati e Sofia li mergia in un singolo contatto/ticket/lead).
- Mostrare preview con inline buttons "Salva | Modifica | Annulla".
- Garantire 1 draft attivo per chat (no duplicate da race condition).
- Avere TTL automatico (24h default, configurabile).
- Cleanup periodico (cron) per drafts abbandonati.

## Drop-in 4-step

### Step 1 — Migration DB
```bash
sed -e 's/{{TABLE_NAME}}/bot_capture_drafts/g' \
    -e 's/{{TENANTS_TABLE}}/tenants/g' \
    -e 's/{{USERS_TABLE}}/users/g' \
  src/le-go/telegram-state-machine-capture/db/migration-template.sql \
  > supabase/migrations/$(date +%Y%m%d%H%M%S)_capture_drafts.sql

sed -e 's/{{TABLE_NAME}}/bot_capture_drafts/g' \
    -e 's/{{RPC_NAME}}/bot_upsert_capture_draft/g' \
  src/le-go/telegram-state-machine-capture/db/upsert-rpc-template.sql \
  > supabase/migrations/$(date +%Y%m%d%H%M%S)_capture_upsert_rpc.sql

supabase db push --linked
```

### Step 2 — Edge function: capture multi-source
```ts
import { appendToDraft } from '@/le-go/telegram-state-machine-capture';

// In capture-photo edge fn:
const result = await appendToDraft(
  { supabase, table: 'bot_capture_drafts', rpc_name: 'bot_upsert_capture_draft' },
  {
    tenant_id, owner_user_id,
    telegram_chat_id: chat.id,
    payload: { full_name: 'Marco Rossi', company: 'ACME', emails: ['marco@acme.it'] },
    source: 'photo',
    source_meta: { file_id, ocr_confidence: 0.92 },
  },
);
// result.draft.payload contiene il payload mergiato (photo + voice + text precedenti)
// result.was_merged = true se ha mergiato un draft attivo
```

### Step 3 — Edge function: transition state
```ts
import { transitionState } from '@/le-go/telegram-state-machine-capture';

// User clicca "Aggiungi nota"
await transitionState(
  { supabase, table: 'bot_capture_drafts' },
  { draft_id, from_state: 'pending', to_state: 'awaiting_note', preview_message_id: msg.message_id },
);
```

### Step 4 — Cron cleanup abbandonati
```ts
import { abandonExpiredDrafts } from '@/le-go/telegram-state-machine-capture';

// In edge fn schedulata (es. cron */15 * * * *):
const result = await abandonExpiredDrafts(
  { supabase, table: 'bot_capture_drafts' },
  { hard_delete: true, batch_limit: 500 }, // hard_delete per GDPR
);
console.log(`Abandoned ${result.abandoned_count} drafts in ${result.tenants_touched.length} tenants`);
```

## API pubblica

| Helper | Cosa |
|---|---|
| `startDraft(deps, input)` | Crea/sostituisce draft attivo via RPC atomico. Force_replace opzionale. |
| `appendToDraft(deps, input)` | Merge multi-source: carica draft + merge payload lato caller + UPSERT. |
| `defaultMergePayloads(a, b)` | Merger di default: shallow merge, array union, last-write-wins per scalari. |
| `loadActiveDraft(deps, chat_id)` | Carica draft attivo per chat (uno solo grazie a UNIQUE INDEX parziale). |
| `loadActiveDraftScoped(deps, scope)` | Variante con `tenant_id + owner_user_id` filter (multi-bot). |
| `transitionState(deps, input)` | FSM strict: valida transizione + UPDATE state. |
| `isTransitionAllowed(from, to)` | Check whitelist FSM (pure function). |
| `abandonDraft(deps, draft_id)` | Marca single draft come 'abandoned'. |
| `abandonExpiredDrafts(deps, opts)` | Batch cleanup TTL scaduti, hard_delete opzionale per GDPR. |
| `buildDraftSummary(draft)` | Calcola statistics (source_count, field_count, ttl_remaining). |
| `formatSummaryHtml(summary)` | Render Telegram HTML pre-review. |

## State machine (FSM strict)

```
              ┌─ awaiting_note  ──┐
              │                   ↓
   ┌─→ pending ─→ awaiting_edit ─→ saved
   │          │                   │
  start       │                   │
              └─→ abandoned ←────┘ (TTL o user cancel)
```

Transizioni whitelist (vedi `transition-state.ts`):
- `pending` → `awaiting_note | awaiting_edit | saved | abandoned`
- `awaiting_note | awaiting_edit` → `pending | saved | abandoned`
- `saved | abandoned` → (terminal, no transition)

## Schema DB

Tabella `{{TABLE_NAME}}` (default `bot_capture_drafts`):

| Colonna | Tipo | Cosa |
|---|---|---|
| `id` | UUID PK | gen_random_uuid() |
| `tenant_id` | UUID FK | CASCADE on tenant delete |
| `owner_user_id` | UUID FK | CASCADE on user delete |
| `telegram_chat_id` | BIGINT | Chat Telegram (anche web session id stringificato in dom equiv.) |
| `payload` | JSONB | Cumulato multi-source |
| `state` | TEXT | enum pending/awaiting_note/awaiting_edit/saved/abandoned |
| `sources` | JSONB | Append-only `[{source, at, meta}]` per audit |
| `preview_message_id` | BIGINT | ID messaggio Telegram preview (per editMessage) |
| `expires_at` | TIMESTAMPTZ | TTL 24h default |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

UNIQUE INDEX parziale: `(telegram_chat_id) WHERE state IN (active_states)` — garantisce 1 draft attivo per chat.

## Compliance

Vedi `compliance/controls.json`. Stato baseline:
- **GDPR art.5.1.c** minimization (TTL 24h default + cron cleanup).
- **GDPR art.5.1.e** storage-limitation (hard_delete option).
- **GDPR art.17** right-to-erasure (CASCADE su tenant_id + owner_user_id).
- **GDPR art.32** security (RLS 4-policy + service_role bypass).
- **ISO 27001 A.12.4.1** event-logging (sources append-only audit trail).
- **ISO 27001 A.9** access-control (RLS multi-tenant strict).

## Portabilità (ADK Mod 1)

✅ Zero hardcode `tenant_id` / `project_ref` / `bot_username`
✅ Table name parametrico (`{{TABLE_NAME}}`)
✅ RPC name parametrico (`{{RPC_NAME}}`)
✅ TTL configurabile per call (default 86400s)
✅ Merger custom-iniettabile (defaultMergePayloads override)

## Donor attribution

- Primary: `gomyreference/supabase/functions/_shared/draft.ts` (160 righe)
- Migration: `gomyreference/supabase/migrations/20260518140000_goref_capture_drafts.sql`
- RPC: `gomyreference/supabase/migrations/20260520080000_goref_draft_upsert_rpc.sql` (S3.3 sprint hardening, race condition fix)

## Changelog

### v0.1.0 — 23/05/2026
- Estrazione canonical da donor GoMyReference (92% conforme).
- 6 helper TS (startDraft + appendToDraft + loadActiveDraft + transitionState + abandonDraft + buildDraftSummary).
- 2 migration template (table + upsert RPC).
- FSM strict con whitelist transitions.
- TTL configurabile + abandonExpiredDrafts batch cleanup.
- Mai-throw su ogni helper (lezione canonical #14).
- Generalizzato: payload → JSONB qualsiasi (donor era ExtractedContact-specific).
- Aggiunto stato `abandoned` (donor non lo aveva).

### TODO v0.2.0
- Web chat support (chat_id come TEXT per session web).
- Multi-tenant isolation test E2E.
- Trigger DB per audit log on state transition.
- Notifica utente pre-TTL (es. 1h prima dello scadere).
