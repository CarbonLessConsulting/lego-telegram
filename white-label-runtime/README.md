# telegram-white-label-runtime

> Brick le-GO v0.1.0 · Categoria **C-UI** · Estensione Telegram del brick `brand-white-label`
>
> **Payoff GOCOTECH**: *Più performance. Meno impatto.*

Brand config runtime per bot Telegram: carica `brand_config` JSONB dal tenant, lo applica a welcome message, signature, CTA, locale, colori. **Una sola Sofia, brand diversi.**

---

## Perché esiste

Vision le-GO Giuseppe (23/05/2026): _"24 bot agency da unificare. Una sola Sofia, stessi brick, KB diverse, brand diversi."_

GoMyReference white-label per Diego (Crea) è il donor canonical: il pattern di brand-per-tenant lì funziona già — questo brick lo estrae e lo rende drop-in per qualsiasi bot futuro.

Il brick React `brand-white-label` esiste già nel repo e gestisce la PWA companion (logo, colori, OG image). Questo brick **estende** quella base con i campi Telegram-specifici (welcome, signature, locale, cta_url) **senza duplicare** (riusa `BrandConfig` come base via `Partial`).

---

## Cosa risolve

| Problema | Soluzione |
|---|---|
| Bot risponde con nome hardcoded ("Sofia GOMec") indipendentemente dal cliente | `brand_name` dinamico per tenant |
| Welcome `/start` uguale per tutti i white-label | `welcome_template` per tenant con `{{user_name}}` `{{brand_name}}` `{{cta_url}}` |
| Locale "italiano hardcoded" anche per cliente DE/FR | `locale_default` per tenant + fallback Telegram `from.language_code` |
| Lookup brand_config ad ogni messaggio = N query/sec | Cache in-memory TTL 5min (`lazy-cache`) |
| Brand cambia a runtime → cache stale | `invalidateBrandCache(chat_id?)` per invalidazione mirata |

---

## File del brick

```
telegram-white-label-runtime/
├── README.md                         # questo file
├── compliance/controls.json
├── db/migration-template.sql         # ALTER TABLE <tenants> ADD brand_config JSONB
├── helpers/
│   ├── load-brand-config.ts          # loader iniettato + merge default
│   ├── apply-brand-template.ts       # interpolazione {{var}} (donor i18n.ts)
│   ├── render-welcome-message.ts     # /start dinamico multi-lingua (it/en/es/de/fr)
│   ├── render-signature.ts           # footer messaggio (+ appendSignature convenience)
│   ├── lazy-cache.ts                 # cache in-memory TTL 5min
│   └── css-vars-generator.ts         # CSS vars per PWA companion (Tailwind compat)
├── types.ts                          # TelegramBrandConfig estende Partial<BrandConfig> React
└── index.ts                          # entry pubblico
```

---

## API canonical

### 1. Loader (lato edge fn / webhook)

```typescript
import {
  loadBrandConfig,
  renderWelcomeMessage,
  appendSignature,
  type TelegramBrandLoader,
} from './_shared/le-go/telegram-white-label-runtime/index.ts'; // adatta path

// Loader iniettato dal consumer (legge dal tuo schema reale)
const myLoader: TelegramBrandLoader = async (telegramChatId) => {
  const { data } = await sb
    .from('users')
    .select('tenant_id, tenants(brand_config, bot_username)')
    .eq('telegram_chat_id', telegramChatId)
    .maybeSingle();

  if (!data) return null;
  return {
    tenant_id: data.tenant_id,
    bot_username: data.tenants?.bot_username ?? null,
    brand_config: data.tenants?.brand_config ?? null,
  };
};

// Risolve brand (cache TTL 5min)
const resolved = await loadBrandConfig(message.chat.id, myLoader);

// Welcome /start
const welcome = renderWelcomeMessage(resolved.brand, {
  lang: 'it',
  user_name: message.from.first_name,
});
await sendMessage(message.chat.id, welcome);

// Messaggio assistant con signature
const body = await sofia.reply(input);
await sendMessage(message.chat.id, appendSignature(body, resolved.brand));
```

