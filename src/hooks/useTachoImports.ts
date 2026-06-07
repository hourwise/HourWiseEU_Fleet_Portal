import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchRecentTachoImports, fetchTachoImportBundle } from '../lib/tacho/api';
import type { TachoImportRecord, TachoReconciliationItem, VehicleMotionDiscrepancy } from '../lib/tacho/rules/types';

const MOCK_IMPORTS: TachoImportRecord[] = [
  {
    id: 'import-1',
    sourceType: 'driver_card',
    fileName: 'LEWIS_CARTER_20260509.C1B',
    fileType: 'c1b',
    importedAt: '2026-05-09T08:15:00Z',
    status: 'processing',
    progressPercent: 68,
    driverName: 'Lewis Carter',
    summary: 'Card uploaded and normalization in progress.',
  },
  {
    id: 'import-1b',
    sourceType: 'driver_card',
    fileName: 'DECLAN_MURPHY_20260508.C1B',
    fileType: 'c1b',
    importedAt: '2026-05-08T09:20:00Z',
    status: 'complete',
    progressPercent: 100,
    driverName: 'Declan Murphy',
    summary: 'Driver card processed with cross-check review items against app clocking.',
    reconciliationIssueCount: 3,
    highSeverityCount: 1,
    reconciliationPreview: [
      {
        id: 'mock-recon-1',
        status: 'tacho_only',
        date: '2026-05-08',
        appLabel: '0h 00m driving in app',
        tachoLabel: '2h 10m driving on tacho',
        summary: 'Tachograph recorded 2h 10m of driving with no matching app driving for the day.',
      },
      {
        id: 'mock-recon-2',
        status: 'mismatch_duration',
        date: '2026-05-07',
        appLabel: '6h 15m driving in app',
        tachoLabel: '7h 05m driving on tacho',
        summary: 'App and tachograph driving totals differ by 0h 50m for the day.',
      },
    ],
  },
  {
    id: 'import-2',
    sourceType: 'vehicle_unit',
    fileName: 'HX24FLT_20260508.DDD',
    fileType: 'ddd',
    importedAt: '2026-05-08T17:42:00Z',
    status: 'complete',
    progressPercent: 100,
    vehicleReg: 'HX24 FLT',
    summary: 'VU file normalized successfully with one overspeed event.',
    technicalEventCount: 4,
    discrepancyCount: 3,
    highSeverityCount: 2,
    discrepancyPreview: [
      {
        id: 'mock-disc-1',
        date: '2026-05-08',
        startTime: '2026-05-08T06:42:00Z',
        endTime: '2026-05-08T06:51:00Z',
        durationMins: 9,
        severity: 'high',
        status: 'unassigned_motion',
        summary: 'Vehicle movement was recorded before any linked driver card was present in the VU.',
      },
      {
        id: 'mock-disc-2',
        date: '2026-05-08',
        startTime: '2026-05-08T09:50:00Z',
        endTime: '2026-05-08T10:08:00Z',
        durationMins: 18,
        severity: 'medium',
        status: 'driver_mismatch',
        summary: 'Vehicle movement has no matching linked driver session in the current review window.',
      },
    ],
  },
  {
    id: 'import-3',
    sourceType: 'driver_card',
    fileName: 'AMANDA_REID_20260503.V1B',
    fileType: 'v1b',
    importedAt: '2026-05-03T12:10:00Z',
    status: 'failed',
    progressPercent: 100,
    driverName: 'Amanda Reid',
    summary: 'Parser rejected one corrupted activity block. Retry recommended.',
    processingError: 'Corrupted activity block at offset 21844.',
  },
  {
    id: 'import-4',
    sourceType: 'vehicle_unit',
    fileName: 'HX24FLT_20260605.DDD',
    fileType: 'ddd',
    importedAt: '2026-06-05T18:05:00Z',
    status: 'queued',
    progressPercent: 20,
    vehicleReg: 'HX24 FLT',
    summary: 'Import is waiting for a backend retry after processing kickoff did not confirm.',
    processingKickoffError: 'Edge Function returned 401 while browser kickoff was attempted.',
    processingKickoffRequestedAt: '2026-06-05T18:05:12Z',
  },
];

interface UseTachoImportsOptions {
  companyId?: string;
  useLive?: boolean;
  fallbackToMock?: boolean;
  limit?: number;
}

function buildImportDiscrepancyPreview(discrepancies: VehicleMotionDiscrepancy[] | undefined) {
  if (!discrepancies?.length) return undefined;
  return discrepancies.slice(0, 3);
}

function buildImportReconciliationPreview(items: TachoReconciliationItem[] | undefined) {
  if (!items?.length) return undefined;
  return items.filter((item) => item.status !== 'matched').slice(0, 3);
}

export function useTachoImports(options?: UseTachoImportsOptions) {
  const { profile } = useAuth();
  const [data, setData] = useState<TachoImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const companyId = options?.companyId ?? profile?.company_id ?? undefined;
      const shouldUseLive = options?.useLive !== false && !!companyId;

      try {
        if (shouldUseLive && companyId) {
          const imports = await fetchRecentTachoImports(companyId, options?.limit ?? 12);
          const enrichedImports = await Promise.all(
            imports.map(async (item) => {
              if (item.status !== 'complete' && item.status !== 'partial') return item;

              try {
                const bundle = await fetchTachoImportBundle(companyId, item.id);
                const discrepancies = bundle?.vehicleMotionDiscrepancies ?? [];
                const technicalEvents = bundle?.technicalEvents ?? [];
                const reconciliation = bundle?.reconciliation ?? [];
                const highSeverityCount = [...technicalEvents, ...discrepancies].filter(
                  (entry) => entry.severity === 'high' || entry.severity === 'critical'
                ).length;

                return {
                  ...item,
                  technicalEventCount: technicalEvents.length,
                  discrepancyCount: discrepancies.length,
                  reconciliationIssueCount: reconciliation.filter((entry) => entry.status !== 'matched').length,
                  highSeverityCount,
                  discrepancyPreview: buildImportDiscrepancyPreview(discrepancies),
                  reconciliationPreview: buildImportReconciliationPreview(reconciliation),
                };
              } catch {
                return item;
              }
            })
          );

          if (!cancelled) {
            setData(enrichedImports);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setData(MOCK_IMPORTS);
        }
      } catch (err) {
        if (!cancelled) {
          if (options?.fallbackToMock === false) {
            setError(err instanceof Error ? err.message : 'Failed to load import records');
            setData([]);
          } else {
            setData(MOCK_IMPORTS);
            setError(null);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [options?.companyId, options?.fallbackToMock, options?.limit, options?.useLive, profile?.company_id, reloadKey]);

  return { data, loading, error, reload };
}
