import type {
  TachoActivitySegment,
  TachoAnalysisRange,
  TachoDaySummary,
  TachoFinding,
  TachoSummaryMetric,
  VehicleMotionDiscrepancy,
  VehicleUnitAnalysisData,
} from './rules/types';

const TODAY = new Date('2026-05-09T12:00:00Z');

function isoDay(offset: number) {
  const value = new Date(TODAY);
  value.setUTCDate(value.getUTCDate() - offset);
  return value.toISOString().slice(0, 10);
}

function buildActivity(
  date: string,
  start: string,
  end: string,
  activityType: TachoActivitySegment['activityType'],
  label?: string
): TachoActivitySegment {
  const startTime = `${date}T${start}:00Z`;
  const endTime = `${date}T${end}:00Z`;

  return {
    id: `${date}-${start}-${activityType}`,
    source: 'vehicle_unit',
    activityType,
    startTime,
    endTime,
    durationMins: Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)),
    label,
  };
}

const dailySummaries: TachoDaySummary[] = [
  {
    date: isoDay(0),
    drivingMins: 420,
    workMins: 0,
    poaMins: 0,
    restMins: 1020,
    findingsCount: 1,
    vuEventCount: 1,
    activities: [
      buildActivity(isoDay(0), '05:40', '09:00', 'driving'),
      buildActivity(isoDay(0), '09:00', '09:45', 'break_rest'),
      buildActivity(isoDay(0), '09:45', '13:25', 'driving'),
    ],
  },
  {
    date: isoDay(1),
    drivingMins: 390,
    workMins: 0,
    poaMins: 0,
    restMins: 1050,
    findingsCount: 3,
    vuEventCount: 2,
    activities: [
      buildActivity(isoDay(1), '06:10', '10:00', 'driving'),
      buildActivity(isoDay(1), '10:00', '10:45', 'break_rest'),
      buildActivity(isoDay(1), '10:45', '13:30', 'driving'),
    ],
  },
  {
    date: isoDay(2),
    drivingMins: 250,
    workMins: 0,
    poaMins: 0,
    restMins: 1190,
    findingsCount: 0,
    vuEventCount: 0,
    activities: [
      buildActivity(isoDay(2), '08:00', '10:10', 'driving'),
      buildActivity(isoDay(2), '10:10', '10:55', 'break_rest'),
      buildActivity(isoDay(2), '10:55', '12:10', 'driving'),
    ],
  },
  {
    date: isoDay(3),
    drivingMins: 460,
    workMins: 0,
    poaMins: 0,
    restMins: 980,
    findingsCount: 2,
    vuEventCount: 2,
    activities: [
      buildActivity(isoDay(3), '05:30', '09:40', 'driving'),
      buildActivity(isoDay(3), '09:40', '10:25', 'break_rest'),
      buildActivity(isoDay(3), '10:25', '13:55', 'driving'),
    ],
  },
  {
    date: isoDay(4),
    drivingMins: 200,
    workMins: 0,
    poaMins: 0,
    restMins: 1240,
    findingsCount: 1,
    vuEventCount: 1,
    activities: [
      buildActivity(isoDay(4), '07:30', '09:00', 'driving'),
      buildActivity(isoDay(4), '09:00', '09:50', 'break_rest'),
      buildActivity(isoDay(4), '09:50', '11:40', 'driving'),
    ],
  },
  {
    date: isoDay(5),
    drivingMins: 340,
    workMins: 0,
    poaMins: 0,
    restMins: 1100,
    findingsCount: 1,
    vuEventCount: 1,
    activities: [
      buildActivity(isoDay(5), '06:45', '09:20', 'driving'),
      buildActivity(isoDay(5), '09:20', '10:05', 'break_rest'),
      buildActivity(isoDay(5), '10:05', '12:10', 'driving'),
    ],
  },
  {
    date: isoDay(6),
    drivingMins: 300,
    workMins: 0,
    poaMins: 0,
    restMins: 1140,
    findingsCount: 0,
    vuEventCount: 0,
    activities: [
      buildActivity(isoDay(6), '08:15', '10:40', 'driving'),
      buildActivity(isoDay(6), '10:40', '11:30', 'break_rest'),
      buildActivity(isoDay(6), '11:30', '12:45', 'driving'),
    ],
  },
];

const findings: TachoFinding[] = [
  {
    id: 'vu-find-0',
    source: 'vehicle_unit',
    severity: 'medium',
    status: 'warning',
    ruleCode: 'DRV_WEEKLY_56H_EXCEEDED',
    title: 'Vehicle activity exceeds weekly linked driving threshold',
    summary: 'Rolling weekly VU activity suggests one linked driver exceeded the weekly driving limit and should be reviewed against card data.',
    occurredAt: `${isoDay(0)}T18:00:00Z`,
    periodStart: `${isoDay(6)}T05:30:00Z`,
    periodEnd: `${isoDay(0)}T18:00:00Z`,
    legalBasis: 'Drivers’ Hours',
    evidenceRefs: [{ kind: 'summary', refId: 'vu-summary-week-1', label: 'Weekly vehicle summary' }],
    metadata: { weeklyDrivingMinutes: 3420, thresholdMinutes: 3360 },
  },
];

