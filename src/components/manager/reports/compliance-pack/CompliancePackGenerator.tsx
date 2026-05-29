import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { FileText, Download, Loader2, User, ShieldCheck } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { CompliancePackPDF } from './CompliancePackPDF';
import { useAuth } from '../../../../contexts/AuthContext';

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
    if (!selectedDriverId) return;
    setIsPreparing(true);
    setError(null);
    setPackData(null);

    try {
      const thirteenWeeksAgo = new Date();
      thirteenWeeksAgo.setDate(thirteenWeeksAgo.getDate() - 91);
      const startDate = thirteenWeeksAgo.toISOString().split('T')[0];
      const startDateTime = thirteenWeeksAgo.toISOString();

      // Parallel fetch for all compliance components
      const [profileRes, sessionsRes, trainingRes, infringementsRes, checksRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', selectedDriverId).single(),
        supabase.from('work_sessions').select('*').eq('user_id', selectedDriverId).gte('date', startDate).order('date', { ascending: false }),
        supabase.from('training_records').select('*').eq('driver_id', selectedDriverId).order('completed_at', { ascending: false }),
        supabase.from('infringements').select('*').eq('driver_id', selectedDriverId).eq('status', 'debriefed').order('occurred_at', { ascending: false }),
        supabase.from('vehicle_checks').select('*').eq('user_id', selectedDriverId).gte('created_at', startDateTime).order('created_at', { ascending: false })
      ]);

      if (profileRes.error) throw profileRes.error;

      setPackData({
        driver: profileRes.data,
        sessions: sessionsRes.data || [],
        training: trainingRes.data || [],
        infringements: infringementsRes.data || [],
        checks: checksRes.data || [],
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
                Found {packData.sessions.length} work sessions, {packData.training.length} training records, and {packData.infringements.length} debriefs.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
