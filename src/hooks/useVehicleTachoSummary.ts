import { useEffect, useState } from 'react';
import { subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { TachoDownloadComplianceStatus } from '../lib/tacho/rules/types';

interface VehicleReviewFocus {
  date?: string;
  summary?: string;
}

export interface VehicleTachoSummary {
  vehicleId: string;
  lastDownloadAt?: string;
  downloadStatus?: TachoDownloadComplianceStatus;
  highSeverityIssues: number;
  unassignedMotionCount: number;
  latestReviewFocus?: VehicleReviewFocus;
  hasVuData: boolean;
}

export function useVehicleTachoSummary(companyId: string | undefined, vehicleId: string | undefined) {
  const [data, setData] = useState<VehicleTachoSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!companyId || !vehicleId) {
        setData(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const reviewStart = subDays(new Date(), 30).toISOString();

        const [
          { data: latestDownload, error: latestDownloadError },
          { data: discrepancies, error: discrepanciesError },
          { data: technicalEvents, error: technicalEventsError },
        ] = await Promise.all([
          supabase
            .from('vehicle_unit_downloads' as any)
            .select('downloaded_at, download_status')
            .eq('company_id', companyId)
            .eq('vehicle_id', vehicleId)
            .order('downloaded_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('tachograph_vehicle_motion_discrepancies' as any)
            .select('discrepancy_date, start_time, severity, status, summary')
            .eq('company_id', companyId)
            .eq('vehicle_id', vehicleId)
            .gte('start_time', reviewStart)
            .order('start_time', { ascending: false }),
          supabase
            .from('tachograph_technical_events' as any)
            .select('occurred_at, severity, summary')
            .eq('company_id', companyId)
            .eq('vehicle_id', vehicleId)
            .gte('occurred_at', reviewStart)
            .order('occurred_at', { ascending: false }),
        ]);

        if (latestDownloadError) throw latestDownloadError;
        if (discrepanciesError) throw discrepanciesError;
        if (technicalEventsError) throw technicalEventsError;
        const latestDownloadRow = latestDownload as { downloaded_at?: string; download_status?: TachoDownloadComplianceStatus } | null;

        const discrepancyRows = (discrepancies as any[] | null) ?? [];
        const technicalEventRows = (technicalEvents as any[] | null) ?? [];
        const latestDiscrepancy = discrepancyRows[0];
        const latestEvent = technicalEventRows[0];
        const latestReviewFocus =
          latestDiscrepancy && (!latestEvent || latestDiscrepancy.start_time >= latestEvent.occurred_at)
            ? { date: latestDiscrepancy.discrepancy_date, summary: latestDiscrepancy.summary }
            : latestEvent
            ? { date: latestEvent.occurred_at?.slice(0, 10), summary: latestEvent.summary }
            : undefined;

        if (!cancelled) {
          setData({
            vehicleId,
            lastDownloadAt: latestDownloadRow?.downloaded_at ?? undefined,
            downloadStatus: latestDownloadRow?.download_status ?? undefined,
            highSeverityIssues: [...discrepancyRows, ...technicalEventRows].filter(
              (row) => row.severity === 'high' || row.severity === 'critical'
            ).length,
            unassignedMotionCount: discrepancyRows.filter((row) => row.status === 'unassigned_motion').length,
            latestReviewFocus,
            hasVuData: Boolean(latestDownloadRow?.downloaded_at || discrepancyRows.length || technicalEventRows.length),
          });
        }
      } catch (error) {
        console.error('Error loading vehicle tacho summary:', error);
        if (!cancelled) {
          setData({
            vehicleId,
            highSeverityIssues: 0,
            unassignedMotionCount: 0,
            hasVuData: false,
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
  }, [companyId, vehicleId]);

  return { data, loading };
}
