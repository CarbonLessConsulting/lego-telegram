# telegram-contact-upsert-fuzzy

> Brick le-GO v0.1.0 · Categoria **C-Data** · Donor: GoMyReference (92% maturity)
>
> **Payoff GOCOTECH**: *Più performance. Meno impatto.*

Upsert contatti smart: prima di INSERT fa **semantic search pgvector + fuzzy name (pg_trgm) + exact overlap email/phone** per evitare duplicati. Sopra threshold high → UPDATE merge; mid → ritorna candidati per conferma utente Telegram; low → INSERT nuovo.

---

## Perché esiste

Donor GoMyReference (`@go_your_relationship_bot`) ha 200+ contatti per Diego white-label. Senza dedup smart: ogni foto/vocale crea nuovo contatto → 5x duplicati in 2 settimane.

La soluzione canonical sopravvive a:
- OCR rumoroso (foto sfocata: "Mario Rossi" → "Marlo R0ssi")
- Whisper non-deterministico ("Lui è Mario di Roma" vs "Mario Rossi di Roma")
- vCard parziali (solo nome + telefono, no email)
- Multi-utente per tenant (B2B): Alice e Bob hanno entrambi un "Mario" → match SCOPATO per `owner_user_id`

---

## Cosa risolve

| Problema | Strategia brick |
|---|---|
| Foto biglietto duplicata (OCR rumoroso) | embedding 1536d + fuzzy name + email overlap |
| Vocale generico ("Marco mi ha presentato Anna") | LLM extraction → ContactCanonical → match |
| Cross-tenant leak | RLS 4 policy granulari (`tenant_id` + `owner_user_id`) |
| Mid-confidence ambiguity | `action='needs_user_confirmation'` ritorna candidati per inline-button Telegram |
| Merge distruttivo accidentale | `pickNonNull` non sovrascrive con `null`, `setUnion` per array |
| Manutenzione duplicati pregressi | `buildDedupPlan` + `applyDedupPlan` separati (umano-confermato) |

---

## File del brick

```
telegram-contact-upsert-fuzzy/
├── README.md
├── compliance/controls.json
├── db/migration-template.sql           # contacts + RLS + pgvector + pg_trgm + 2 RPC SECURITY DEFINER
├── helpers/
│   ├── embed-contact.ts                # OpenAI text-embedding-3-small (1536d, retry 3x)
│   ├── search-similar.ts               # pgvector cosine top-K
│   ├── fuzzy-match-name.ts             # pg_trgm + jsTrigramSimilarity client-side
│   ├── upsert-contact.ts               # orchestrator: match → decide → INSERT/UPDATE/CONFIRM
│   ├── merge-contact-fields.ts         # mergeContactFields + setUnion + pickNonNull
│   └── dedup-batch.ts                  # plan + apply (maintenance job)
├── prompts/
│   └── extract-contact-from-message.ts # SYSTEM + USER template + RECOMMENDED_LLM_PARAMS
├── types.ts                            # ContactCanonical, MatchCandidate, UpsertResult, Thresholds
└── index.ts
```

---

## API canonical

### 1. Upsert da edge fn Telegram (capture vocale)

```typescript
import {
  embedContact,
  buildContactEmbedText,
  upsertContactFuzzy,
  buildExtractPrompt,
  RECOMMENDED_LLM_PARAMS,
} from './_shared/le-go/telegram-contact-upsert-fuzzy/index.ts';

// 1) Trascrivi vocale (brick telegram-voice-capture-whisper)
const transcript = await transcribeVoice(audio);

// 2) Estrai contatto via LLM
const { system, user } = buildExtractPrompt(transcript);
const contact = await claudeJson({ system, user, ...RECOMMENDED_LLM_PARAMS });

// 3) Embed + upsert
const embedText = buildContactEmbedText(contact);
const embedding = await embedContact(embedText);

const result = await upsertContactFuzzy({
  sb,
  table: 'goref_contacts',                     // o gocotech_contacts, ecc.
  tenant_id: ctx.tenant_id,
  owner_user_id: ctx.user_id,
  source: 'voice',
  contact,
  embedding,
});

// 4) Decisione
switch (result.action) {
  case 'inserted':
    await reply(chatId, `Salvato nuovo contatto: ${contact.full_name}`);
    break;
  case 'updated':
    await reply(chatId, `Aggiornato contatto esistente`);
    break;
  case 'needs_user_confirmation':
    await replyWithInlineButtons(chatId, 'Forse intendi uno di questi?', result.candidates);
    break;
  case 'noop':
    console.error('upsert failed', result.error);
    break;
}
```

### 2. Maintenance batch dedup

