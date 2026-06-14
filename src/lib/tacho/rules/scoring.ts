import type { TachoFinding } from './types';

export function scoreLegalCompliance(findings: TachoFinding[]) {
  return Math.max(
    0,
    100 - findings.reduce((score, finding) => score + severityPenalty(finding.severity), 0)
  );
}

export function summarizeViolationTitles(findings: TachoFinding[]) {
  return [...new Set(findings.map((finding) => finding.title))];
}

function severityPenalty(severity: TachoFinding['severity']) {
  if (severity === 'critical') return 16;
  if (severity === 'high') return 12;
  if (severity === 'medium') return 8;
  if (severity === 'low') return 4;
  return 0;
}
