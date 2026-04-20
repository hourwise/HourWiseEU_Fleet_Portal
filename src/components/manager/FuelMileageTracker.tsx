import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Fuel, Plus, Download, Pencil, X, ChevronDown, ChevronUp,
  TrendingUp, Gauge, DollarSign, MapPin, Settings2, Save,
  Check, AlertCircle, Droplets
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FuelLog {
  id: string;
  company_id: string | null;
  reg_number: string;
  vehicle_id: string | null;
  driver_id: string;
  vehicle_check_id: string | null;
  log_date: string;
  start_odometer: number | null;
  end_odometer: number | null;
  distance_covered: number | null;
  fuel_added_litres: number;
  fuel_type: string;
  fuel_cost_per_litre: number | null;
  total_fuel_cost: number | null;
  mpg: number | null;
  notes: string | null;
  source: 'driver_app' | 'manual_entry';
  created_at: string;
  // client-joined
  driver_name: string;
}

interface DriverOption {
  id: string;
  full_name: string;
}

interface VehicleOption {
  id: string;
  reg_number: string;
  make: string;
  model: string | null;
  current_odometer: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** UK Imperial MPG: (miles × 4.54609) / litres */
function calcMpg(distanceMiles: number | null, litres: number): number | null {
  if (!distanceMiles || distanceMiles <= 0 || !litres || litres <= 0) return null;
  return (distanceMiles * 4.54609) / litres;
}

function fmtMpg(mpg: number | null): string {
  if (mpg === null) return '—';
  return `${mpg.toFixed(1)} mpg`;
}

function fmtCost(n: number | null): string {
  if (n === null) return '—';
  return `£${n.toFixed(2)}`;
}

function fmtNum(n: number | null, dp = 1): string {
  if (n === null) return '—';
  return n.toFixed(dp);
}

function downloadCSV(headers: string[], rows: (string | number | null)[][], filename: string) {
  const escape = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type Preset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom';
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'this_week',     label: 'This Week' },
  { id: 'last_week',     label: 'Last Week' },
  { id: 'this_month',    label: 'This Month' },
  { id: 'last_month',    label: 'Last Month' },
  { id: 'last_3_months', label: 'Last 3 Months' },
  { id: 'this_year',     label: 'This Year' },
  { id: 'custom',        label: 'Custom' },
];

function getPresetDates(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  switch (preset) {
    case 'this_week': {
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return { from: fmt(mon), to: fmt(today) };
    }
    case 'last_week': {
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun) };
    }
    case 'this_month':
      return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last  = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(first), to: fmt(last) };
    }
    case 'last_3_months': {
      const from = new Date(today); from.setMonth(today.getMonth() - 3);
      return { from: fmt(from), to: fmt(today) };
    }
    case 'this_year':
      return { from: `${today.getFullYear()}-01-01`, to: fmt(today) };
    default:
      return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
  }
}

const FUEL_TYPE_LABELS: Record<string, string> = {
  diesel: 'Diesel', petrol: 'Petrol', hvo: 'HVO', adblue: 'AdBlue',
  electric_kwh: 'Electric (kWh)', other: 'Other',
};

const FUEL_TYPE_COLOURS: Record<string, string> = {
  diesel: 'bg-blue-500/10 text-blue-400',
  petrol: 'bg-green-500/10 text-green-400',
  hvo: 'bg-emerald-500/10 text-emerald-400',
  adblue: 'bg-cyan-500/10 text-cyan-400',
  electric_kwh: 'bg-purple-500/10 text-purple-400',
  other: 'bg-slate-500/10 text-slate-400',
};

// ─── AddFuelLogModal ──────────────────────────────────────────────────────────

interface AddFuelLogModalProps {
  companyId: string;
  managerId: string;
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  companyPpl: number | null;
  editLog?: FuelLog | null;
  onClose: () => void;
  onSaved: () => void;
}

