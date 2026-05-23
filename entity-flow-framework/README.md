# telegram-entity-flow-framework

> Brick le-GO v0.1.0 · Categoria **I-Domain** · Donor: GOMec (gosolution, 68%)
>
> **Payoff GOCOTECH**: *Più performance. Meno impatto.*

Framework **declarativo** per modellare wizard multi-step su entity diverse (cliente / veicolo / preventivo / tagliando / intervento / FAP / magazzino / lead CRM / ...). Step come dati, non come `if/else` hardcoded.

---

## Perché esiste

Donor `gomec-telegram-webhook/entities/` ha **9 file di wizard** (cliente.ts 1014 LOC, veicolo.ts, preventivo.ts, ecc.) — ognuno re-implementa lo stesso loop "ask → validate → review → commit" con leggere variazioni.

Pattern estratto:
- Schema dichiarativo `FieldSpec[]` per ogni entity (donor `_shared.ts:CLIENTE_SCHEMA`, `VEICOLO_SCHEMA`)
- Helper canonical `nextMissingField`, `applyCorrection`, `formatRiepilogoConMancanti`
- Session persistence con TTL 30min (donor `_session.ts`)

Questo brick **estrae il framework** lasciando ai consumer SOLO la definizione DECLARATIVA del flow (steps[] data) + il `commit_fn` finale che persiste su DB.

---

## Cosa risolve

| Problema | Soluzione brick |
|---|---|
| 9 wizard re-implementati con drift | 1 framework + N flow definitions data-driven |
| Branch `if (tipo==='privato')...` sparso ovunque | `type='branch'` step + `skip_if(draft)` declarative |
| Validation regex copia-incollata | `FlowFieldSpec.type` + `validate(value)` typed |
| Race condition 2 wizard paralleli stessa chat | Unique index `(tenant+chat+entity) WHERE status='running'` |
| Flow run abbandonati senza GC | `abandonExpiredRuns` cron-style |
| Lookup CRM duplicate prima di iniziare wizard | Combinable con brick `telegram-crm-prefetch-lookup` |

---

## Differenza con `telegram-state-machine-capture`

Sono **complementari**, non sovrapposti:

| Brick | Scope | Use case |
|---|---|---|
| `telegram-state-machine-capture` | Persistence di **un singolo draft** in stato pending/edit/save | Aggregazione multi-source (foto + vocale + testo) in un contact/lead unico |
| `telegram-entity-flow-framework` | Orchestrazione **multi-step** declarative su entity diverse | Wizard creazione cliente con 4-5 step ordinati (manual-walk) |

Un flow run può anche **usare** il draft pattern internamente per gli step di capture multi-source. Vedi `depends_on` in compliance.

---

## File del brick

```
telegram-entity-flow-framework/
├── README.md
├── compliance/controls.json
├── db/migration-template.sql           # entity_flow_runs + RLS 4-policy + unique index running + trigger updated_at
├── helpers/
│   ├── define-flow.ts                  # registry in-memory + getNextStep
│   ├── start-flow-run.ts               # insert run + replace_active
│   ├── load-active-run.ts              # lookup tenant+chat+entity (no expired)
│   ├── advance-step.ts                 # orchestrator: validate → next/branch/commit/abandon
│   ├── validate-step-input.ts          # type-aware: text/phone/email/integer/date/enum + validate(v)
│   ├── render-step-prompt.ts           # interpolazione {{var}} + auto-build per capture/review/commit
│   └── abandon-run.ts                  # single + cron GC expired
├── flows/
│   ├── README.md                       # come definire un flow
│   ├── _example-cliente.flow.ts        # 4-step + skip_if (privato/azienda)
│   ├── _example-veicolo.flow.ts        # validate regex targa + range anno
│   └── _example-preventivo.flow.ts     # branch step (rapido vs completo)
├── types.ts                            # EntityFlowDefinition, FlowStep, FlowFieldSpec, FlowRunRow, AdvanceResult
└── index.ts
```

---

## API canonical

### 1. Definisci un flow (al boot)

```typescript
import { defineFlow, type EntityFlowDefinition } from './_shared/le-go/telegram-entity-flow-framework/index.ts';

const myClienteFlow: EntityFlowDefinition = {
  id: 'gomec_cliente_create',
  version: '1.0.0',
  entity_type: 'cliente',
  label: 'Cliente GOMec',
  ttl_minutes: 30,
  steps: [
    { id: 'ask_tipo', type: 'capture', label: 'Tipo', fields: [{ key: 'tipo', label: 'Tipo', required: true, type: 'enum', enum_values: ['privato','azienda'] }] },
    { id: 'ask_dati', type: 'capture', label: 'Dati', fields: [
      { key: 'nome', label: 'Nome', required: true, skip_if: (d) => d.tipo !== 'privato' },
      { key: 'ragione_sociale', label: 'Rag. sociale', required: true, visible_if: (d) => d.tipo === 'azienda' },
    ]},
    { id: 'review', type: 'review', label: 'Conferma', fields: [/* ... */] },
    { id: 'commit', type: 'commit', label: 'Salvataggio', commit_fn: async (draft, ctx) => {
      const { data, error } = await sb.from('erp_clienti').insert({
        tenant_id: ctx.tenant_id,
        ...draft,
      }).select('id').single();
      if (error) return { error: String(error) };
      return { record_id: data?.id, user_message: `✅ Cliente <b>${draft.nome ?? draft.ragione_sociale}</b> salvato.` };
    }},
  ],
};

defineFlow(myClienteFlow);
```

### 2. Avvia un run (su comando /cliente_nuovo)