### 2. CSS vars per PWA companion

```typescript
import { generateCssVars } from './_shared/le-go/telegram-white-label-runtime/index.ts';

const cssVars = generateCssVars(resolved.brand);
// → "  :root {\n  --primary: 192 71% 21%;\n  --accent:  19 84% 49%;\n  }"
// Iniettato in <style> della pagina compagna del bot.
```

### 3. Invalidazione cache (admin update brand)

```typescript
import { invalidateBrandCache } from './_shared/le-go/telegram-white-label-runtime/index.ts';

// Dopo UPDATE brand_config in admin UI:
invalidateBrandCache(); // tutti i tenant
// oppure mirato:
invalidateBrandCache(specificTelegramChatId);
```

---

## Pattern di integrazione

Per ogni bot:

1. Applicare `db/migration-template.sql` adattando `<tenant_table>` al tuo schema reale (es. `goref_tenants`, `gocotech_tenants`, `tenants`).
2. Implementare `TelegramBrandLoader` che legge da `telegram_chat_id → tenant.brand_config`.
3. Chiamare `loadBrandConfig(chatId, loader)` all'inizio del webhook handler.
4. Usare `renderWelcomeMessage` per `/start` e `appendSignature` per ogni risposta assistant.

---

## Donor attribution

- **Pattern brand_config JSONB**: `~/Sviluppo/erp/gomyreference/supabase/migrations/20260515180000_goref_fase1.sql` (`goref_tenants.brand_config`)
- **Lookup tenant da chat_id**: `~/Sviluppo/erp/gomyreference/supabase/functions/_shared/tenant.ts` (`getTenantContext`)
- **Interpolazione `{{var}}`**: `~/Sviluppo/erp/gomyreference/supabase/functions/_shared/i18n.ts` (`interpolate`)
- **Welcome message multi-lingua**: chiavi `bot.onboarding.greeting_named` / `greeting_anon` di `_shared/i18n.ts`
- **toHslVar**: `~/Sviluppo/erp/gomyreference/src/lib/brand-config.ts` + `gocotech-website/src/lib/brand-config.ts`
- **Base BrandConfig React**: `src/le-go/brand-white-label/types.ts` (riusato via `Partial`)

---

## Vincoli ADK Mod 1 (portabilità)

- Zero hardcode di nomi tabella / project Supabase / bot username
- Loader iniettato (DI) → questo brick non sa nulla di `goref_*` / `gocotech_*` / `gomec_*`
- Default brand `TELEGRAM_NEUTRAL_BRAND` = GOCOTECH (override semplice via `defaultBrand` opt)

---

## Compliance

Vedi `compliance/controls.json`. Mappato a GDPR art.5.1.c (data minimization), art.13 (transparency), le-GO principio 7 (soft helper no-throw).

---

## Test plan (da scrivere in sprint dedicato)

- [ ] Loader ritorna `null` → fallback su `TELEGRAM_NEUTRAL_BRAND`
- [ ] Loader throws → catch + fallback default + log
- [ ] Cache hit entro TTL non chiama loader
- [ ] Cache miss dopo TTL chiama loader
- [ ] `invalidateBrandCache(chatId)` mirato funziona
- [ ] `applyBrandTemplate` lascia `{{var}}` intatto se var mancante
- [ ] `renderWelcomeMessage` rispetta `welcome_template` custom > default lingua
- [ ] `toHslVar('#1A4D5C')` → `"192 71% 21%"`
- [ ] `generateCssVars` ritorna `""` se brand senza colori

---

## NON include (out of scope)

- ❌ Gestione UI admin per modificare `brand_config` (UI separata, non parte del brick)
- ❌ Storage upload logo (usa Supabase Storage direct o brick `r2-storage-tenant`)
- ❌ Localizzazione completa stringhe bot (usa i18n.ts del consumer per chiavi diverse da welcome)
- ❌ Theme dark/light React (gestito da `brand-white-label` esistente)