const technicalEvents: TachoFinding[] = [
  {
    id: 'vu-find-1',
    source: 'vehicle_unit',
    severity: 'high',
    status: 'breach',
    ruleCode: 'VU_OVERSPEED',
    title: 'Overspeed event recorded',
    summary: 'The VU shows one overspeed event exceeding the configured threshold for more than 60 seconds.',
    occurredAt: `${isoDay(1)}T12:18:00Z`,
    periodStart: `${isoDay(1)}T12:16:00Z`,
    periodEnd: `${isoDay(1)}T12:19:00Z`,
    legalBasis: 'Vehicle Unit Event',
    evidenceRefs: [{ kind: 'raw_file', refId: 'vu-import-2088', label: 'VU import' }],
    metadata: { speedKmh: 96, thresholdKmh: 90 },
  },
  {
    id: 'vu-find-2',
    source: 'vehicle_unit',
    severity: 'medium',
    status: 'warning',
    ruleCode: 'VU_MOTION_CONFLICT',
    title: 'Motion conflict event',
    summary: 'One motion consistency event should be reviewed against sensor and GNSS context.',
    occurredAt: `${isoDay(3)}T07:45:00Z`,
    periodStart: `${isoDay(3)}T07:44:00Z`,
    periodEnd: `${isoDay(3)}T07:46:00Z`,
    legalBasis: 'Vehicle Unit Event',
    evidenceRefs: [{ kind: 'event', refId: 'vu-import-2086-motion', label: 'Motion conflict event' }],
    metadata: { eventCategory: 'motion_conflict' },
  },
  {
    id: 'vu-find-3',
    source: 'vehicle_unit',
    severity: 'high',
    status: 'warning',
    ruleCode: 'VU_DRIVING_WITHOUT_CARD',
    title: 'Driving without card event',
    summary: 'The VU recorded motion with no corresponding driver card present for the captured interval.',
    occurredAt: `${isoDay(1)}T06:48:00Z`,
    periodStart: `${isoDay(1)}T06:42:00Z`,
    periodEnd: `${isoDay(1)}T06:51:00Z`,
    legalBasis: 'Vehicle Unit Event',
    evidenceRefs: [{ kind: 'event', refId: 'vu-import-2088-cardless', label: 'Driving without card event' }],
    metadata: { durationMinutes: 9 },
  },
  {
    id: 'vu-find-4',
    source: 'vehicle_unit',
    severity: 'medium',
    status: 'warning',
    ruleCode: 'VU_POWER_INTERRUPTION',
    title: 'Power interruption recorded',
    summary: 'A short VU power interruption was logged and should be checked against workshop or electrical maintenance notes.',
    occurredAt: `${isoDay(4)}T14:12:00Z`,
    periodStart: `${isoDay(4)}T14:12:00Z`,
    periodEnd: `${isoDay(4)}T14:15:00Z`,
    legalBasis: 'Vehicle Unit Event',
    evidenceRefs: [{ kind: 'fault', refId: 'vu-import-2084-power', label: 'Power interruption fault' }],
    metadata: { faultCategory: 'power_interruption' },
  },
];

const unassignedMotion: VehicleMotionDiscrepancy[] = [
  {
    id: 'vu-disc-1',
    date: isoDay(1),
    startTime: `${isoDay(1)}T06:42:00Z`,
    endTime: `${isoDay(1)}T06:51:00Z`,
    durationMins: 9,
    severity: 'high',
    status: 'unassigned_motion',
    summary: 'Vehicle movement was recorded before any linked driver card was present in the VU.',
    evidenceRefs: [{ kind: 'event', refId: 'vu-import-2088-cardless', label: 'Driving without card event' }],
  },
  {
    id: 'vu-disc-2',
    date: isoDay(3),
    startTime: `${isoDay(3)}T07:44:00Z`,
    endTime: `${isoDay(3)}T07:46:00Z`,
    durationMins: 2,
    severity: 'medium',
    status: 'needs_review',
    summary: 'Motion conflict event should be checked against sensor data and assigned driver context.',
    evidenceRefs: [{ kind: 'event', refId: 'vu-import-2086-motion', label: 'Motion conflict event' }],
  },
  {
    id: 'vu-disc-3',
    date: isoDay(4),
    startTime: `${isoDay(4)}T09:50:00Z`,
    endTime: `${isoDay(4)}T10:08:00Z`,
    durationMins: 18,
    severity: 'medium',
    status: 'driver_mismatch',
    summary: 'Vehicle movement has no matching linked driver session in the current review window.',
    linkedDriverName: 'Unassigned',
    evidenceRefs: [{ kind: 'summary', refId: 'vu-day-gap-1', label: 'Vehicle day review' }],
  },
];

function metricsForRange(range: TachoAnalysisRange): TachoSummaryMetric[] {
  return [
    { label: 'Overspeed Events', value: range === '7d' ? '1' : range === '30d' ? '3' : range === '3m' ? '5' : '7', tone: 'danger' },
    { label: 'Card / Driver Events', value: range === '7d' ? '1' : range === '30d' ? '2' : range === '3m' ? '3' : '4', tone: 'warning' },
    { label: 'Technical Faults', value: range === '7d' ? '2' : range === '30d' ? '4' : range === '3m' ? '6' : '8', tone: 'warning' },
    { label: 'Unassigned Motion', value: range === '7d' ? '2' : range === '30d' ? '4' : range === '3m' ? '6' : '9', tone: 'danger' },
    { label: 'Compliance Findings', value: range === '7d' ? '1' : range === '30d' ? '2' : range === '3m' ? '3' : '4', tone: 'warning' },
    { label: 'Download Status', value: 'Overdue', tone: 'danger' },
  ];
}

export function getMockVehicleUnitAnalysis(range: TachoAnalysisRange): VehicleUnitAnalysisData {
  return {
    identity: {
      vehicleId: 'vehicle-001',
      regNumber: 'HX24 FLT',
      vuSerial: 'VDO-8820-19344',
      makeModel: 'DAF XF 530',
      calibrationDue: '2026-11-14',
      lastDownloadAt: '2026-01-28T16:30:00Z',
      downloadStatus: 'overdue',
    },
    range,
    metrics: metricsForRange(range),
    dailySummaries,
    findings,
    technicalEvents,
    unassignedMotion,
  };
}
