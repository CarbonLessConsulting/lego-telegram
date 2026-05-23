# telegram-crm-prefetch-lookup

> Brick le-GO v0.1.0 · Categoria **I-Domain** · Donor: GOMec (gosolution, 68%)
>
> **Payoff GOCOTECH**: *Più performance. Meno impatto.*

Pre-parser che estrae token candidati (email, telefono, P.IVA, CF, targa, nome) da testo libero utente **PRIMA del Sofia turn**, fa fuzzy search CRM tenant-scoped, e inietta i risultati come **context preloaded** nello system prompt. Sofia non deve fare round-trip tool call separato per ogni lookup.

---

## Perché esiste

Pattern verticale per bot CRM-heavy (`@GOMEC_ERP_Bot`, `@tecnogroup_bot`, futuri reseller). Senza prefetch: ogni "Vorrei un preventivo per il signor Rossi" → Sofia chiama tool `crm_search` → round-trip 500-800ms + tokens consumati.

Con prefetch: pre-parser intercetta `Rossi` come name_uppercase, fa ILIKE multi-column, inietta `<crm_prefetch_hints>` con top-5 candidati. Sofia li valuta senza tool call.

**Beneficio misurato (donor GOMec)**: -1 LLM round-trip su ~40% dei turn = riduzione cost/latency significativa.

---

## Cosa risolve

| Problema | Soluzione brick |
|---|---|
| Sofia fa N tool calls CRM per ogni messaggio user | Pre-parser estrae token → 1 lookup batch prima del turn |
| Lookup CRM non tenant-scoped → leak cross-tenant | `tenant_id` filter obbligatorio in `fuzzySearchCrm` |
| LIKE wildcard `_`/`%` da utente → full-table scan | `escapeLike` interno |
| Audit log con PII (query/email/phone candidati) | Payload privacy-safe: solo metric (length, kinds, counts) |
| Token regex false positive (sigle uppercase) | `filterUsefulTokens` esclude name <7 char, phone <9 digit |

---

## File del brick

```
telegram-crm-prefetch-lookup/
├── README.md
├── compliance/controls.json
├── helpers/
│   ├── extract-candidates.ts          # regex IT: email/phone/PIVA/CF/targa/name_upper/company
│   ├── fuzzy-search-crm.ts            # ILIKE multi-column or() Supabase (donor searchClienti)
│   ├── rank-candidates.ts             # score by KIND_WEIGHT (CF/PIVA = 1.0, name_upper = 0.4)
│   ├── render-hints-system-prompt.ts  # XML-tagged JSON per Sofia context
│   └── persist-audit.ts               # audit privacy-safe (NO PII payload)
├── types.ts                           # CandidateToken, CrmCandidate, PrefetchHints, PrefetchConfig
└── index.ts                           # export + prefetchCrmHints orchestrator
```

---

## API canonical

### Orchestrator end-to-end (modo raccomandato)

```typescript
import { prefetchCrmHints, renderHintsForSystemPrompt } from './_shared/le-go/telegram-crm-prefetch-lookup/index.ts';
import { logAudit } from './_shared/le-go/audit-log-immutable/audit-log.ts';

// Nel webhook Telegram handler, PRIMA del Sofia turn:
const hints = await prefetchCrmHints({
  sb,
  tenant_id: ctx.tenant_id,
  user_message: message.text,
  config: { max_candidates: 5, table: 'crm_contatti' },
  logAudit: (action, payload, opts) => logAudit(sb, action, payload, opts),
});

// Inietta nel system prompt Sofia
const systemPrompt = `${baseSystemPrompt}

${renderHintsForSystemPrompt(hints)}

Continua la conversazione tenendo conto dei candidati CRM sopra.`;

const reply = await sofia.runTurn({ system: systemPrompt, messages });
```

### API low-level (compose-it-yourself)

```typescript
import {
  extractCandidates,
  filterUsefulTokens,
  fuzzySearchCrm,
  rankCandidates,
  topK,
} from './_shared/le-go/telegram-crm-prefetch-lookup/index.ts';

const tokens = filterUsefulTokens(extractCandidates(userMsg));
const raw = await fuzzySearchCrm(sb, { tenant_id, tokens });
const ranked = rankCandidates(raw);
const top = topK(ranked, 5);
```

### Config override

```typescript
import { prefetchCrmHints } from '...';

await prefetchCrmHints({
  sb,
  tenant_id,
  user_message: msg,
  config: {
    table: 'tecno_crm_leads',                                // schema custom prodotto
    search_columns: ['name', 'email', 'phone', 'vat_id'],    // colonne custom
    max_candidates: 3,
    min_token_length: 3,
  },
});
```

