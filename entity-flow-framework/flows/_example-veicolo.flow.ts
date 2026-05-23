// Donor: ~/Sviluppo/erp/gosolution/.../gomec-telegram-webhook/entities/veicolo.ts
// Donor: ~/Sviluppo/erp/gosolution/.../entities/_shared.ts (VEICOLO_SCHEMA)
// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)

import type { EntityFlowDefinition } from '../types';

export const exampleVeicoloQuickFlow: EntityFlowDefinition = {
  id: 'example_veicolo_quick',
  version: '1.0.0',
  entity_type: 'veicolo',
  label: 'Veicolo (quick)',
  ttl_minutes: 20,
  steps: [
    {
      id: 'ask_targa',
      type: 'capture',
      label: 'Targa',
      fields: [
        {
          key: 'targa',
          label: 'Targa',
          emoji: '🚗',
          required: true,
          prompt: 'Scrivi la <b>targa</b> (es. AB123CD):',
          validate: (v) => {
            const s = typeof v === 'string' ? v.toUpperCase().replace(/[\s-]/g, '') : '';
            if (!/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(s) && !/^[A-Z]{2}\d{5}$/.test(s)) {
              return 'Formato targa non riconosciuto (atteso AB123CD o AB12345).';
            }
            return null;
          },
        },
      ],
    },
    {
      id: 'ask_marca_modello',
      type: 'capture',
      label: 'Marca e modello',
      fields: [
        { key: 'marca', label: 'Marca', emoji: '🏭', required: true },
        { key: 'modello', label: 'Modello', emoji: '📌', required: true },
      ],
    },
    {
      id: 'ask_anno',
      type: 'capture',
      label: 'Anno immatricolazione',
      fields: [
        {
          key: 'anno',
          label: 'Anno',
          emoji: '📅',
          required: false,
          type: 'integer',
          validate: (v) => {
            const n = Number(v);
            const y = new Date().getFullYear();
            if (n < 1900 || n > y + 1) return `Anno fuori range (1900-${y + 1}).`;
            return null;
          },
        },
      ],
    },
    {
      id: 'review',
      type: 'review',
      label: 'Riepilogo veicolo',
      fields: [
        { key: 'targa', label: 'Targa', emoji: '🚗', required: true },
        { key: 'marca', label: 'Marca', emoji: '🏭', required: true },
        { key: 'modello', label: 'Modello', emoji: '📌', required: true },
        { key: 'anno', label: 'Anno', emoji: '📅', required: false },
      ],
    },
    {
      id: 'commit_veicolo',
      type: 'commit',
      label: 'Salvataggio veicolo',
      commit_fn: async () => {
        return { error: 'commit_fn not overridden by consumer' };
      },
    },
  ],
};
