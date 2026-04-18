import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Upload, FileText, AlertTriangle, CheckCircle, GraduationCap } from 'lucide-react';
import Papa from 'papaparse';
import type { Database } from '../../../lib/database.types';
import { TRAINING_MODULES } from './TrainingLibrary';

type Profile = Database['public']['Tables']['profiles']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];

interface TachoRow {
  date: string;
  startTime: string;
  endTime: string;
  activity: string;
}

interface Discrepancy {
  time: string;
  appActivity: string;
  tachoActivity: string;
  severity: 'high' | 'low';
  description: string;
  suggestedModule?: string;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

function analyseDiscrepancies(tachoRows: TachoRow[], sessions: WorkSession[]): Discrepancy[] {
  const results: Discrepancy[] = [];

  for (const row of tachoRows) {
    const tStart = toMinutes(row.startTime ?? '');
    const tEnd = toMinutes(row.endTime ?? '');
    if (isNaN(tStart) || isNaN(tEnd)) continue;

    const tachoActivity = (row.activity ?? '').toLowerCase().trim();

    // Find app sessions that overlap with this tacho window
    const overlapping = sessions.filter(s => {
      const sDate = s.start_time.slice(0, 10);
      if (sDate !== row.date) return false;
      const sStart = toMinutes(s.start_time.slice(11, 16));
      const sEnd = s.end_time ? toMinutes(s.end_time.slice(11, 16)) : sStart + 60;
      return overlaps(sStart, sEnd, tStart, tEnd);
    });

    if (overlapping.length === 0 && tachoActivity !== 'rest' && tachoActivity !== 'break') {
      results.push({
        time: `${row.startTime} – ${row.endTime}`,
        appActivity: 'No app session recorded',
        tachoActivity: row.activity,
        severity: 'low',
        description: 'Missing app record: tacho shows activity but no matching session found in the portal.',
        suggestedModule: 'tacho-modes',
      });
      continue;
    }

    for (const session of overlapping) {
      const sessionType = session.status ?? 'working';
      const isAppDriving = sessionType === 'driving';
      const isTachoDriving = tachoActivity === 'driving';
      const isTachoBreak = tachoActivity === 'rest' || tachoActivity === 'break';

      if (isAppDriving && isTachoBreak) {
        results.push({
          time: `${row.startTime} – ${row.endTime}`,
          appActivity: 'Driving',
          tachoActivity: row.activity,
          severity: 'high',
          description: 'Falsification Alert: App recorded driving activity while tacho was set to Rest/Break.',
          suggestedModule: 'tacho-modes',
        });
      } else if (!isAppDriving && isTachoDriving) {
        results.push({
          time: `${row.startTime} – ${row.endTime}`,
          appActivity: sessionType,
          tachoActivity: 'Driving',
          severity: 'high',
          description: 'Mode mismatch: Tacho records driving but app session shows different activity. Check tachograph mode switch procedure.',
          suggestedModule: 'tacho-modes',
        });
      }
    }
  }

  return results;
}

interface TachoCheckerProps {
  drivers: Profile[];
  onAssigned: () => void;
}

export function TachoChecker({ drivers, onAssigned }: TachoCheckerProps) {
  const { profile } = useAuth();
  const [selectedDriver, setSelectedDriver] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[] | null>(null);
  const [assigningFor, setAssigningFor] = useState<string | null>(null);
  const [justAssigned, setJustAssigned] = useState<string | null>(null);
  const [parseError, setParseError] = useState('');

  const activeDrivers = drivers.filter(d => d.role === 'driver' && d.is_active);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDriver) return;
    setParseError('');
    setAnalyzing(true);
    setDiscrepancies(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data, errors }) => {
        if (errors.length > 0) {
          setParseError('Could not parse CSV. Make sure it has headers: date, startTime, endTime, activity');
          setAnalyzing(false);
          return;
        }

        const tachoRows: TachoRow[] = data
          .map(row => ({
            date: row['date']?.trim() ?? '',
            startTime: row['startTime']?.trim() ?? row['start_time']?.trim() ?? '',
            endTime: row['endTime']?.trim() ?? row['end_time']?.trim() ?? '',
            activity: row['activity']?.trim() ?? row['mode']?.trim() ?? '',
          }))
          .filter(r => r.date && r.startTime && r.endTime);

        if (tachoRows.length === 0) {
          setParseError('No valid rows found. Expected columns: date, startTime, endTime, activity');
          setAnalyzing(false);
          return;
        }

        const dates = [...new Set(tachoRows.map(r => r.date))];
        const { data: sessions } = await supabase
          .from('work_sessions')
          .select('*')
          .eq('user_id', selectedDriver)
          .in('date', dates);

        const found = analyseDiscrepancies(tachoRows, sessions ?? []);
        setDiscrepancies(found);
        setAnalyzing(false);
        // Reset the input so the same file can be re-uploaded if needed
        e.target.value = '';
      },
      error: () => {
        setParseError('File could not be read. Please check it is a valid CSV.');
        setAnalyzing(false);
      },
    });
  };

  const handleAssignModule = async (moduleId: string) => {
    if (!selectedDriver || !profile?.company_id) return;
    const mod = TRAINING_MODULES.find(m => m.id === moduleId);
    if (!mod) return;
    setAssigningFor(moduleId);
    await supabase.from('training_records').insert({
      company_id: profile.company_id,
      driver_id: selectedDriver,
      training_type: 'tacho_refresher',
      module_id: mod.id,
      title: mod.title,
      hours_credited: mod.hours,
      status: 'assigned',
      assigned_by: profile.id,
    });
    setAssigningFor(null);
    setJustAssigned(moduleId);
    setTimeout(() => setJustAssigned(null), 2500);
    onAssigned();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload panel */}
      <div className="lg:col-span-1 space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-black text-slate-900 flex items-center gap-2 text-sm uppercase tracking-widest">
            <Upload size={15} className="text-blue-600" /> Upload Tacho CSV
          </h3>

          <div>
            <label htmlFor="tacho-driver" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Driver</label>
            <select
              id="tacho-driver"
              value={selectedDriver}
              onChange={e => { setSelectedDriver(e.target.value); setDiscrepancies(null); }}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-sm font-medium"
            >
              <option value="">Choose driver…</option>
              {activeDrivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>

          <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors relative ${
            selectedDriver ? 'border-blue-300 hover:border-blue-500 cursor-pointer' : 'border-slate-200 opacity-50'
          }`}>
            <input
              type="file"
              accept=".csv"
              onChange={handleFile}
              disabled={!selectedDriver || analyzing}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="space-y-2 pointer-events-none">
              <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <FileText className="text-blue-500" />
              </div>
              <p className="text-sm font-bold text-slate-700">Drop CSV here or click to browse</p>
              <p className="text-xs text-slate-400">Tachomaster · OPTAC3 · Disc-Check</p>
              <p className="text-[10px] text-slate-400">Required columns: date, startTime, endTime, activity</p>
            </div>
          </div>

          {parseError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">{parseError}</p>}
        </div>

        <div className="bg-blue-600 rounded-xl p-5 text-white text-sm space-y-2">
          <p className="font-black uppercase tracking-widest text-xs opacity-80">How It Works</p>
          <p className="text-blue-100 leading-relaxed text-xs">
            Export a CSV from your tacho analysis software. The checker cross-references each tacho activity window against the driver's portal work sessions to surface mode mismatches and missing records.
          </p>
        </div>
      </div>

      {/* Results panel */}
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-black text-slate-900">Analysis Results</h3>
          {discrepancies !== null && discrepancies.length > 0 && (
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black uppercase">
              {discrepancies.length} conflict{discrepancies.length !== 1 ? 's' : ''} found
            </span>
          )}
        </div>

        {analyzing ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            <p className="text-slate-400 font-bold animate-pulse">Comparing records…</p>
          </div>
        ) : discrepancies === null ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <FileText className="text-slate-300 w-8 h-8" />
            </div>
            <p className="font-bold text-slate-600">No data analysed yet</p>
            <p className="text-sm text-slate-400 mt-1">Select a driver and upload their tacho CSV to begin.</p>
          </div>
        ) : discrepancies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8">
            <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="text-emerald-500 w-8 h-8" />
            </div>
            <p className="font-bold text-slate-800 text-lg">100% Match</p>
            <p className="text-sm text-slate-400 mt-1">App data perfectly aligns with tacho records for this period.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {discrepancies.map((d, i) => (
              <div key={i} className="p-5 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${d.severity === 'high' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{d.time}</p>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">{d.description}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded uppercase shrink-0 ml-3 ${
                    d.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>{d.severity === 'high' ? 'High Priority' : 'Low Priority'}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">App</p>
                    <p className="font-bold text-slate-700 text-sm">{d.appActivity}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Tacho</p>
                    <p className="font-bold text-blue-700 text-sm">{d.tachoActivity}</p>
                  </div>
                </div>

                {d.suggestedModule && selectedDriver && (
                  <button
                    onClick={() => handleAssignModule(d.suggestedModule!)}
                    disabled={!!assigningFor}
                    className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
                  >
                    <GraduationCap size={14} />
                    {justAssigned === d.suggestedModule
                      ? '✓ Training Assigned'
                      : assigningFor === d.suggestedModule
                      ? 'Assigning…'
                      : `Assign "${TRAINING_MODULES.find(m => m.id === d.suggestedModule)?.title ?? 'Refresher'}" to Driver`}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
