// Brick: telegram-white-label-runtime v0.1.0 (le-GO C-UI)

import type { TelegramBrandConfig } from '../types';
import { applyBrandTemplate, buildBrandVars } from './apply-brand-template';

/**
 * Render signature da appendere a un messaggio assistant.
 *
 * Ritorna stringa vuota se il brand non ha `signature` (no footer = comportamento
 * di default, non vogliamo rumore visivo).
 *
 * Newline leading (`\n\n`) NON aggiunto automaticamente — è responsabilità del
 * template (alcuni brand vorranno corpo + dash, altri solo dash).
 */
export function renderSignature(brand: TelegramBrandConfig): string {
  if (!brand.signature) return '';
  return applyBrandTemplate(brand.signature, buildBrandVars(brand));
}

/**
 * Convenienza: appende signature al body con separatore standard.
 * Se body vuoto o signature vuota, ritorna `body` tale e quale.
 */
export function appendSignature(body: string, brand: TelegramBrandConfig): string {
  const sig = renderSignature(brand);
  if (!sig) return body;
  if (!body) return sig;
  return `${body}\n\n${sig}`;
}
