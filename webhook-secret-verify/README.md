# telegram-webhook-secret-verify

> Brick le-GO v0.1.0 - Categoria **F-Integrations** - Principi: zero-trust, fail-closed, input-validation
>
> **STANDARD is MAGIC**. Donor canonical: `@go_your_relationship_bot` (GoMyReference).

Verifica `X-Telegram-Bot-Api-Secret-Token` con constant-time compare + parsing safe + filtraggio allowed updates + healthcheck handler. Drop-in universale per ogni edge function webhook Telegram dell'agency.

---

## Cosa risolve

**Lezione globale GOAi #12** (incidente setup webhook):

> Telegram webhook Edge function richiede `--no-verify-jwt`. Telegram non manda Bearer JWT (solo `X-Telegram-Bot-Api-Secret-Token`). Deploy webhook con `--no-verify-jwt`.

Senza questo brick il pattern viene riscritto ad hoc in ogni edge function, con varianti vulnerabili:
- comparazione naive `header === expected` → **timing attack** che rivela il secret byte-by-byte
- nessun controllo struttura body → request random / enormi crashano la fn
- nessun whitelist update types → spoof di tipi non gestiti

E **lezione GoNetworker** (18/05/2026):

> `allowed_updates` di default in Telegram esclude `callback_query` → bottoni inline silenziosamente morti.

Il brick fornisce la whitelist canonical pronta per `setWebhook`.

---

## Quando usarlo

Ogni edge function `*-telegram-webhook` dell'agency. Casi tipici:

- Webhook bot Telegram su Supabase Edge Functions (deploy con `--no-verify-jwt` + secret manuale)
- Webhook su qualsiasi platform serverless (Cloudflare Workers, Vercel Edge, ...) che riceve Telegram update POST
- Test endpoint con healthcheck GET separato (uptime monitor / curl debug)

---

## API canonical

```ts
// === Verifica secret ===
verifySecretToken(request: Request, expectedSecret: string): boolean
constantTimeEqual(a: string, b: string): boolean
TG_SECRET_HEADER: "x-telegram-bot-api-secret-token"

// === Parse safe ===
parseUpdate(request: Request, opts?: { max_body_bytes?: number })
  : Promise<
      | { ok: true; update: TgUpdate }
      | { ok: false; error: "invalid_json" | "missing_update_id" | "empty_body" | "body_too_large"; description?: string }
    >

// === Allowed updates ===
detectUpdateType(upd: TgUpdate): TgAllowedUpdateType | null
isAllowedUpdate(upd: TgUpdate, allowed: ReadonlyArray<TgAllowedUpdateType>): boolean
buildAllowedUpdatesPayload(allowed: ReadonlyArray<TgAllowedUpdateType>): TgAllowedUpdateType[]

ALLOWED_UPDATES_CANONICAL: ["message", "edited_message", "callback_query"]
ALLOWED_UPDATES_EXTENDED:  + ["my_chat_member", "chat_member"]
ALLOWED_UPDATES_ALL:       tutti i tipi Telegram

// === Healthcheck ===
isHealthcheckRequest(request: Request): boolean  // GET / HEAD / OPTIONS
healthcheckResponse(opts?): Response             // 200 "ok"

// === Tipi Telegram Bot API completi ===
TgUpdate, TgMessage, TgUser, TgChat, TgChatType,
TgCallbackQuery, TgInlineQuery, TgChosenInlineResult,
TgShippingQuery, TgPreCheckoutQuery, TgShippingAddress, TgOrderInfo,
TgPoll, TgPollOption, TgPollAnswer,
TgChatMember, TgChatMemberStatus, TgChatMemberUpdated,
TgMessageEntity, TgPhotoSize, TgVoice, TgAudio, TgVideo, TgDocument,
TgContact, TgLocation,
TgAllowedUpdateType
```

---

## Pattern integrato (Deno boilerplate)

Edge function webhook canonical agency, copia-incolla pronta:

```ts
// supabase/functions/<my-bot>-telegram-webhook/index.ts
//
// Deploy: supabase functions deploy <my-bot>-telegram-webhook --use-api --no-verify-jwt
//
// setWebhook (one-time):
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
//     -H "Content-Type: application/json" \
//     -d '{
//       "url": "https://<PROJECT>.supabase.co/functions/v1/<my-bot>-telegram-webhook",
//       "secret_token": "<TELEGRAM_WEBHOOK_SECRET_MYBOT>",
//       "allowed_updates": ["message", "edited_message", "callback_query"]
//     }'

import {
  verifySecretToken,
  parseUpdate,
  isAllowedUpdate,
  ALLOWED_UPDATES_CANONICAL,
  isHealthcheckRequest,
  healthcheckResponse,
  type TgUpdate,
} from "../_bricks/telegram-webhook-secret-verify/index.ts";

import {
  sendMessage,
  answerCallbackQuery,
  escapeHtml,
} from "../_bricks/telegram-push-soft/index.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN_MYBOT") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET_MYBOT") ?? "";

Deno.serve(async (req) => {
  // 1. Healthcheck GET (no secret required)
  if (isHealthcheckRequest(req)) return healthcheckResponse();

  // 2. Verifica secret token (lezione #12)
  if (!verifySecretToken(req, WEBHOOK_SECRET)) {
    return new Response("Forbidden", { status: 403 });
  }

  // 3. Parse safe del body
  const parsed = await parseUpdate(req);
  if (!parsed.ok) {
    console.warn({ fn: "webhook", parse_error: parsed.error, description: parsed.description });
    return new Response("Bad Request", { status: 400 });
  }
  const upd: TgUpdate = parsed.update;

  // 4. Filtra update types whitelist (lezione GoNetworker)
  if (!isAllowedUpdate(upd, ALLOWED_UPDATES_CANONICAL)) {
    // 200 OK lato Telegram per non accumulare retry quota.
    return new Response("ok");
  }

  // 5. Dispatch business
  if (upd.message) {
    const chatId = upd.message.chat.id;
    const name = upd.message.from?.first_name ?? "amico";
    await sendMessage(BOT_TOKEN, chatId, `Ciao <b>${escapeHtml(name)}</b>!`);
  } else if (upd.callback_query) {
    await answerCallbackQuery(BOT_TOKEN, upd.callback_query.id, { text: "Ricevuto!" });
    // ... business handler
  }

  return new Response("ok");
});
```

---

## Donor

**Primary**: `~/Sviluppo/erp/gomyreference/supabase/functions/goref-telegram-webhook/index.ts` (header verify inline) + `_shared/types.ts` (TgUpdate / TgMessage).

Il brick consolida pattern ricorrente in 5+ edge function dell'agency (goref, gonetworker, gomec, gomaplab, goyouravatar) eliminando i duplicati e fix-andoli per timing-safety + size-limit + whitelist canonical.

---

## Compliance breakdown

Vedi `compliance/controls.json`. Sintesi:

| Controllo | Articolo | File |
|---|---|---|
| OWASP A07 | Identification & auth failures | `helpers/verify-secret-token.ts` |
| OWASP A03 | Injection (input validation) | `helpers/parse-update.ts`, `types.ts` |
| OWASP A08 | Software & data integrity failures | `helpers/allowed-update-types.ts` |
| GDPR art. 5 §1 lett. f | Integrità + riservatezza | `helpers/verify-secret-token.ts` (constant-time) |
| GDPR art. 32 §1 lett. b | Resilienza | `helpers/parse-update.ts` (size limit, no crash su body random) |
| Lezione GOAi #12 | Webhook secret obbligatorio | `helpers/verify-secret-token.ts` |
| Lezione GoNetworker | allowed_updates whitelist | `helpers/allowed-update-types.ts` |

---

## Migration path da pattern legacy

| Pattern legacy | Sostituire con |
|---|---|
| `const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token"); if (secret !== expected) return 403` | `if (!verifySecretToken(req, expected)) return new Response("Forbidden", { status: 403 })` |
| `const upd = await req.json() as any` | `const parsed = await parseUpdate(req); if (!parsed.ok) return 400; const upd = parsed.update;` |
| `setWebhook` payload senza `allowed_updates` | aggiungere `allowed_updates: ALLOWED_UPDATES_CANONICAL` (o EXTENDED se serve chat_member) |
| `if (req.method === "GET") return new Response("ok")` ad hoc | `if (isHealthcheckRequest(req)) return healthcheckResponse()` |

### Checklist refactor consumer

1. Sostituire import inline con `import {...} from "../_bricks/telegram-webhook-secret-verify/index.ts"`
2. Mai loggare il valore del secret in chiaro (anche in caso di mismatch)
3. Settare `setWebhook` con `allowed_updates` esplicito (curl con payload completo)
4. Verificare deploy fn con flag `--no-verify-jwt` (lezione #12) — flag SI resetta a ogni deploy, mettere nel `config.toml` del repo
5. Test end-to-end: curl GET → 200; curl POST senza secret → 403; curl POST con secret → 200

---

## Vincoli portabilità (ADK Mod 1)

Zero hardcode di:
- `tenant_id` / `project_ref` Supabase
- nome bot / `bot_username` / `chat_id` admin
- env var name del secret (il consumer passa esplicitamente la stringa)

Lo stesso brick si replica drop-in su ogni bot agency: `goref`, `gomyreference`, `gomec_*`, `gocotech_brain`, `mayla_bot`, eccetera.

---

## File del brick

```
src/le-go/telegram-webhook-secret-verify/
├── README.md                       (questo file)
├── compliance/
│   └── controls.json               OWASP A07/A03/A08 + GDPR + lezioni GOAi
├── helpers/
│   ├── verify-secret-token.ts      verifySecretToken + constantTimeEqual
│   ├── parse-update.ts             parseUpdate (size limit + struttura minima)
│   ├── allowed-update-types.ts     whitelist + isAllowedUpdate + detectUpdateType
│   └── healthcheck-handler.ts      isHealthcheckRequest + healthcheckResponse
├── types.ts                        TgUpdate completo (15+ tipi Telegram Bot API)
└── index.ts                        barrel re-export pubblico
```