function AddFuelLogModal({ companyId, managerId, vehicles, drivers, companyPpl, editLog, onClose, onSaved }: AddFuelLogModalProps) {
  const isEdit = !!editLog;

  const [regNumber,       setRegNumber]       = useState(editLog?.reg_number ?? '');
  const [vehicleId,       setVehicleId]       = useState(editLog?.vehicle_id ?? '');
  const [driverId,        setDriverId]        = useState(editLog?.driver_id ?? '');
  const [logDate,         setLogDate]         = useState(editLog?.log_date ?? new Date().toISOString().split('T')[0]);
  const [startOdo,        setStartOdo]        = useState(editLog?.start_odometer?.toString() ?? '');
  const [endOdo,          setEndOdo]          = useState(editLog?.end_odometer?.toString() ?? '');
  const [litres,          setLitres]          = useState(editLog?.fuel_added_litres?.toString() ?? '');
  const [fuelType,        setFuelType]        = useState(editLog?.fuel_type ?? 'diesel');
  const [costOverride,    setCostOverride]    = useState(editLog?.fuel_cost_per_litre?.toString() ?? '');
  const [notes,           setNotes]           = useState(editLog?.notes ?? '');
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState('');
  const [useCustomReg,    setUseCustomReg]    = useState(!editLog?.vehicle_id);

  // When vehicle is selected, auto-fill reg + current odometer as start
  const handleVehicleSelect = (vid: string) => {
    setVehicleId(vid);
    const v = vehicles.find(x => x.id === vid);
    if (v) {
      setRegNumber(v.reg_number);
      if (!startOdo) setStartOdo(v.current_odometer.toString());
    }
  };

  const distance = useMemo(() => {
    const s = parseFloat(startOdo), e = parseFloat(endOdo);
    return !isNaN(s) && !isNaN(e) && e >= s ? e - s : null;
  }, [startOdo, endOdo]);

  const effectivePpl = costOverride ? parseFloat(costOverride) : companyPpl;
  const previewMpg  = calcMpg(distance, parseFloat(litres) || 0);
  const previewCost = effectivePpl && litres ? parseFloat(litres) * effectivePpl : null;

  const handleSave = async () => {
    setError('');
    if (!regNumber.trim()) { setError('Registration number is required.'); return; }
    if (!driverId)         { setError('Please select a driver.'); return; }
    if (!endOdo)           { setError('End odometer is required.'); return; }
    if (!litres)           { setError('Fuel added is required.'); return; }

    setSaving(true);
    try {
      const payload = {
        company_id:         companyId,
        reg_number:         regNumber.trim().toUpperCase(),
        vehicle_id:         vehicleId || null,
        driver_id:          driverId,
        log_date:           logDate,
        start_odometer:     startOdo ? parseFloat(startOdo) : null,
        end_odometer:       parseFloat(endOdo),
        fuel_added_litres:  parseFloat(litres),
        fuel_type:          fuelType,
        fuel_cost_per_litre: costOverride ? parseFloat(costOverride) : null,
        total_fuel_cost:    previewCost,
        mpg:                previewMpg,
        notes:              notes.trim() || null,
        source:             'manual_entry' as const,
        created_by:         managerId,
      };

      let err;
      if (isEdit) {
        const { error: e } = await supabase.from('fuel_logs').update(payload).eq('id', editLog!.id);
        err = e;
      } else {
        const { error: e } = await supabase.from('fuel_logs').insert(payload);
        err = e;
      }
      if (err) throw err;

      // Update vehicle current_odometer if vehicle is known
      if (vehicleId && endOdo) {
        await supabase.from('vehicles')
          .update({ current_odometer: parseFloat(endOdo), updated_at: new Date().toISOString() })
          .eq('id', vehicleId);
      }

      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 className="font-black text-white flex items-center gap-2">
            <Fuel className="w-5 h-5 text-brand-accent" />
            {isEdit ? 'Edit Fuel Log' : 'Add Fuel Log'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Vehicle */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Vehicle</label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setUseCustomReg(false)}
                className={`text-xs px-3 py-1.5 rounded font-bold transition ${!useCustomReg ? 'bg-brand-accent text-white' : 'bg-brand-dark text-slate-400 hover:text-white'}`}
              >Select from fleet</button>
              <button
                onClick={() => { setUseCustomReg(true); setVehicleId(''); }}
                className={`text-xs px-3 py-1.5 rounded font-bold transition ${useCustomReg ? 'bg-brand-accent text-white' : 'bg-brand-dark text-slate-400 hover:text-white'}`}
              >Custom reg</button>
            </div>
            {useCustomReg ? (
              <input
                type="text"
                value={regNumber}
                onChange={e => setRegNumber(e.target.value.toUpperCase())}
                placeholder="e.g. AB12 CDE"
                className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent uppercase"
              />
            ) : (
              <select
                value={vehicleId}
                onChange={e => handleVehicleSelect(e.target.value)}
                className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              >
                <option value="">— Select vehicle —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.reg_number} — {v.make} {v.model}</option>
                ))}
              </select>
            )}
          </div>

          {/* Driver + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Driver</label>
              <select
                value={driverId}
                onChange={e => setDriverId(e.target.value)}
                className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              >
                <option value="">— Select driver —</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
              <input
                type="date"
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
                className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              />
            </div>
          </div>

          {/* Odometers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Start Odometer (mi)</label>
              <input
                type="number"
                value={startOdo}
                onChange={e => setStartOdo(e.target.value)}
                placeholder="Optional"
                className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">End Odometer (mi) *</label>
              <input
                type="number"
                value={endOdo}
                onChange={e => setEndOdo(e.target.value)}
                placeholder="Required"
                className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              />
            </div>
          </div>

          {/* Distance preview */}
          {distance !== null && (
            <div className="flex items-center gap-2 text-xs bg-brand-dark/60 rounded-lg px-3 py-2">
              <MapPin className="w-3.5 h-3.5 text-brand-accent" />
              <span className="text-slate-400">Distance:</span>
              <span className="font-bold text-white">{distance.toFixed(1)} miles</span>
              <span className="text-slate-500">({(distance * 1.60934).toFixed(1)} km)</span>
            </div>
          )}

          {/* Fuel */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Fuel Added (L) *</label>
              <input
                type="number"
                step="0.1"
                value={litres}
                onChange={e => setLitres(e.target.value)}
                placeholder="e.g. 80.5"
                className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Fuel Type</label>
              <select
                value={fuelType}
                onChange={e => setFuelType(e.target.value)}
                className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent"
              >
                {Object.entries(FUEL_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cost per litre */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
              Cost per Litre (£) — Override
            </label>
            <input
              type="number"
              step="0.001"
              value={costOverride}
              onChange={e => setCostOverride(e.target.value)}
              placeholder={companyPpl ? `Company default: £${companyPpl.toFixed(3)}` : 'Leave blank to use company default'}
              className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent placeholder:text-slate-600"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Fill in for station top-ups. Leave blank to apply the company bulk fuel price.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional — e.g. 'motorway breakdown top-up'"
              className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent resize-none"
            />
          </div>

          {/* Preview */}
          {(previewMpg || previewCost) && (
            <div className="grid grid-cols-2 gap-3">
              {previewMpg !== null && (
                <div className="bg-brand-dark/60 rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Est. MPG</p>
                  <p className="text-lg font-black text-green-400">{previewMpg.toFixed(1)}</p>
                </div>
              )}
              {previewCost !== null && (
                <div className="bg-brand-dark/60 rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Est. Cost</p>
                  <p className="text-lg font-black text-amber-400">£{previewCost.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-brand-border flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-bold transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-brand-accent hover:bg-brand-accent-dark text-white font-black text-sm rounded-lg transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : isEdit ? 'Update Log' : 'Save Log'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CompanyPriceCard ─────────────────────────────────────────────────────────

function CompanyPriceCard({ companyId, value, onSaved }: { companyId: string; value: number | null; onSaved: (v: number) => void }) {
  const [editing, setEditing]   = useState(false);
  const [input,   setInput]     = useState(value?.toString() ?? '');
  const [saving,  setSaving]    = useState(false);
  const [saved,   setSaved]     = useState(false);
  const [error,   setError]     = useState('');

  const handleSave = async () => {
    const n = parseFloat(input);
    if (isNaN(n) || n <= 0) { setError('Enter a valid price per litre.'); return; }
    setSaving(true);
    setError('');
    const { error: e } = await supabase
      .from('companies')
      .update({ default_fuel_cost_per_litre: n })
      .eq('id', companyId);
    setSaving(false);
    if (e) { setError(e.message); return; }
    onSaved(n);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Droplets className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Company Bulk Fuel Price</p>
          <p className="text-sm text-slate-300 mt-0.5">Applied to all logs without an individual override</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {editing ? (
          <>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-sm font-bold">£</span>
              <input
                autoFocus
                type="number"
                step="0.001"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="e.g. 1.189"
                className="w-28 bg-brand-dark border border-brand-border rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-brand-accent"
              />
              <span className="text-slate-400 text-sm">/L</span>
            </div>
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand-accent text-white text-xs font-black rounded-lg hover:bg-brand-accent-dark transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-white transition">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            {saved && <span className="flex items-center gap-1 text-xs text-green-400"><Check className="w-3.5 h-3.5" /> Saved</span>}
            <span className="text-2xl font-black text-white">
              {value ? `£${value.toFixed(3)}` : <span className="text-slate-500 text-base">Not set</span>}
            </span>
            <span className="text-slate-500 text-sm">/litre</span>
            <button
              onClick={() => { setInput(value?.toString() ?? ''); setEditing(true); setError(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-dark border border-brand-border hover:border-brand-accent text-slate-400 hover:text-white text-xs font-bold rounded-lg transition"
            >
              <Settings2 className="w-3.5 h-3.5" /> Update Price
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FuelMileageTracker() {
  const { profile } = useAuth();

  // Date range
  const [preset, setPreset]     = useState<Preset>('this_month');
  const [dateFrom, setDateFrom] = useState(() => getPresetDates('this_month').from);
  const [dateTo,   setDateTo]   = useState(() => getPresetDates('this_month').to);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const { from, to } = getPresetDates(p);
      setDateFrom(from); setDateTo(to);
    }
  };

  // Data
  const [logs,      setLogs]      = useState<FuelLog[]>([]);
  const [vehicles,  setVehicles]  = useState<VehicleOption[]>([]);
  const [drivers,   setDrivers]   = useState<DriverOption[]>([]);
  const [companyPpl, setCompanyPpl] = useState<number | null>(null);
  const [loading,   setLoading]   = useState(true);

  // UI
  const [showAdd,     setShowAdd]     = useState(false);
  const [editLog,     setEditLog]     = useState<FuelLog | null>(null);
  const [expandedVeh, setExpandedVeh] = useState<string | null>(null);
  const [filterReg,   setFilterReg]   = useState('');
  const [filterDriver, setFilterDriver] = useState('');

  const companyId = profile?.company_id ?? '';
  const managerId = profile?.id ?? '';

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [logsRes, vehiclesRes, driversRes, companyRes] = await Promise.all([
        supabase
          .from('fuel_logs')
          .select('*')
          .eq('company_id', companyId)
          .gte('log_date', dateFrom)
          .lte('log_date', dateTo)
          .order('log_date', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('vehicles')
          .select('id, reg_number, make, model, current_odometer')
          .eq('company_id', companyId)
          .order('reg_number'),

        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', companyId)
          .eq('role', 'driver')
          .eq('is_active', true)
          .order('full_name'),

        supabase
          .from('companies')
          .select('default_fuel_cost_per_litre')
          .eq('id', companyId)
          .maybeSingle(),
      ]);

      const driverMap = new Map<string, string>(
        (driversRes.data ?? []).map(d => [d.id, d.full_name])
      );

      setLogs(
        (logsRes.data ?? []).map(l => ({
          ...l,
          driver_name: driverMap.get(l.driver_id) ?? 'Unknown driver',
        }))
      );
      setVehicles(vehiclesRes.data ?? []);
      setDrivers(driversRes.data ?? []);
      setCompanyPpl(companyRes.data?.default_fuel_cost_per_litre ?? null);
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Filters ────────────────────────────────────────────────────────────────

  const filteredLogs = useMemo(() => logs.filter(l => {
    if (filterReg && !l.reg_number.toLowerCase().includes(filterReg.toLowerCase())) return false;
    if (filterDriver && l.driver_id !== filterDriver) return false;
    return true;
  }), [logs, filterReg, filterDriver]);

  // ── Computed stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let totalDistance = 0;
    let totalFuel     = 0;
    let totalCost     = 0;
    let hasCost       = false;
    let mpgNumerator  = 0;
    let mpgFuelSum    = 0;

    filteredLogs.forEach(l => {
      const dist = l.distance_covered ?? 0;
      totalDistance += dist;
      totalFuel     += l.fuel_added_litres;

      const ppl = l.fuel_cost_per_litre ?? companyPpl;
      if (ppl) { totalCost += l.fuel_added_litres * ppl; hasCost = true; }

      if (dist > 0 && l.fuel_added_litres > 0) {
        mpgNumerator += dist * 4.54609; // dist_miles × litres_per_imp_gallon
        mpgFuelSum   += l.fuel_added_litres;
      }
    });

    const avgMpg = mpgFuelSum > 0 ? mpgNumerator / mpgFuelSum : null;
    const cpk    = totalDistance > 0 && hasCost ? (totalCost / (totalDistance * 1.60934)) : null; // cost per km

    return {
      totalDistance: totalDistance > 0 ? totalDistance : null,
      totalFuel:     totalFuel     > 0 ? totalFuel     : null,
      totalCost:     hasCost ? totalCost : null,
      avgMpg,
      cpk,
      logCount: filteredLogs.length,
    };
  }, [filteredLogs, companyPpl]);

  // ── Per-vehicle summaries ──────────────────────────────────────────────────

  const vehicleSummaries = useMemo(() => {
    const map = new Map<string, {
      reg_number: string; vehicle_id: string | null;
      logs: FuelLog[];
    }>();
    filteredLogs.forEach(l => {
      if (!map.has(l.reg_number)) {
        map.set(l.reg_number, { reg_number: l.reg_number, vehicle_id: l.vehicle_id, logs: [] });
      }
      map.get(l.reg_number)!.logs.push(l);
    });

    return Array.from(map.values()).map(({ reg_number, vehicle_id, logs: vLogs }) => {
      let totalDistance = 0, totalFuel = 0, totalCost = 0, hasCost = false;
      let mpgNum = 0, mpgFuel = 0;
      vLogs.forEach(l => {
        const dist = l.distance_covered ?? 0;
        totalDistance += dist;
        totalFuel     += l.fuel_added_litres;
        const ppl = l.fuel_cost_per_litre ?? companyPpl;
        if (ppl) { totalCost += l.fuel_added_litres * ppl; hasCost = true; }
        if (dist > 0 && l.fuel_added_litres > 0) { mpgNum += dist * 4.54609; mpgFuel += l.fuel_added_litres; }
      });
      return {
        reg_number,
        vehicle_id,
        logCount:      vLogs.length,
        totalDistance: totalDistance || null,
        totalFuel:     totalFuel || null,
        totalCost:     hasCost ? totalCost : null,
        avgMpg:        mpgFuel > 0 ? mpgNum / mpgFuel : null,
      };
    }).sort((a, b) => (b.totalDistance ?? 0) - (a.totalDistance ?? 0));
  }, [filteredLogs, companyPpl]);

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const headers = ['Date', 'Reg', 'Driver', 'Start Odo (mi)', 'End Odo (mi)', 'Distance (mi)', 'Fuel (L)', 'Fuel Type', 'Cost/L (£)', 'Total Cost (£)', 'MPG', 'Source', 'Notes'];
    const rows = filteredLogs.map(l => {
      const ppl = l.fuel_cost_per_litre ?? companyPpl;
      const cost = ppl ? (l.fuel_added_litres * ppl).toFixed(2) : '';
      const mpg = calcMpg(l.distance_covered, l.fuel_added_litres);
      return [
        l.log_date, l.reg_number, l.driver_name,
        l.start_odometer ?? '', l.end_odometer ?? '',
        l.distance_covered ?? '',
        l.fuel_added_litres, l.fuel_type,
        ppl?.toFixed(3) ?? '', cost,
        mpg?.toFixed(1) ?? '',
        l.source, l.notes ?? '',
      ];
    });
    downloadCSV(headers, rows, `fuel-log-${dateFrom}-to-${dateTo}.csv`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Company price card */}
      <CompanyPriceCard
        companyId={companyId}
        value={companyPpl}
        onSaved={v => setCompanyPpl(v)}
      />

      {/* Date filter */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => handlePreset(p.id)}
              className={`px-3 py-1.5 text-xs font-black rounded-lg uppercase tracking-widest transition ${
                preset === p.id
                  ? 'bg-brand-accent text-white'
                  : 'bg-brand-dark text-slate-400 hover:text-white border border-brand-border'
              }`}
            >
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-brand-dark border border-brand-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-brand-accent" />
              <span className="text-slate-500 text-sm">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-brand-dark border border-brand-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-brand-accent" />
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-brand-dark border border-brand-border hover:border-brand-accent text-slate-300 hover:text-white text-xs font-black rounded-lg transition"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => { setEditLog(null); setShowAdd(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-accent hover:bg-brand-accent-dark text-white text-xs font-black rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> Add Log
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Distance', value: stats.totalDistance ? `${stats.totalDistance.toFixed(0)} mi` : '—', sub: stats.totalDistance ? `${(stats.totalDistance * 1.60934).toFixed(0)} km` : null, icon: MapPin, colour: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Fuel Consumed', value: stats.totalFuel ? `${stats.totalFuel.toFixed(1)} L` : '—', sub: stats.logCount > 0 ? `${stats.logCount} log${stats.logCount !== 1 ? 's' : ''}` : null, icon: Droplets, colour: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Total Fuel Cost', value: stats.totalCost ? fmtCost(stats.totalCost) : '—', sub: stats.cpk ? `£${stats.cpk.toFixed(3)}/km` : null, icon: DollarSign, colour: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Fleet Avg MPG', value: fmtMpg(stats.avgMpg), sub: stats.avgMpg ? `${(282.5 / stats.avgMpg).toFixed(1)} L/100km` : null, icon: Gauge, colour: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-brand-card border border-brand-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon className={`w-4.5 h-4.5 ${s.colour}`} size={18} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
            </div>
            <p className={`text-2xl font-black ${s.value === '—' ? 'text-slate-600' : 'text-white'}`}>{s.value}</p>
            {s.sub && <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Per-vehicle breakdown */}
      {vehicleSummaries.length > 0 && (
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-accent" />
            <h3 className="font-black text-white text-sm uppercase tracking-widest">Vehicle Breakdown</h3>
            <span className="ml-auto text-xs text-slate-500">{vehicleSummaries.length} vehicle{vehicleSummaries.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  {['Reg', 'Logs', 'Distance', 'Fuel (L)', 'Total Cost', 'Avg MPG'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {vehicleSummaries.map(v => (
                  <tr key={v.reg_number} className="hover:bg-brand-dark/30 transition">
                    <td className="px-4 py-3 font-black text-white">{v.reg_number}</td>
                    <td className="px-4 py-3 text-slate-300">{v.logCount}</td>
                    <td className="px-4 py-3 text-slate-300">{v.totalDistance ? `${v.totalDistance.toFixed(0)} mi` : '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{v.totalFuel ? `${v.totalFuel.toFixed(1)}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{fmtCost(v.totalCost)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${v.avgMpg ? (v.avgMpg >= 30 ? 'text-green-400' : v.avgMpg >= 20 ? 'text-amber-400' : 'text-red-400') : 'text-slate-600'}`}>
                        {fmtMpg(v.avgMpg)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full log table */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border flex flex-wrap items-center gap-3">
          <Fuel className="w-4 h-4 text-brand-accent flex-shrink-0" />
          <h3 className="font-black text-white text-sm uppercase tracking-widest">Daily Fuel Log</h3>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Reg filter */}
            <input
              type="text"
              value={filterReg}
              onChange={e => setFilterReg(e.target.value)}
              placeholder="Filter by reg…"
              className="bg-brand-dark border border-brand-border rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-accent w-32"
            />
            {/* Driver filter */}
            <select
              value={filterDriver}
              onChange={e => setFilterDriver(e.target.value)}
              className="bg-brand-dark border border-brand-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-accent"
            >
              <option value="">All drivers</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
            {(filterReg || filterDriver) && (
              <button onClick={() => { setFilterReg(''); setFilterDriver(''); }} className="text-xs text-slate-400 hover:text-white transition">
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mx-auto" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center">
            <Fuel className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">No fuel logs in this period</p>
            <p className="text-slate-600 text-sm mt-1">Logs will appear here once drivers submit end-of-shift data, or you can add them manually.</p>
            <button
              onClick={() => { setEditLog(null); setShowAdd(true); }}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-accent hover:bg-brand-accent-dark text-white text-xs font-black rounded-lg transition mx-auto"
            >
              <Plus className="w-4 h-4" /> Add First Log
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  {['Date', 'Reg', 'Driver', 'Start Odo', 'End Odo', 'Distance', 'Fuel (L)', 'Type', 'Cost/L', 'Total Cost', 'MPG', 'Source', ''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {filteredLogs.map(l => {
                  const ppl         = l.fuel_cost_per_litre ?? companyPpl;
                  const totalCost   = ppl ? l.fuel_added_litres * ppl : null;
                  const mpg         = calcMpg(l.distance_covered, l.fuel_added_litres);
                  const isSourceApp = l.source === 'driver_app';
                  return (
                    <tr key={l.id} className="hover:bg-brand-dark/30 transition group">
                      <td className="px-3 py-3 text-slate-300 whitespace-nowrap">
                        {new Date(l.log_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-3 py-3 font-black text-white whitespace-nowrap">{l.reg_number}</td>
                      <td className="px-3 py-3 text-slate-300 whitespace-nowrap truncate max-w-[120px]">{l.driver_name}</td>
                      <td className="px-3 py-3 text-slate-400">{l.start_odometer ?? '—'}</td>
                      <td className="px-3 py-3 text-slate-300">{l.end_odometer ?? '—'}</td>
                      <td className="px-3 py-3 font-bold text-white whitespace-nowrap">
                        {l.distance_covered ? `${l.distance_covered.toFixed(0)} mi` : '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-300">{fmtNum(l.fuel_added_litres)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${FUEL_TYPE_COLOURS[l.fuel_type] ?? 'bg-slate-500/10 text-slate-400'}`}>
                          {l.fuel_type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-400 whitespace-nowrap">
                        {ppl ? (
                          <span className={l.fuel_cost_per_litre ? 'text-amber-400' : 'text-slate-500'} title={l.fuel_cost_per_litre ? 'Station override' : 'Company default'}>
                            £{ppl.toFixed(3)}
                            {l.fuel_cost_per_litre && <span className="text-[9px] ml-0.5 opacity-70">†</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 font-bold text-white whitespace-nowrap">{fmtCost(totalCost)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`font-bold ${mpg ? (mpg >= 30 ? 'text-green-400' : mpg >= 20 ? 'text-amber-400' : 'text-red-400') : 'text-slate-600'}`}>
                          {fmtMpg(mpg)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${isSourceApp ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'}`}>
                          {isSourceApp ? 'App' : 'Manual'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => { setEditLog(l); setShowAdd(true); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-brand-dark transition text-slate-400 hover:text-white"
                          title="Edit log"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Table footer — totals */}
            <div className="border-t border-brand-border px-3 py-3 flex flex-wrap gap-6 text-xs text-slate-400">
              <span><span className="text-white font-black">{filteredLogs.length}</span> entries</span>
              {stats.totalDistance && <span>Total distance: <span className="text-white font-black">{stats.totalDistance.toFixed(0)} mi</span></span>}
              {stats.totalFuel     && <span>Total fuel: <span className="text-white font-black">{stats.totalFuel.toFixed(1)} L</span></span>}
              {stats.totalCost     && <span>Total cost: <span className="text-white font-black">{fmtCost(stats.totalCost)}</span></span>}
              {stats.avgMpg        && <span>Fleet avg: <span className="text-white font-black">{fmtMpg(stats.avgMpg)}</span></span>}
              <span className="text-slate-600 text-[10px] ml-auto">† = station price override</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showAdd && (
        <AddFuelLogModal
          companyId={companyId}
          managerId={managerId}
          vehicles={vehicles}
          drivers={drivers}
          companyPpl={companyPpl}
          editLog={editLog}
          onClose={() => { setShowAdd(false); setEditLog(null); }}
          onSaved={() => { setShowAdd(false); setEditLog(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
