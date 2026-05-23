# @goai/lego-telegram

> **le-GO canonical Telegram bot brick library** — drop-in modules per Deno / Supabase Edge Functions / qualsiasi runtime moderno.
>
> "STANDARD is MAGIC" — una sola implementazione, tutti i bot la condividono.

[![JSR](https://jsr.io/badges/@goai/lego-telegram)](https://jsr.io/@goai/lego-telegram)
[![JSR Score](https://jsr.io/badges/@goai/lego-telegram/score)](https://jsr.io/@goai/lego-telegram)

## Cosa è

Library di 13 brick canonical per costruire bot Telegram production-grade in Deno. Estratti dall'agenzia GOAi&digital dopo aver gestito 20+ bot in produzione (avatar generation, customer care multi-tenant, CRM officine, ERP industriale, KB semantica, ecc).

Ogni brick è:
- **Soft no-throw** (lezione critica: helper Telegram mai throw — la business transaction sopra deve restare coerente)
- **Portabile** (zero hardcode: tenant_id / project_ref / bot_token passati come parametri)
- **Tenant-scoped quando applicabile** (multi-tenant RLS-ready)
- **Audit-aware** (privacy-safe logging, no PII raw)
- **Compliance-tagged** (GDPR / OWASP / AI Act references in `compliance/controls.json`)

## Catalogo

| Brick | Categoria | Cosa fa |
|---|---|---|
| `push-soft` | F-Integrations | `sendMessage/sendPhoto/sendDocument/sendChatAction/editMessage/answerCallback` soft no-throw + retry 429/5xx |
| `webhook-secret-verify` | F-Integrations | `X-Telegram-Bot-Api-Secret-Token` constant-time + `parseUpdate` type-safe |
| `voice-capture-whisper` | E-Media | Voice → getFile → Whisper-1 STT + cost tracking |
| `photo-ocr-vision` | E-Media | Photo/PDF → Claude Vision OCR + 7 template (vCard, doc identità, libretto, contachilometri, OBD, gas analyzer, generic) |
| `inline-menu-callback` | C-UI | Inline keyboard fluent builder + callback_query dispatcher routing |
| `i18n-core` | C-UI | Multi-lingua IT/EN/ES/DE/FR/PT + auto-detect + Intl format |
| `state-machine-capture` | B-Sofia-Core | Draft lifecycle persistente (capture → review → save → done) |
| `cost-meter-per-model` | G-Ops | Cost tracking fine-grained per LLM model + EUR conversion |
| `white-label-runtime` | C-UI | Brand config JSONB → welcome/signature/CSS vars render |
| `contact-upsert-fuzzy` | I-Domain | pgvector semantic search + fuzzy name match prima di INSERT |
| `crm-prefetch-lookup` | I-Domain | Candidates extraction da testo libero + ranked CRM hints |
| `entity-flow-framework` | I-Domain | Generic entity flow declarative (cliente → veicolo → preventivo → ...) |
| `bot-snapshot-test` | G-Ops | Anti-regression test diff zero pre/post refactor |

## Quick start

### Install (Deno + Supabase Edge Functions)

Nessun install. Import diretto via JSR:

```typescript
// 1. webhook secret verify + parse update
import {
  verifySecretToken,
  parseUpdate,
} from "jsr:@goai/lego-telegram/webhook-secret-verify";

// 2. send messages soft no-throw
import { sendMessage } from "jsr:@goai/lego-telegram/push-soft";

// 3. voice transcription
import { transcribeVoice } from "jsr:@goai/lego-telegram/voice-capture-whisper";

// 4. photo OCR Claude Vision
import { ocrWithTemplate } from "jsr:@goai/lego-telegram/photo-ocr-vision";

// 5. inline menu + callback handling
import {
  buildKeyboard,
  handleCallback,
} from "jsr:@goai/lego-telegram/inline-menu-callback";
```

### Esempio minimo edge function

```typescript
import { verifySecretToken, parseUpdate } from "jsr:@goai/lego-telegram/webhook-secret-verify";
import { sendMessage } from "jsr:@goai/lego-telegram/push-soft";

Deno.serve(async (req) => {
  const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET_MYBOT")!;
  if (!verifySecretToken(req, expectedSecret)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const parsed = await parseUpdate(req);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400 });
  }

  const msg = parsed.update.message;
  if (!msg || !msg.text) {
    return new Response(JSON.stringify({ ok: true, ignored: "no_text" }), { status: 200 });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN_MYBOT")!;
  await sendMessage(botToken, msg.chat.id, `Hello <b>${msg.from?.first_name ?? ""}</b>!`, {
    parse_mode: "HTML",
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

## Filosofia design (le-GO principles)

1. **Soft no-throw** — gli helper Telegram non lanciano mai eccezioni. Una `sendMessage` fallita non deve far morire l'edge function chiamante (incident Ersilia 21/05/2026: 4h debug per un throw a metà flow → DB inconsistente).
2. **Portabilità ADK Mod 1** — zero hardcode di tenant_id / project_ref / bot_username / paths. Tutto via env/parametri runtime.
3. **Tenant-scoped strict** — RLS multi-tenant da day 1, mai `USING(true)` su tabelle business (lezione globale agency #1).
4. **Compliance-tagged** — ogni brick include `compliance/controls.json` con riferimenti GDPR / OWASP / AI Act / le-GO principles.
5. **Donor attribution** — ogni file `.ts` ha header che indica il donor canonical (per audit + cronologia).
6. **Lezioni globali codificate** — pattern operativi della agenzia (chunked base64 #11, surrogate UTF-16 #7, secret_token webhook #12, service_role sb_secret #13) sono baked-in nei brick.

## Compliance ready

- **GDPR**: art. 5 data minimization, art. 30 records, art. 32 security, art. 9 special categories (voce)
- **OWASP Top 10**: A01 broken access, A03 injection, A05 misconfig, A07 ID failures
- **AI Act**: art. 10 data quality, art. 13 transparency
- **le-GO 7 principles**: multi-tenant isolation verifiable, transparency, observability, resilience, rollback-readiness, data-minimization, accessibility

Ogni brick ha `compliance/controls.json` con mapping esplicito.

## Versioning

Semver strict da `v1.0`:
- `0.x` = beta (breaking changes possibili durante stabilizzazione iniziale)
- `1.0+` = stable (no breaking change senza major bump)

## Contributing

Repo canonical: [github.com/CarbonLessConsulting/lego-telegram](https://github.com/CarbonLessConsulting/lego-telegram)

Maintenance: GOAi&digital Agency (Bulgaria/Italy).

## License

MIT © GOCOTECH Ltd / GOAi&digital Agency

## Credits — donors canonical

I brick sono estratti da bot in produzione:

- **@go_your_relationship_bot** (GoMyReference, Diego Vismara white-label) — donor PRIMARY 92% (12/14 brick), i18n nativa 5 lingue, multi-modale completo (voice + photo + vCard)
- **@tecnogrouplab_ai_bot** (Tecnogrouplab industrial brain) — donor SECONDARY 75%, KB verticale + SLA cron + healthcheck Tier 2
- **@GOMEC_ERP_Bot** (DECAR + GOSolution officina + TGL multi-tenant) — donor TERTIARY 68%, OCR universale 5 verticali + entity flow framework

Vision: "una sola Sofia, stessi brick, KB diverse" — Giuseppe Di Gregorio, CEO GOCOTECH Ltd.
