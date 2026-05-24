// @goai/lego-telegram — entry point
//
// Catalogo canonical le-GO Telegram bot brick library.
// Vision: "STANDARD is MAGIC" — una sola implementazione, tutti i bot la condividono.
//
// Per import singolo brick (PREFERITO):
//   import { sendMessage } from "jsr:@goai/lego-telegram/push-soft";
//   import { verifySecretToken } from "jsr:@goai/lego-telegram/webhook-secret-verify";
//
// Per import barrel (utile per bot multi-brick):
//   import * as legoTg from "jsr:@goai/lego-telegram";
//
// I 15 brick canonical inclusi:
//   - push-soft               sendMessage soft no-throw + retry (F-Integrations)
//   - webhook-secret-verify   X-Telegram-Bot-Api-Secret-Token (F-Integrations)
//   - voice-capture-whisper   Whisper STT pipeline (E-Media)
//   - photo-ocr-vision        Claude Vision OCR multi-template (E-Media)
//   - inline-menu-callback    Inline keyboard + callback_query routing (C-UI)
//   - i18n-core               Multi-lingua runtime IT/EN/ES/DE/FR/PT (C-UI)
//   - state-machine-capture   Draft lifecycle persistente (B-Sofia-Core)
//   - cost-meter-per-model    Cost tracking fine-grained per LLM model (G-Ops)
//   - white-label-runtime     Brand config JSONB → render (C-UI)
//   - contact-upsert-fuzzy    Dedup + pgvector semantic match (I-Domain)
//   - crm-prefetch-lookup     CRM candidates extraction + fuzzy search (I-Domain)
//   - entity-flow-framework   Generic entity flow declarative (I-Domain)
//   - bot-snapshot-test       Anti-regression diff zero test (G-Ops)
//   - llm-router-multi-provider Router LLM 7 provider task-aware + fallback (B-Sofia-Core)
//   - llm-usage-interceptor   🚨 ZERO TOKEN LEAK 🚨 Drop-in fetch wrapper logga ogni call (G-Ops)

// Re-export selettivo per consumer barrel (no auto-import esterni per evitare
// pull di tutte le dipendenze su cold start).

export * as pushSoft from "./push-soft/index.ts";
export * as webhookSecretVerify from "./webhook-secret-verify/index.ts";
export * as voiceCaptureWhisper from "./voice-capture-whisper/index.ts";
export * as photoOcrVision from "./photo-ocr-vision/index.ts";
export * as inlineMenuCallback from "./inline-menu-callback/index.ts";
export * as i18nCore from "./i18n-core/index.ts";
export * as stateMachineCapture from "./state-machine-capture/index.ts";
export * as costMeterPerModel from "./cost-meter-per-model/index.ts";
export * as whiteLabelRuntime from "./white-label-runtime/index.ts";
export * as contactUpsertFuzzy from "./contact-upsert-fuzzy/index.ts";
export * as crmPrefetchLookup from "./crm-prefetch-lookup/index.ts";
export * as entityFlowFramework from "./entity-flow-framework/index.ts";
export * as botSnapshotTest from "./bot-snapshot-test/index.ts";
export * as llmRouterMultiProvider from "./llm-router-multi-provider/index.ts";
export * as llmUsageInterceptor from "./llm-usage-interceptor/index.ts";
