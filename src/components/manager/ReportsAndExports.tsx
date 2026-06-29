import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileBarChart2, Download, Calendar, DollarSign, Receipt,
  Clock, AlertTriangle, ShieldCheck, Truck, GraduationCap,
  Check, X, ChevronDown, ChevronUp, Wrench, RefreshCw,
  ClipboardList, Bell, FileText, LifeBuoy,
} from 'lucide-react';
import { calculateDailyPay, formatCurrency } from '../../lib/payCalculations';
import type { Database } from '../../lib/database.types';
import { CompliancePackGenerator } from './reports/compliance-pack/CompliancePackGenerator';

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = Database['public']['Tables']['profiles']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];
type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type MaintenanceLog = Database['public']['Tables']['maintenance_logs']['Row'];
type VehicleCheck = Database['public']['Tables']['vehicle_checks']['Row'];
type TrainingRecord = Database['public']['Tables']['training_records']['Row'];
type Infringement = Database['public']['Tables']['infringements']['Row'];

interface Incident {
  id: string;
  company_id: string;
  driver_id: string;
  vehicle_id: string | null;
  type: string;
  occurred_at: string;
  location: string;
  description: string;
  has_injury: boolean;
  injury_details: string | null;
  is_third_party_involved: boolean;
  third_party_details: any;
  police_ref: string | null;
  photo_urls: string[];
  status: string;
  manager_notes: string | null;
  created_at: string;
}

// Inline interfaces for tables not yet in database.types.ts
interface Expense {
  id: string;
  user_id: string;
  company_id: string;
  date: string | null;
  amount: number | null;
  description: string | null;
  status: string | null;
  receipt_path: string | null;
  created_at: string;
}

interface PayConfiguration {
  hourly_rate: number | null;
  shift_allowance: number | null;
  overtime_threshold_hours: number | null;
  unpaid_break_minutes: number | null;
  overtime_rate_multiplier: number | null;
  overtime_rate_percentage: number | null;
  additional_overtime_tiers: { threshold: number; multiplier?: number; percentage?: number }[] | null;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const toISO = (date: Date) => date.toISOString().split('T')[0];
const parseIsoDayStart = (s: string) => new Date(`${s}T00:00:00`);
const parseIsoDayEnd = (s: string) => new Date(`${s}T23:59:59.999`);
const fmtIsoDay = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('en-GB');

function downloadCSV(headers: string[], rows: (string | number | null | undefined)[][], filename: string) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-GB') : '—');
const fmtDateTime = (s: string | null) => (s ? new Date(s).toLocaleString('en-GB') : '—');
const daysUntil = (s: string | null) => {
  if (!s) return null;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000);
};

// ─── Date Filter Bar ──────────────────────────────────────────────────────────

interface DateRange { start: Date; end: Date }

type Preset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_quarter' | 'this_year' | 'custom';

function getPresetRange(preset: Exclude<Preset, 'custom'>): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'this_week': {
      const day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0,0,0,0);
      return { start: mon, end: now };
    }
    case 'last_week': {
      const day = now.getDay();
      const lastMon = new Date(now); lastMon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7); lastMon.setHours(0,0,0,0);
      const lastSun = new Date(lastMon); lastSun.setDate(lastMon.getDate() + 6); lastSun.setHours(23,59,59,999);
      return { start: lastMon, end: lastSun };
    }
    case 'this_month':
      return { start: new Date(y, m, 1), end: now };
    case 'last_month': {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      return { start: s, end: e };
    }
    case 'last_quarter': {
      const q = Math.floor(m / 3);
      const s = new Date(y, (q - 1) * 3, 1);
      const e = new Date(y, q * 3, 0);
      return { start: s, end: e };
    }
    case 'this_year':
      return { start: new Date(y, 0, 1), end: now };
  }
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'this_week',    label: 'This Week'    },
  { id: 'last_week',    label: 'Last Week'    },
  { id: 'this_month',   label: 'This Month'   },
  { id: 'last_month',   label: 'Last Month'   },
  { id: 'last_quarter', label: 'Last Quarter' },
  { id: 'this_year',    label: 'This Year'    },
  { id: 'custom',       label: 'Custom'       },
];

interface DateFilterBarProps {
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
}

