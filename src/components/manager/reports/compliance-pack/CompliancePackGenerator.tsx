import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { FileText, Download, Loader2, User, ShieldCheck } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { CompliancePackPDF } from './CompliancePackPDF';
import { useAuth } from '../../../../contexts/AuthContext';

type TachoFindingRow = {
  id: string;
  import_id: string;
  source: string;
  severity: string;
  status: string;
  rule_code: string;
  title: string;
  summary: string;
  legal_basis: string | null;
  occurred_at: string;
  period_start: string;
  period_end: string;
};

type TachoFindingReviewRow = {
  finding_id: string;
  status: string;
  corrective_action_type: string | null;
  manager_note: string | null;
  reviewed_at: string | null;
  closed_at: string | null;
};

export function CompliancePackGenerator({ preferredDriverId }: { preferredDriverId?: string }) {
  const { profile: managerProfile } = useAuth();
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [drivers, setDrivers] = useState<{ id: string; full_name: string }[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [packData, setPackData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDrivers = async () => {
      if (!managerProfile?.company_id) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', managerProfile.company_id)
        .eq('role', 'driver')
        .order('full_name');

      if (error) {
        console.error('Error fetching drivers:', error);
      } else {
        setDrivers(data || []);
      }
    };
    fetchDrivers();
  }, [managerProfile?.company_id]);

  useEffect(() => {
    if (!preferredDriverId) return;
    setSelectedDriverId(preferredDriverId);
    setPackData(null);
    setError(null);
  }, [preferredDriverId]);

  const prepareData = async () => {
    if (!selectedDriverId || !managerProfile?.company_id) return;
    setIsPreparing(true);
    setError(null);
    setPackData(null);

    try {
      const thirteenWeeksAgo = new Date();
      thirteenWeeksAgo.setDate(thirteenWeeksAgo.getDate() - 91);
      const startDate = thirteenWeeksAgo.toISOString().split('T')[0];
      const startDateTime = thirteenWeeksAgo.toISOString();

      // Parallel fetch for all compliance components
      const [
        profileRes,
        sessionsRes,
        trainingRes,
        infringementsRes,
        checksRes,
        tachoDownloadsRes,
        tachoImportsRes,
        tachoDaySummaryRes,
        tachoFindingsRes,
        tachoReconciliationRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', selectedDriverId).single(),
        supabase.from('work_sessions').select('*').eq('user_id', selectedDriverId).gte('date', startDate).order('date', { ascending: false }),
        supabase.from('training_records').select('*').eq('driver_id', selectedDriverId).order('completed_at', { ascending: false }),
        supabase.from('infringements').select('*').eq('driver_id', selectedDriverId).eq('status', 'debriefed').order('occurred_at', { ascending: false }),
        supabase.from('vehicle_checks').select('*').eq('user_id', selectedDriverId).gte('created_at', startDateTime).order('created_at', { ascending: false }),
        supabase
          .from('driver_card_downloads' as any)
          .select('import_id, card_number, card_expiry, issuing_country, downloaded_at, period_start, period_end, download_status')
          .eq('company_id', managerProfile.company_id)
          .eq('driver_id', selectedDriverId)
          .gte('downloaded_at', startDateTime)
          .order('downloaded_at', { ascending: false }),
        supabase
          .from('tachograph_files' as any)
          .select('id, filename, file_type, status, uploaded_at, processed_at, source_type, external_card_number, metadata')
          .eq('company_id', managerProfile.company_id)
          .eq('driver_id', selectedDriverId)
          .or('source_type.eq.driver_card,source_type.is.null')
          .gte('uploaded_at', startDateTime)
          .order('uploaded_at', { ascending: false }),
        supabase
          .from('tachograph_day_summaries' as any)
          .select('import_id, summary_date, driving_mins, work_mins, poa_mins, rest_mins, findings_count, vu_event_count')
          .eq('company_id', managerProfile.company_id)
          .eq('driver_id', selectedDriverId)
          .gte('summary_date', startDate)
          .order('summary_date', { ascending: false }),
        supabase
          .from('tachograph_findings' as any)
          .select('id, import_id, source, severity, status, rule_code, title, summary, legal_basis, occurred_at, period_start, period_end')
          .eq('company_id', managerProfile.company_id)
          .eq('driver_id', selectedDriverId)
          .gte('occurred_at', startDateTime)
          .order('occurred_at', { ascending: false }),
        supabase
          .from('tachograph_reconciliation_items' as any)
          .select('id, import_id, recon_date, status, app_label, tacho_label, summary, app_driving_mins, tacho_driving_mins')
          .eq('company_id', managerProfile.company_id)
          .eq('driver_id', selectedDriverId)
          .gte('recon_date', startDate)
          .order('recon_date', { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (tachoDownloadsRes.error) throw tachoDownloadsRes.error;
      if (tachoImportsRes.error) throw tachoImportsRes.error;
      if (tachoDaySummaryRes.error) throw tachoDaySummaryRes.error;
      if (tachoFindingsRes.error) throw tachoFindingsRes.error;
      if (tachoReconciliationRes.error) throw tachoReconciliationRes.error;

      const tachoFindings = (tachoFindingsRes.data as unknown as TachoFindingRow[] | null) || [];
      let tachoReviewByFindingId = new Map<string, TachoFindingReviewRow>();

      if (tachoFindings.length > 0) {
        const { data: reviewRows, error: reviewError } = await supabase
          .from('tachograph_finding_reviews' as any)
          .select('finding_id, status, corrective_action_type, manager_note, reviewed_at, closed_at')
          .eq('company_id', managerProfile.company_id)
          .in('finding_id', tachoFindings.map((finding) => finding.id));

        if (reviewError) throw reviewError;

        tachoReviewByFindingId = new Map(
          ((reviewRows as unknown as TachoFindingReviewRow[] | null) || []).map((review) => [review.finding_id, review])
        );
      }

      const tachoDaySummaries = (tachoDaySummaryRes.data as unknown as any[] | null) || [];
      const tachoImports = (tachoImportsRes.data as unknown as any[] | null) || [];
      const tachoReconciliation = (tachoReconciliationRes.data as unknown as any[] | null) || [];
      const tachoCriticalFindings = tachoFindings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high');
      const tachoUnreviewedFindings = tachoFindings.filter((finding) => {
        const review = tachoReviewByFindingId.get(finding.id);
        return !review || review.status === 'open' || review.status === 'action_required';
      });

      setPackData({
        driver: profileRes.data,
        sessions: sessionsRes.data || [],
        training: trainingRes.data || [],
        infringements: infringementsRes.data || [],
        checks: checksRes.data || [],
        tacho: {
          downloads: tachoDownloadsRes.data || [],
          imports: tachoImports,
          daySummaries: tachoDaySummaries,
          findings: tachoFindings.map((finding) => ({
            ...finding,
            review: tachoReviewByFindingId.get(finding.id) || null,
          })),
          reconciliation: tachoReconciliation,
          totals: {
            downloadCount: (tachoDownloadsRes.data || []).length,
            importCount: tachoImports.length,
            activeImportCount: tachoImports.filter((row) => row.metadata?.helper_capture_active_analysis_rows !== false).length,
            dayCount: tachoDaySummaries.length,
            drivingMins: tachoDaySummaries.reduce((sum, row) => sum + (row.driving_mins || 0), 0),
            workMins: tachoDaySummaries.reduce((sum, row) => sum + (row.work_mins || 0), 0),
            poaMins: tachoDaySummaries.reduce((sum, row) => sum + (row.poa_mins || 0), 0),
            restMins: tachoDaySummaries.reduce((sum, row) => sum + (row.rest_mins || 0), 0),
            findingCount: tachoFindings.length,
            criticalFindingCount: tachoCriticalFindings.length,
            unreviewedFindingCount: tachoUnreviewedFindings.length,
            reconciliationIssueCount: tachoReconciliation.filter((row) => row.status !== 'matched').length,
          },
        },
        generatedAt: new Date().toLocaleString('en-GB'),
        companyName: managerProfile?.company_id
      });
    } catch (err: any) {
      console.error('Error preparing compliance pack:', err);
      setError(err.message || 'Failed to prepare data');
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-brand-border bg-brand-dark/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Compliance Evidence Pack</h3>
            <p className="text-xs text-slate-400">Generate a comprehensive audit-ready PDF for any driver (13-week lookback).</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User size={12} /> Select Driver
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => {
                setSelectedDriverId(e.target.value);
                setPackData(null);
                setError(null);
              }}
              className="w-full px-4 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 transition font-bold"
            >
              <option value="">-- Choose a Driver --</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={prepareData}
              disabled={!selectedDriverId || isPreparing}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-black uppercase tracking-widest transition disabled:opacity-50"
            >
              {isPreparing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Prepare Audit Data
                </>
              )}
            </button>

            {packData && (
              <PDFDownloadLink
                document={<CompliancePackPDF data={packData} />}
                fileName={`Compliance_Pack_${packData.driver.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-widest transition animate-in fade-in slide-in-from-bottom-2"
              >
                {({ loading }) => (
                  loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download PDF
                    </>
                  )
                )}
              </PDFDownloadLink>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 font-bold bg-red-400/10 p-3 rounded-lg border border-red-400/20">
            {error}
          </p>
        )}

        {packData && !isPreparing && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3 animate-in fade-in duration-500">
            <div className="p-1 bg-green-500 rounded-full mt-0.5">
              <FileText className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-green-400 uppercase tracking-wide">Data Ready for Export</p>
              <p className="text-[10px] text-green-400/70 mt-1">
                Found {packData.sessions.length} work sessions, {packData.training.length} training records, {packData.infringements.length} debriefs, and {packData.tacho?.totals?.findingCount ?? 0} tacho findings.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
