# telegram-i18n-core

> Brick le-GO v0.1.0 - Categoria **C-UI** - Principi: accessibility, consistency, no-throw
>
> **STANDARD is MAGIC**. Donor canonical: `@go_your_relationship_bot` (GoMyReference).

Mini i18n runtime per edge function Telegram bot. Detect automatico lingua utente, JSON bundle per locale, fallback chain, plural rules ICU, format currency/date.

---

## Cosa risolve

I bot dell'agency GOAi&digital servono utenti reali in mercati EU misti:
- DECAR (TGL) → IT primario, EN clienti esteri
- Mayla Surf ERP → IT/PT (Camilla parla portoghese in Brasile)
- GoYourSocialMediaManager (Sara) → IT/EN/ES per agenzia clienti
- GoMyReference / GoYourRelationships → IT/EN/ES/DE/FR community

Pattern legacy comune: stringhe hardcoded in italiano nel codice, utenti non-IT vedono UI fuori contesto, viola WCAG 3.1.1 (Language of Page) e art. 12 GDPR (trasparenza in mother-language).

Il brick fornisce:
- **`detectLocale()`** — auto da `update.message.from.language_code` + user override DB
- **`t()`** — translation helper con interpolazione `{{var}}` + fallback chain (target → en → it → key)
- **`tPlural()`** — selettore ICU one/other (estendibile a few/many via Intl.PluralRules)
- **`formatCurrency()`** / **`formatDate()`** — wrapper Intl con fallback soft
- **6 bundle base** (IT, EN, ES, DE, FR, PT) con chiavi canonical cross-bot
- **`createInMemoryPersister()`** — persister default per dev/test; consumer provvede Supabase/KV in prod

---

## Quando usarlo

Sempre, su ogni edge function bot Telegram dell'agency. Migrazione obbligatoria entro le-GO v1.0.

NON serve per:
- Bot single-tenant single-lingua (ma anche lì meglio averlo per portabilità)
- Email transactional (usare brick i18n-email se esiste; comunque pattern simile)

---

## API canonical

### Setup registry e t()

```ts
import {
  createRegistry, t, tArr, tPlural, detectLocale,
} from "../_bricks/telegram-i18n-core/index.ts";

// Bundle del bot (custom). Estende quelli builtin del brick.
const goMecIt = {
  "gomec.greeting": "<b>Ciao {{name}}!</b> Benvenuto in GOMec.",
  "gomec.order_saved": "✓ Ordine <b>{{id}}</b> salvato.",
};
const goMecEn = {
  "gomec.greeting": "<b>Hi {{name}}!</b> Welcome to GOMec.",
  "gomec.order_saved": "✓ Order <b>{{id}}</b> saved.",
};

const registry = createRegistry({ it: goMecIt, en: goMecEn });

// In webhook handler:
const userLang = detectLocale(
  userRow?.locale, // override DB (priority 1)
  update.message?.from?.language_code, // Telegram (priority 2)
);

const greeting = t(registry, userLang, "gomec.greeting", {
  name: escapeHtml(update.message.from.first_name),
});
await sendMessage(BOT_TOKEN, chatId, greeting);
```

### Plural

```ts
import { tPlural } from "../_bricks/telegram-i18n-core/index.ts";

const text = tPlural(contactCount, {
  one: "Hai <b>1</b> contatto in rubrica.",
  other: "Hai <b>{{count}}</b> contatti in rubrica.",
});
```

### Format currency / date

```ts
import { formatCurrency, formatDate } from "../_bricks/telegram-i18n-core/index.ts";

const price = formatCurrency(199.9, { currency: "EUR", locale: userLang });
// it → "199,90 €"  en → "€199.90"  de → "199,90 €"

const meetingDate = formatDate(new Date(meeting.start_at), {
  style: "long",
  locale: userLang,
  include_time: true,
});
// it → "23 maggio 2026, 14:30"
```

### Persister (user setting `/lingua`)

