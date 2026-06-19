import { useEffect, useState } from 'react';
import { fetchCompanyTachoSignals } from '../lib/tacho/api';
import { supabase } from '../lib/supabase';
import type { TachoDownloadComplianceStatus, TachoReviewFocus } from '../lib/tacho/rules/types';

type DriverTachoDownloadStatus = TachoDownloadComplianceStatus | 'partial_identity';

export interface DriverTachoSummary {
  driverId: string;
  lastDownloadAt?: string;
  downloadStatus?: DriverTachoDownloadStatus;
  truthScore?: number;
  crossCheckIssues: number;
  latestReviewFocus?: TachoReviewFocus;
  hasCardData: boolean;
}

interface DriverCardDownloadRow {
  downloaded_at?: string | null;
  download_status?: DriverTachoDownloadStatus | null;
}

interface TachoImportSummaryRow {
  uploaded_at?: string | null;
  processed_at?: string | null;
  status?: string | null;
}

interface TachoProfileCardRow {
  tacho_card_number?: string | null;
}

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface TachoProfileCardQuery {
  select(columns: string): {
    eq(column: string, value: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<QueryResult<TachoProfileCardRow>>;
      };
    };
  };
}

interface DriverCardDownloadQueryBuilder {
  eq(column: string, value: string): DriverCardDownloadQueryBuilder;
  order(column: string, options: { ascending: boolean }): DriverCardDownloadQueryBuilder;
  limit(count: number): Promise<QueryResult<DriverCardDownloadRow[]>>;
}

interface DriverCardDownloadQuery {
  select(columns: string): DriverCardDownloadQueryBuilder;
}

interface TachoImportSummaryQueryBuilder {
  eq(column: string, value: string): TachoImportSummaryQueryBuilder;
  order(column: string, options: { ascending: boolean }): TachoImportSummaryQueryBuilder;
  limit(count: number): Promise<QueryResult<TachoImportSummaryRow[]>>;
}

interface TachoImportSummaryQuery {
  select(columns: string): TachoImportSummaryQueryBuilder;
}

function newestDownload(rows: DriverCardDownloadRow[]) {
  return rows
    .filter((row) => row.downloaded_at)
    .sort((left, right) => new Date(right.downloaded_at ?? 0).getTime() - new Date(left.downloaded_at ?? 0).getTime())[0] ?? null;
}

function importToDownloadSummary(row: TachoImportSummaryRow): DriverCardDownloadRow | null {
  const importedAt = row.processed_at ?? row.uploaded_at;
  if (!importedAt) return null;

  const downloadStatus =
    row.status === 'processed' || row.status === 'complete'
      ? 'ok'
      : row.status === 'partial'
        ? 'partial_identity'
        : undefined;

  return {
    downloaded_at: importedAt,
    download_status: downloadStatus,
  };
}

function profileCardQuery() {
  return supabase.from('profiles') as unknown as TachoProfileCardQuery;
}

function driverCardDownloadQuery() {
  return supabase.from('driver_card_downloads') as unknown as DriverCardDownloadQuery;
}

function tachoImportSummaryQuery() {
  return supabase.from('tachograph_files') as unknown as TachoImportSummaryQuery;
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
        const [{ data: profileRow }, signals] = await Promise.all([
          profileCardQuery()
            .select('tacho_card_number')
            .eq('id', driverId)
            .eq('company_id', companyId)
            .maybeSingle(),
          fetchCompanyTachoSignals(companyId, 30).catch(() => ({
            complianceSignals: [],
            riskSignals: [],
            source: 'normalized_findings' as const,
          })),
        ]);

        const tachoCardNumber = ((profileRow as { tacho_card_number?: string | null } | null)?.tacho_card_number ?? '').trim().toUpperCase();
        const downloadQueries = [
          driverCardDownloadQuery()
            .select('downloaded_at, download_status')
            .eq('company_id', companyId)
            .eq('driver_id', driverId)
            .order('downloaded_at', { ascending: false })
            .limit(1),
        ];

        if (tachoCardNumber) {
          downloadQueries.push(
            driverCardDownloadQuery()
              .select('downloaded_at, download_status')
              .eq('company_id', companyId)
              .eq('card_number', tachoCardNumber)
              .order('downloaded_at', { ascending: false })
              .limit(1)
          );
        }

        const downloadResults = await Promise.all(downloadQueries);
        const downloadError = downloadResults.find((result) => result.error)?.error;
        if (downloadError) throw downloadError;

        const importQueries = [
          tachoImportSummaryQuery()
            .select('uploaded_at, processed_at, status')
            .eq('company_id', companyId)
            .eq('driver_id', driverId)
            .order('uploaded_at', { ascending: false })
            .limit(1),
        ];

        if (tachoCardNumber) {
          importQueries.push(
            tachoImportSummaryQuery()
              .select('uploaded_at, processed_at, status')
              .eq('company_id', companyId)
              .eq('external_card_number', tachoCardNumber)
              .order('uploaded_at', { ascending: false })
              .limit(1)
          );
        }

        const importResults = await Promise.all(importQueries);
        const importError = importResults.find((result) => result.error)?.error;
        if (importError) throw importError;

        const downloadRows = downloadResults.flatMap((result) => (result.data ?? []) as DriverCardDownloadRow[]);
        const importRows = importResults
          .flatMap((result) => (result.data ?? []) as TachoImportSummaryRow[])
          .map(importToDownloadSummary)
          .filter((row): row is DriverCardDownloadRow => row !== null);
        const latestDownloadRow = newestDownload([...downloadRows, ...importRows]);

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
