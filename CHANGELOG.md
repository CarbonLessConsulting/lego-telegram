# Changelog

All notable changes to `@goai/lego-telegram` documented qui.

Format: [Keep a Changelog](https://keepachangelog.com/), versioning [SemVer](https://semver.org/).

## [0.1.0] — 2026-05-23

### Added — initial release
- 13 brick canonical estratti da bot produzione GOAi&digital Agency
- 6 P0 foundation: `push-soft`, `webhook-secret-verify`, `voice-capture-whisper`, `photo-ocr-vision`, `inline-menu-callback`, `i18n-core`
- 5 P1 avanzati: `state-machine-capture`, `cost-meter-per-model`, `white-label-runtime`, `contact-upsert-fuzzy`
- 2 P2 specializzati: `crm-prefetch-lookup`, `entity-flow-framework`
- 1 G-Ops: `bot-snapshot-test` (anti-regression test)
- Compliance JSON per ogni brick (GDPR / OWASP / AI Act mapping)
- Donor attribution in ogni file `.ts`
- 6 locale bundle (IT/EN/ES/DE/FR/PT) in `i18n-core`
- 7 OCR template in `photo-ocr-vision`
- Pricing table modelli LLM ufficiale in `cost-meter-per-model`

### Documented
- README con quick start + filosofia design
- Esempio minimo edge function Deno
- Catalogo brick con categorie le-GO

### Known limitations (v0.1)
- `bot-snapshot-test` v0.1 cattura solo response HTTP webhook (non outbound sendMessage). v0.2 aggiungerà proxy Telegram API mock.
- Alcuni brick contengono import relativi a `_shared/` esterno — verificare compatibilità con pubblicazione JSR (potrebbe richiedere refactor a v0.2).
