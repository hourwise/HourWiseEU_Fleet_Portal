import type { TachoImportRecord } from './rules/types';

export interface TachoImportObservabilityIssue {
  kind: 'processing_kickoff' | 'trigger_dispatch' | 'helper_capture' | 'processing_error';
  title: string;
  message: string;
  timestamp?: string;
  tone: 'warning' | 'danger';
  retryable: boolean;
}

export interface TachoImportObservabilitySummary {
  processingNow: number;
  completedToday: number;
  failedImports: number;
  partialImports: number;
  kickoffWarnings: number;
  dispatchWarnings: number;
  helperCaptureWarnings: number;
  processingErrors: number;
  retryBacklog: number;
  attentionQueue: number;
}

export function getTachoImportObservabilityIssue(item: TachoImportRecord): TachoImportObservabilityIssue | null {
  if (item.processingKickoffError) {
    return {
      kind: 'processing_kickoff',
      title: 'Processing Kickoff Warning',
      message: item.processingKickoffError,
      timestamp: item.processingKickoffRequestedAt,
      tone: 'warning',
      retryable: true,
    };
  }

  if (item.triggerDispatchError) {
    return {
      kind: 'trigger_dispatch',
      title: 'Trigger Dispatch Warning',
      message: item.triggerDispatchError,
      timestamp: item.triggerDispatchRequestedAt,
      tone: 'warning',
      retryable: true,
    };
  }

  if (item.parserStatus === 'partial_helper_capture' || item.helperCaptureSchema) {
    const selectedFiles = item.helperCaptureSelectedFileCount ?? item.helperCaptureFileCount;
    const capturedBytes = item.helperCaptureCapturedBytes;
    const captureDetail = [
      selectedFiles !== undefined ? `${selectedFiles} tachograph card file${selectedFiles === 1 ? '' : 's'}` : null,
      capturedBytes !== undefined ? `${capturedBytes.toLocaleString()} bytes` : null,
    ].filter(Boolean).join(', ');

    return {
      kind: 'helper_capture',
      title: 'Read-only Helper Capture',
      message: item.helperCaptureWarning ?? (
        captureDetail
          ? `The desktop helper stored a read-only EF capture (${captureDetail}). It is preserved for parser development and is not yet normalized into compliance records.`
          : 'The desktop helper stored a read-only EF capture. It is preserved for parser development and is not yet normalized into compliance records.'
      ),
      tone: 'warning',
      retryable: false,
    };
  }

  if (item.processingError) {
    return {
      kind: 'processing_error',
      title: 'Processing Error',
      message: item.processingError,
      tone: 'danger',
      retryable: item.status === 'failed',
    };
  }

  return null;
}

export function canRetryTachoImportProcessing(item: TachoImportRecord) {
  return getTachoImportObservabilityIssue(item)?.retryable ?? false;
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function summarizeTachoImportObservability(
  items: TachoImportRecord[],
  now = new Date()
): TachoImportObservabilitySummary {
  return items.reduce<TachoImportObservabilitySummary>(
    (summary, item) => {
      const issue = getTachoImportObservabilityIssue(item);

      if (item.status === 'processing') {
        summary.processingNow += 1;
      }

      if (item.status === 'complete' && isSameCalendarDay(new Date(item.importedAt), now)) {
        summary.completedToday += 1;
      }

      if (item.status === 'failed') {
        summary.failedImports += 1;
      }

      if (item.status === 'partial') {
        summary.partialImports += 1;
      }

      if (issue?.kind === 'processing_kickoff') {
        summary.kickoffWarnings += 1;
      }

      if (issue?.kind === 'trigger_dispatch') {
        summary.dispatchWarnings += 1;
      }

      if (issue?.kind === 'helper_capture') {
        summary.helperCaptureWarnings += 1;
      }

      if (issue?.kind === 'processing_error') {
        summary.processingErrors += 1;
      }

      if (issue?.retryable) {
        summary.retryBacklog += 1;
      }

      if (issue || item.status === 'partial' || item.status === 'failed') {
        summary.attentionQueue += 1;
      }

      return summary;
    },
    {
      processingNow: 0,
      completedToday: 0,
      failedImports: 0,
      partialImports: 0,
      kickoffWarnings: 0,
      dispatchWarnings: 0,
      helperCaptureWarnings: 0,
      processingErrors: 0,
      retryBacklog: 0,
      attentionQueue: 0,
    }
  );
}
