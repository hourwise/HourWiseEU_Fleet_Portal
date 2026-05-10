import type {
  TachoActivitySegment,
  TachoAnalysisRange,
  TachoDaySummary,
  TachoFinding,
  TachoSummaryMetric,
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
    evidenceRefs: [{ kind: 'event', refId: 'vu-import-2086-motion', label: 'Motion conflict event' }],
  },
  {
    id: 'vu-find-3',
    source: 'vehicle_unit',
    severity: 'medium',
    status: 'warning',
    ruleCode: 'VU_DOWNLOAD_OVERDUE',
    title: 'Vehicle unit download overdue',
    summary: 'The last completed VU download is beyond the expected compliance interval.',
    occurredAt: `${isoDay(0)}T08:00:00Z`,
    periodStart: `${isoDay(6)}T08:15:00Z`,
    periodEnd: `${isoDay(0)}T08:00:00Z`,
    evidenceRefs: [{ kind: 'raw_file', refId: 'vu-import-2088', label: 'VU import' }],
  },
];

function metricsForRange(range: TachoAnalysisRange): TachoSummaryMetric[] {
  return [
    { label: 'Overspeed Events', value: range === '7d' ? '1' : range === '30d' ? '3' : range === '3m' ? '5' : '7', tone: 'danger' },
    { label: 'Technical Events', value: range === '7d' ? '2' : range === '30d' ? '4' : range === '3m' ? '6' : '9', tone: 'warning' },
    { label: 'Unassigned Motion', value: range === '7d' ? '1 day' : range === '30d' ? '2 days' : range === '3m' ? '4 days' : '6 days', tone: 'warning' },
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
    technicalEvents: findings,
  };
}
