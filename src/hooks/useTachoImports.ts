import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchRecentTachoImports } from '../lib/tacho/api';
import type { TachoImportRecord } from '../lib/tacho/rules/types';

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
    id: 'import-2',
    sourceType: 'vehicle_unit',
    fileName: 'HX24FLT_20260508.DDD',
    fileType: 'ddd',
    importedAt: '2026-05-08T17:42:00Z',
    status: 'complete',
    progressPercent: 100,
    vehicleReg: 'HX24 FLT',
    summary: 'VU file normalized successfully with one overspeed event.',
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
  },
];

interface UseTachoImportsOptions {
  companyId?: string;
  useLive?: boolean;
  fallbackToMock?: boolean;
  limit?: number;
}

export function useTachoImports(options?: UseTachoImportsOptions) {
  const { profile } = useAuth();
  const [data, setData] = useState<TachoImportRecord[]>([]);
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
          const imports = await fetchRecentTachoImports(companyId, options?.limit ?? 12);
          if (!cancelled) {
            setData(imports);
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
  }, [options?.companyId, options?.fallbackToMock, options?.limit, options?.useLive, profile?.company_id]);

  return { data, loading, error };
}
