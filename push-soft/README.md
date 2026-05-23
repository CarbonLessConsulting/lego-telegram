# telegram-push-soft

> Brick le-GO v0.1.0 - Categoria **F-Integrations** - Principi: resilience, observability, no-throw
>
> **STANDARD is MAGIC**. Donor canonical: `@go_your_relationship_bot` (GoMyReference).

Helper canonical per Telegram Bot API con semantica **soft-fail**: retry esponenziale x3 sui transient (429 / 5xx), ritorno strutturato, **MAI throw**. Drop-in universale per ogni bot Telegram dell'agency GOAi&digital.

---

## Cosa risolve

Lezione globale GOAi **#14** (4h di debug onboarding goref Ersilia, 21/05/2026):

> Un `throw` in `sendMessage` fa morire la edge function chiamante a metà → stato DB inconsistente (utente creato ma welcome non inviato, draft salvato ma notifica persa).

Questo brick fornisce gli helper Telegram canonical:
- ritentano x3 sui transient (429, 500/502/503/504) con backoff esponenziale + jitter
- ritornano `{ok: false, ...}` su fail definitivo
- **MAI throw** — il chiamante decide se gli interessa il fail
- splittano automaticamente messaggi > 4000 char su boundary safe (no surrogate orfani)
- chunking preserva la disposizione di `reply_markup` solo sull'ultimo chunk

E aggrega altri pattern critici Telegram già stratificati in `goai-decisions`:
- lezione **#7** — surrogate orfano UTF-16 (no taglio a metà emoji)

---

## Quando usarlo

Sempre, su ogni edge function Telegram dell'agency. Casi tipici:

- **Webhook bot** che risponde a `/start`, `/help`, comandi custom
- **Onboarding** flow multi-step (welcome message + cattura dati + conferma)
- **Sofia-style** LLM che streamma risposte (editMessageText progressivo)
- **Notifiche cross-tenant** (es. internal-caller → bot dedicato)
- **Inline keyboard** workflow (answerCallbackQuery obbligatorio entro 15s)
- **Allegati** (PDF garanzia, foto report, voice playback) via sendDocument / sendPhoto

NON serve per: invio massivo (>30 msg/sec → usa Bot API Webhooks dedicato), upload bytes raw (multipart custom).

---

## API canonical

```ts
// === Messaggi testo ===
sendMessage(botToken: string, chatId: number, text: string, opts?: SendMessageOptions)
  : Promise<TgSendResult>    // MAI throw

// === Media ===
sendPhoto(botToken: string, chatId: number, photo: string /* URL o file_id */, opts?: SendPhotoOptions)
  : Promise<TgSendResult>
sendDocument(botToken: string, chatId: number, document: string, opts?: SendDocumentOptions)
  : Promise<TgSendResult>

// === UX ===
sendChatAction(botToken: string, chatId: number, action: ChatAction)
  : Promise<TgSendResult>    // best-effort, 1 tentativo

// === Streaming / correzioni ===
editMessageText(botToken: string, chatId: number, messageId: number, text: string, opts?: EditMessageOptions)
  : Promise<TgSendResult>
editMessageReplyMarkup(botToken: string, chatId: number, messageId: number, replyMarkup: unknown)
  : Promise<TgSendResult>

// === Inline keyboard ===
answerCallbackQuery(botToken: string, callbackQueryId: string, opts?: AnswerCallbackOptions)
  : Promise<TgSendResult>    // OBBLIGATORIO entro 15s

// === Utility ===
escapeHtml(text: string): string        // sanitizza contenuto user-supplied per parse_mode HTML
chunkHtmlSafe(html: string): string[]   // split su boundary safe per Telegram 4096 cap
isTransient({http_status, tg_error_code}): boolean
backoffMs(attempt: number, baseMs?: number): number
```

### Tipo risultato canonical

```ts
interface TgSendResult {
  ok: boolean;
  error_code?: number;       // codice Telegram (429, 403, 400, ...)
  http_status?: number;      // HTTP status del gateway
  error?: string;            // description Telegram o tipo errore interno
  message_id?: number;       // message_id su successo (per editMessageText successivi)
}
```

---

## Pattern integrato

Edge function Deno webhook completa (con brick gemello `telegram-webhook-secret-verify`):

```ts
import {
  sendMessage,
  sendChatAction,
  answerCallbackQuery,
  escapeHtml,
  type TgSendResult,
} from "../_bricks/telegram-push-soft/index.ts";
import {
  verifySecretToken,
  parseUpdate,
} from "../_bricks/telegram-webhook-secret-verify/index.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN_GOREF") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET_GOREF") ?? "";

Deno.serve(async (req) => {
  // 1. Healthcheck
  if (req.method === "GET") return new Response("ok", { status: 200 });

  // 2. Verifica secret (Telegram NON manda Bearer JWT — lezione #12)
  if (!verifySecretToken(req, WEBHOOK_SECRET)) {
    return new Response("Forbidden", { status: 403 });
  }

  // 3. Parse safe
  const parsed = await parseUpdate(req);
  if (!parsed.ok) return new Response("Bad Request", { status: 400 });

  const upd = parsed.update;
  const chatId = upd.message?.chat.id;
  const name = upd.message?.from?.first_name ?? "amico";

  if (chatId) {
    // 4. UX: typing indicator
    await sendChatAction(BOT_TOKEN, chatId, "typing");

    // 5. Risposta soft — nessun throw, business logic protected
    const result: TgSendResult = await sendMessage(
      BOT_TOKEN,
      chatId,
      `Ciao <b>${escapeHtml(name)}</b>, benvenuto.`,
    );

    if (!result.ok) {
      // Logghiamo ma NON facciamo throw: la transazione DB upstream resta coerente.
      console.error({ fn: "onboarding-start", soft_fail: result });
    }
  }

  // 6. Callback inline keyboard
  if (upd.callback_query) {
    await answerCallbackQuery(BOT_TOKEN, upd.callback_query.id, {
      text: "Ricevuto!",
    });
  }

  return new Response("ok");
});
```

