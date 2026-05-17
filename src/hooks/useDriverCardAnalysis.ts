import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchDriverTachoAnalysisBundle, fetchLatestDriverCardTarget } from '../lib/tacho/api';
import { adaptDriverBundleToAnalysis } from '../lib/tacho/adapters';
import { getMockDriverCardAnalysis } from '../lib/tacho/mockDriverCardData';
import { buildAppTachoReconciliationItems } from '../lib/tacho/rules/reconciliation';
import type { DriverCardAnalysisData, TachoAnalysisRange } from '../lib/tacho/rules/types';

function resolveRangeStart(range: TachoAnalysisRange) {
  const start = new Date();
  switch (range) {
    case '30d':
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    case '3m':
      start.setUTCMonth(start.getUTCMonth() - 3);
      break;
    case '6m':
      start.setUTCMonth(start.getUTCMonth() - 6);
      break;
    default:
      start.setUTCDate(start.getUTCDate() - 7);
      break;
  }
  return start.toISOString().split('T')[0];
}

interface UseDriverCardAnalysisOptions {
  companyId?: string;
  driverId?: string;
  useLive?: boolean;
  fallbackToMock?: boolean;
}

interface DriverCardAnalysisEmptyState {
  title: string;
  guidance: string;
}

export function useDriverCardAnalysis(
  range: TachoAnalysisRange,
  options?: UseDriverCardAnalysisOptions
) {
  const { profile } = useAuth();
  const [data, setData] = useState<DriverCardAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyState, setEmptyState] = useState<DriverCardAnalysisEmptyState | null>(null);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setEmptyState(null);
      setIsMock(false);

      const companyId = options?.companyId ?? profile?.company_id ?? undefined;
      const shouldUseLive = options?.useLive !== false && !!companyId;

      try {
        if (shouldUseLive && companyId) {
          const resolvedDriverId = options?.driverId ?? await fetchLatestDriverCardTarget(companyId);
          if (resolvedDriverId) {
            const bundle = await fetchDriverTachoAnalysisBundle(companyId, resolvedDriverId, range);
            if (bundle) {
              const reconciliation = Array.isArray(bundle.reconciliation)
                ? bundle.reconciliation
                : await (async () => {
                    const { data: workSessions, error: workSessionsError } = await supabase
                      .from('work_sessions')
                      .select('start_time, end_time, total_work_minutes, total_break_minutes, other_data')
                      .eq('user_id', resolvedDriverId)
                      .gte('date', resolveRangeStart(range))
                      .order('date', { ascending: false });

                    if (workSessionsError) throw workSessionsError;

                    return buildAppTachoReconciliationItems(
                      bundle.activitySegments.map((segment) => ({
                        id: segment.id,
                        driverId: segment.driverId ?? null,
                        vehicleId: segment.vehicleId ?? null,
                        startTime: segment.startTime,
                        endTime: segment.endTime,
                        activityType:
                          segment.activityType === 'break_rest'
                            ? 'rest'
                            : segment.activityType === 'unknown'
                            ? 'work'
                            : segment.activityType,
                        distanceKm: segment.distanceKm ?? null,
                        source: 'normalized_findings',
                      })),
                      (workSessions as any[]) ?? []
                    );
                  })();

              if (!cancelled) {
                setData(adaptDriverBundleToAnalysis(bundle, range, reconciliation));
                setIsMock(false);
                setLoading(false);
              }
              return;
            }
          }

          if (options?.driverId) {
            if (!cancelled) {
              setData(null);
              setEmptyState({
                title: 'No driver-card data found for this driver',
                guidance: 'This driver can be selected, but no imported driver-card bundle matched the current company data yet. Upload a card file or pick a different driver.',
              });
            }
            return;
          }

          if (!resolvedDriverId) {
            if (!cancelled) {
              setData(null);
              setEmptyState({
                title: 'No driver-card downloads imported yet',
                guidance: 'Import a .ddd, .c1b, or .v1b driver-card file to start building a live card workspace.',
              });
            }
            return;
          }
        }

        if (options?.fallbackToMock === false && shouldUseLive) {
          throw new Error('No live driver-card analysis bundle was available.');
        }

        if (!cancelled) {
          setData(getMockDriverCardAnalysis(range));
          setIsMock(true);
        }
      } catch (err) {
        if (!cancelled) {
          if (options?.fallbackToMock === false) {
            setError(err instanceof Error ? err.message : 'Failed to load driver card analysis');
            setData(null);
          } else {
            setData(getMockDriverCardAnalysis(range));
            setIsMock(true);
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
  }, [options?.companyId, options?.driverId, options?.fallbackToMock, options?.useLive, profile?.company_id, range]);

  return { data, loading, error, emptyState, isMock };
}
