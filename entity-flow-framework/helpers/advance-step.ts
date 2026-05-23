// Brick: telegram-entity-flow-framework v0.1.0 (le-GO I-Domain)

import type {
  AdvanceResult,
  FlowEngineConfig,
  FlowRunRow,
  SupabaseLike,
} from '../types';
import { DEFAULT_ENGINE_CONFIG } from '../types';
import { getFlow, getNextStep } from './define-flow';
import { renderStepPrompt } from './render-step-prompt';
import { validateStepInput } from './validate-step-input';

/**
 * Avanza il flow run dato l'input utente.
 *
 * Algoritmo:
 *   1. Carica flow def dal registry
 *   2. Trova step corrente
 *   3. Per `type='capture'`: valida input → se ok merge in draft, se errore ritorna validation_error
 *   4. Per `type='branch'`: chiama branch_fn(draft) → vai a step ID ritornato
 *   5. Per `type='commit'`: chiama commit_fn → se ok status='completed', se errore status='failed'
 *   6. Per `type='review'`: se input è 'confirm' → next step; se 'cancel' → status='abandoned'
 *   7. Persist run aggiornato
 *   8. Render prompt prossimo step + ritorna AdvanceResult
 *
 * Soft no-throw: in caso di errore ritorna un AdvanceResult con validation_error.
 */
export async function advanceStep(opts: {
  sb: SupabaseLike;
  run: FlowRunRow;
  /** Input utente. Per 'capture': dict di field values. Per 'review': {action:'confirm'|'cancel'}. */
  input: Record<string, unknown>;
  config?: Partial<FlowEngineConfig>;
}): Promise<AdvanceResult | null> {
  const config: FlowEngineConfig = { ...DEFAULT_ENGINE_CONFIG, ...opts.config };
  const flow = getFlow(opts.run.flow_id);
  if (!flow) {
    console.error('[entity-flow-framework] advanceStep: flow not registered', { id: opts.run.flow_id });
    return null;
  }

  const currentStep = flow.steps.find((s) => s.id === opts.run.current_step_id);
  if (!currentStep) {
    console.error('[entity-flow-framework] advanceStep: step not found', {
      flow: flow.id,
      step: opts.run.current_step_id,
    });
    return null;
  }

  const now = new Date().toISOString();
  let nextDraft = { ...opts.run.draft };
  let nextStatus: FlowRunRow['status'] = 'running';
  let nextStepId = opts.run.current_step_id;
  let validation_error: string | undefined;
  let result_record_id: string | null = opts.run.result_record_id;
  let error_message: string | null = opts.run.error_message;
  let user_message: string | undefined;

  switch (currentStep.type) {
    case 'capture': {
      const { ok, patch, errors } = validateStepInput(currentStep, opts.input, opts.run.draft);
      if (!ok) {
        validation_error = Object.values(errors).join(' · ');
        // Stay on same step
      } else {
        nextDraft = { ...nextDraft, ...patch };
        const next = getNextStep(flow, currentStep, nextDraft);
        if (next) nextStepId = next.id;
        else nextStatus = 'completed';
      }
      break;
    }

    case 'review': {
      const action = String(opts.input?.action ?? '');
      if (action === 'cancel') {
        nextStatus = 'abandoned';
      } else if (action === 'confirm') {
        const next = getNextStep(flow, currentStep, nextDraft);
        if (next) nextStepId = next.id;
        else nextStatus = 'completed';
      } else {
        validation_error = "Azione non valida. Atteso 'confirm' o 'cancel'.";
      }
      break;
    }

    case 'branch': {
      if (!currentStep.branch_fn) {
        validation_error = 'branch step senza branch_fn';
      } else {
        try {
          const target = currentStep.branch_fn(nextDraft);
          if (!flow.steps.find((s) => s.id === target)) {
            validation_error = `branch_fn ha ritornato step ID inesistente: ${target}`;
          } else {
            nextStepId = target;
          }
        } catch (e) {
          validation_error = `branch_fn ha lanciato: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      break;
    }

    case 'commit': {
      if (!currentStep.commit_fn) {
        nextStatus = 'failed';
        error_message = 'commit step senza commit_fn';
      } else {
        try {
          const r = await currentStep.commit_fn(nextDraft, {
            tenant_id: opts.run.tenant_id,
            owner_user_id: opts.run.owner_user_id,
            telegram_chat_id: opts.run.telegram_chat_id,
            flow_id: opts.run.flow_id,
            run_id: opts.run.id,
          });
          if (r.error) {
            nextStatus = 'failed';
            error_message = r.error;
            user_message = r.user_message;
          } else {
            result_record_id = r.record_id ?? null;
            user_message = r.user_message;
            const next = getNextStep(flow, currentStep, nextDraft);
            if (next) nextStepId = next.id;
            else nextStatus = 'completed';
          }
        } catch (e) {
          nextStatus = 'failed';
          error_message = e instanceof Error ? e.message : String(e);
        }
      }
      break;
    }
  }

  // Persist
  try {
    const stepHistory = [...opts.run.step_history];
    if (nextStepId !== opts.run.current_step_id) {
      stepHistory.push({ step_id: nextStepId, entered_at: now });
    }
    const patch: Record<string, unknown> = {
      current_step_id: nextStepId,
      status: nextStatus,
      draft: nextDraft,
      step_history: stepHistory,
      result_record_id,
      error_message,
      updated_at: now,
    };
    await opts.sb.from(config.runs_table).update(patch).eq('id', opts.run.id);
  } catch (e) {
    console.error('[entity-flow-framework] advanceStep persist failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const updatedRun: FlowRunRow = {
    ...opts.run,
    current_step_id: nextStepId,
    status: nextStatus,
    draft: nextDraft,
    result_record_id,
    error_message,
    updated_at: now,
  };
  const finalStep = flow.steps.find((s) => s.id === nextStepId) ?? currentStep;

  return {
    run: updatedRun,
    current_step: finalStep,
    is_terminal: nextStatus !== 'running',
    user_message: user_message ?? renderStepPrompt(finalStep, nextDraft),
    validation_error,
  };
}
