# telegram-inline-menu-callback

> Brick le-GO v0.1.0 - Categoria **C-UI** - Principi: accessibility, consistency, no-throw
>
> **STANDARD is MAGIC**. Donor canonical: `@go_your_relationship_bot` (GoMyReference).

Inline keyboard builder + dispatcher `callback_query` routing per Telegram Bot. Sostituisce gli `if/else` di parsing `callback_data` hardcoded che proliferano in ogni webhook bot dell'agency.

---

## Cosa risolve

Tre dolori reali raccolti dai webhook esistenti (`gomec`, `gomaplab`, `gonetworker`, `goref`):

1. **Parsing `callback_data` hardcoded** — `if (data.startsWith('approve:')) ...` non scala oltre 4-5 azioni; aggiungere una nuova action significa editare un megaswitch centrale con rischio prefissi ambigui.
2. **Limite 64 byte UTF-8 sul `callback_data`** — facilmente sforato quando ci sono testi liberi + emoji, e gli `slice(0, N)` raw spezzano i surrogate pair (lezione globale GOAi #7).
3. **`callback_query` non ricevuti** — Telegram di default NON include `callback_query` in `allowed_updates`: bottoni inline silenziosamente morti (lezione 18/05/2026 Marco@Corsair).

Il brick fornisce:
- **Builder fluent** `buildKeyboard().button(...).row().button(...).build()` con encoding auto e warn su truncate
- **Dispatcher** `handleCallback(ctx, registry)` con routing per `namespace:action` + handler isolati soft-catch
- **Encode/decode** safe per code point (no surrogate orfani)
- **Nested menu state** (breadcrumb stack) serializzabile in DB / KV
- **answerCallbackQuery** wrapper soft (mai throw)
- **updateMessageWithMenu** per navigazione nested

---

## Quando usarlo

Sempre, su qualsiasi edge function bot Telegram che usi `inline_keyboard`. Casi tipici:

- **Preview draft + conferma** (es. `goref` Sofia mostra contatto e chiede Save/Edit/Cancel)
- **Disambiguation** (es. utente scrive ambiguo → 3 bottoni Cerca/Nuovo/Briefing)
- **Approve/reject workflows** (es. `gomec` ordine richiede conferma titolare)
- **Settings menu** (multi-level, language/preferenze/network)
- **Cross-matching** (`goref` §5: presenta/rifiuta/più tardi)
- **Multi-message batch** (`goref` §8: 5 messaggi → conferma uno per uno)

NON serve per:
- Reply keyboard (tastiere persistenti a fondo schermo) — quelle non hanno callback
- Static UI senza interazione

---

## API canonical

### Builder

```ts
import { buildKeyboard, singleRowKeyboard, backCancelRow, emptyKeyboard }
  from "../_bricks/telegram-inline-menu-callback/index.ts";

// Fluent
const kb = buildKeyboard()
  .button("✅ Save", { namespace: "gomec", action: "order_save", args: ["abc123"] })
  .button("❌ Cancel", { namespace: "gomec", action: "order_cancel", args: ["abc123"] })
  .row()
  .urlButton("Apri PWA", "https://app.example.com")
  .build();
// → { inline_keyboard: [[{...},{...}], [{...}]] }

// Shortcut singolaTriga
const yesNo = singleRowKeyboard([
  { text: "✅ Sì", namespace: "goref", action: "match_approve", args: [proposalId] },
  { text: "❌ No", namespace: "goref", action: "match_decline", args: [proposalId] },
]);

// Reset menu (svuota bottoni dopo azione completata)
await updateMessageMenuOnly(BOT_TOKEN, chatId, messageId, emptyKeyboard());
```

### Encode / decode

```ts
import { encodeCallbackData, decodeCallbackData, isWithinTelegramCallbackLimit }
  from "../_bricks/telegram-inline-menu-callback/index.ts";

// Encode (safe, truncate auto se >64 byte)
const enc = encodeCallbackData({ namespace: "gomec", action: "order_save", args: ["abc"] });
// → { data: "gomec:order_save:abc", truncated: false, bytes: 20 }

if (enc.truncated) {
  // salva payload pieno in DB, usa id corto
}

// Decode (no throw)
const dec = decodeCallbackData(update.callback_query.data);
if (!dec.ok) {
  // dec.error: "empty_data" | "exceeds_64_bytes" | "missing_action" | "invalid_namespace" | "invalid_action"
}
// dec.payload: { namespace: "gomec", action: "order_save", args: ["abc"], raw: "..." }
```

### Dispatcher

```ts
import { handleCallback, createRegistry, actionKey, answerCallbackQuery }
  from "../_bricks/telegram-inline-menu-callback/index.ts";

const registry = createRegistry([
  [actionKey("gomec", "order_save"), async (payload, ctx) => {
    const orderId = payload.args[0];
    await db.saveOrder(orderId);
    await answerCallbackQuery(BOT_TOKEN, ctx.callback_query_id, { text: "✓ Salvato" });
    await updateMessageMenuOnly(BOT_TOKEN, ctx.chat_id, ctx.message_id!, emptyKeyboard());
  }],
  [actionKey("gomec", "order_cancel"), async (payload, ctx) => {
    /* ... */
  }],
]);

Deno.serve(async (req) => {
  // ...verify secret, parse update...
  const cb = update.callback_query;
  if (cb) {
    const result = await handleCallback(
      {
        callback_query_id: cb.id,
        chat_id: cb.message!.chat.id,
        message_id: cb.message!.message_id,
        user_id: cb.from.id,
        user_language_code: cb.from.language_code,
        raw_data: cb.data ?? "",
      },
      registry,
      {
        on_unknown: async (payload, ctx) => {
          await answerCallbackQuery(BOT_TOKEN, ctx.callback_query_id, {
            text: "Comando non riconosciuto",
          });
        },
      },
    );
    if (!result.ok) console.warn({ fn: "webhook", soft_fail: result });
  }
  return new Response("ok");
});
```

### Nested menu state (breadcrumb)

```ts
import {
  emptyMenuState, pushMenuState, popMenuState,
  currentMenuFrame, renderBreadcrumb,
  serializeMenuState, deserializeMenuState,
} from "../_bricks/telegram-inline-menu-callback/index.ts";

// Carica da DB
let state = deserializeMenuState(userRow.menu_state_json);

// Naviga in sub-menu
state = pushMenuState(state, { menu_id: "settings.language" });

// Render breadcrumb
const crumbs = renderBreadcrumb(state); // "main > settings > settings.language"

// Torna indietro
state = popMenuState(state);

// Persisti
await db.update({ menu_state_json: serializeMenuState(state) });
```

---

## Setup webhook (lezione #13)

`callback_query` NON è incluso nel default Telegram `allowed_updates`. Senza configurazione, i bottoni inline appaiono ma il bot non riceve mai il tap.

```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<project>.supabase.co/functions/v1/<webhook-fn>",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "edited_message", "callback_query"]
  }'

# Verifica
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

Verifica `allowed_updates` nel response.

---

## Convenzione `callback_data` canonical

Formato: `<namespace>:<action>[:<arg1>[:<arg2>...]]`

- **`namespace`** = slug bot/contesto, `[a-zA-Z0-9_-]{1,32}`. Esempi: `gomec`, `goref`, `gomaplab`, `mayla`, `gocotech`.
- **`action`** = nome azione, `[a-zA-Z0-9_-]{1,32}`. Esempi: `order_save`, `match_approve`, `nav_settings`.
- **`args`** = URL-encoded, decode trasparente.

Riservata: il caratter `:` è separatore — args che lo contengono DEVONO essere URL-encoded (lo fa già `encodeCallbackData`).

---

## Donor

**Primary**: `~/Sviluppo/erp/gomyreference/supabase/functions/goref-telegram-webhook/index.ts`

File donor estratti:
- righe 1132-1148 `safeCallbackPayload` (UTF-8 byte-aware truncate) → `helpers/encode-callback-data.ts`
- righe 1172-1183 inline keyboard literal (`goref:disamb:*`) → pattern builder `helpers/build-keyboard.ts`
- righe 1193-1228 `runCallbackBranch` soft-catch → `helpers/handle-callback.ts`
- righe 1230-1252 `handleDraftCallback` dispatcher logic → `helpers/handle-callback.ts`

**Secondary**: `~/Sviluppo/erp/gosolution/supabase/functions/gomec-telegram-webhook/` — pattern entity menu (consultato per coerenza naming `gomec:*`).

Donor `_shared/telegram.ts` righe 141-163: `answerCallbackQuery` / `editMessageReplyMarkup` / `editMessageText`.

---

## Compliance breakdown

Vedi `compliance/controls.json` per il mapping completo. Sintesi:

| Controllo | Articolo / Lezione | File |
|---|---|---|
| OWASP A03 | Injection via callback_data | `helpers/decode-callback-data.ts` |
| OWASP A04 | Soft-fail dispatcher | `helpers/handle-callback.ts` |
| OWASP A09 | Logging strutturato no-PII | tutti gli helper |
| GDPR art. 5.1.c | Minimization (id corti invece di PII in callback) | README |
| Lezione GOAi #14 | Mai throw | `handle-callback.ts`, `answer-callback.ts`, `update-message-with-menu.ts` |
| Lezione GOAi #7 | Surrogate orfano UTF-16 | `encode-callback-data.ts`, `build-keyboard.ts`, `answer-callback.ts` |
| `allowed_updates` | Bottoni morti silenti | README setup |

---

## Vincoli portabilità (ADK Mod 1)

Zero hardcode di:
- `tenant_id` / `project_ref` Supabase
- nome bot / token (passato esplicitamente come `botToken: string`)
- namespace di routing (deciso dal consumer)

Stesso brick funziona su `goref`, `gomec`, `gomaplab`, `gocotech_brain`, `mayla_bot` senza alcuna modifica.

---

## Migration path da pattern legacy

| Pattern legacy | Repo donatore | Sostituire con |
|---|---|---|
| `if (data.startsWith('approve:')) {...}` | gomaplab, gonetworker | `createRegistry([[actionKey(ns, "approve"), handler]])` + `handleCallback` |
| `data.split(':')` ad hoc + parts[1] | gomec, goref | `decodeCallbackData(data)` → payload tipato |
| `{ inline_keyboard: [[...]] }` literal | tutti | `buildKeyboard().button(...).row()...build()` |
| `data.slice(0, 64)` raw | gomaplab | `encodeCallbackData(...)` (no surrogate orfani) |
| `editMessageReplyMarkup(chatId, msgId, { inline_keyboard: [] })` | goref | `updateMessageMenuOnly(token, chatId, msgId, emptyKeyboard())` |

### Checklist refactor consumer

1. Sostituire import legacy con `import {...} from "../_bricks/telegram-inline-menu-callback/index.ts"`
2. Passare `botToken` esplicito (no env baked) — ADK Mod 1
3. Definire registry centrale `<namespace>:<action> → handler`
4. Verificare `allowed_updates` include `callback_query` (lezione #13)
5. Verificare `answerCallbackQuery` chiamato sempre entro 15s (consumer responsability)

---

## File del brick

```
src/le-go/telegram-inline-menu-callback/
├── README.md                          (questo file)
├── compliance/
│   └── controls.json                  OWASP + GDPR + lezioni GOAi
├── helpers/
│   ├── build-keyboard.ts              builder fluent + shortcut
│   ├── encode-callback-data.ts        safe encoding 64-byte
│   ├── decode-callback-data.ts        parse + validation regex whitelist
│   ├── handle-callback.ts             dispatcher routing + soft-catch
│   ├── answer-callback.ts             answerCallbackQuery soft wrapper
│   ├── update-message-with-menu.ts    editMessageText/ReplyMarkup soft
│   └── nested-menu-state.ts           breadcrumb push/pop + serialize
├── types.ts                           KeyboardButton, CallbackPayload, ...
└── index.ts                           barrel re-export pubblico
```
