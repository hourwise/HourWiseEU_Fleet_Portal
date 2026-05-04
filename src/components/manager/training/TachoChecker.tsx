import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Upload, FileText, AlertTriangle, CheckCircle, GraduationCap, Database as DbIcon, Calendar, Info } from 'lucide-react';
import Papa from 'papaparse';
import type { Database } from '../../../lib/database.types';
import { TRAINING_MODULES } from './TrainingLibrary';
import { analyzeTachoCompliance, TachoActivity } from '../../../lib/compliance';
import { detectMissingMileage } from '../../../lib/tachoAnalysis';

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
  const [sourceMode, setSourceMode] = useState<'csv' | 'database'>('database');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[] | null>(null);
  const [assigningFor, setAssigningFor] = useState<string | null>(null);
  const [justAssigned, setJustAssigned] = useState<string | null>(null);
  const [parseError, setParseError] = useState('');

  const activeDrivers = drivers.filter(d => d.role === 'driver' && d.is_active);

  const fetchAndAnalyseFromDb = async () => {
    if (!selectedDriver) return;
    setAnalyzing(true);
    setParseError('');

    try {
      const { data: tacho } = await supabase
        .from('tachograph_activities')
        .select('*')
        .eq('driver_id', selectedDriver)
        .gte('start_time', dateRange.start)
        .lte('start_time', dateRange.end + 'T23:59:59');

      const { data: sessions } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', selectedDriver)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      if (!tacho || tacho.length === 0) {
        setParseError('No tachograph data found for this driver in the selected date range. Try uploading a .DDD file first.');
        setDiscrepancies(null);
        return;
      }

      // Convert DB Tacho Activities to Discrepancy format
      const tachoRows: TachoRow[] = tacho.map(t => ({
        date: t.start_time.split('T')[0],
        startTime: t.start_time.split('T')[1].slice(0, 5),
        endTime: t.end_time.split('T')[1].slice(0, 5),
        activity: t.activity_type
      }));

      const found = analyseDiscrepancies(tachoRows, (sessions as any) ?? []);

      // Also add missing mileage detections
      const missing = detectMissingMileage(tacho as any, (sessions as any) ?? []);
      const missingDiscrepancies: Discrepancy[] = missing.map(m => ({
        time: `${m.start.split('T')[1].slice(0, 5)} – ${m.end.split('T')[1].slice(0, 5)} (${m.start.split('T')[0]})`,
        appActivity: 'No app session',
        tachoActivity: 'Driving',
        severity: 'high',
        description: 'Unlogged Driving: Tachograph shows vehicle motion but no corresponding App session was active.',
        suggestedModule: 'tacho-modes'
      }));

      setDiscrepancies([...found, ...missingDiscrepancies]);
    } catch (err) {
      console.error(err);
      setParseError('An error occurred while fetching data.');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (sourceMode === 'database' && selectedDriver) {
      fetchAndAnalyseFromDb();
    }
  }, [selectedDriver, sourceMode, dateRange]);

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
      hours_credited: 0,
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
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setSourceMode('database')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-black uppercase tracking-wider transition ${
                sourceMode === 'database' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <DbIcon size={12} /> Stored Data
            </button>
            <button
              onClick={() => setSourceMode('csv')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-black uppercase tracking-wider transition ${
                sourceMode === 'csv' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <Upload size={12} /> CSV Upload
            </button>
          </div>

          <div>
            <label htmlFor="tacho-driver" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Driver</label>
            <select
              id="tacho-driver"
              value={selectedDriver}
              onChange={e => { setSelectedDriver(e.target.value); setDiscrepancies(null); }}
              className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm font-medium"
            >
              <option value="">Choose driver…</option>
              {activeDrivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>

          {sourceMode === 'database' ? (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">From</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full p-2 text-xs border border-slate-300 rounded bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">To</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full p-2 text-xs border border-slate-300 rounded bg-white font-bold"
                  />
                </div>
              </div>
              <button
                onClick={fetchAndAnalyseFromDb}
                disabled={!selectedDriver || analyzing}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-black text-xs uppercase tracking-widest transition"
              >
                {analyzing ? 'Checking Database...' : 'Run Analysis'}
              </button>
            </div>
          ) : (
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
              </div>
            </div>
          )}

          {parseError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">{parseError}</p>}
        </div>

        <div className="bg-blue-600 rounded-xl p-5 text-white text-sm space-y-2">
          <p className="font-black uppercase tracking-widest text-xs opacity-80 flex items-center gap-2">
            <Info size={12} /> {sourceMode === 'database' ? 'Database Mode' : 'How It Works'}
          </p>
          <p className="text-blue-100 leading-relaxed text-xs">
            {sourceMode === 'database'
              ? 'Automatically comparing stored Tachograph files (.DDD) against App sessions. To add more data, upload files in the Compliance Scoreboard.'
              : 'Export a CSV from your tacho analysis software. The checker cross-references each tacho activity window against the driver\'s portal work sessions.'}
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
