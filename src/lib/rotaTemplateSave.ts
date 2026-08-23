import type { Database, Json } from './database.types';

export const ROTA_TEMPLATE_SAVE_TIMEOUT_MS = 15_000;

export type RotaTemplateRequirementDraft = {
  id: string;
  cycleDay: number;
  roleLabel: string;
  startTime: string;
  endTime: string;
  headcount: number;
};

export type CreateRotaTemplateArgs =
  Database['public']['Functions']['create_cyclic_rota_template']['Args'];

export type RotaTemplateRpcResponse = {
  data: Json | null;
  error: { message: string } | null;
};

export type RotaTemplateSaveResult =
  | { status: 'confirmed'; templateId: string; name: string; replayed: boolean }
  | { status: 'server_error'; message: string }
  | { status: 'uncertain'; message: string }
  | { status: 'inconsistent'; templateId: string; message: string };

type SubmitDependencies = {
  rpc: (args: CreateRotaTemplateArgs, signal: AbortSignal) => PromiseLike<RotaTemplateRpcResponse>;
  refreshAndSelect: (templateId: string) => Promise<boolean>;
  setBusy: (busy: boolean) => void;
  onConfirmed: () => void;
  reportTechnicalError?: (error: unknown) => void;
  timeoutMs?: number;
};

class RotaTemplateTimeoutError extends Error {
  constructor() {
    super('Rota template save timed out');
    this.name = 'RotaTemplateTimeoutError';
  }
}

export function buildRotaTemplateCreateArgs(input: {
  name: string;
  cycleLength: number;
  requirements: RotaTemplateRequirementDraft[];
  requestKey: string;
}): CreateRotaTemplateArgs {
  const name = input.name.trim();
  if (!name || !Number.isInteger(input.cycleLength) || input.cycleLength < 1 || input.cycleLength > 56) {
    throw new Error('Enter a pattern name and a valid cycle length.');
  }
  if (!input.requestKey || input.requirements.length < 1 || input.requirements.length > 500) {
    throw new Error('Add at least one valid staffing requirement.');
  }

  const slots = input.requirements.map((entry, sortOrder) => {
    const roleLabel = entry.roleLabel.trim();
    const validTime = /^\d{2}:\d{2}$/.test(entry.startTime) && /^\d{2}:\d{2}$/.test(entry.endTime);
    if (
      !Number.isInteger(entry.cycleDay) || entry.cycleDay < 1 || entry.cycleDay > input.cycleLength ||
      !roleLabel || !validTime || entry.startTime === entry.endTime ||
      !Number.isInteger(entry.headcount) || entry.headcount < 1 || entry.headcount > 50
    ) {
      throw new Error('Check each requirement has a day, role, different start and finish times, and 1 to 50 people.');
    }
    return {
      cycle_day: entry.cycleDay,
      role_label: roleLabel,
      start_time: entry.startTime,
      end_time: entry.endTime,
      required_headcount: entry.headcount,
      sort_order: sortOrder,
    } satisfies Json;
  });

  return {
    p_name: name,
    p_description: 'Staffing demand pattern',
    p_cycle_length_days: input.cycleLength,
    p_slots: slots,
    p_request_key: input.requestKey,
  };
}

export async function submitRotaTemplate(
  args: CreateRotaTemplateArgs,
  dependencies: SubmitDependencies,
): Promise<RotaTemplateSaveResult> {
  const controller = new AbortController();
  const timeoutMs = dependencies.timeoutMs ?? ROTA_TEMPLATE_SAVE_TIMEOUT_MS;
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let shouldConfirm = false;

  dependencies.setBusy(true);
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new RotaTemplateTimeoutError());
      }, timeoutMs);
    });
    const response = await Promise.race([
      Promise.resolve(dependencies.rpc(args, controller.signal)),
      timeout,
    ]);

    if (response.error) {
      dependencies.reportTechnicalError?.(response.error);
      return {
        status: 'server_error',
        message: "We couldn't save this staffing pattern. Nothing was saved. Check the entries and try again.",
      };
    }

    const outcome = readCreateOutcome(response.data);
    if (!outcome) {
      dependencies.reportTechnicalError?.(new Error('Template RPC returned no usable template identifier'));
      return {
        status: 'uncertain',
        message: "We couldn't confirm whether this pattern was saved. Refresh the pattern list before trying again.",
      };
    }

    const visibleAfterRefresh = await dependencies.refreshAndSelect(outcome.templateId);
    if (!visibleAfterRefresh) {
      return {
        status: 'inconsistent',
        templateId: outcome.templateId,
        message: 'The pattern was saved, but the refreshed pattern list did not include it. Refresh before trying again.',
      };
    }

    shouldConfirm = true;
    return {
      status: 'confirmed',
      templateId: outcome.templateId,
      name: args.p_name,
      replayed: outcome.replayed,
    };
  } catch (error) {
    dependencies.reportTechnicalError?.(error);
    return {
      status: 'uncertain',
      message: timedOut || error instanceof RotaTemplateTimeoutError
        ? "We couldn't confirm whether this pattern was saved. Refresh the pattern list before trying again."
        : "We couldn't confirm whether this pattern was saved. Check your connection, then refresh the pattern list.",
    };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    dependencies.setBusy(false);
    if (shouldConfirm) dependencies.onConfirmed();
  }
}

function readCreateOutcome(data: Json | null): { templateId: string; replayed: boolean } | null {
  if (!data || Array.isArray(data) || typeof data !== 'object') return null;
  const templateId = data.template_id;
  if (typeof templateId !== 'string' || !templateId) return null;
  return { templateId, replayed: data.replayed === true };
}
