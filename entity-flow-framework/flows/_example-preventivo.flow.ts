// Donor: ~/Sviluppo/erp/gosolution/.../gomec-telegram-webhook/entities/preventivo.ts
// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)
//
// Esempio con branch step: scegli "rapido" (3 campi) vs "completo" (8 campi).

import type { EntityFlowDefinition } from "../types.ts";

export const examplePreventivoFlow: EntityFlowDefinition = {
  id: 'example_preventivo_create',
  version: '1.0.0',
  entity_type: 'preventivo',
  label: 'Creazione preventivo',
  ttl_minutes: 45,
  steps: [
    {
      id: 'ask_cliente',
      type: 'capture',
      label: 'Cliente destinatario',
      fields: [
        { key: 'cliente_id', label: 'Cliente', emoji: '👤', required: true, prompt: 'Inserisci ID o nome cliente:' },
      ],
    },
    {
      id: 'ask_modalita',
      type: 'capture',
      label: 'Modalità inserimento',
      fields: [
        {
          key: 'modalita',
          label: 'Modalità',
          emoji: '⚙️',
          required: true,
          type: 'enum',
          enum_values: ['rapido', 'completo'],
        },
      ],
    },
    {
      id: 'branch_modalita',
      type: 'branch',
      label: 'Routing rapido vs completo',
      branch_fn: (draft) => (draft.modalita === 'completo' ? 'ask_dettagli_completi' : 'ask_voce_unica'),
    },
    {
      id: 'ask_voce_unica',
      type: 'capture',
      label: 'Voce unica (rapido)',
      fields: [
        { key: 'descrizione', label: 'Descrizione', emoji: '📝', required: true },
        { key: 'importo_eur', label: 'Importo (EUR)', emoji: '💶', required: true, type: 'integer' },
      ],
      next_step: 'review',
    },
    {
      id: 'ask_dettagli_completi',
      type: 'capture',
      label: 'Dettagli completi',
      fields: [
        { key: 'descrizione', label: 'Descrizione', emoji: '📝', required: true },
        { key: 'manodopera_eur', label: 'Manodopera (EUR)', emoji: '🔧', required: false, type: 'integer' },
        { key: 'ricambi_eur', label: 'Ricambi (EUR)', emoji: '🛠', required: false, type: 'integer' },
        { key: 'sconto_pct', label: 'Sconto %', emoji: '🏷', required: false, type: 'integer' },
        { key: 'note_interne', label: 'Note interne', emoji: '🗒', required: false },
      ],
      next_step: 'review',
    },
    {
      id: 'review',
      type: 'review',
      label: 'Riepilogo preventivo',
      fields: [
        { key: 'cliente_id', label: 'Cliente', emoji: '👤', required: true },
        { key: 'modalita', label: 'Modalità', emoji: '⚙️', required: true },
        { key: 'descrizione', label: 'Descrizione', emoji: '📝', required: true },
        { key: 'importo_eur', label: 'Importo', emoji: '💶', required: false },
        { key: 'manodopera_eur', label: 'Manodopera', emoji: '🔧', required: false },
        { key: 'ricambi_eur', label: 'Ricambi', emoji: '🛠', required: false },
        { key: 'sconto_pct', label: 'Sconto', emoji: '🏷', required: false },
      ],
    },
    {
      id: 'commit_preventivo',
      type: 'commit',
      label: 'Generazione preventivo',
      commit_fn: async () => {
        return { error: 'commit_fn not overridden by consumer' };
      },
    },
  ],
};