function DateFilterBar({ range, onRangeChange }: DateFilterBarProps) {
  const [activePreset, setActivePreset] = useState<Preset>('this_month');

  const selectPreset = (p: Preset) => {
    setActivePreset(p);
    if (p !== 'custom') onRangeChange(getPresetRange(p));
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <Calendar size={12} /> Date Range
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => selectPreset(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activePreset === p.id
                ? 'bg-brand-accent text-white'
                : 'bg-brand-dark text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {activePreset === 'custom' && (
        <div className="flex flex-wrap gap-4 pt-1">
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">From</label>
            <input
              type="date"
              value={toISO(range.start)}
              onChange={e => onRangeChange({ ...range, start: new Date(e.target.value) })}
              className="px-3 py-1.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-white focus:ring-2 focus:ring-brand-accent"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">To</label>
            <input
              type="date"
              value={toISO(range.end)}
              onChange={e => onRangeChange({ ...range, end: new Date(e.target.value) })}
              className="px-3 py-1.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-white focus:ring-2 focus:ring-brand-accent"
            />
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Showing: <span className="text-slate-300 font-medium">{range.start.toLocaleDateString('en-GB')}</span>
        {' '}→{' '}
        <span className="text-slate-300 font-medium">{range.end.toLocaleDateString('en-GB')}</span>
      </p>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="w-9 h-9 bg-brand-accent/10 rounded-lg flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-accent" />
      </div>
      <div>
        <h3 className="text-base font-black text-white uppercase tracking-wide">{title}</h3>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Export Card wrapper ───────────────────────────────────────────────────────

interface ExportCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: string;
  badgeColour?: string;
  loading: boolean;
  rowCount?: number;
  onRefresh: () => void;
  onDownload?: () => void;
  downloadLabel?: string;
  expanded: boolean;
  onToggleExpand: () => void;
  children: React.ReactNode;
}

function ExportCard({
  icon: Icon, title, description, badge, badgeColour = 'bg-amber-500',
  loading, rowCount, onRefresh, onDownload, downloadLabel = 'Download CSV',
  expanded, onToggleExpand, children,
}: ExportCardProps) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 bg-brand-dark rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-brand-accent" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-sm text-white">{title}</p>
              {badge && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded text-white ${badgeColour}`}>{badge}</span>
              )}
              {rowCount !== undefined && !loading && (
                <span className="text-[10px] text-slate-400">{rowCount} rows</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onRefresh} disabled={loading} className="p-1.5 rounded-lg bg-brand-dark hover:bg-slate-700 transition text-slate-400 hover:text-white" title="Refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          {onDownload && (
            <button
              onClick={onDownload}
              disabled={loading || rowCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent hover:bg-brand-accent-dark text-white rounded-lg text-xs font-black uppercase tracking-wide transition disabled:opacity-40"
            >
              <Download size={12} /> {downloadLabel}
            </button>
          )}
          <button onClick={onToggleExpand} className="p-1.5 rounded-lg bg-brand-dark hover:bg-slate-700 transition text-slate-400 hover:text-white">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-brand-border bg-brand-dark/30 overflow-x-auto max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-accent" /></div>
          ) : children}
        </div>
      )}
    </div>
  );
}

// Small helper table
function PreviewTable({ headers, rows, emptyMsg = 'No data for this period.' }: { headers: string[]; rows: (string | number | React.ReactNode)[][]; emptyMsg?: string }) {
  if (rows.length === 0) return <p className="text-xs text-slate-500 text-center py-6">{emptyMsg}</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-brand-border">
          {headers.map(h => <th key={h} className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-brand-border/50">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-brand-card/50">
            {row.map((cell, j) => <td key={j} className="px-3 py-2 text-slate-300 whitespace-nowrap">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 1 — Payroll Export
// ═════════════════════════════════════════════════════════════════════════════

type DriverWithPay = Profile & { pay_configurations: PayConfiguration | null; work_sessions: WorkSession[]; expenses: Expense[] };

interface PayrollRow { driverId: string; name: string; payrollNumber: string; normalHours: string; overtimeHours: string; wagePay: string; expenses: string; grossPay: string }

function PayrollExportCard({ range }: { range: DateRange }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const start = toISO(range.start), end = toISO(range.end);
      const { data: drivers } = await supabase.from('profiles').select('*, pay_configurations(*)').eq('company_id', profile.company_id).eq('role', 'driver');
      if (!drivers?.length) { setRows([]); return; }
      const ids = drivers.map(d => d.id);
      const [{ data: sessions }, { data: expenses }] = await Promise.all([
        supabase.from('work_sessions').select('*').in('user_id', ids).gte('date', start).lte('date', end),
        supabase.from('expenses').select('*').in('user_id', ids).gte('date', start).lte('date', end),
      ]);
      const payrollRows: PayrollRow[] = (drivers as DriverWithPay[]).map(d => {
        const dSessions = sessions?.filter(s => s.user_id === d.id) ?? [];
        const dExpenses = expenses?.filter(e => e.user_id === d.id) ?? [];
        let normalH = 0, overtimeH = 0, wage = 0;
        if (d.pay_configurations) {
          const byDate: Record<string, WorkSession[]> = {};
          dSessions.forEach(s => { if (s.date) (byDate[s.date] = byDate[s.date] || []).push(s); });
          Object.values(byDate).forEach(daySessions => {
            const r = calculateDailyPay(daySessions, d.pay_configurations!);
            normalH += r.normalHours; overtimeH += r.overtimeHours; wage += r.totalPay;
          });
        }
        const expTotal = dExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);
        return {
          driverId: d.id,
          name: d.full_name,
          payrollNumber: d.payroll_number ?? 'N/A',
          normalHours: normalH.toFixed(2),
          overtimeHours: overtimeH.toFixed(2),
          wagePay: wage.toFixed(2),
          expenses: expTotal.toFixed(2),
          grossPay: (wage + expTotal).toFixed(2),
        };
      });
      setRows(payrollRows);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id, range]);

  useEffect(() => { fetch(); }, [fetch]);

  const download = () => downloadCSV(
    ['Driver Name', 'Payroll Number', 'Normal Hours', 'Overtime Hours', 'Wage Pay (£)', 'Expenses (£)', 'Gross Pay (£)'],
    rows.map(r => [r.name, r.payrollNumber, r.normalHours, r.overtimeHours, r.wagePay, r.expenses, r.grossPay]),
    `payroll_${toISO(range.start)}_${toISO(range.end)}.csv`,
  );

  return (
    <ExportCard icon={DollarSign} title="Payroll Export" description="Gross pay, normal & overtime hours per driver for the selected period."
      loading={loading} rowCount={rows.length} onRefresh={fetch} onDownload={download}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      <PreviewTable
        headers={['Driver', 'Payroll No.', 'Normal Hrs', 'OT Hrs', 'Wage (£)', 'Expenses (£)', 'Gross (£)']}
        rows={rows.map(r => [r.name, r.payrollNumber, r.normalHours, r.overtimeHours, r.wagePay, r.expenses, r.grossPay])}
      />
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 2 — Expense Approvals (interactive, no date filter)
// ═════════════════════════════════════════════════════════════════════════════

type ExpenseWithProfile = Expense & { profiles: { full_name: string } | null };

function ExpenseApprovalsCard() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<ExpenseWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('expenses').select('*, profiles(full_name)').eq('company_id', profile.company_id).eq('status', 'pending').order('created_at');
      setPending((data as ExpenseWithProfile[]) ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    setActing(id);
    const { error } = await supabase.from('expenses').update({ status }).eq('id', id);
    if (!error) setPending(p => p.filter(e => e.id !== id));
    setActing(null);
  };

  const badge = pending.length > 0 ? String(pending.length) : undefined;

  return (
    <ExportCard icon={Receipt} title="Expense Approvals" description="Approve or reject pending driver expense claims."
      badge={badge} badgeColour="bg-amber-500"
      loading={loading} rowCount={pending.length} onRefresh={fetch}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      {pending.length === 0 ? (
        <div className="text-center py-6">
          <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400">All clear — no pending expenses.</p>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-brand-border">
              {['Driver', 'Date', 'Amount', 'Description', 'Receipt', 'Action'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/50">
            {pending.map(exp => (
              <tr key={exp.id} className="hover:bg-brand-card/50">
                <td className="px-3 py-2 text-slate-300 font-medium">{exp.profiles?.full_name ?? '—'}</td>
                <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtDate(exp.date ?? exp.created_at)}</td>
                <td className="px-3 py-2 text-white font-bold whitespace-nowrap">£{(exp.amount ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-300 max-w-[200px] truncate">{exp.description}</td>
                <td className="px-3 py-2">
                  {exp.receipt_path ? (
                    <button
                      onClick={async () => {
                        const { data } = await supabase.storage.from('expense-receipts').download(exp.receipt_path!);
                        if (data) { const url = URL.createObjectURL(data); window.open(url, '_blank'); }
                      }}
                      className="text-brand-accent hover:underline text-xs"
                    >View</button>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    <button onClick={() => handleAction(exp.id, 'approved')} disabled={acting === exp.id}
                      className="p-1.5 bg-green-900/30 text-green-400 hover:bg-green-900/60 rounded-lg transition disabled:opacity-40" title="Approve">
                      <Check size={12} />
                    </button>
                    <button onClick={() => handleAction(exp.id, 'rejected')} disabled={acting === exp.id}
                      className="p-1.5 bg-red-900/30 text-red-400 hover:bg-red-900/60 rounded-lg transition disabled:opacity-40" title="Reject">
                      <X size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 3 — Expense History Export
// ═════════════════════════════════════════════════════════════════════════════

function ExpenseHistoryCard({ range }: { range: DateRange }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ExpenseWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('expenses').select('*, profiles(full_name)').eq('company_id', profile.company_id)
        .gte('date', toISO(range.start)).lte('date', toISO(range.end)).order('date', { ascending: false });
      setRows((data as ExpenseWithProfile[]) ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id, range]);

  useEffect(() => { fetch(); }, [fetch]);

  const download = () => downloadCSV(
    ['Driver', 'Date', 'Amount (£)', 'Description', 'Status'],
    rows.map(r => [r.profiles?.full_name ?? '—', r.date ?? '', (r.amount ?? 0).toFixed(2), r.description ?? '', r.status ?? '']),
    `expenses_${toISO(range.start)}_${toISO(range.end)}.csv`,
  );

  return (
    <ExportCard icon={FileText} title="Expense History Export" description="Full expense log for the selected period — all statuses."
      loading={loading} rowCount={rows.length} onRefresh={fetch} onDownload={download}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      <PreviewTable
        headers={['Driver', 'Date', 'Amount (£)', 'Description', 'Status']}
        rows={rows.map(r => [
          r.profiles?.full_name ?? '—',
          fmtDate(r.date ?? r.created_at),
          `£${(r.amount ?? 0).toFixed(2)}`,
          r.description ?? '—',
          <span className={`font-bold ${r.status === 'approved' ? 'text-green-400' : r.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>{(r.status ?? '').toUpperCase()}</span>,
        ])}
      />
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 4 — Driver Hours Audit
// ═════════════════════════════════════════════════════════════════════════════

type SessionWithProfile = WorkSession & { profiles: { full_name: string; payroll_number: string | null } | null };

function DriverHoursAuditCard({ range }: { range: DateRange }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<SessionWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data: drivers } = await supabase.from('profiles').select('id').eq('company_id', profile.company_id).eq('role', 'driver');
      if (!drivers?.length) { setRows([]); return; }
      const { data } = await supabase.from('work_sessions').select('*, profiles:user_id(full_name, payroll_number)')
        .in('user_id', drivers.map(d => d.id)).gte('date', toISO(range.start)).lte('date', toISO(range.end)).order('date', { ascending: false });
      setRows((data as SessionWithProfile[]) ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id, range]);

  useEffect(() => { fetch(); }, [fetch]);

  const download = () => downloadCSV(
    ['Date', 'Driver', 'Payroll No.', 'Start Time', 'End Time', 'Work Minutes', 'Break Minutes', 'Status'],
    rows.map(r => [
      r.date, r.profiles?.full_name ?? '—', r.profiles?.payroll_number ?? 'N/A',
      r.start_time, r.end_time ?? '—', r.total_work_minutes ?? 0, r.total_break_minutes ?? 0, r.status,
    ]),
    `driver_hours_audit_${toISO(range.start)}_${toISO(range.end)}.csv`,
  );

  return (
    <ExportCard icon={Clock} title="Driver Hours Audit" description="Every work session log for compliance auditing and working time directive checks."
      loading={loading} rowCount={rows.length} onRefresh={fetch} onDownload={download}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      <PreviewTable
        headers={['Date', 'Driver', 'Start', 'End', 'Work Mins', 'Break Mins', 'Status']}
        rows={rows.map(r => [
          r.date,
          r.profiles?.full_name ?? '—',
          r.start_time,
          r.end_time ?? '—',
          r.total_work_minutes ?? 0,
          r.total_break_minutes ?? 0,
          <span className={`font-bold text-[10px] ${r.status === 'completed' ? 'text-green-400' : 'text-amber-400'}`}>{r.status?.toUpperCase()}</span>,
        ])}
      />
    </ExportCard>
  );
}

