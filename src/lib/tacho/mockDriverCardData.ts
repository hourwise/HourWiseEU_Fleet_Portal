import type {
  DriverCardAnalysisData,
  TachoActivitySegment,
  TachoAnalysisRange,
  TachoDaySummary,
  TachoFinding,
  TachoReconciliationItem,
  TachoSummaryMetric,
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
  source: TachoActivitySegment['source'],
  label?: string
): TachoActivitySegment {
  const startTime = `${date}T${start}:00Z`;
  const endTime = `${date}T${end}:00Z`;
  const durationMins = Math.max(
    0,
    Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
  );

  return {
    id: `${date}-${start}-${activityType}-${source}`,
    source,
    activityType,
    driverId: 'driver-001',
    vehicleId: 'vehicle-001',
    startTime,
    endTime,
    durationMins,
    label,
  };
}

function buildDaySummary(
  offset: number,
  config: {
    drivingMins: number;
    workMins: number;
    poaMins: number;
    restMins: number;
    appDrivingMins?: number;
    findingsCount: number;
    activities: TachoActivitySegment[];
  }
): TachoDaySummary {
  return {
    date: isoDay(offset),
    drivingMins: config.drivingMins,
    workMins: config.workMins,
    poaMins: config.poaMins,
    restMins: config.restMins,
    appDrivingMins: config.appDrivingMins,
    findingsCount: config.findingsCount,
    activities: config.activities,
  };
}

const dailySummaries: TachoDaySummary[] = [
  buildDaySummary(0, {
    drivingMins: 310,
    workMins: 140,
    poaMins: 25,
    restMins: 965,
    appDrivingMins: 280,
    findingsCount: 1,
    activities: [
      buildActivity(isoDay(0), '05:45', '08:45', 'driving', 'driver_card'),
      buildActivity(isoDay(0), '08:45', '09:10', 'break_rest', 'driver_card'),
      buildActivity(isoDay(0), '09:10', '10:40', 'driving', 'driver_card'),
      buildActivity(isoDay(0), '10:40', '12:00', 'work', 'driver_card'),
      buildActivity(isoDay(0), '12:00', '12:25', 'poa', 'driver_card'),
    ],
  }),
  buildDaySummary(1, {
    drivingMins: 515,
    workMins: 110,
    poaMins: 35,
    restMins: 780,
    appDrivingMins: 450,
    findingsCount: 3,
    activities: [
      buildActivity(isoDay(1), '06:05', '10:50', 'driving', 'driver_card'),
      buildActivity(isoDay(1), '10:50', '11:05', 'break_rest', 'driver_card'),
      buildActivity(isoDay(1), '11:05', '12:40', 'driving', 'driver_card'),
      buildActivity(isoDay(1), '12:40', '14:30', 'work', 'driver_card'),
    ],
  }),
  buildDaySummary(2, {
    drivingMins: 270,
    workMins: 190,
    poaMins: 45,
    restMins: 935,
    appDrivingMins: 270,
    findingsCount: 0,
    activities: [
      buildActivity(isoDay(2), '07:00', '09:15', 'driving', 'driver_card'),
      buildActivity(isoDay(2), '09:15', '10:00', 'break_rest', 'driver_card'),
      buildActivity(isoDay(2), '10:00', '12:15', 'work', 'driver_card'),
      buildActivity(isoDay(2), '12:15', '13:45', 'driving', 'driver_card'),
    ],
  }),
  buildDaySummary(3, {
    drivingMins: 360,
    workMins: 150,
    poaMins: 40,
    restMins: 890,
    appDrivingMins: 360,
    findingsCount: 1,
    activities: [
      buildActivity(isoDay(3), '05:50', '08:10', 'driving', 'driver_card'),
      buildActivity(isoDay(3), '08:10', '08:55', 'break_rest', 'driver_card'),
      buildActivity(isoDay(3), '08:55', '10:35', 'work', 'driver_card'),
      buildActivity(isoDay(3), '10:35', '12:35', 'driving', 'driver_card'),
    ],
  }),
  buildDaySummary(4, {
    drivingMins: 180,
    workMins: 210,
    poaMins: 55,
    restMins: 995,
    appDrivingMins: 0,
    findingsCount: 2,
    activities: [
      buildActivity(isoDay(4), '06:10', '07:30', 'work', 'driver_card'),
      buildActivity(isoDay(4), '07:30', '09:15', 'driving', 'driver_card'),
      buildActivity(isoDay(4), '09:15', '10:10', 'poa', 'driver_card'),
      buildActivity(isoDay(4), '10:10', '12:00', 'work', 'driver_card'),
    ],
  }),
  buildDaySummary(5, {
    drivingMins: 405,
    workMins: 120,
    poaMins: 30,
    restMins: 885,
    appDrivingMins: 390,
    findingsCount: 1,
    activities: [
      buildActivity(isoDay(5), '06:20', '09:25', 'driving', 'driver_card'),
      buildActivity(isoDay(5), '09:25', '10:10', 'break_rest', 'driver_card'),
      buildActivity(isoDay(5), '10:10', '12:00', 'driving', 'driver_card'),
      buildActivity(isoDay(5), '12:00', '13:00', 'work', 'driver_card'),
    ],
  }),
  buildDaySummary(6, {
    drivingMins: 250,
    workMins: 95,
    poaMins: 20,
    restMins: 1075,
    appDrivingMins: 250,
    findingsCount: 0,
    activities: [
      buildActivity(isoDay(6), '08:00', '10:30', 'driving', 'driver_card'),
      buildActivity(isoDay(6), '10:30', '11:15', 'break_rest', 'driver_card'),
      buildActivity(isoDay(6), '11:15', '12:50', 'work', 'driver_card'),
    ],
  }),
];

