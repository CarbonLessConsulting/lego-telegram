# telegram-voice-capture-whisper

Brick le-GO **v0.1.0** · categoria **E-Media** · payoff GOCOTECH _"Piu' performance. Meno impatto."_

## Cosa risolve

Pipeline canonica per ricezione voice message Telegram → trascrizione testo via OpenAI Whisper:

1. Riceve un oggetto `voice` da `update.message.voice` Telegram
2. Scarica i bytes audio via `getFile` + endpoint CDN Telegram
3. Trascrive via OpenAI Whisper (`whisper-1`, `verbose_json`)
4. Filtra hallucination Whisper (Amara closing cards, "thank you for watching", music tags)
5. Calcola costo USD reale
6. Persisti audit log privacy-safe (NO testo, NO audio raw)
7. Ritorna trascrizione + lingua rilevata + costo al consumer

**Soft no-throw end-to-end**: ogni helper ritorna `{ ok: boolean, ... }`. Mai exception → la edge fn chiamante non muore mai a meta' pipeline (lezione globale #14).

## Quando usarlo

- Bot Telegram che riceve note vocali (es. GoYourRelationships: nota su contatto, GOMec: report officina, le-GO consumer)
- Trasformare un vocale in input testuale per LLM tool calling
- Voice command su Mini App Telegram

NON usarlo per:
- Audio > 60 secondi senza override esplicito `maxDurationSeconds` (cost guard)
- File audio non da Telegram (usa direttamente `transcribeWhisper` helper su un Uint8Array)
- Trascrizione streaming real-time (Whisper batch-only)

## API canonical

```ts
import { captureVoice } from "@gocotech/le-go/telegram-voice-capture-whisper";

const result = await captureVoice(update.message.voice, {
  botToken: Deno.env.get("TELEGRAM_BOT_TOKEN")!,
  openaiApiKey: Deno.env.get("OPENAI_API_KEY")!,
  maxDurationSeconds: 60,
  languageHint: "it",
  whisperPrompt:
    "Nota vocale su un contatto professionale. Include nome, cognome, ruolo, azienda.",
  auditCallback: async (entry) => {
    await sb.from("usage_log").insert({
      tenant_id,
      user_id,
      operation: "voice_transcribe",
      ...entry,
    });
  },
});

if (!result.ok) {
  // result.reason: 'duration_exceeded' | 'download_failed' | 'transcription_failed' | 'empty_transcription' | 'invalid_config'
  await sendMessageSoft(botToken, chatId, "Non sono riuscito a trascrivere la nota. Riprova.");
  return;
}

// Sicuro: TS narrowing
console.log(result.transcription);  // "Mario Rossi della Acme Srl..."
console.log(result.language);        // "it"
console.log(result.cost_usd);        // 0.0042
console.log(result.duration_seconds);// 42
```

## Pattern integrato (state machine)

```ts
// Esempio: Telegram webhook handler con stato draft
async function onVoice(upd: TelegramUpdate) {
  const chatId = upd.message!.chat.id;

  const result = await captureVoice(upd.message!.voice!, {
    botToken: BOT_TOKEN,
    openaiApiKey: OPENAI_KEY,
    maxDurationSeconds: 90,
    languageHint: detectUserLang(upd),
    auditCallback: (entry) =>
      logUsage({ tenant_id, user_id: getUserId(upd), ...entry }),
  });

  if (!result.ok) {
    const msg = result.reason === "duration_exceeded"
      ? "Audio troppo lungo. Max 90 secondi."
      : "Non sono riuscito a leggere la voce. Prova in un posto piu' silenzioso.";
    await sendMessageSoft(BOT_TOKEN, chatId, msg);
    return;
  }

  // Passa il transcript al tool calling LLM downstream
  await processTranscript(result.transcription, {
    chat_id: chatId,
    language: result.language,
    duration_sec: result.duration_seconds,
  });
}
```

## Helpers esposti (re-export da `index.ts`)