type InfringementWithProfile = Infringement & {
  profiles: { full_name: string } | null;
  source?: string | null;
};

type TachoTrainingWithProfile = TrainingRecord & { profiles: { full_name: string } | null };

type TachoFindingWithProfile = {
  id: string;
  driver_id: string | null;
  occurred_at: string;
  severity: string;
  status: string;
  rule_code: string;
  title: string;
  summary: string;
  source: string;
  profiles: { full_name: string } | null;
};

type TachoReconciliationWithProfile = {
  id: string;
  driver_id: string | null;
  recon_date: string;
  status: string;
  app_label: string;
  tacho_label: string;
  summary: string;
  profiles: { full_name: string } | null;
};

interface TachoFollowUpRow {
  id: string;
  driverId: string;
  driverName: string;
  reviewDate: string;
  recordType: 'Finding' | 'Reconciliation' | 'Infringement' | 'Training';
  status: string;
  summary: string;
  origin: string;
}

function TachoFollowUpExportCard({
  range,
  focusedDriverId,
  focusedDate,
  onOpenDriverAnalysis,
}: {
  range: DateRange;
  focusedDriverId?: string;
  focusedDate?: string;
  onOpenDriverAnalysis?: (driverId: string, date?: string) => void;
}) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<TachoFollowUpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      let infringementsQuery = supabase
        .from('infringements')
        .select('*, profiles:driver_id(full_name)')
        .eq('company_id', profile.company_id)
        .gte('occurred_at', range.start.toISOString())
        .lte('occurred_at', range.end.toISOString())
        .order('occurred_at', { ascending: false });

      let trainingQuery = supabase
        .from('training_records')
        .select('*, profiles:driver_id(full_name)')
        .eq('company_id', profile.company_id)
        .gte('assigned_at', range.start.toISOString())
        .lte('assigned_at', range.end.toISOString())
        .order('assigned_at', { ascending: false });

      let findingsQuery = supabase
        .from('tachograph_findings' as any)
        .select('id, driver_id, occurred_at, severity, status, rule_code, title, summary, source, profiles:driver_id(full_name)')
        .eq('company_id', profile.company_id)
        .gte('occurred_at', range.start.toISOString())
        .lte('occurred_at', range.end.toISOString())
        .order('occurred_at', { ascending: false });

      let reconciliationQuery = supabase
        .from('tachograph_reconciliation_items' as any)
        .select('id, driver_id, recon_date, status, app_label, tacho_label, summary, profiles:driver_id(full_name)')
        .eq('company_id', profile.company_id)
        .neq('status', 'matched')
        .gte('recon_date', toISO(range.start))
        .lte('recon_date', toISO(range.end))
        .order('recon_date', { ascending: false });

      if (focusedDriverId) {
        infringementsQuery = infringementsQuery.eq('driver_id', focusedDriverId);
        trainingQuery = trainingQuery.eq('driver_id', focusedDriverId);
        findingsQuery = findingsQuery.eq('driver_id', focusedDriverId);
        reconciliationQuery = reconciliationQuery.eq('driver_id', focusedDriverId);
      }

      const [
        { data: infringementData },
        { data: trainingData },
        { data: findingData },
        { data: reconciliationData },
      ] = await Promise.all([
        infringementsQuery,
        trainingQuery,
        findingsQuery,
        reconciliationQuery,
      ]);

      const tachoRows: TachoFollowUpRow[] = [];

      ((findingData as unknown as TachoFindingWithProfile[]) ?? [])
        .filter((row) => row.driver_id)
        .forEach((row) => {
          tachoRows.push({
            id: `finding-${row.id}`,
            driverId: row.driver_id!,
            driverName: row.profiles?.full_name ?? '—',
            reviewDate: row.occurred_at.slice(0, 10),
            recordType: 'Finding',
            status: `${row.severity} ${row.status}`.replace('_', ' '),
            summary: `${row.title || row.rule_code}: ${row.summary}`,
            origin: `${row.source} normalized finding`,
          });
        });

      ((reconciliationData as unknown as TachoReconciliationWithProfile[]) ?? [])
        .filter((row) => row.driver_id)
        .forEach((row) => {
          tachoRows.push({
            id: `recon-${row.id}`,
            driverId: row.driver_id!,
            driverName: row.profiles?.full_name ?? '—',
            reviewDate: row.recon_date,
            recordType: 'Reconciliation',
            status: row.status.replace('_', ' '),
            summary: `${row.summary} App: ${row.app_label}; Tacho: ${row.tacho_label}`,
            origin: 'App vs tacho reconciliation',
          });
        });

      ((infringementData as InfringementWithProfile[]) ?? [])
        .filter((row) => row.regulation === 'REG_561' || row.source === 'tacho')
        .forEach((row) => {
          tachoRows.push({
            id: `inf-${row.id}`,
            driverId: row.driver_id,
            driverName: row.profiles?.full_name ?? '—',
            reviewDate: row.occurred_at.slice(0, 10),
            recordType: 'Infringement',
            status: row.status.replace('_', ' '),
            summary: row.violation_type,
            origin: row.source === 'tacho' ? 'Verified tacho import' : 'EU Reg 561 workflow',
          });
        });

      ((trainingData as TachoTrainingWithProfile[]) ?? [])
        .filter((row) =>
          ['remedial', 'tacho_refresher'].includes(row.training_type) ||
          /tacho/i.test(`${row.title} ${row.notes ?? ''}`)
        )
        .forEach((row) => {
          tachoRows.push({
            id: `training-${row.id}`,
            driverId: row.driver_id,
            driverName: row.profiles?.full_name ?? '—',
            reviewDate: row.assigned_at.slice(0, 10),
            recordType: 'Training',
            status: row.status.replace('_', ' '),
            summary: row.title,
            origin: row.training_type,
          });
        });

      tachoRows.sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));
      setRows(tachoRows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [focusedDriverId, profile?.company_id, range]);

  useEffect(() => { fetch(); }, [fetch]);

  const download = () => downloadCSV(
    ['Review Date', 'Driver', 'Record Type', 'Status', 'Summary', 'Origin', 'Focused Review Day'],
    rows.map((row) => [
      fmtIsoDay(row.reviewDate),
      row.driverName,
      row.recordType,
      row.status,
      row.summary,
      row.origin,
      focusedDate ? fmtIsoDay(focusedDate) : '—',
    ]),
    `tacho_follow_up_${toISO(range.start)}_${toISO(range.end)}.csv`,
  );

  const badge = focusedDriverId || focusedDate ? 'Focused' : rows.length > 0 ? `${rows.length} items` : undefined;

  return (
    <ExportCard
      icon={FileText}
      title="Tacho Follow-up Export"
      description="Verified tacho-linked infringements and remedial training actions for the selected reporting window."
      badge={badge}
      badgeColour="bg-blue-600"
      loading={loading}
      rowCount={rows.length}
      onRefresh={fetch}
      onDownload={download}
      downloadLabel="Download Pack CSV"
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
    >
      <PreviewTable
        headers={['Date', 'Driver', 'Type', 'Status', 'Summary', 'Action']}
        rows={rows.map((row) => [
          fmtIsoDay(row.reviewDate),
          row.driverName,
          row.recordType,
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{row.status}</span>,
          row.summary,
          onOpenDriverAnalysis ? (
            <button
              onClick={() => onOpenDriverAnalysis(row.driverId, focusedDate ?? row.reviewDate)}
              className="rounded-lg border border-blue-500/20 bg-blue-600/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-blue-300 hover:bg-blue-600/20"
            >
              Open Review
            </button>
          ) : '—',
        ])}
        emptyMsg="No tacho-linked follow-up items matched the selected period."
      />
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 5 — Upcoming Renewals (next 90 days, always live)
// ═════════════════════════════════════════════════════════════════════════════

interface RenewalRow { driver: string; type: string; idNumber: string | null; expiry: string | null; daysLeft: number | null }

function UpcomingRenewalsCard() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<RenewalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const horizon = new Date(); horizon.setDate(horizon.getDate() + 90);
      const horizonStr = toISO(horizon);

      // From driver_documents
      const { data: docs } = await supabase.from('driver_documents')
        .select('*, profiles:user_id(full_name)').eq('company_id', profile.company_id)
        .not('expiry_date', 'is', null).lte('expiry_date', horizonStr).order('expiry_date');

      // From profiles — driving licence + DQC
      const { data: drivers } = await supabase.from('profiles').select('full_name, driving_licence_expiry, cpc_dqc_expiry, cpc_dqc_number, driving_licence_number')
        .eq('company_id', profile.company_id).eq('role', 'driver');

      const renewals: RenewalRow[] = [];

      docs?.forEach((d: any) => {
        renewals.push({ driver: d.profiles?.full_name ?? '—', type: d.document_type, idNumber: d.id_number, expiry: d.expiry_date, daysLeft: daysUntil(d.expiry_date) });
      });

      drivers?.forEach(d => {
        if (d.driving_licence_expiry && d.driving_licence_expiry <= horizonStr) {
          renewals.push({ driver: d.full_name, type: 'Driving Licence', idNumber: d.driving_licence_number, expiry: d.driving_licence_expiry, daysLeft: daysUntil(d.driving_licence_expiry) });
        }
        if (d.cpc_dqc_expiry && d.cpc_dqc_expiry <= horizonStr) {
          renewals.push({ driver: d.full_name, type: 'DQC / CPC Card', idNumber: d.cpc_dqc_number, expiry: d.cpc_dqc_expiry, daysLeft: daysUntil(d.cpc_dqc_expiry) });
        }
      });

      renewals.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
      setRows(renewals);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id]);

  useEffect(() => { fetch(); }, [fetch]);

  const overdueCount = rows.filter(r => (r.daysLeft ?? 0) < 0).length;
  const download = () => downloadCSV(
    ['Driver', 'Document Type', 'ID Number', 'Expiry Date', 'Days Remaining'],
    rows.map(r => [r.driver, r.type, r.idNumber ?? '—', r.expiry ? fmtDate(r.expiry) : '—', r.daysLeft ?? '—']),
    `upcoming_renewals_${toISO(new Date())}.csv`,
  );

  const badge = rows.length > 0 ? `${rows.length} due` : undefined;
  const badgeColour = overdueCount > 0 ? 'bg-red-600' : 'bg-amber-500';

  return (
    <ExportCard icon={Bell} title="Upcoming Renewals" description="Driver licences, DQC cards, and documents expiring within 90 days."
      badge={badge} badgeColour={badgeColour}
      loading={loading} rowCount={rows.length} onRefresh={fetch} onDownload={download}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      {rows.length === 0 ? (
        <div className="text-center py-6">
          <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No renewals due within 90 days.</p>
        </div>
      ) : (
        <PreviewTable
          headers={['Driver', 'Document', 'ID / Ref', 'Expiry', 'Days']}
          rows={rows.map(r => {
            const d = r.daysLeft;
            const colour = d === null ? 'text-slate-400' : d < 0 ? 'text-red-400 font-black' : d <= 14 ? 'text-red-400 font-bold' : d <= 30 ? 'text-amber-400 font-bold' : 'text-yellow-300';
            const label = d === null ? '—' : d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`;
            return [r.driver, r.type, r.idNumber ?? '—', fmtDate(r.expiry), <span className={colour}>{label}</span>];
          })}
        />
      )}
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 6 — Safety Checks Log
// ═════════════════════════════════════════════════════════════════════════════

type CheckWithProfile = VehicleCheck & { profiles: { full_name: string } | null };

function SafetyChecksLogCard({ range }: { range: DateRange }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<CheckWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('vehicle_checks').select('*, profiles:driver_id(full_name)')
        .eq('company_id', profile.company_id)
        .gte('created_at', range.start.toISOString()).lte('created_at', range.end.toISOString())
        .order('created_at', { ascending: false });
      setRows((data as CheckWithProfile[]) ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id, range]);

  useEffect(() => { fetch(); }, [fetch]);

  const defectCount = rows.filter(r => r.check_status === 'defect').length;

  const download = () => downloadCSV(
    ['Date', 'Time', 'Driver', 'Vehicle Reg', 'Vehicle Type', 'Make', 'Odometer', 'Status', 'Defect Details', 'Defect Status'],
    rows.map(r => [
      new Date(r.created_at).toLocaleDateString('en-GB'),
      new Date(r.created_at).toLocaleTimeString('en-GB'),
      r.profiles?.full_name ?? '—',
      r.reg_number, r.vehicle_type, r.vehicle_make ?? '—',
      r.odometer_reading ?? '—',
      r.check_status.toUpperCase(),
      r.defect_details ?? '—',
      r.defect_lifecycle_status ?? '—',
    ]),
    `safety_checks_${toISO(range.start)}_${toISO(range.end)}.csv`,
  );

  const badge = defectCount > 0 ? `${defectCount} defects` : undefined;

  return (
    <ExportCard icon={ShieldCheck} title="Safety Checks Log" description="All driver walkaround check results including defect detail and lifecycle status."
      badge={badge} badgeColour="bg-red-600"
      loading={loading} rowCount={rows.length} onRefresh={fetch} onDownload={download}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      <PreviewTable
        headers={['Date', 'Driver', 'Reg', 'Status', 'Defect']}
        rows={rows.map(r => [
          fmtDate(r.created_at),
          r.profiles?.full_name ?? '—',
          <span className="font-bold text-blue-400">{r.reg_number}</span>,
          <span className={`font-black text-[10px] ${r.check_status === 'pass' ? 'text-green-400' : 'text-red-400'}`}>{r.check_status.toUpperCase()}</span>,
          r.defect_details ? <span className="text-amber-300 italic">{r.defect_details.slice(0, 60)}{r.defect_details.length > 60 ? '…' : ''}</span> : '—',
        ])}
      />
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 7 — Fleet Compliance Schedule (all vehicles, upcoming service dates)
// ═════════════════════════════════════════════════════════════════════════════

function FleetComplianceCard() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('vehicles').select('*').eq('company_id', profile.company_id).order('reg_number');
      setVehicles(data ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id]);

  useEffect(() => { fetch(); }, [fetch]);

  const overdueVehicles = vehicles.filter(v =>
    [v.mot_due_date, v.pmi_due_date, v.tacho_calibration_due, v.loler_due_date, v.insurance_expiry]
      .some(d => d && daysUntil(d)! < 0)
  ).length;

  const download = () => downloadCSV(
    ['Reg', 'Make', 'Model', 'Type', 'VOR', 'MOT Due', 'PMI Due', 'Tacho Cal Due', 'LOLER Due', 'Insurance Expiry'],
    vehicles.map(v => [
      v.reg_number, v.make, v.model ?? '—', v.vehicle_type,
      v.is_vor ? 'VOR' : 'Operational',
      v.mot_due_date ? fmtDate(v.mot_due_date) : '—',
      v.pmi_due_date ? fmtDate(v.pmi_due_date) : '—',
      v.tacho_calibration_due ? fmtDate(v.tacho_calibration_due) : '—',
      v.loler_due_date ? fmtDate(v.loler_due_date) : '—',
      v.insurance_expiry ? fmtDate(v.insurance_expiry) : '—',
    ]),
    `fleet_compliance_schedule_${toISO(new Date())}.csv`,
  );

  const badge = overdueVehicles > 0 ? `${overdueVehicles} overdue` : undefined;

  const DueCell = ({ date }: { date: string | null }) => {
    if (!date) return <span className="text-slate-600">—</span>;
    const d = daysUntil(date);
    const cls = d! < 0 ? 'text-red-400 font-bold' : d! <= 14 ? 'text-amber-400 font-bold' : d! <= 30 ? 'text-yellow-300' : 'text-slate-300';
    return <span className={cls}>{fmtDate(date)}{d! < 0 ? ' ⚠' : ''}</span>;
  };

  return (
    <ExportCard icon={Truck} title="Fleet Compliance Schedule" description="MOT, PMI, tacho calibration, LOLER, and insurance due dates for all vehicles."
      badge={badge} badgeColour="bg-red-600"
      loading={loading} rowCount={vehicles.length} onRefresh={fetch} onDownload={download}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      <PreviewTable
        headers={['Reg', 'Make/Model', 'VOR', 'MOT Due', 'PMI Due', 'Tacho Cal', 'Insurance']}
        rows={vehicles.map(v => [
          <span className="font-bold text-blue-400">{v.reg_number}</span>,
          `${v.make}${v.model ? ' ' + v.model : ''}`,
          v.is_vor ? <span className="text-red-400 font-black text-[10px]">VOR</span> : <span className="text-green-400 text-[10px]">OK</span>,
          <DueCell date={v.mot_due_date} />,
          <DueCell date={v.pmi_due_date} />,
          <DueCell date={v.tacho_calibration_due} />,
          <DueCell date={v.insurance_expiry} />,
        ])}
        emptyMsg="No vehicles registered."
      />
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 8 — Maintenance History Export
// ═════════════════════════════════════════════════════════════════════════════

type LogWithVehicle = MaintenanceLog & { vehicles: { reg_number: string; make: string; model: string | null } | null };

function MaintenanceHistoryCard({ range }: { range: DateRange }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<LogWithVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('maintenance_logs').select('*, vehicles(reg_number, make, model)')
        .eq('company_id', profile.company_id)
        .gte('completed_at', range.start.toISOString()).lte('completed_at', range.end.toISOString())
        .order('completed_at', { ascending: false });
      setRows((data as LogWithVehicle[]) ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id, range]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);

  const download = () => downloadCSV(
    ['Date', 'Vehicle Reg', 'Make/Model', 'Event Type', 'Provider', 'Odometer', 'Cost (£)', 'Description'],
    rows.map(r => [
      fmtDate(r.completed_at),
      r.vehicles?.reg_number ?? '—',
      r.vehicles ? `${r.vehicles.make}${r.vehicles.model ? ' ' + r.vehicles.model : ''}` : '—',
      r.event_type, r.service_provider, r.odometer_at_service,
      (r.cost ?? 0).toFixed(2), r.description,
    ]),
    `maintenance_history_${toISO(range.start)}_${toISO(range.end)}.csv`,
  );

  return (
    <ExportCard icon={Wrench} title="Maintenance History" description={`Repair and service records for the period. Total cost: ${formatCurrency(totalCost)}`}
      loading={loading} rowCount={rows.length} onRefresh={fetch} onDownload={download}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      <PreviewTable
        headers={['Date', 'Reg', 'Event', 'Provider', 'Cost (£)', 'Description']}
        rows={rows.map(r => [
          fmtDate(r.completed_at),
          <span className="font-bold text-blue-400">{r.vehicles?.reg_number ?? '—'}</span>,
          r.event_type,
          r.service_provider,
          `£${(r.cost ?? 0).toFixed(2)}`,
          <span className="text-slate-400 italic">{r.description.slice(0, 50)}{r.description.length > 50 ? '…' : ''}</span>,
        ])}
      />
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 9 — Training Records Export
// ═════════════════════════════════════════════════════════════════════════════

type TrainingWithProfile = TrainingRecord & { profiles: { full_name: string } | null };

function TrainingRecordsCard({ range }: { range: DateRange }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<TrainingWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('training_records').select('*, profiles:driver_id(full_name)')
        .eq('company_id', profile.company_id)
        .gte('assigned_at', range.start.toISOString()).lte('assigned_at', range.end.toISOString())
        .order('assigned_at', { ascending: false });
      setRows((data as TrainingWithProfile[]) ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id, range]);

  useEffect(() => { fetch(); }, [fetch]);

  const download = () => downloadCSV(
    ['Driver', 'Module Title', 'Type', 'Status', 'Assigned Date', 'Completed Date', 'Notes'],
    rows.map(r => [
      r.profiles?.full_name ?? '—',
      r.title, r.training_type, r.status,
      fmtDate(r.assigned_at), r.completed_at ? fmtDate(r.completed_at) : '—',
      r.notes ?? '—',
    ]),
    `training_records_${toISO(range.start)}_${toISO(range.end)}.csv`,
  );

  return (
    <ExportCard icon={GraduationCap} title="Training Records Export" description="Remedial training assignments and completion records for due-diligence audit trail."
      loading={loading} rowCount={rows.length} onRefresh={fetch} onDownload={download}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      <PreviewTable
        headers={['Driver', 'Module', 'Status', 'Assigned', 'Completed']}
        rows={rows.map(r => [
          r.profiles?.full_name ?? '—',
          r.title,
          <span className={`text-[10px] font-black ${r.status === 'complete' ? 'text-green-400' : r.status === 'in_progress' ? 'text-amber-400' : 'text-slate-400'}`}>{r.status.toUpperCase()}</span>,
          fmtDate(r.assigned_at),
          r.completed_at ? fmtDate(r.completed_at) : <span className="text-slate-600">Pending</span>,
        ])}
      />
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 10 — Open Defects Report (live, no date filter)
// ═════════════════════════════════════════════════════════════════════════════

type DefectWithProfile = VehicleCheck & { profiles: { full_name: string } | null };

function OpenDefectsCard() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<DefectWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('vehicle_checks').select('*, profiles:driver_id(full_name)')
        .eq('company_id', profile.company_id).eq('check_status', 'defect')
        .neq('defect_lifecycle_status', 'fixed').order('created_at', { ascending: false });
      setRows((data as DefectWithProfile[]) ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id]);

  useEffect(() => { fetch(); }, [fetch]);

  const download = () => downloadCSV(
    ['Date Reported', 'Driver', 'Vehicle Reg', 'Vehicle Type', 'Defect Status', 'Defect Details'],
    rows.map(r => [
      fmtDateTime(r.created_at),
      r.profiles?.full_name ?? '—',
      r.reg_number, r.vehicle_type,
      r.defect_lifecycle_status ?? 'reported',
      r.defect_details ?? '—',
    ]),
    `open_defects_${toISO(new Date())}.csv`,
  );

  const badge = rows.length > 0 ? `${rows.length} open` : undefined;

  return (
    <ExportCard icon={AlertTriangle} title="Open Defects Report" description="All unresolved vehicle defects reported by drivers — live view."
      badge={badge} badgeColour="bg-red-600"
      loading={loading} rowCount={rows.length} onRefresh={fetch} onDownload={download}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      {rows.length === 0 ? (
        <div className="text-center py-6">
          <ShieldCheck className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No open defects. All vehicles clear.</p>
        </div>
      ) : (
        <PreviewTable
          headers={['Date', 'Driver', 'Reg', 'Defect Status', 'Details']}
          rows={rows.map(r => {
            const s = r.defect_lifecycle_status ?? 'reported';
            const colour = s === 'in_progress' ? 'text-amber-400' : 'text-red-400';
            return [
              fmtDate(r.created_at),
              r.profiles?.full_name ?? '—',
              <span className="font-bold text-blue-400">{r.reg_number}</span>,
              <span className={`text-[10px] font-black ${colour}`}>{s.replace('_', ' ').toUpperCase()}</span>,
              <span className="text-slate-300 italic">{(r.defect_details ?? '—').slice(0, 60)}{(r.defect_details?.length ?? 0) > 60 ? '…' : ''}</span>,
            ];
          })}
        />
      )}
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 11 — Incident Log Export
// ═════════════════════════════════════════════════════════════════════════════

type IncidentWithProfiles = Incident & { profiles: { full_name: string } | null; vehicles: { reg_number: string } | null };

function IncidentLogCard({ range }: { range: DateRange }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<IncidentWithProfiles[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetch = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('incidents').select('*, profiles:driver_id(full_name), vehicles(reg_number)')
        .eq('company_id', profile.company_id)
        .gte('occurred_at', range.start.toISOString()).lte('occurred_at', range.end.toISOString())
        .order('occurred_at', { ascending: false });
      setRows((data as any) ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [profile?.company_id, range]);

  useEffect(() => { fetch(); }, [fetch]);

  const download = () => downloadCSV(
    ['Date', 'Driver', 'Vehicle', 'Type', 'Location', 'Injury?', 'Third Party?', 'Police Ref', 'Status', 'Description'],
    rows.map(r => [
      fmtDate(r.occurred_at),
      r.profiles?.full_name ?? '—',
      r.vehicles?.reg_number ?? 'N/A',
      r.type.toUpperCase(),
      r.location,
      r.has_injury ? 'YES' : 'NO',
      r.is_third_party_involved ? 'YES' : 'NO',
      r.police_ref ?? '—',
      r.status.toUpperCase(),
      r.description
    ]),
    `incident_log_${toISO(range.start)}_${toISO(range.end)}.csv`,
  );

  return (
    <ExportCard icon={LifeBuoy} title="Incident & Accident Log" description="Complete record of all accidents, road incidents, and workplace injuries."
      loading={loading} rowCount={rows.length} onRefresh={fetch} onDownload={download}
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}>
      <PreviewTable
        headers={['Date', 'Driver', 'Vehicle', 'Type', 'Status']}
        rows={rows.map(r => [
          fmtDate(r.occurred_at),
          r.profiles?.full_name ?? '—',
          r.vehicles?.reg_number ?? <span className="text-slate-500">N/A</span>,
          <span className="capitalize">{r.type}</span>,
          <span className={`text-[10px] font-black ${r.status === 'closed' ? 'text-green-400' : 'text-amber-400'}`}>{r.status.toUpperCase()}</span>,
        ])}
      />
    </ExportCard>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ROOT — ReportsAndExports
// ═════════════════════════════════════════════════════════════════════════════

export function ReportsAndExports({
  focusedDriverId,
  focusedDate,
  onOpenDriverAnalysis,
}: {
  focusedDriverId?: string;
  focusedDate?: string;
  onOpenDriverAnalysis?: (driverId: string, date?: string) => void;
}) {
  const [range, setRange] = useState<DateRange>(() => {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  });

  useEffect(() => {
    if (!focusedDate) return;
    setRange({ start: parseIsoDayStart(focusedDate), end: parseIsoDayEnd(focusedDate) });
  }, [focusedDate]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-brand-accent/10 rounded-xl flex items-center justify-center">
          <FileBarChart2 className="w-5 h-5 text-brand-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">Reports &amp; Exports</h2>
          <p className="text-sm text-slate-400">Generate CSV exports, approve expenses, and monitor compliance from one place.</p>
        </div>
      </div>

      {/* Date Filter Bar */}
      <DateFilterBar range={range} onRangeChange={setRange} />

      {(focusedDriverId || focusedDate) && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-5 py-4 text-sm text-blue-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Focused Evidence View</p>
              <p className="mt-1">
                {focusedDriverId ? 'Driver-specific evidence is preselected.' : 'Evidence is scoped to the current report view.'}
                {focusedDate ? ` Review day: ${fmtIsoDay(focusedDate)}.` : ''}
              </p>
            </div>
            {focusedDriverId && onOpenDriverAnalysis ? (
              <button
                onClick={() => onOpenDriverAnalysis(focusedDriverId, focusedDate)}
                className="rounded-lg border border-blue-400/20 bg-blue-600/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-600/30"
              >
                Open Driver Review
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Section 1: Payroll & Expenses ── */}
      <div className="space-y-4">
        <SectionHeader icon={DollarSign} title="Payroll & Expenses" subtitle="Export pay data and manage driver expense claims." />
        <PayrollExportCard range={range} />
        <ExpenseApprovalsCard />
        <ExpenseHistoryCard range={range} />
      </div>

      {/* ── Section 2: Driver & Compliance ── */}
      <div className="space-y-4">
        <SectionHeader icon={ClipboardList} title="Driver & Compliance" subtitle="Hours audit, document renewals, and training records." />
        <TachoFollowUpExportCard
          range={range}
          focusedDriverId={focusedDriverId}
          focusedDate={focusedDate}
          onOpenDriverAnalysis={onOpenDriverAnalysis}
        />
        <CompliancePackGenerator preferredDriverId={focusedDriverId} />
        <DriverHoursAuditCard range={range} />
        <UpcomingRenewalsCard />
        <TrainingRecordsCard range={range} />
      </div>

      {/* ── Section 3: Fleet & Safety ── */}
      <div className="space-y-4">
        <SectionHeader icon={Truck} title="Fleet & Safety" subtitle="Vehicle compliance schedules, safety checks, defects, and maintenance." />
        <FleetComplianceCard />
        <OpenDefectsCard />
        <IncidentLogCard range={range} />
        <SafetyChecksLogCard range={range} />
        <MaintenanceHistoryCard range={range} />
      </div>
    </div>
  );
}
