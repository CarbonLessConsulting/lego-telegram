# telegram-bot-snapshot-test (G-Ops) v0.1.0

> **GARANZIA ANTI-ROTTURE per la Fase 6 piano ORDINE le-GO**
>
> Permette di catturare snapshot del comportamento di un bot Telegram (response HTTP + sendMessage outbound) e fare diff tra pre-refactor e post-refactor. Diff zero = safe merge.

## Cosa risolve

Vision le-GO Giuseppe: ogni bot della agency viene refactored per usare i brick canonical. Rischio: un refactor introduce regressioni silenziose (es. messaggio Telegram subtly diverso, status code cambiato, audit log mancante).

Questo brick risolve il rischio fornendo:
1. **Fixture YAML** con conversation flows tipici per ogni bot
2. **Runner Deno** che simula update Telegram e cattura outbound
3. **Diff engine** semantic (ignora campi rumore: timestamp, message_id Telegram, durations)
4. **CI workflow** che fa fail se diff != 0

## Quando usarlo

- **Pre-refactor**: cattura reference snapshot del bot funzionante.
- **Post-refactor**: cattura snapshot della versione brick-driven.
- **Diff**: 0 = safe. Non-0 = analisi obbligatoria prima del merge.

## API canonical

```typescript
import {
  loadFixtures,
  runSnapshot,
  diffSnapshots,
  type Fixture,
  type SnapshotResult,
} from '@le-go/telegram-bot-snapshot-test';

// Carica fixtures bot
const fixtures = await loadFixtures('./tests/bot-snapshots/gocotech_brain_bot/flows.yaml');

// Esegui runner contro webhook target
const snapshot = await runSnapshot({
  webhookUrl: 'https://aijplizzpjhtnhsvmfrl.supabase.co/functions/v1/gocotech-brain-webhook',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET_GOCOTECH_BRAIN,
  fixtures,
});

// Save reference
await saveSnapshot(snapshot, './tests/bot-snapshots/gocotech_brain_bot/reference/2026-05-23.json');

// Diff
const diff = diffSnapshots(referenceSnapshot, newSnapshot);
if (diff.equal) {
  console.log('✅ safe to merge');
} else {
  console.log('⚠️  changes detected:', diff.changes);
}
```

## Pattern integrato con CI

`.github/workflows/bot-snapshot-diff.yml`:

```yaml
on:
  pull_request:
    paths:
      - 'supabase/functions/<bot>-webhook/**'
jobs:
  snapshot-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: deno run --allow-net --allow-read tools/snapshot-bot.ts <bot> --diff
```

Se diff zero → CI verde, PR mergiabile. Altrimenti CI rosso, review obbligatoria.

## Donor

- Pattern fixture: ispirato a `gosolution/tests/` + `gomyreference/tests/`
- Diff engine: custom (ignora timestamp/duration/message_id Telegram)

## Compliance

- **GDPR art.5 minimization**: fixture NON contiene PII reale (chat_id Giuseppe è OK = pubblico interno). Per bot multi-cliente usare chat_id mock.
- **OWASP A05**: snapshot reference NON contengono secrets (verificato gitleaks).

## Limitazioni v0.1

- Cattura SOLO response HTTP del webhook (body JSON). NON cattura outbound `sendMessage` reali.
- v0.2 (futuro): proxy Telegram API mock per cattura completa outbound.

## File structure fixture YAML

```yaml
# tests/bot-snapshots/gocotech_brain_bot/flows.yaml
bot_username: gocotech_brain_bot
flows:
  - name: greeting_start
    description: /start command su chat Giuseppe
    update:
      update_id: 100
      message:
        message_id: 1
        chat: { id: 518790378, first_name: Giuseppe }
        text: /start
        date: 1716480000
    expect:
      response_status: 200
      response_body_subset: { ok: true }
      # outbound_messages: [] # v0.2

  - name: knowledge_lookup_rls
    description: query KB lezione RLS multi-tenant
    update:
      ...
    expect:
      response_status: 200
      response_body_subset: { ok: true, iters: ">=1" }
```