---

## Donor

**Primary**: `~/Sviluppo/erp/gomyreference/supabase/functions/_shared/telegram.ts` — `@go_your_relationship_bot` (score le-GO 92%, multi-modale, i18n 5 lingue, white-label runtime).

File donor estratti:
- righe 49-105 `sendMessage` → `helpers/send-message.ts`
- righe 10-20 `escapeHtml` → `helpers/escape-html.ts`
- righe 29-47 `chunkHtml` → `helpers/chunk-html.ts`
- righe 141-147 `answerCallbackQuery` → `helpers/answer-callback.ts`
- righe 149-163 `editMessageText` / `editMessageReplyMarkup` → `helpers/edit-message.ts`
- pattern retry da `_shared/retry.ts` → `helpers/retry-policy.ts`

Helper non presenti nel donor (`sendPhoto`, `sendDocument`, `sendChatAction`) ricostruiti applicando lo stesso pattern soft+retry per consistenza canonical.

---

## Compliance breakdown

Vedi `compliance/controls.json` per il mapping completo. Sintesi:

| Controllo | Articolo | File |
|---|---|---|
| GDPR art. 5 §1 lett. f | Integrità trattamento | `helpers/send-message.ts` |
| GDPR art. 32 §1 lett. b | Resilienza sistemi | `helpers/send-message.ts` + `helpers/retry-policy.ts` |
| OWASP A09 | Security logging | `helpers/send-message.ts` (log strutturato no-PII) |
| Lezione GOAi #14 | Helper Telegram mai throw | tutti gli helper |
| Lezione GOAi #7 | Surrogate orfano UTF-16 | `helpers/chunk-html.ts` |

---

## Migration path da pattern legacy

Mapping concreto da pattern legacy → API canonical brick:

| Pattern legacy | Repo donatore | Sostituire con |
|---|---|---|
| `throw new Error('Telegram API ...')` | gomaplab, goyouravatar | `await sendMessage(...)` + check `result.ok` |
| `import { sendMessage } from '_shared/telegram.ts'` con env baked | gomyreference, gonetworker | passare `botToken` esplicito dal consumer |
| `fetch(api.telegram.org/bot${TOKEN}/sendPhoto, ...)` ad hoc | tutti | `await sendPhoto(BOT_TOKEN, chatId, url)` |
| `for retry ... if status 429 ... await sleep(...)` ad hoc | gomaplab | il brick lo fa internamente |
| `chunkText = text.slice(0, 4096)` raw | tutti | `chunkHtmlSafe(text)` (no emoji rotti) |

### Checklist refactor consumer

1. Sostituire import legacy con `import {...} from "../_bricks/telegram-push-soft/index.ts"`
2. Passare `botToken` esplicito (zero hardcode env) — regola portabilità ADK Mod 1
3. Sostituire `await sendMessage(...)` con `const r = await sendMessage(...); if (!r.ok) console.error(...)`
4. Rimuovere try/catch nei consumer attorno alle send (non servono più)
5. Verificare che il deploy della edge fn sia con `--no-verify-jwt` (lezione #12)

---

## Vincoli portabilità (ADK Mod 1)

Zero hardcode di:
- `tenant_id` / `project_ref` Supabase
- nome bot / `bot_username`
- env var name del token (il consumer passa esplicitamente la stringa)

Tutto via parametri runtime. Lo stesso brick funziona su `goref`, `gomyreference`, `gomec`, `gocotech_brain`, `mayla_bot`, eccetera senza alcuna modifica del codice del brick.

---

## File del brick

```
src/le-go/telegram-push-soft/
├── README.md                       (questo file)
├── compliance/
│   └── controls.json               GDPR + OWASP + lezioni GOAi
├── helpers/
│   ├── send-message.ts             sendMessage soft + chunking + retry
│   ├── send-photo.ts               sendPhoto soft
│   ├── send-document.ts            sendDocument soft
│   ├── send-chat-action.ts         sendChatAction best-effort
│   ├── edit-message.ts             editMessageText / editMessageReplyMarkup
│   ├── answer-callback.ts          answerCallbackQuery
│   ├── escape-html.ts              escapeHtml (5 char coverage)
│   ├── chunk-html.ts               chunkHtmlSafe boundary-aware
│   └── retry-policy.ts             isTransient + backoffMs + sleep
├── types.ts                        TgSendResult, SendMessageOptions, ...
└── index.ts                        barrel re-export pubblico
```
