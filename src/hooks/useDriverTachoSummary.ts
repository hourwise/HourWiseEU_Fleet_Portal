import { useEffect, useState } from 'react';
import { fetchCompanyTachoSignals } from '../lib/tacho/api';
import { supabase } from '../lib/supabase';
import type { TachoDownloadComplianceStatus, TachoReviewFocus } from '../lib/tacho/rules/types';

export interface DriverTachoSummary {
  driverId: string;
  lastDownloadAt?: string;
  downloadStatus?: TachoDownloadComplianceStatus;
  truthScore?: number;
  crossCheckIssues: number;
  latestReviewFocus?: TachoReviewFocus;
  hasCardData: boolean;
}

export function useDriverTachoSummary(companyId: string | undefined, driverId: string | undefined) {
  const [data, setData] = useState<DriverTachoSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!companyId || !driverId) {
        setData(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [{ data: latestDownload, error: latestDownloadError }, signals] = await Promise.all([
          supabase
            .from('driver_card_downloads' as any)
            .select('downloaded_at, download_status')
            .eq('company_id', companyId)
            .eq('driver_id', driverId)
            .order('downloaded_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          fetchCompanyTachoSignals(companyId, 30).catch(() => ({
            complianceSignals: [],
            riskSignals: [],
            source: 'normalized_findings' as const,
          })),
        ]);

        if (latestDownloadError) throw latestDownloadError;
        const latestDownloadRow = latestDownload as { downloaded_at?: string; download_status?: TachoDownloadComplianceStatus } | null;

        const signal = signals.complianceSignals.find((entry) => entry.driverId === driverId);

        if (!cancelled) {
          setData({
            driverId,
            lastDownloadAt: latestDownloadRow?.downloaded_at ?? undefined,
            downloadStatus: latestDownloadRow?.download_status ?? undefined,
            truthScore: signal?.averageScore,
            crossCheckIssues: signal?.reconciliationSummary?.totalIssues ?? 0,
            latestReviewFocus: signal?.reviewFocus,
            hasCardData: Boolean(latestDownloadRow?.downloaded_at || signal?.hasData),
          });
        }
      } catch (error) {
        console.error('Error loading driver tacho summary:', error);
        if (!cancelled) {
          setData({
            driverId,
            crossCheckIssues: 0,
            hasCardData: false,
          });
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
  }, [companyId, driverId]);

  return { data, loading };
}
