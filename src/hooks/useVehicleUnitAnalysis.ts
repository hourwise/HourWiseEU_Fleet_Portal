import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchLatestVehicleUnitTarget, fetchVehicleUnitAnalysisBundle } from '../lib/tacho/api';
import { adaptVehicleBundleToAnalysis } from '../lib/tacho/adapters';
import { getMockVehicleUnitAnalysis } from '../lib/tacho/mockVehicleUnitData';
import type { TachoAnalysisRange, VehicleUnitAnalysisData } from '../lib/tacho/rules/types';

interface UseVehicleUnitAnalysisOptions {
  companyId?: string;
  vehicleId?: string;
  useLive?: boolean;
  fallbackToMock?: boolean;
}

export function useVehicleUnitAnalysis(
  range: TachoAnalysisRange,
  options?: UseVehicleUnitAnalysisOptions
) {
  const { profile } = useAuth();
  const [data, setData] = useState<VehicleUnitAnalysisData | null>(null);
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
          const resolvedVehicleId = options?.vehicleId ?? await fetchLatestVehicleUnitTarget(companyId);
          if (resolvedVehicleId) {
            const bundle = await fetchVehicleUnitAnalysisBundle(companyId, resolvedVehicleId, range);
            if (bundle) {
              if (!cancelled) {
                setData(adaptVehicleBundleToAnalysis(bundle, range));
                setLoading(false);
              }
              return;
            }
          }
        }

        if (options?.fallbackToMock === false && shouldUseLive) {
          throw new Error('No live vehicle-unit analysis bundle was available.');
        }

        if (!cancelled) {
          setData(getMockVehicleUnitAnalysis(range));
        }
      } catch (err) {
        if (!cancelled) {
          if (options?.fallbackToMock === false) {
            setError(err instanceof Error ? err.message : 'Failed to load vehicle unit analysis');
            setData(null);
          } else {
            setData(getMockVehicleUnitAnalysis(range));
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
  }, [options?.companyId, options?.fallbackToMock, options?.useLive, options?.vehicleId, profile?.company_id, range]);

  return { data, loading, error };
}