```typescript
import { buildDedupPlan, applyDedupPlan } from './_shared/le-go/telegram-contact-upsert-fuzzy/index.ts';

// Step 1: scan (read-only)
const plan = await buildDedupPlan(sb, {
  table: 'goref_contacts',
  tenant_id,
  owner_user_id,
  threshold: 0.92, // conservativo
});

console.log(`${plan.duplicate_candidates} candidati su ${plan.analyzed} contatti`);

// Step 2: review umana → poi apply (DISTRUTTIVO)
const { applied, errors } = await applyDedupPlan(sb, { table: 'goref_contacts', plan });
```

### 3. Threshold custom

```typescript
import { upsertContactFuzzy, DEFAULT_THRESHOLDS } from './_shared/le-go/telegram-contact-upsert-fuzzy/index.ts';

await upsertContactFuzzy({
  // ...
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    high_match: 0.95,  // più conservativo
    mid_match: 0.80,
  },
});
```

---

## Pattern di integrazione

1. **DB**: applicare `db/migration-template.sql` adattando `<contacts_table>` e `<tenants_table>` al tuo schema.
2. **Env**: settare `OPENAI_API_KEY` nelle secrets della edge fn (Supabase secrets per project).
3. **Estensione type**: estendere `ContactCanonical` con campi product-specific via intersection (`ContactCanonical & { role_taxonomy_id?: string }`).
4. **Audit log**: dopo `inserted`/`updated` chiamare il brick `audit-log-immutable` con `action='contact_inserted'` / `'contact_updated'` e payload `{ contact_id, source, match_source }`.
5. **Prompt injection guard**: wrappare il transcript user con brick `sofia-prompt-injection-guard` PRIMA di `buildExtractPrompt`.

---

## Donor attribution

- **Upsert orchestrator** (462 LOC): `~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-upsert.ts`
- **pgvector match**: `~/Sviluppo/erp/gomyreference/supabase/functions/_shared/contact-match.ts` (RPC `goref_find_contact_by_embedding_admin`)
- **OpenAI embeddings**: `~/Sviluppo/erp/gomyreference/supabase/functions/_shared/embedding.ts`
- **Migration RPC pgvector**: `~/Sviluppo/erp/gomyreference/supabase/migrations/20260520080100_goref_find_contact_admin.sql`
- **Migration pg_trgm fuzzy**: `~/Sviluppo/erp/gomyreference/supabase/migrations/20260518110000_goref_fuzzy_name_match.sql`
- **Schema contacts + RLS**: `~/Sviluppo/erp/gomyreference/supabase/migrations/20260515180000_goref_fase1.sql`

---

## Vincoli ADK Mod 1 (portabilità)

- Zero hardcode di table name (`table` parametro `upsertContactFuzzy`)
- Zero hardcode di RPC name (`rpc_names` override)
- SupabaseLike adapter loose-typed → usabile sia da Deno (edge fn) che da Node (Next.js server action)
- Default RPC names sono **generici** (`find_contact_by_embedding`, `find_similar_by_name`) — il consumer adatta via `rpc_names` se ha naming legacy

---

## Compliance

Vedi `compliance/controls.json`. Soddisfa: GDPR art.5.1.c+d + art.32.1.b+d, le-GO principio 1 (RLS 4 policy) + 7 (soft helper no-throw).

`depends_on`: `audit-log-immutable`, `rls-multitenant`.
`depends_on_optional`: `telegram-photo-ocr-vision`, `telegram-voice-capture-whisper`, `sofia-prompt-injection-guard`.

---

## Test plan (sprint dedicato)

- [ ] embed-contact: retry su 429, fallback su null se 4xx config error
- [ ] search-similar: ritorna [] su RPC error (no throw)
- [ ] fuzzy-match-name: input < 3 char ritorna []
- [ ] upsert: email overlap → `updated` con similarity=1
- [ ] upsert: similarity 0.92 → `updated` (sopra high_match)
- [ ] upsert: similarity 0.80 → `needs_user_confirmation` con 1-3 candidates
- [ ] upsert: similarity 0.40 → `inserted`
- [ ] upsert: input invalido (`full_name=''`) → `noop`
- [ ] merge: `setUnion` deduplica emails
- [ ] merge: `pickNonNull` non sovrascrive valore esistente con null
- [ ] dedup: scan 200 contatti produce plan; apply esegue merge+delete

---

## NON include (out of scope)

- ❌ OCR foto biglietto (brick `telegram-photo-ocr-vision`)
- ❌ Whisper trascrizione (brick `telegram-voice-capture-whisper`)
- ❌ vCard parsing (brick `telegram-vcard-parser`)
- ❌ UI conferma inline-button Telegram (gestita dal consumer, brick è server-side only)
- ❌ Sync esterno (HubSpot, Calendar — brick separati)
