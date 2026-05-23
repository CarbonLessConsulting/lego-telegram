// Donor: ~/Sviluppo/erp/gosolution/.../entities/_shared.ts (applyCorrection, FieldSpec validation pattern)
// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)

import type { FlowFieldSpec, FlowStep } from '../types';

export interface ValidationResult {
  ok: boolean;
  /** Patch validata (solo campi accettati). */
  patch: Record<string, unknown>;
  /** Errori per campo (vuoto se tutto ok). */
  errors: Record<string, string>;
}

/**
 * Valida input utente contro i fields di uno step.
 *
 * Validazioni canonical per `type`:
 *   - `text`     → trim + non vuoto (se required)
 *   - `phone`    → 9-14 digit dopo strip non-digit
 *   - `email`    → regex base
 *   - `integer`  → parseInt valido
 *   - `date`     → ISO 8601 YYYY-MM-DD oppure parsable Date
 *   - `enum`     → value ∈ enum_values
 *
 * Field custom `validate(value)` → ritorna error message o null.
 */
export function validateStepInput(
  step: FlowStep,
  input: Record<string, unknown>,
  draft: Record<string, unknown>,
): ValidationResult {
  const patch: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  if (step.type !== 'capture' || !step.fields?.length) {
    return { ok: true, patch, errors };
  }

  for (const field of step.fields) {
    // Visibilità condizionale: salta se field non applicabile
    if (field.visible_if && !field.visible_if(draft)) continue;

    const raw = input[field.key];

    // Empty check
    if (raw == null || raw === '') {
      if (field.required) {
        errors[field.key] = `Campo "${field.label}" obbligatorio.`;
      }
      continue;
    }

    // Type validation
    const typeErr = validateFieldType(field, raw);
    if (typeErr) {
      errors[field.key] = typeErr;
      continue;
    }

    // Custom validator
    if (field.validate) {
      const customErr = field.validate(raw);
      if (customErr) {
        errors[field.key] = customErr;
        continue;
      }
    }

    // Normalize per type
    patch[field.key] = normalizeFieldValue(field, raw);
  }

  return { ok: Object.keys(errors).length === 0, patch, errors };
}

function validateFieldType(field: FlowFieldSpec, raw: unknown): string | null {
  const type = field.type ?? 'text';
  const s = typeof raw === 'string' ? raw.trim() : String(raw);

  switch (type) {
    case 'text':
      return s.length === 0 ? `Campo "${field.label}" vuoto.` : null;

    case 'phone': {
      const digits = s.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 14) {
        return `"${field.label}" non sembra un telefono valido (servono 9-14 cifre).`;
      }
      return null;
    }

    case 'email':
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) {
        return `"${field.label}" non è una email valida.`;
      }
      return null;

    case 'integer': {
      const n = Number(s);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        return `"${field.label}" deve essere un numero intero.`;
      }
      return null;
    }

    case 'date': {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) {
        return `"${field.label}" non è una data valida (formato YYYY-MM-DD).`;
      }
      return null;
    }

    case 'enum': {
      if (!field.enum_values?.length) return null;
      if (!field.enum_values.includes(s)) {
        return `"${field.label}" deve essere uno di: ${field.enum_values.join(', ')}.`;
      }
      return null;
    }

    default:
      return null;
  }
}

function normalizeFieldValue(field: FlowFieldSpec, raw: unknown): unknown {
  const type = field.type ?? 'text';
  const s = typeof raw === 'string' ? raw.trim() : String(raw);

  switch (type) {
    case 'phone':
      return s.replace(/[^\d+]/g, '');
    case 'email':
      return s.toLowerCase();
    case 'integer':
      return parseInt(s, 10);
    case 'date':
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      return new Date(s).toISOString().slice(0, 10);
    default:
      return s;
  }
}