const findings: TachoFinding[] = [
  {
    id: 'driver-find-1',
    source: 'driver_card',
    severity: 'high',
    status: 'breach',
    ruleCode: 'DRV_CONTINUOUS_4H30_EXCEEDED',
    title: 'Continuous driving exceeded 4h 30m',
    summary: 'The card record shows one driving block beyond the 4h 30m threshold before a compliant break.',
    occurredAt: `${isoDay(1)}T10:50:00Z`,
    periodStart: `${isoDay(1)}T06:05:00Z`,
    periodEnd: `${isoDay(1)}T10:50:00Z`,
    legalBasis: 'Drivers’ Hours',
    evidenceRefs: [{ kind: 'raw_file', refId: 'card-import-1142', label: 'Driver card import' }],
  },
  {
    id: 'driver-find-2',
    source: 'combined',
    severity: 'medium',
    status: 'warning',
    ruleCode: 'DISC_MISMATCH_DRIVING',
    title: 'App driving time lower than tacho driving time',
    summary: 'The app recorded 45 fewer driving minutes than the card for one duty window.',
    occurredAt: `${isoDay(1)}T12:40:00Z`,
    periodStart: `${isoDay(1)}T06:05:00Z`,
    periodEnd: `${isoDay(1)}T12:40:00Z`,
    evidenceRefs: [
      { kind: 'raw_file', refId: 'card-import-1142', label: 'Driver card import' },
      { kind: 'summary', refId: 'app-session-8821', label: 'App work session' },
    ],
  },
  {
    id: 'driver-find-3',
    source: 'driver_card',
    severity: 'medium',
    status: 'warning',
    ruleCode: 'DOWNLOAD_DUE_SOON',
    title: 'Driver card download due soon',
    summary: 'Last successful card download is within the next compliance threshold window.',
    occurredAt: `${isoDay(0)}T07:00:00Z`,
    periodStart: `${isoDay(6)}T08:00:00Z`,
    periodEnd: `${isoDay(0)}T07:00:00Z`,
    evidenceRefs: [{ kind: 'raw_file', refId: 'card-import-1142', label: 'Driver card import' }],
  },
  {
    id: 'driver-find-4',
    source: 'app',
    severity: 'low',
    status: 'warning',
    ruleCode: 'APP_ONLY_SHIFT_GAP',
    title: 'Portal work declaration missing in tachograph context',
    summary: 'One portal work segment has no matching card activity and should be reviewed as a manual-entry candidate.',
    occurredAt: `${isoDay(4)}T11:20:00Z`,
    periodStart: `${isoDay(4)}T10:10:00Z`,
    periodEnd: `${isoDay(4)}T12:00:00Z`,
    evidenceRefs: [{ kind: 'summary', refId: 'app-session-8792', label: 'App work session' }],
  },
];

