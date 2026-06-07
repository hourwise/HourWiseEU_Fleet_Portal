import * as Sentry from '@sentry/react';

type TachoImportTelemetryLevel = 'warning' | 'error';

export type TachoImportTelemetryStage =
  | 'helper_download'
  | 'storage_upload'
  | 'import_insert'
  | 'metadata_persist'
  | 'helper_acknowledge'
  | 'processing_kickoff'
  | 'import_status'
  | 'processing_retry';

export interface TachoImportTelemetryContext {
  stage: TachoImportTelemetryStage;
  companyId?: string;
  importId?: string;
  readSessionId?: string;
  fileName?: string;
  filePath?: string;
  sourceType?: string | null;
  ingestSource?: string;
}

function stringifyContext(context: TachoImportTelemetryContext) {
  return {
    feature: 'tachograph_import',
    stage: context.stage,
    companyId: context.companyId ?? null,
    importId: context.importId ?? null,
    readSessionId: context.readSessionId ?? null,
    fileName: context.fileName ?? null,
    filePath: context.filePath ?? null,
    sourceType: context.sourceType ?? null,
    ingestSource: context.ingestSource ?? null,
  };
}

export function reportTachoImportTelemetry(args: {
  level: TachoImportTelemetryLevel;
  message: string;
  context: TachoImportTelemetryContext;
  error?: unknown;
}) {
  const context = stringifyContext(args.context);
  const consoleMethod = args.level === 'error' ? console.error : console.warn;
  consoleMethod(`[tacho:${args.context.stage}] ${args.message}`, {
    ...context,
    error: args.error,
  });

  if (args.error instanceof Error) {
    Sentry.captureException(args.error, {
      level: args.level,
      tags: {
        feature: 'tachograph_import',
        stage: args.context.stage,
      },
      extra: {
        ...context,
        message: args.message,
      },
    });
    return;
  }

  Sentry.captureMessage(args.message, {
    level: args.level,
    tags: {
      feature: 'tachograph_import',
      stage: args.context.stage,
    },
    extra: context,
  });
}