---

## Output: hints nel system prompt

Esempio output di `renderHintsForSystemPrompt`:

```xml
<crm_prefetch_hints>
{
  "query_length": 47,
  "tokens": [{"kind":"phone"},{"kind":"name_uppercase"}],
  "candidates": [
    {"id":"abc","display_name":"Mario Rossi","score":0.95,"matched_on":["phone","name_uppercase"]},
    {"id":"def","display_name":"Rossi Auto S.r.l.","score":0.45,"matched_on":["name_uppercase"]}
  ],
  "total_count": 2,
  "note": "Tutti i candidati CRM mostrati..."
}
</crm_prefetch_hints>
```

Sofia legge il blocco, valuta lo score, decide se proporre conferma utente o creare nuovo.

**Nota privacy**: nel JSON inviato a Sofia NON sono inclusi emails/phones/PIVA/CF dei candidati — solo `display_name` + score + `matched_on`. Sofia chiede via tool call dedicato (esistente) se ha bisogno dei dettagli completi.

---

## Donor attribution

- **`searchClienti` ILIKE multi-column** `or()` filter: `gosolution/supabase/functions/gomec-telegram-webhook/entities/_shared.ts:25-43`
- **CRM dispatcher pattern**: `gosolution/.../entities/crm.ts` (2316 LOC, sezione `comando_cerca`)
- **escapeLike**: pattern S1.9 di gomyreference (`_shared/sql.ts`)

---

## Vincoli ADK Mod 1 (portabilità)

- ✅ Zero hardcode di tabella (`config.table`)
- ✅ Zero hardcode di colonne (`config.search_columns`)
- ✅ Loader Supabase loose-typed (Deno + Node compat)
- ✅ Default config = `crm_contatti` + colonne italiane (override semplice)

---

## Pattern di integrazione

1. **Schema DB**: il tenant deve avere una tabella CRM con `tenant_id UUID` + almeno `id` + `ragione_sociale|nome|cognome` + opzionalmente `email|telefono|partita_iva|codice_fiscale`.
2. **Webhook handler**: chiama `prefetchCrmHints(...)` PRIMA di costruire system prompt Sofia.
3. **System prompt Sofia**: usa `renderHintsForSystemPrompt(hints)` come blocco dedicato XML-tagged. Sofia deve essere istruita a leggerlo (aggiungi 1-2 frasi al system prompt globale: "Se trovi `<crm_prefetch_hints>` valuta candidati prima di chiamare tool crm_search").
4. **Audit log**: passare `logAudit` da brick `audit-log-immutable` per tracing privacy-safe.
5. **Prompt injection**: wrappare `user_message` con brick `sofia-prompt-injection-guard` PRIMA di `extractCandidates` per neutralizzare payload malevoli.

---

## Compliance

Vedi `compliance/controls.json`. Soddisfa:
- GDPR art.5.1.c (minimization, query non loggata), art.6.1.f (legitimate interest), art.32.1.b
- OWASP A03 (input validation via escapeLike), A04 (tenant scoping)
- le-GO principio data-minimization + cost-transparency + soft-helper-no-throw

---

## Test plan (sprint dedicato)

- [ ] `extractCandidates('Mario Rossi 333-1234567')` → 2 token (phone + name_uppercase)
- [ ] `extractCandidates('IT12345678901')` → 1 token partita_iva
- [ ] `extractCandidates('AB123CD')` → 1 token targa
- [ ] `extractCandidates('mario.rossi@gmail.com')` → 1 token email
- [ ] `filterUsefulTokens` esclude name <7 char
- [ ] `fuzzySearchCrm` con tenant_id sbagliato → 0 risultati (RLS test)
- [ ] `escapeLike('a%b_c')` → `a\%b\_c`
- [ ] `scoreCandidate` con matched_on=['codice_fiscale'] → 1.0
- [ ] `scoreCandidate` con matched_on=['name_uppercase'] → 0.40
- [ ] `topK([], 5)` → []
- [ ] `prefetchCrmHints` con `user_message=''` → hints vuoti, no chiamata DB
- [ ] `persistPrefetchAudit` non blocca su log fail

---

## NON include (out of scope)

- ❌ Upsert/insert CRM (brick `telegram-contact-upsert-fuzzy`)
- ❌ Sofia tool `crm_search` implementation (consumer-side)
- ❌ Sofia system prompt strategico (consumer-side)
- ❌ UI inline-button "Conferma candidato" (consumer-side, usa state machine brick)