```typescript
import { startFlowRun, renderStepPrompt } from './_shared/le-go/telegram-entity-flow-framework/index.ts';

const run = await startFlowRun({
  sb,
  flow_id: 'gomec_cliente_create',
  tenant_id: ctx.tenant_id,
  owner_user_id: ctx.user_id,
  telegram_chat_id: message.chat.id,
});
if (!run) {
  await reply(chatId, 'Errore avvio flow. Riprova.');
  return;
}

// Render primo step prompt
const firstStep = getFlow(run.flow_id)!.steps.find((s) => s.id === run.current_step_id)!;
await sendMessage(chatId, renderStepPrompt(firstStep, run.draft));
```

### 3. Ogni messaggio successivo: avanza

```typescript
import { loadActiveRun, advanceStep } from './_shared/le-go/telegram-entity-flow-framework/index.ts';

const run = await loadActiveRun({ sb, tenant_id, telegram_chat_id: chatId, entity_type: 'cliente' });
if (!run) {
  // Nessun flow attivo — gestisci come messaggio normale
  return;
}

// Parse input utente (text / inline callback)
const input: Record<string, unknown> = parseUserInput(message);
// es. per step capture campo `tipo`: { tipo: 'privato' }
// es. per step review:                { action: 'confirm' }

const result = await advanceStep({ sb, run, input });
if (!result) {
  await sendMessage(chatId, '⚠️ Errore tecnico flow. Riprova.');
  return;
}

if (result.validation_error) {
  await sendMessage(chatId, `❌ ${result.validation_error}\n\n${result.user_message ?? ''}`);
  return;
}

await sendMessage(chatId, result.user_message ?? '...');

if (result.is_terminal) {
  // Run finito: status='completed'/'abandoned'/'failed'
  // Eventuale cleanup UI lato consumer
}
```

### 4. Cron GC (raccomandato: ogni 5 minuti)

```typescript
import { abandonExpiredRuns } from './_shared/le-go/telegram-entity-flow-framework/index.ts';

// Edge function `cleanup-expired-flows` schedulata in supabase/config.toml:
const count = await abandonExpiredRuns({ sb });
console.log(`[cleanup-expired-flows] ${count} run abbandonati`);
```

---

## Donor attribution

- **`FieldSpec` schema**: `gosolution/.../gomec-telegram-webhook/entities/_shared.ts:166-178`
- **`nextMissingField` / `applyCorrection` / `requiredMancanti`**: `_shared.ts:80-120, 220-235`
- **Wizard cliente 1014 LOC** (estratto/generalizzato): `entities/cliente.ts`
- **Branch pattern**: `entities/preventivo.ts` (rapido vs completo)
- **TTL session 30min**: `_session.ts:6`
- **9 entity files**: cliente, veicolo, preventivo, tagliando, intervento, fap, magazzino, crm, crm-templates

---

## Vincoli ADK Mod 1 (portabilità)

- ✅ Zero hardcode di tabella DB target (commit_fn iniettato dal consumer)
- ✅ Zero hardcode di runs_table (`config.runs_table` override)
- ✅ SupabaseLike loose-typed (Deno + Node compat)
- ✅ Flow definitions sono DATA → portabili a JSON serialization in futuro

---

## Pattern di integrazione

1. **Applica migration**: `db/migration-template.sql` adattando se vuoi tabella custom name
2. **Definisci flow** al boot del bot (in `_init.ts` o equivalente): chiama `defineFlow(...)` per ogni wizard
3. **Triggera flow** su comando o intent Sofia: `startFlowRun(...)`
4. **Avanza flow** su ogni messaggio user: `loadActiveRun()` → `advanceStep()`
5. **Audit log**: in `commit_fn` chiama brick `audit-log-immutable` (action='entity_created', resource_type, resource_id)
6. **Cron GC**: schedula `abandonExpiredRuns` ogni 5min via Supabase cron

---

## Compliance

Vedi `compliance/controls.json`. Soddisfa:
- GDPR art.5.1.b (purpose limitation: ogni flow ha entity_type esplicito) + 5.1.c + 32.1.b
- OWASP A03 + A04
- le-GO: declarative-over-imperative, tenant-scoped, soft-helper-no-throw

`depends_on`: `telegram-state-machine-capture` (per pattern persistence draft — non usato qui ma stesso layer concettuale), `rls-multitenant`.

---

## Test plan (sprint dedicato)

- [ ] `defineFlow` valida steps array vuoto → return false
- [ ] `defineFlow` valida duplicate step IDs → return false
- [ ] `defineFlow` valida `initial_step` esistente
- [ ] `getNextStep` rispetta `next_step` esplicito
- [ ] `getNextStep` salta step con `skip_if(draft)=true`
- [ ] `startFlowRun` con `replace_active=true` marca vecchio run come abandoned
- [ ] `loadActiveRun` ignora run con `expires_at` passato
- [ ] `advanceStep` capture valido → merge in draft + step successivo
- [ ] `advanceStep` capture invalido → stay on same step + validation_error
- [ ] `advanceStep` branch → step ID ritornato da branch_fn
- [ ] `advanceStep` commit_fn ok → status=completed
- [ ] `advanceStep` commit_fn error → status=failed + error_message
- [ ] `validateStepInput` phone con <9 digit → error
- [ ] `validateStepInput` enum value non in enum_values → error
- [ ] `abandonExpiredRuns` cron marca solo running+expired

---

## NON include (out of scope)

- ❌ UI inline-button rendering (consumer-side — il brick ritorna `user_message` HTML)
- ❌ Persistence draft di una singola entity (brick `telegram-state-machine-capture`)
- ❌ OCR / Whisper extraction (brick `telegram-photo-ocr-vision`, `telegram-voice-capture-whisper`)
- ❌ Sofia integration (consumer decide se Sofia può triggerare flow via tool call)
- ❌ DB schema delle entity (cliente/veicolo/preventivo — consumer-side)