| Helper | Donor | Scopo |
|---|---|---|
| `captureVoice` | GMR `goref-capture-voice` | Pipeline end-to-end |
| `downloadVoice` | GMR `_shared/telegram.ts` (getFile + downloadFileBytes) | Solo step download (uso avanzato) |
| `transcribeWhisper` | GMR `_shared/whisper.ts` | Solo step trascrizione (su qualsiasi Uint8Array) |
| `looksLikeHallucination` | GMR `_shared/whisper.ts` | Filtro pattern Whisper hallucination |
| `computeWhisperCostUsd` | nuovo | Cost calc da durata secondi |
| `normalizeLanguage` | nuovo | "italian" → "it" |
| `persistAudit` | GMR `_shared/usage-meter.ts` (logUsage pattern) | Audit privacy-safe |
| `buildAuditEntry` | nuovo | Builder helper per VoiceAuditEntry |

## Donor attribution

- **Primary**: `~/Sviluppo/erp/gomyreference/supabase/functions/goref-capture-voice/index.ts`
  - 92% feature coverage del flow voice GoYourRelationships
  - Pattern: getFile → download → Whisper verbose_json → looksLikeHallucination filter → result
- **Primary helpers**:
  - `_shared/whisper.ts` — chiamata API + retry + cost
  - `_shared/telegram.ts` — getFile / downloadFileBytes
  - `_shared/usage-meter.ts` — logUsage (modello audit pattern)

Donor secondary (`@GOMEC_ERP_Bot` su gosolution) **non aveva voice STT** alla data di estrazione (solo OCR 5 specializzati). Pattern voice tutto da GMR.

## Compliance breakdown

Vedi [`compliance/controls.json`](./compliance/controls.json) per il dettaglio. Sintesi:

| Framework | Articoli mappati | Implementation |
|---|---|---|
| GDPR | art. 5 §1 lett. c (minimization), art. 9 §1 (categorie particolari — voce), art. 32 §1 lett. b (resilienza), art. 30 §1 (registri) | Audio NON persistito; trascrizione NON in audit; retry x3 su transient; audit callback for record-keeping |
| AI Act 2024/1689 | art. 13 (trasparenza) | Modello + provider esposti nel result + audit |
| le-GO Principles | #7 Soft helper no-throw, Cost transparency | captureVoice + helpers mai throw; cost USD esposto |

## Costi

**Pricing ufficiale OpenAI Whisper-1**: `$0.006 / minuto di audio`
([fonte](https://openai.com/pricing), verificato 2026-05-23, billing al secondo).

**Esempio reale (donor GMR)**:
- Voice 42 secondi → 42/60 * $0.006 = **$0.0042** (≈ €0.004)
- Voice 60 secondi → $0.006 (≈ €0.0056)
- 1.000 voci/giorno avg 30s → $30/mese (≈ €28)

La funzione `computeWhisperCostUsd(durationSeconds)` esposta ritorna il valore esatto (6 decimali) per ogni trascrizione. Audit entry contiene `cost_usd` per usage tracking + chargeback tenant.

## Dipendenze le-GO

- **`telegram-push-soft`** (obbligatorio per il caller, NON per il brick stesso) — il consumer usa `sendMessageSoft` per rispondere all'utente sul Telegram canale (es. errore, conferma trascrizione). Il brick `telegram-voice-capture-whisper` NON spedisce messaggi: ritorna risultato strutturato.

## Anti-pattern evitati

1. **`throw` su error Whisper** (GOMAPLAB legacy pattern) → ritorno soft `{ ok: false }`
2. **Persistere audio raw su Storage** → audio dimenticato post-trascrizione (GDPR minimization)
3. **Loggare testo trascritto nell'audit** → solo char count nell'audit (privacy by design)
4. **`btoa(String.fromCharCode(...))` su buffer grossi** → non applicabile qui (no base64 audio: passiamo a Whisper come multipart Blob)

## Roadmap

- [ ] v0.2.0 — supporto fallback provider (Whisper → Deepgram → AssemblyAI) per resilienza
- [ ] v0.2.0 — opt-in voiceprint detection (dato biometrico, base giuridica art. 9 §2 lett. a consenso esplicito)
- [ ] v0.3.0 — chunking audio > 25MB (limit OpenAI Whisper)
- [ ] v0.3.0 — streaming Whisper (quando OpenAI supportera' SSE su transcriptions endpoint)

---

_Brick le-GO v0.1.0 — estratto da `@go_your_relationship_bot` (GoMyReference) — 2026-05-23_