```ts
import {
  setUserLocale, getUserLocale, validateLocaleInput,
  createInMemoryPersister,
} from "../_bricks/telegram-i18n-core/index.ts";

// Dev / test:
const persister = createInMemoryPersister();

// Prod: il consumer scrive il proprio persister Supabase.
const supabasePersister = {
  async load(telegram_user_id) {
    const { data } = await sb
      .from("telegram_user_locales")
      .select("locale")
      .eq("telegram_user_id", telegram_user_id)
      .maybeSingle();
    return data ? { ok: true, locale: data.locale } : { ok: false, error: "not_found" };
  },
  async save(row) {
    const { error } = await sb
      .from("telegram_user_locales")
      .upsert({ telegram_user_id: row.telegram_user_id, locale: row.locale, updated_at: row.updated_at });
    return error ? { ok: false, error: error.message } : { ok: true };
  },
};

// Handler /lingua pt:
const result = await setUserLocale(supabasePersister, user.id, "pt");
if (!result.ok) {
  await sendMessage(BOT_TOKEN, chatId, t(registry, userLang, "command.lingua.invalid"));
  return;
}
await sendMessage(BOT_TOKEN, chatId, t(registry, result.locale, "command.lingua.set_ok", {
  locale: result.locale!.toUpperCase(),
}));
```

---

## Convenzione chiavi canonical (cross-bot)

I bundle builtin (`locales/*.json`) contengono SOLO chiavi cross-bot riutilizzabili. Convenzione gerarchica:

| Prefisso | Scope | Esempi |
|---|---|---|
| `common.*` | Vocabolario universale (yes/no/save/cancel/back) | `common.yes`, `common.cancel`, `common.save` |
| `command.*` | Comandi bot standard | `command.unknown`, `command.start`, `command.lingua.*` |
| `callback.*` | Toast/alert callback | `callback.saved`, `callback.error`, `callback.expired` |
| `tech.*` | Errori tecnici | `tech.error_branch` |
| `gdpr.*` | Conformità GDPR | `gdpr.consent_required`, `gdpr.deletion_requested` |

I bot estendono con il loro namespace (es. `gomec.*`, `goref.*`, `goyouravatar.*`).

---

## Fallback chain

```
target locale (es. "pt")
  └─ MISSING ─→ "en" (UNIVERSAL_FALLBACK)
                  └─ MISSING ─→ "it" (DEFAULT, source)
                                  └─ MISSING ─→ return key + console.warn
```

- **Soft no-throw**: il bot resta vivo anche con bundle incompleto. L'utente vede la chiave raw come degradation visibile.
- **Observability**: `tWithMeta()` espone `fallback_used` + `resolved_locale` per audit / metrics.

---

## Sicurezza HTML

I bundle CONTENGONO HTML inline pre-trusted (tag `<b>`, `<i>`, `<code>`, `<a>` consistenti con `sendMessage(parse_mode='HTML')` del brick `telegram-push-soft`).

Il brick NON auto-escape le `vars` interpolate `{{var}}`. Il consumer DEVE passare già escape per fonti user-supplied:

```ts
import { escapeHtml } from "../_bricks/telegram-push-soft/index.ts";

t(registry, lang, "gomec.greeting", {
  name: escapeHtml(update.message.from.first_name), // ← OBBLIGATORIO
});
```

---

## Donor

**Primary**: `~/Sviluppo/erp/gomyreference/supabase/functions/_shared/i18n.ts` (513 righe, 5 lingue native, 100+ chiavi `goref.*`)

File donor estratti:
- righe 17-25 `BotLang` + `normalizeLang` → `helpers/detect-locale.ts`
- righe 27-33 `interpolate` → integrato in `helpers/t.ts`
- righe 35-263 `IT` bundle → estratte chiavi canonical cross-bot in `locales/it.json` (escludendo chiavi `bot.*` goref-specific)
- righe 265-474 `EN` bundle → `locales/en.json`
- righe 489-513 `tr` / `tArr` fallback chain → `helpers/t.ts`

