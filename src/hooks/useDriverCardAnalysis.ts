import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchDriverTachoAnalysisBundle, fetchLatestDriverCardTarget } from '../lib/tacho/api';
import { adaptDriverBundleToAnalysis } from '../lib/tacho/adapters';
import { getMockDriverCardAnalysis } from '../lib/tacho/mockDriverCardData';
import type { DriverCardAnalysisData, TachoAnalysisRange } from '../lib/tacho/rules/types';

interface UseDriverCardAnalysisOptions {
  companyId?: string;
  driverId?: string;
  useLive?: boolean;
  fallbackToMock?: boolean;
}

export function useDriverCardAnalysis(
  range: TachoAnalysisRange,
  options?: UseDriverCardAnalysisOptions
) {
  const { profile } = useAuth();
  const [data, setData] = useState<DriverCardAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const companyId = options?.companyId ?? profile?.company_id ?? undefined;
      const shouldUseLive = options?.useLive !== false && !!companyId;

      try {
        if (shouldUseLive && companyId) {
          const resolvedDriverId = options?.driverId ?? await fetchLatestDriverCardTarget(companyId);
          if (resolvedDriverId) {
            const bundle = await fetchDriverTachoAnalysisBundle(companyId, resolvedDriverId, range);
            if (bundle) {
              if (!cancelled) {
                setData(adaptDriverBundleToAnalysis(bundle, range));
                setLoading(false);
              }
              return;
            }
          }
        }

        if (options?.fallbackToMock === false && shouldUseLive) {
          throw new Error('No live driver-card analysis bundle was available.');
        }

        if (!cancelled) {
          setData(getMockDriverCardAnalysis(range));
        }
      } catch (err) {
        if (!cancelled) {
          if (options?.fallbackToMock === false) {
            setError(err instanceof Error ? err.message : 'Failed to load driver card analysis');
            setData(null);
          } else {
            setData(getMockDriverCardAnalysis(range));
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

  return { data, loading, error };
}