const technicalEvents: TachoFinding[] = [
  {
    id: 'driver-vu-1',
    source: 'vehicle_unit',
    severity: 'high',
    status: 'warning',
    ruleCode: 'VU_DRIVING_WITHOUT_CARD',
    title: 'Driving without card event',
    summary: 'A linked VU event indicates vehicle motion without a detected card during the duty period tied to this driver.',
    occurredAt: `${isoDay(4)}T09:05:00Z`,
    periodStart: `${isoDay(4)}T08:58:00Z`,
    periodEnd: `${isoDay(4)}T09:10:00Z`,
    legalBasis: 'Vehicle Unit Event',
    evidenceRefs: [{ kind: 'event', refId: 'vu-import-9021', label: 'Linked VU event' }],
    metadata: { linkedRegNumber: 'HX24FLT' },
  },
  {
    id: 'driver-vu-2',
    source: 'vehicle_unit',
    severity: 'medium',
    status: 'warning',
    ruleCode: 'VU_OVERSPEED',
    title: 'Overspeed event',
    summary: 'The linked vehicle unit recorded an overspeed event while the driver card was active in the same duty window.',
    occurredAt: `${isoDay(1)}T12:18:00Z`,
    periodStart: `${isoDay(1)}T12:18:00Z`,
    periodEnd: `${isoDay(1)}T12:18:00Z`,
    legalBasis: 'Vehicle Unit Event',
    evidenceRefs: [{ kind: 'event', refId: 'vu-import-9024', label: 'Overspeed event' }],
    metadata: { speedKmh: 96 },
  },
  {
    id: 'driver-vu-3',
    source: 'vehicle_unit',
    severity: 'high',
    status: 'warning',
    ruleCode: 'VU_SECURITY_FAULT',
    title: 'Security fault event',
    summary: 'A linked vehicle unit security event should be reviewed alongside this driver’s duty records and vehicle access context.',
    occurredAt: `${isoDay(0)}T04:55:00Z`,
    periodStart: `${isoDay(0)}T04:55:00Z`,
    periodEnd: `${isoDay(0)}T05:05:00Z`,
    legalBasis: 'Vehicle Unit Technical Fault',
    evidenceRefs: [{ kind: 'fault', refId: 'vu-import-9025-security', label: 'Security event' }],
    metadata: { linkedRegNumber: 'HX24FLT' },
  },
];

const reconciliation: TachoReconciliationItem[] = [
  {
    id: 'recon-1',
    status: 'mismatch_duration',
    date: isoDay(1),
    appLabel: '7h 30m driving in portal',
    tachoLabel: '8h 35m driving on card',
    summary: 'Review one late-afternoon driving segment that appears unlogged in the app.',
  },
  {
    id: 'recon-2',
    status: 'matched',
    date: isoDay(2),
    appLabel: '4h 30m driving in portal',
    tachoLabel: '4h 30m driving on card',
    summary: 'App and card timelines align for this day.',
  },
  {
    id: 'recon-3',
    status: 'app_only',
    date: isoDay(4),
    appLabel: 'Manual work declaration recorded',
    tachoLabel: 'No corresponding card segment',
    summary: 'Treat as manual-entry or off-vehicle work review.',
  },
];

function metricsForRange(range: TachoAnalysisRange): TachoSummaryMetric[] {
  const rangeLabel =
    range === '7d'
      ? '7 days'
      : range === '30d'
      ? '30 days'
      : range === '3m'
      ? '3 months'
      : range === '6m'
      ? '6 months'
      : '12 months';

  return [
    { label: `${rangeLabel} Driving Breaches`, value: range === '7d' ? '2' : range === '30d' ? '4' : range === '3m' ? '7' : range === '6m' ? '11' : '18', tone: 'warning' },
    { label: 'WTD Alerts', value: range === '7d' ? '1' : range === '30d' ? '3' : range === '3m' ? '5' : range === '6m' ? '8' : '13', tone: 'neutral' },
    { label: 'App/Tacho Mismatches', value: range === '7d' ? '2' : range === '30d' ? '5' : range === '3m' ? '8' : range === '6m' ? '10' : '16', tone: 'danger' },
    { label: 'Linked VU Events', value: range === '7d' ? '3' : range === '30d' ? '5' : range === '3m' ? '8' : range === '6m' ? '12' : '19', tone: 'warning' },
    { label: 'Download Status', value: range === '12m' ? '1 overdue risk' : 'Due soon', tone: 'warning' },
  ];
}

export function getMockDriverCardAnalysis(range: TachoAnalysisRange): DriverCardAnalysisData {
  return {
    identity: {
      driverId: 'driver-001',
      driverName: 'Lewis Carter',
      cardNumber: 'UK-DC-4491-882',
      cardExpiry: '2028-09-18',
      issuingCountry: 'United Kingdom',
      lastDownloadAt: '2026-05-01T09:12:00Z',
      downloadStatus: 'due_soon',
    },
    range,
    metrics: metricsForRange(range),
    dailySummaries,
    activitySegments: dailySummaries.flatMap((day) => day.activities),
    findings,
    technicalEvents,
    reconciliation,
  };
}
