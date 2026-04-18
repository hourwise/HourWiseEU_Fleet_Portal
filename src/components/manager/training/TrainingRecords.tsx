import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { ClipboardList, CheckCircle, Clock, Download } from 'lucide-react';
import type { Database } from '../../../lib/database.types';

type TrainingRecord = Database['public']['Tables']['training_records']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

type RecordWithDriver = TrainingRecord & { driver: Profile | null };

const STATUS_STYLES = {
  assigned:    'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  complete:    'bg-emerald-100 text-emerald-700',
};

const TYPE_LABEL: Record<string, string> = {
  module:       'Module',
  external_cpc: 'CPC Session',
  tacho_refresher: 'Tacho Refresher',
};

interface TrainingRecordsProps {
  refresh: number; // increment this prop to trigger a re-fetch
}

export function TrainingRecords({ refresh }: TrainingRecordsProps) {
  const { profile } = useAuth();
  const [records, setRecords] = useState<RecordWithDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'complete'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('training_records')
      .select('*, driver:profiles!training_records_driver_id_fkey(id, full_name, email, role, company_id, is_active, cpc_dqc_number, cpc_dqc_expiry, created_at)')
      .eq('company_id', profile.company_id)
      .order('assigned_at', { ascending: false });
    setRecords((data ?? []) as RecordWithDriver[]);
    setLoading(false);
  }, [profile?.company_id]);

  useEffect(() => { fetchRecords(); }, [fetchRecords, refresh]);

  const markComplete = async (record: RecordWithDriver) => {
    setUpdatingId(record.id);
    await supabase
      .from('training_records')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', record.id);
    setUpdatingId(null);
    fetchRecords();
  };

  const exportCsv = () => {
    const header = 'Driver,Type,Module,Status,Assigned,Completed\n';
    const rows = records.map(r =>
      [
        r.driver?.full_name ?? r.driver_id,
        TYPE_LABEL[r.training_type] ?? r.training_type,
        r.title,
        r.status,
        new Date(r.assigned_at).toLocaleDateString(),
        r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '',
      ].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-records-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = statusFilter === 'all'
    ? records
    : records.filter(r => r.status === statusFilter);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['all', 'assigned', 'complete'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition ${
                statusFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
          <span className="text-xs text-slate-400 ml-2">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="w-10 h-10 text-slate-200 mb-3" />
            <p className="font-bold text-slate-500">No records found</p>
            <p className="text-xs text-slate-400 mt-1">Assign modules from the Library tab to start building records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Driver', 'Type', 'Module / Session', 'Status', 'Assigned', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">{r.driver?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{TYPE_LABEL[r.training_type] ?? r.training_type}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-[220px] truncate">{r.title}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${STATUS_STYLES[r.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.assigned}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(r.assigned_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {r.status !== 'complete' ? (
                        <button
                          onClick={() => markComplete(r)}
                          disabled={updatingId === r.id}
                          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle size={13} />
                          {updatingId === r.id ? 'Saving…' : 'Mark Complete'}
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock size={12} /> {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
