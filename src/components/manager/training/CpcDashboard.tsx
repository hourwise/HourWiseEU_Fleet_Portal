import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';
import type { Database } from '../../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type TrainingRecord = Database['public']['Tables']['training_records']['Row'];

const CPC_TARGET_HOURS = 35;
const CPC_CYCLE_YEARS = 5;

function getCpcStatus(driver: Profile, records: TrainingRecord[]) {
  const hoursLogged = records
    .filter(r => r.driver_id === driver.id && r.status === 'complete' && r.training_type === 'external_cpc')
    .reduce((sum, r) => sum + r.hours_credited, 0);
  const totalHours = (driver.cpc_training_hours_done ?? 0) + hoursLogged;

  const expiry = driver.cpc_dqc_expiry ? new Date(driver.cpc_dqc_expiry) : null;
  const daysToExpiry = expiry
    ? Math.ceil((expiry.getTime() - Date.now()) / 86_400_000)
    : null;

  if (!expiry || daysToExpiry === null || daysToExpiry < 0) {
    return { totalHours, daysToExpiry, colour: 'red' as const, label: 'Overdue / No DQC' };
  }
  if (daysToExpiry < 90 || totalHours < CPC_TARGET_HOURS * 0.5) {
    return { totalHours, daysToExpiry, colour: 'red' as const, label: 'Urgent' };
  }
  if (daysToExpiry < 180 || totalHours < CPC_TARGET_HOURS * 0.8) {
    return { totalHours, daysToExpiry, colour: 'amber' as const, label: 'Needs Attention' };
  }
  return { totalHours, daysToExpiry, colour: 'green' as const, label: 'On Track' };
}

interface LogSessionModalProps {
  driver: Profile;
  companyId: string;
  managerId: string;
  onClose: () => void;
  onSaved: () => void;
}

function LogSessionModal({ driver, companyId, managerId, onClose, onSaved }: LogSessionModalProps) {
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!title.trim() || !hours) { setError('Title and hours are required.'); return; }
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0 || h > 8) { setError('Hours must be between 0.5 and 8.'); return; }
    setSaving(true);
    const { error: dbErr } = await supabase.from('training_records').insert({
      company_id: companyId,
      driver_id: driver.id,
      training_type: 'external_cpc',
      title: title.trim(),
      hours_credited: h,
      status: 'complete',
      assigned_by: managerId,
      completed_at: new Date(date).toISOString(),
      notes: notes.trim() || null,
    });
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-black text-slate-900">Log CPC Training</h3>
            <p className="text-xs text-slate-500 mt-0.5">{driver.full_name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="space-y-4">
          <div>
            <label htmlFor="cpc-title" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Session Title</label>
            <input id="cpc-title" type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g. Safe & Fuel Efficient Driving" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cpc-hours" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Hours Credited</label>
              <input id="cpc-hours" type="number" min="0.5" max="8" step="0.5" value={hours} onChange={e => setHours(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="7" />
            </div>
            <div>
              <label htmlFor="cpc-date" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Date Completed</label>
              <input id="cpc-date" type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="cpc-notes" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Notes (optional)</label>
            <textarea id="cpc-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
              placeholder="Provider, location, certificate ref..." />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CpcDashboardProps {
  drivers: Profile[];
}

export function CpcDashboard({ drivers }: CpcDashboardProps) {
  const { profile } = useAuth();
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loggingFor, setLoggingFor] = useState<Profile | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!profile?.company_id) return;
    const { data } = await supabase
      .from('training_records')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('training_type', 'external_cpc');
    setRecords(data ?? []);
  }, [profile?.company_id]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const activeDrivers = drivers.filter(d => d.role === 'driver' && d.is_active);
  const allStatuses = activeDrivers.map(d => getCpcStatus(d, records));
  const redCount = allStatuses.filter(s => s.colour === 'red').length;
  const amberCount = allStatuses.filter(s => s.colour === 'amber').length;
  const greenCount = allStatuses.filter(s => s.colour === 'green').length;

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'On Track', count: greenCount, colour: 'emerald', Icon: CheckCircle },
          { label: 'Needs Attention', count: amberCount, colour: 'amber', Icon: Clock },
          { label: 'Urgent / Overdue', count: redCount, colour: 'red', Icon: AlertTriangle },
        ].map(({ label, count, colour, Icon }) => (
          <div key={label} className={`bg-${colour}-50 border border-${colour}-100 rounded-xl p-4 flex items-center gap-3`}>
            <Icon className={`w-6 h-6 text-${colour}-500`} />
            <div>
              <p className={`text-2xl font-black text-${colour}-700`}>{count}</p>
              <p className={`text-xs font-bold text-${colour}-600 uppercase tracking-widest`}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-driver cards */}
      <div className="space-y-3">
        {activeDrivers.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-12">No active drivers found.</p>
        )}
        {activeDrivers.map(driver => {
          const { totalHours, daysToExpiry, colour, label } = getCpcStatus(driver, records);
          const pct = Math.min(100, Math.round((totalHours / CPC_TARGET_HOURS) * 100));
          const barColour = colour === 'green' ? 'bg-emerald-500' : colour === 'amber' ? 'bg-amber-400' : 'bg-red-500';

          return (
            <div key={driver.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-black text-slate-900">{driver.full_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    DQC: {driver.cpc_dqc_number ?? '—'}
                    {driver.cpc_dqc_expiry && (
                      <span className="ml-3">
                        Expires: {new Date(driver.cpc_dqc_expiry).toLocaleDateString()}
                        {daysToExpiry !== null && (
                          <span className={`ml-1 font-bold ${colour === 'red' ? 'text-red-600' : colour === 'amber' ? 'text-amber-600' : 'text-emerald-600'}`}>
                            ({daysToExpiry > 0 ? `${daysToExpiry}d remaining` : 'EXPIRED'})
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${
                    colour === 'green' ? 'bg-emerald-100 text-emerald-700' :
                    colour === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>{label}</span>
                  <button
                    onClick={() => setLoggingFor(driver)}
                    className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                  >
                    <Plus size={14} /> Log Session
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColour}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <p className="text-sm font-black text-slate-700 whitespace-nowrap">
                  {totalHours.toFixed(1)} / {CPC_TARGET_HOURS} hrs
                  <span className="text-slate-400 font-normal ml-1">({pct}%)</span>
                </p>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {CPC_TARGET_HOURS - totalHours > 0
                  ? `${(CPC_TARGET_HOURS - totalHours).toFixed(1)} hours still needed in this ${CPC_CYCLE_YEARS}-year cycle`
                  : '✓ Periodic training requirement met'}
              </p>
            </div>
          );
        })}
      </div>

      {loggingFor && profile && (
        <LogSessionModal
          driver={loggingFor}
          companyId={profile.company_id!}
          managerId={profile.id}
          onClose={() => setLoggingFor(null)}
          onSaved={() => { setLoggingFor(null); fetchRecords(); }}
        />
      )}
    </div>
  );
}
