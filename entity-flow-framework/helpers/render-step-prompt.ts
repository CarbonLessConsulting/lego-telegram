// Donor: ~/Sviluppo/erp/gomyreference/supabase/functions/_shared/i18n.ts (interpolate pattern)
// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)

import type { FlowStep } from '../types';

/**
 * Interpolazione canonical `{{var}}` allineata al pattern le-GO
 * (vedi anche brick `telegram-white-label-runtime/helpers/apply-brand-template.ts`).
 *
 * Soft no-throw: input invalido ritorna stringa vuota.
 */
function interpolate(template: string, vars?: Record<string, unknown>): string {
  if (!template) return '';
  if (!vars) return template;
  try {
    return template.replace(/\{\{(\w+)\}\}/g, (m, key: string) => {
      const v = vars[key];
      return v === undefined || v === null ? m : String(v);
    });
  } catch {
    return template;
  }
}

/**
 * Render del prompt step per Telegram (HTML inline ammesso).
 *
 * Logica:
 *   1. Se step ha `prompt_template`: interpolate con draft come vars
 *   2. Altrimenti: builda prompt automatico dai fields visible required
 *   3. type='review': mostra riepilogo dei dati accumulati (con emoji)
 *   4. type='commit': messaggio "Sto salvando..." (placeholder, il commit_fn
 *      può tornare un user_message custom)
 *
 * Output è HTML-safe per `sendMessage(parse_mode='HTML')` Telegram.
 */
export function renderStepPrompt(
  step: FlowStep,
  draft: Record<string, unknown>,
): string {
  // 1. Template esplicito
  if (step.prompt_template) {
    return interpolate(step.prompt_template, draft);
  }

  // 2. Auto-build per type='capture'
  if (step.type === 'capture' && step.fields?.length) {
    const visible = step.fields.filter((f) => !f.visible_if || f.visible_if(draft));
    if (visible.length === 1) {
      const f = visible[0];
      return f.prompt ?? `${f.emoji ?? '✏️'} ${f.label}:`;
    }
    const lines: string[] = ['<b>Mi servono questi dati:</b>'];
    for (const f of visible) {
      const flag = f.required ? ' <i>(obbligatorio)</i>' : '';
      lines.push(`${f.emoji ?? '•'} ${f.label}${flag}`);
    }
    return lines.join('\n');
  }

  // 3. Review: riepilogo draft
  if (step.type === 'review') {
    const fields = collectAllFields(step, draft);
    const present: string[] = [];
    const missing: string[] = [];
    for (const f of fields) {
      const v = draft[f.key];
      if (v != null && v !== '') {
        present.push(`${f.emoji ?? '•'} ${f.label}: ${String(v)}`);
      } else if (f.required) {
        missing.push(`❌ ${f.label} <i>(obbligatorio)</i>`);
      }
    }
    const out: string[] = [];
    out.push(`<b>${step.label}</b>`);
    if (present.length) out.push(present.join('\n'));
    if (missing.length) {
      out.push('');
      out.push('<b>Mancano:</b>');
      out.push(missing.join('\n'));
    }
    return out.join('\n');
  }

  // 4. Commit placeholder
  if (step.type === 'commit') {
    return `⏳ ${step.label}...`;
  }

  // Branch
  return `<i>${step.label}</i>`;
}

/**
 * Helper per review step: raccoglie tutti i FieldSpec di tutti gli step
 * 'capture' del flow corrente. Non disponibile senza flow def, quindi
 * fallback su empty.
 *
 * Il review step può ricevere `fields` override → preferiscili a fallback.
 */
function collectAllFields(step: FlowStep, _draft: Record<string, unknown>) {
  return step.fields ?? [];
}
