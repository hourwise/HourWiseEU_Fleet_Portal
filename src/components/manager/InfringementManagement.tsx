import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle, ChevronDown, ChevronUp, CheckCircle,
  ClipboardCheck, X, RefreshCw, Filter, GraduationCap, BookOpen,
} from 'lucide-react';
import type { Database } from '../../lib/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Infringement = Database['public']['Tables']['infringements']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface InfringementWithDriver extends Infringement {
  profiles: { full_name: string } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REGULATION_LABELS: Record<string, string> = {
  REG_561: 'EU Reg 561',
  WTD:     'WTD',
  DOMESTIC:'Domestic',
  OTHER:   'Other',
};

const SEVERITY_CONFIG: Record<string, { label: string; colour: string }> = {
  minor:       { label: 'Minor',       colour: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  serious:     { label: 'Serious',     colour: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  very_serious:{ label: 'Very Serious',colour: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const STATUS_CONFIG: Record<string, { label: string; colour: string }> = {
  open:      { label: 'Open',      colour: 'bg-red-500/10 text-red-400' },
  debriefed: { label: 'Debriefed', colour: 'bg-amber-500/10 text-amber-400' },
  closed:    { label: 'Closed',    colour: 'bg-green-500/10 text-green-400' },
};

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-GB') : '—';

// ─── Debrief Modal ────────────────────────────────────────────────────────────

interface DebriefModalProps {
  infringement: InfringementWithDriver;
  drivers: Profile[];
  onClose: () => void;
  onSaved: () => void;
}

function DebriefModal({ infringement, drivers, onClose, onSaved }: DebriefModalProps) {
  const { profile } = useAuth();
  const [statement, setStatement] = useState(infringement.driver_statement ?? '');
  const [notes, setNotes] = useState(infringement.manager_notes ?? '');
  const [newStatus, setNewStatus] = useState<'debriefed' | 'closed'>(
    infringement.status === 'open' ? 'debriefed' : 'closed'
  );
  const [assignTraining, setAssignTraining] = useState(false);
  const [trainingTitle, setTrainingTitle] = useState('Tachograph Compliance Refresher');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!profile?.id || !profile?.company_id) return;
    setSaving(true);
    setError('');
    try {
      let trainingRecordId = infringement.training_record_id;

      // Optionally create a training record
      if (assignTraining && !trainingRecordId) {
        const { data: tr, error: trErr } = await supabase.from('training_records').insert({
          company_id: profile.company_id,
          driver_id: infringement.driver_id,
          training_type: 'remedial',
          title: trainingTitle,
          hours_credited: 0,
          status: 'assigned',
          assigned_by: profile.id,
          notes: `Assigned following infringement: ${infringement.violation_type} on ${fmtDate(infringement.occurred_at)}`,
        }).select('id').single();
        if (trErr) throw trErr;
        trainingRecordId = tr.id;
      }

      const { error: updErr } = await supabase.from('infringements').update({
        status: newStatus,
        driver_statement: statement || null,
        manager_notes: notes || null,
        debriefed_at: new Date().toISOString(),
        debriefed_by: profile.id,
        training_record_id: trainingRecordId,
      }).eq('id', infringement.id);

      if (updErr) throw updErr;
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-brand-card flex items-center justify-between p-5 border-b border-brand-border z-10">
          <div>
            <h3 className="font-black text-white flex items-center gap-2">
              <ClipboardCheck size={16} className="text-brand-accent" /> Debrief Infringement
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {infringement.profiles?.full_name} · {fmtDate(infringement.occurred_at)} · {infringement.violation_type}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-dark text-slate-400 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Infringement summary */}
          <div className="p-3 bg-brand-dark rounded-xl space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Regulation</p>
                <p className="font-bold text-slate-200">{REGULATION_LABELS[infringement.regulation] ?? infringement.regulation}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Severity</p>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${SEVERITY_CONFIG[infringement.severity]?.colour}`}>
                  {SEVERITY_CONFIG[infringement.severity]?.label}
                </span>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Status → </p>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as 'debriefed' | 'closed')}
                  className="text-[10px] font-black bg-brand-card border border-brand-border rounded px-1.5 py-0.5 text-slate-200"
                >
                  <option value="debriefed">Debriefed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Driver statement */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Driver Statement
              <span className="text-slate-600 normal-case font-normal ml-1">(record driver's explanation)</span>
            </label>
            <textarea
              value={statement}
              onChange={e => setStatement(e.target.value)}
              rows={3}
              placeholder="Driver's account of the infringement…"
              className="w-full px-3 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-brand-accent resize-none"
            />
          </div>

          {/* Manager notes */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Manager Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any corrective action taken, context, or follow-up…"
              className="w-full px-3 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-brand-accent resize-none"
            />
          </div>

          {/* Assign training */}
          <div className="p-3 bg-brand-dark rounded-xl space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={assignTraining}
                onChange={e => setAssignTraining(e.target.checked)}
                className="rounded border-brand-border bg-brand-card text-brand-accent"
              />
              <span className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
                <GraduationCap size={14} className="text-brand-accent" />
                Assign remedial training module
              </span>
            </label>
            {assignTraining && !infringement.training_record_id && (
              <input
                type="text"
                value={trainingTitle}
                onChange={e => setTrainingTitle(e.target.value)}
                className="w-full px-3 py-2 bg-brand-card border border-brand-border rounded-lg text-sm text-slate-200 focus:ring-2 focus:ring-brand-accent"
                placeholder="Module title…"
              />
            )}
            {infringement.training_record_id && (
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <CheckCircle size={12} /> Training already linked to this infringement.
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="p-5 border-t border-brand-border flex justify-end gap-3 sticky bottom-0 bg-brand-card">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-brand-accent hover:bg-brand-accent-dark text-white rounded-lg text-sm font-black transition disabled:opacity-50"
          >
            <ClipboardCheck size={14} /> {saving ? 'Saving…' : 'Save Debrief'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InfringementManagement() {
  const { profile } = useAuth();
  const [infringements, setInfringements] = useState<InfringementWithDriver[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDriver, setFilterDriver] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [debriefTarget, setDebriefTarget] = useState<InfringementWithDriver | null>(null);

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const [{ data: inf }, { data: drv }] = await Promise.all([
        supabase.from('infringements')
          .select('*, profiles:driver_id(full_name)')
          .eq('company_id', profile.company_id)
          .order('occurred_at', { ascending: false }),
        supabase.from('profiles')
          .select('*').eq('company_id', profile.company_id).eq('role', 'driver'),
      ]);
      setInfringements((inf as InfringementWithDriver[]) ?? []);
      setDrivers(drv ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id]);

  useEffect(() => { load(); }, [load]);

  const filtered = infringements.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (filterDriver !== 'all' && i.driver_id !== filterDriver) return false;
    return true;
  });

  const openCount      = infringements.filter(i => i.status === 'open').length;
  const debriefedCount = infringements.filter(i => i.status === 'debriefed').length;
  const closedCount    = infringements.filter(i => i.status === 'closed').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <BookOpen size={18} className="text-brand-accent" /> Infringement Register
          </h3>
          <p className="text-xs text-slate-400">Formal debrief trail for all raised infringements.</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-brand-dark border border-brand-border text-slate-400 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open',      count: openCount,      colour: 'text-red-400',   bg: 'bg-red-500/5 border-red-500/20'   },
          { label: 'Debriefed', count: debriefedCount, colour: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20'},
          { label: 'Closed',    count: closedCount,    colour: 'text-green-400', bg: 'bg-green-500/5 border-green-500/20'},
        ].map(s => (
          <button key={s.label} onClick={() => setFilterStatus(filterStatus === s.label.toLowerCase() ? 'all' : s.label.toLowerCase())}
            className={`p-3 rounded-xl border text-center transition hover:opacity-80 ${s.bg} ${filterStatus === s.label.toLowerCase() ? 'ring-2 ring-brand-accent' : ''}`}>
            <p className={`text-2xl font-black ${s.colour}`}>{s.count}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={13} className="text-slate-500" />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 bg-brand-dark border border-brand-border rounded-lg text-xs text-slate-200 focus:ring-2 focus:ring-brand-accent"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="debriefed">Debriefed</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={filterDriver}
          onChange={e => setFilterDriver(e.target.value)}
          className="px-2 py-1.5 bg-brand-dark border border-brand-border rounded-lg text-xs text-slate-200 focus:ring-2 focus:ring-brand-accent"
        >
          <option value="all">All Drivers</option>
          {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
        </select>
        {(filterStatus !== 'all' || filterDriver !== 'all') && (
          <button onClick={() => { setFilterStatus('all'); setFilterDriver('all'); }} className="text-[10px] text-slate-400 hover:text-white transition underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Register table */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-accent" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-slate-400">
              {infringements.length === 0 ? 'No infringements raised yet. Use the Raise button on violation rows above.' : 'No results for the selected filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border/50">
            {filtered.map(inf => {
              const sev = SEVERITY_CONFIG[inf.severity];
              const sta = STATUS_CONFIG[inf.status];
              const isExpanded = expandedId === inf.id;

              return (
                <div key={inf.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : inf.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-dark/40 transition text-left"
                  >
                    {/* Date */}
                    <div className="w-20 flex-shrink-0 text-center">
                      <p className="text-xs font-bold text-slate-300">{fmtDate(inf.occurred_at)}</p>
                    </div>

                    {/* Driver + violation */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-white">{inf.profiles?.full_name ?? '—'}</p>
                      <p className="text-xs text-slate-400 truncate">{inf.violation_type}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="hidden sm:block text-[10px] font-black text-slate-400">{REGULATION_LABELS[inf.regulation]}</span>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${sev?.colour}`}>{sev?.label}</span>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${sta?.colour}`}>{sta?.label}</span>
                      {inf.training_record_id && <GraduationCap size={12} className="text-brand-accent" title="Training linked" />}
                    </div>

                    {/* Expand */}
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-brand-dark/20 space-y-3">
                      {/* Detail grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                        {[
                          { label: 'Regulation', value: REGULATION_LABELS[inf.regulation] },
                          { label: 'Severity', value: sev?.label },
                          { label: 'Raised', value: fmtDate(inf.created_at) },
                          { label: 'Debriefed', value: inf.debriefed_at ? fmtDate(inf.debriefed_at) : '—' },
                        ].map(item => (
                          <div key={item.label} className="bg-brand-dark rounded-lg p-2.5">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
                            <p className="text-xs font-bold text-slate-300 mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Statement / Notes */}
                      {inf.driver_statement && (
                        <div className="p-3 bg-brand-dark rounded-lg">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Driver Statement</p>
                          <p className="text-xs text-slate-300 italic">{inf.driver_statement}</p>
                        </div>
                      )}
                      {inf.manager_notes && (
                        <div className="p-3 bg-brand-dark rounded-lg">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Manager Notes</p>
                          <p className="text-xs text-slate-300">{inf.manager_notes}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {inf.status !== 'closed' && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setDebriefTarget(inf)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent hover:bg-brand-accent-dark text-white rounded-lg text-xs font-black transition"
                          >
                            <ClipboardCheck size={12} />
                            {inf.status === 'open' ? 'Record Debrief' : 'Update & Close'}
                          </button>
                        </div>
                      )}
                      {inf.status === 'closed' && (
                        <p className="text-xs text-green-400 flex items-center gap-1.5 pt-1">
                          <CheckCircle size={12} /> Infringement closed — no further action required.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Debrief modal */}
      {debriefTarget && (
        <DebriefModal
          infringement={debriefTarget}
          drivers={drivers}
          onClose={() => setDebriefTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