Pattern non presenti nel donor (`tPlural`, `formatCurrency`, `formatDate`, bundle ES/DE/FR/PT, persister) ricostruiti su Intl standard + best-practice agency.

---

## Compliance breakdown

Vedi `compliance/controls.json`. Sintesi:

| Controllo | Articolo | File |
|---|---|---|
| GDPR art. 12 | Trasparenza mother-language | `helpers/detect-locale.ts` |
| WCAG 3.1.1 | Language of Page | `helpers/t.ts` (`resolved_locale`) |
| OWASP A03 | Injection HTML in vars (responsabilità consumer) | README + `helpers/t.ts` |
| OWASP A04 | Soft no-throw | tutti gli helper |
| OWASP A09 | Logging strutturato missing_key | `helpers/t.ts` |
| Lezione GOAi #14 | Mai throw | tutti gli helper |

---

## Vincoli portabilità (ADK Mod 1)

Zero hardcode di:
- `tenant_id` / `project_ref` Supabase (il persister è opaco; il consumer ci mette il suo schema)
- Nome bot / `bot_username`
- Lista locale forzata: `SUPPORTED_LOCALES` è esposta come export readonly, ma il brick accetta locale custom per estensione

Stesso brick funziona su ogni bot agency. I bundle builtin sono un "starter kit", non un constraint.

---

## Migration path da pattern legacy

| Pattern legacy | Repo donatore | Sostituire con |
|---|---|---|
| Stringhe hardcoded `'Ciao ' + name + '!'` | tutti | `t(registry, lang, 'gomec.greeting', {name})` |
| `if (lang === 'it') return 'Sì'; else return 'Yes'` | gomaplab | bundle JSON + `t()` fallback chain |
| `new Date().toLocaleString('it-IT')` ad hoc | gomec | `formatDate(date, {style: 'medium', locale: userLang})` |
| `${amount}€` raw | mayla | `formatCurrency(amount, {currency: 'EUR', locale: userLang})` |
| `if (count === 1) return '1 X'; else return count + ' Xs'` | gomec, goref | `tPlural(count, {one, other})` |
| `update.from.language_code === 'it' ? ... : ...` | tutti | `detectLocale(override, update.from.language_code)` |

### Checklist refactor consumer

1. Sostituire import legacy con `import {...} from "../_bricks/telegram-i18n-core/index.ts"`
2. Spostare stringhe da codice TS a `locales/<lang>.json` (bot-specific bundle, namespace `<bot>.*`)
3. Wrappare `createRegistry({...})` una sola volta a startup (cache global)
4. Sostituire `update.from.language_code` direct usage con `detectLocale()`
5. Per stringhe user-supplied (nomi, testo libero): wrappare con `escapeHtml()` PRIMA di passare a `t()`
6. Comando `/lingua` con persister Supabase per persistenza utente

---

## File del brick

```
src/le-go/telegram-i18n-core/
├── README.md                         (questo file)
├── compliance/
│   └── controls.json                 GDPR + WCAG + OWASP + lezioni
├── helpers/
│   ├── detect-locale.ts              detectLocale + normalize + isSupported
│   ├── load-locale-bundle.ts         createRegistry merge builtin+custom
│   ├── t.ts                          t / tArr / tPlural / tWithMeta
│   ├── plural-rules.ts               selectPlural via Intl.PluralRules
│   ├── format-currency.ts            Intl.NumberFormat wrap soft
│   ├── format-date.ts                Intl.DateTimeFormat + RelativeTimeFormat
│   └── persist-user-locale.ts        in-memory persister + validateInput + helper
├── locales/
│   ├── it.json                       28 chiavi canonical cross-bot
│   ├── en.json                       28 chiavi
│   ├── es.json                       28 chiavi
│   ├── de.json                       28 chiavi
│   ├── fr.json                       28 chiavi
│   └── pt.json                       28 chiavi (per Mayla Surf)
├── types.ts                          Locale, TranslationBundle, PluralMap, ...
└── index.ts                          barrel re-export pubblico
```
