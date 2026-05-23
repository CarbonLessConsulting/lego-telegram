# Flow definitions — esempi e convenzioni

Tutti i file `_example-*.flow.ts` sono **template di riferimento**, NON destinati a essere consumati così come sono. I `commit_fn` ritornano errore intenzionale per forzare l'override consumer.

## Come definire un nuovo flow

1. Crea un file `<entity>-<scenario>.flow.ts` (es. `tagliando-quick.flow.ts`).
2. Esporta un `const myFlow: EntityFlowDefinition = { ... }`.
3. Definisci `steps[]` ordinati. Per ogni step:
   - `id`: univoco nel flow
   - `type`: capture | review | branch | commit
   - `fields[]` (per capture/review): array di `FlowFieldSpec`
   - `commit_fn` (per commit): callback async che persiste il payload sul DB del prodotto
4. Al boot del consumer, chiama `defineFlow(myFlow)` UNA volta.
5. Per avviare un run: `startFlowRun({ flow_id: myFlow.id, tenant_id, owner_user_id, telegram_chat_id })`.
6. Su ogni messaggio user: `loadActiveRun(...)` + `advanceStep({ run, input })`.

## Convenzioni

- **TTL**: 30min default; flow lunghi/complessi → aumentare.
- **Branch**: usa `type='branch'` invece di `if` hardcoded nelle handle. Mantiene il flow DECLARATIVO.
- **Skip condizionale**: `skip_if(draft)` evita di chiedere campi non applicabili (es. P.IVA per privato).
- **Commit isolato**: il `commit_fn` è il SOLO punto che tocca il DB del prodotto (cliente, veicolo, ...). Tutto il resto è state-machine generic.
- **Idempotenza commit**: se possibile, il `commit_fn` dovrebbe essere idempotente (upsert su chiave naturale) per gestire retry da timeout.

## Esempi inclusi

| File | Pattern dimostrato |
|---|---|
| `_example-cliente.flow.ts` | Manual-walk + skip_if condizionale (privato/azienda) + multi-step capture |
| `_example-veicolo.flow.ts` | Validate custom (regex targa, range anno) + tipo `integer` |
| `_example-preventivo.flow.ts` | `type='branch'` con routing dinamico + `next_step` override |
