// Donor: ~/Sviluppo/erp/gosolution/.../gomec-telegram-webhook/entities/cliente.ts (1014 LOC wizard)
// Donor: ~/Sviluppo/erp/gosolution/.../gomec-telegram-webhook/entities/_shared.ts (CLIENTE_SCHEMA)
// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)
//
// Esempio CANONICAL: flow di creazione cliente (privato o azienda)
// con manual-walk + review + commit.

import type { EntityFlowDefinition } from "../types.ts";

export const exampleClienteCreateFlow: EntityFlowDefinition = {
  id: 'example_cliente_create',
  version: '1.0.0',
  entity_type: 'cliente',
  label: 'Creazione cliente',
  ttl_minutes: 30,
  steps: [
    {
      id: 'ask_tipo',
      type: 'capture',
      label: 'Tipo cliente',
      prompt_template: '<b>Nuovo cliente</b>\nÈ un privato o un\'azienda?',
      fields: [
        {
          key: 'tipo',
          label: 'Tipo',
          emoji: '👤',
          required: true,
          type: 'enum',
          enum_values: ['privato', 'azienda'],
        },
      ],
    },
    {
      id: 'ask_dati_privato',
      type: 'capture',
      label: 'Dati privato',
      skip_if: (d) => d.tipo !== 'privato',
      fields: [
        { key: 'nome', label: 'Nome', emoji: '👤', required: true, prompt: 'Scrivi il <b>nome</b>:' },
        { key: 'cognome', label: 'Cognome', emoji: '👤', required: true, prompt: 'Scrivi il <b>cognome</b>:' },
        { key: 'codice_fiscale', label: 'Codice Fiscale', emoji: '🆔', required: false },
      ],
    },
    {
      id: 'ask_dati_azienda',
      type: 'capture',
      label: 'Dati azienda',
      skip_if: (d) => d.tipo !== 'azienda',
      fields: [
        { key: 'ragione_sociale', label: 'Ragione sociale', emoji: '🏢', required: true },
        { key: 'partita_iva', label: 'P.IVA', emoji: '📋', required: true },
      ],
    },
    {
      id: 'ask_contatti',
      type: 'capture',
      label: 'Contatti',
      fields: [
        { key: 'telefono', label: 'Telefono', emoji: '📞', required: true, type: 'phone' },
        { key: 'email', label: 'Email', emoji: '📧', required: false, type: 'email' },
      ],
    },
    {
      id: 'review',
      type: 'review',
      label: 'Riepilogo cliente',
      // Review esplicita i field per mostrarli formattati. Il consumer può
      // sostituire questa logica passando user_message custom.
      fields: [
        { key: 'tipo', label: 'Tipo', emoji: '👤', required: true },
        { key: 'nome', label: 'Nome', emoji: '👤', required: false },
        { key: 'cognome', label: 'Cognome', emoji: '👤', required: false },
        { key: 'ragione_sociale', label: 'Rag. sociale', emoji: '🏢', required: false },
        { key: 'partita_iva', label: 'P.IVA', emoji: '📋', required: false },
        { key: 'codice_fiscale', label: 'CF', emoji: '🆔', required: false },
        { key: 'telefono', label: 'Telefono', emoji: '📞', required: true },
        { key: 'email', label: 'Email', emoji: '📧', required: false },
      ],
    },
    {
      id: 'commit_cliente',
      type: 'commit',
      label: 'Salvataggio cliente',
      // commit_fn iniettato dal consumer al register-time (vedi README API).
      // L'esempio mostra la struttura — il consumer override.
      commit_fn: async (draft, ctx) => {
        console.warn('[example_cliente_create] commit_fn NON OVERRIDE — il consumer deve definirlo', { ctx });
        return { error: 'commit_fn not overridden by consumer', user_message: '⚠️ Configurazione mancante.' };
      },
    },
  ],
};
