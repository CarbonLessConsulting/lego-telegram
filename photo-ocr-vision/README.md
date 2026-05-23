# telegram-photo-ocr-vision

Brick le-GO **v0.1.0** · categoria **E-Media** · payoff GOCOTECH _"Piu' performance. Meno impatto."_

## Cosa risolve

Pipeline canonica per OCR di photo/document Telegram via Claude 3.5 Sonnet Vision con **7 template specializzati**:

1. Riceve `update.message.photo[]` (array PhotoSize, 4 risoluzioni) OPPURE `update.message.document` (PDF + immagini "file")
2. Sceglie la risoluzione massima (per photo) o valida MIME (per document)
3. Scarica da CDN Telegram
4. Encoda base64 **chunked** (lezione globale #11 — no stack overflow su file > 50KB)
5. Chiama Claude vision con il prompt del template scelto
6. Parsa il JSON di risposta (template strutturati) tollerando markdown code blocks
7. Calcola costo USD dai token reali
8. Persisti audit log privacy-safe (NO image raw, NO testo OCR)

**Soft no-throw end-to-end**. Lezione globale #14.

## Quando usarlo (use cases per template)

| Template | Use case | Donor |
|---|---|---|
| `generic` | OCR libero (biglietto da visita, foto testo, screenshot) | GMR `goref-capture-photo` |
| `vcard` | Biglietto da visita strutturato (full_name, role, company, emails, phones, websites) | GMR `_shared/contact-schema.ts` |
| `identity-document` | Carta identita', patente, visura, codice fiscale, partita IVA | gosolution `ocr-documento-identita` |
| `libretto-veicolo` | Libretto circolazione auto (targa, marca, modello, VIN, cilindrata, KW) | gosolution `ocr-libretto` |
| `odometer` | Contachilometri (display digitale o analogico) | gosolution `ocr-contachilometri` |
| `obd` | Schermata diagnostica OBD (RPM, EGT, EGR, DPF, Lambda) | gosolution `ocr-obd` |
| `gas-analyzer` | Analizzatore gas 5 (CO, CO2, O2, HC, NOx) | gosolution `ocr-analizzatore-gas` |

**NON usarlo per**:
- Video frame extraction (richiede pipeline diversa, no in scope brick E-Media v0.1)
- OCR streaming real-time (Claude vision e' batch)
- File > 20MB (limit Anthropic vision API — guard `maxFileKb`)

## API canonical

```ts
import { captureOcr } from "@gocotech/le-go/telegram-photo-ocr-vision";

// CASO 1: photo (biglietto da visita strutturato)
const result = await captureOcr(
  { kind: "photo", photos: update.message.photo! },
  {
    botToken: Deno.env.get("TELEGRAM_BOT_TOKEN")!,
    anthropicApiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
    template: "vcard",
    auditCallback: async (entry) => {
      await sb.from("usage_log").insert({
        tenant_id, user_id, operation: "ocr", ...entry,
      });
    },
  },
);

// CASO 2: document PDF (libretto scansionato)
const result = await captureOcr(
  { kind: "document", document: update.message.document! },
  {
    botToken, anthropicApiKey,
    template: "libretto-veicolo",
    maxFileKb: 10_000, // 10MB max per questo flow
  },
);

if (!result.ok) {
  // result.reason: 'file_too_large' | 'download_failed' | 'ocr_failed'
  //                | 'json_parse_failed' | 'unsupported_format' | 'invalid_config'
  await sendMessageSoft(BOT_TOKEN, chatId, "Non sono riuscito a leggere il file.");
  return;
}

// Risultato sempre presente
console.log(result.extracted_text);   // testo raw
console.log(result.structured);        // {} parsato (vcard, identity-document, etc.) — undefined per "generic"
console.log(result.cost_usd);          // 0.0073 (token reali da Anthropic)
console.log(result.template);          // "vcard"
console.log(result.file_size_kb);      // 187
```

## Pattern integrato (state machine con draft)

```ts
async function onPhoto(upd: TelegramUpdate) {
  const chatId = upd.message!.chat.id;

  const result = await captureOcr(
    { kind: "photo", photos: upd.message!.photo! },
    {
      botToken: BOT_TOKEN,
      anthropicApiKey: ANTHROPIC_KEY,
      template: "vcard",
      auditCallback: (entry) =>
        logUsage({ tenant_id, user_id: getUserId(upd), ...entry }),
    },
  );

  if (!result.ok) {
    await sendMessageSoft(BOT_TOKEN, chatId,
      result.reason === "file_too_large"
        ? "Foto troppo grande. Comprimi e riprova."
        : "Non leggo bene la foto. Riprova con piu' luce.");
    return;
  }

  // Saving draft per conferma utente prima di upsert nel DB
  const draft = await saveDraft({
    tenant_id,
    chat_id: chatId,
    source: "photo",
    extracted_text: result.extracted_text,
    extracted_structured: result.structured,
  });
  await sendDraftPreview(draft);
}
```

## Helpers esposti (re-export da `index.ts`)

| Helper | Donor | Scopo |
|---|---|---|
| `captureOcr` | GMR `goref-capture-photo` | Pipeline end-to-end |
| `downloadPhoto` | GMR `_shared/telegram.ts` | Solo step download photo (best resolution) |
| `pickBestPhotoSize` | nuovo | Selezione miglior PhotoSize da array Telegram |
| `downloadDocument` | gosolution `crm-ocr-pizzino` (PDF support) | Solo step download document |
| `isSupportedDocumentMime` | nuovo | Pre-flight check MIME |
| `encodeBase64Chunked` | GMR `_shared/telegram.ts` bytesToBase64 (lezione #11) | Encoding sicuro su file grossi |
| `ocrClaudeVision` | GMR `_shared/claude-vision.ts` | Chiamata Claude Messages API standalone |
| `ocrWithTemplate` | nuovo (dispatcher) | OCR + prompt template + parsing |
| `computeClaudeVisionCostUsd` | nuovo | Cost calc da input/output tokens |
| `parseJsonFromText` | gosolution `_shared/ai-failover.ts` parseJsonFromAI | Parse tollerante markdown + testo extra |
| `persistAudit` | GMR `_shared/usage-meter.ts` logUsage | Audit privacy-safe |

## Donor attribution

- **Primary**: `~/Sviluppo/erp/gomyreference/supabase/functions/goref-capture-photo/index.ts`
  - Pipeline canonica getFile → download → base64 → Claude vision → structured extract
- **Primary helpers**:
  - `_shared/claude-vision.ts` — wrapper Anthropic Messages API
  - `_shared/telegram.ts` — getFile / downloadFileBytes / bytesToBase64 (chunked)
  - `_shared/usage-meter.ts` — pattern logUsage per audit
- **Secondary (per template strutturati specializzati)**: `~/Sviluppo/erp/gosolution/supabase/functions/ocr-*`
  - `ocr-documento-identita` — schema identita' italiana (CF, P.IVA, indirizzo)
  - `ocr-libretto` — schema libretto circolazione (targa, VIN, cilindrata, KW)
  - `ocr-contachilometri` — schema KM + tipo display
  - `ocr-obd` — schema OBD (15 parametri diagnostica)
  - `ocr-analizzatore-gas` — schema gas 5 (CO, CO2, O2, HC, NOx, Lambda)
  - `_shared/ai-failover.ts parseJsonFromAI` — parsing tollerante markdown

## Compliance breakdown

Vedi [`compliance/controls.json`](./compliance/controls.json) per dettaglio. Sintesi:

| Framework | Articoli mappati | Implementation |
|---|---|---|
| GDPR | art. 5 §1 lett. c (minimization), art. 32 §1 lett. b (resilienza), art. 30 §1 (registri) | Image + testo NON persistiti dal brick; retry su 429/5xx; audit callback |
| AI Act 2024/1689 | art. 10 (data quality), art. 13 (trasparenza) | Best resolution selection + MIME validation; modello/costo esposti nel result |
| le-GO Principles | #7 Soft helper no-throw, Cost transparency | Tutti gli helper ritornano `{ok}`; cost USD da token reali |

## Costi

**Pricing ufficiale Anthropic Claude 3.5 Sonnet** ([fonte](https://www.anthropic.com/pricing), verificato 2026-05-23):

- Input: **$3.00 / 1M token**
- Output: **$15.00 / 1M token**
- Immagine standard (≤ 1568x1568): ~1100 token input fissi + testo prompt
  ([fonte](https://docs.anthropic.com/en/docs/build-with-claude/vision#image-cost-calculations))

**Esempio reale (token reali, donor patterns)**:

| Template | Tipico input tokens | Tipico output tokens | Costo USD |
|---|---:|---:|---:|
| `generic` (biglietto visita) | 1.300 (img + prompt) | 200 | $0.0069 |
| `vcard` (strutturato) | 1.450 (img + schema) | 150 | $0.0066 |
| `libretto-veicolo` | 1.450 | 250 | $0.0081 |
| `odometer` (256 max output) | 1.250 | 40 | $0.0044 |
| `identity-document` | 1.450 | 220 | $0.0077 |

La funzione `computeClaudeVisionCostUsd(inputTokens, outputTokens)` ritorna il valore esatto (6 decimali) dai token reali ritornati da `response.usage`.

**1.000 OCR vcard/giorno** ≈ €185/mese.

## Pattern Anthropic source type

Il brick discrimina automaticamente in `ocrClaudeVision`:
- **MIME `image/*`** → `source.type = "base64"` block `type: "image"` (default)
- **MIME `application/pdf`** → block `type: "document"`, `source.type = "base64"`, `media_type = "application/pdf"` (supportato nativamente da Claude Sonnet 4+, riferimento [docs Anthropic PDF support](https://docs.anthropic.com/en/docs/build-with-claude/pdf-support))

Il consumer non deve fare nulla: passa `kind: 'document'` con il TelegramDocument e il brick gestisce.

## Dipendenze le-GO

- **`telegram-push-soft`** (per il caller — non per il brick stesso) — il consumer usa `sendMessageSoft` per rispondere all'utente. Il brick `telegram-photo-ocr-vision` NON spedisce messaggi.

## Anti-pattern evitati

1. **`btoa(String.fromCharCode(...bytes))` su buffer > 50KB** → `encodeBase64Chunked()` (lezione globale #11)
2. **`throw` su Claude 4xx/5xx** → ritorno soft `{ ok: false, reason }`
3. **Persistere image raw** → dimenticata post-OCR (GDPR minimization)
4. **Loggare testo OCR nell'audit** → solo `extracted_chars` (privacy)
5. **No size guard** → `maxFileKb` default 20MB (anti-DoS + Anthropic limit)
6. **Scaricare file unsupported** → pre-flight MIME check su document

## Roadmap

- [ ] v0.2.0 — failover provider (Claude → Gemini → OpenAI) per resilienza (donor `_shared/ai-failover.ts` gosolution)
- [ ] v0.2.0 — template `planimetria` (donor `tecnogroup-brief-ocr-planimetria`)
- [ ] v0.2.0 — template `visura-camerale` (sub-template `identity-document`)
- [ ] v0.3.0 — chunking immagini > 5MB (resize automatic via Deno image lib)
- [ ] v0.3.0 — cache per file_unique_id Telegram (evita re-OCR stesso file)

---

_Brick le-GO v0.1.0 — estratto da `@go_your_relationship_bot` (GMR primary) + `@GOMEC_ERP_Bot` (gosolution secondary, 5 OCR specializzati) — 2026-05-23_
