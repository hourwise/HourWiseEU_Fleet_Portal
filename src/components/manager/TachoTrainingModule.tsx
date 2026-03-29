import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Upload, AlertTriangle, CheckCircle, HelpCircle, GraduationCap, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDrivers } from '../../hooks/useDrivers';

interface TachoActivity {
  driverName: string;
  date: string;
  startTime: string;
  endTime: string;
  activity: string;
  vrm: string;
}

interface Discrepancy {
  time: string;
  appActivity: string;
  tachoActivity: string;
  severity: 'high' | 'low';
  description: string;
}

export function TachoTrainingModule() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { data: drivers } = useDrivers(profile?.company_id);

  const [selectedDriver, setSelectedDriver] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedDriver) return;

    setAnalyzing(true);
    setDiscrepancies([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      // Simple CSV Parsing (In production, use PapaParse)
      const lines = text.split('\n').slice(1);
      const tachoData: TachoActivity[] = lines.map(line => {
        const [id, name, date, start, end, act, vrm] = line.split(',').map(s => s?.trim());
        return { driverName: name, date, startTime: start, endTime: end, activity: act, vrm };
      }).filter(d => d.date);

      // MOCK LOGIC: In a real scenario, we would fetch app logs from Supabase here
      // const { data: appLogs } = await supabase.from('driver_logs').eq('driver_id', selectedDriver)...

      // Simulate analysis delay
      setTimeout(() => {
        const mockDiscrepancies: Discrepancy[] = [
          {
            time: '06:00 - 06:15',
            appActivity: 'Work (Walkaround)',
            tachoActivity: 'Unknown / Gap',
            severity: 'low',
            description: 'Missing Manual Entry: Driver logged walkaround in app but not on tacho card.'
          },
          {
            time: '10:45 - 11:15',
            appActivity: 'Driving',
            tachoActivity: 'Rest/Break',
            severity: 'high',
            description: 'Falsification Alert: App recorded movement while tacho was set to Break.'
          }
        ];
        setDiscrepancies(mockDiscrepancies);
        setAnalyzing(false);
        setIsSuccess(true);
      }, 1500);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('training.title')}</h2>
            <p className="text-gray-600">{t('training.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Import Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Upload size={18} className="text-blue-600" />
              {t('training.import.title')}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t('training.import.selectDriver')}</label>
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-slate-50 text-sm font-medium"
                >
                  <option value="">{t('training.import.selectPlaceholder')}</option>
                  {drivers?.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={!selectedDriver || analyzing}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="space-y-2">
                  <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                    <FileText className="text-blue-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">{t('training.import.uploadLabel')}</p>
                  <p className="text-xs text-slate-400">Tachomaster, OPTAC3, or Disc-Check CSV</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg">
            <HelpCircle className="mb-4 opacity-80" />
            <h4 className="font-bold mb-2">{t('training.suggestion.title')}</h4>
            <p className="text-sm text-blue-100 leading-relaxed">
              {t('training.suggestion.description')}
            </p>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">{t('training.analysis.title')}</h3>
              {discrepancies.length > 0 && (
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black uppercase">
                  {t('training.analysis.conflictsFound', { count: discrepancies.length })}
                </span>
              )}
            </div>

            {analyzing ? (
              <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                <p className="text-slate-500 font-bold animate-pulse">{t('training.import.analyzing')}</p>
              </div>
            ) : discrepancies.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {discrepancies.map((d, idx) => (
                  <div key={idx} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${d.severity === 'high' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{d.time}</p>
                          <h4 className="font-bold text-slate-900">{d.description}</h4>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${
                        d.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {d.severity === 'high' ? t('training.analysis.priorities.high') : t('training.analysis.priorities.low')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('training.analysis.app')}</p>
                        <p className="font-bold text-slate-700">{d.appActivity}</p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <p className="text-[10px] font-black text-blue-400 uppercase mb-1">{t('training.analysis.tacho')}</p>
                        <p className="font-bold text-blue-700">{d.tachoActivity}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button className="text-xs font-black uppercase text-blue-600 hover:text-blue-700 flex items-center gap-2">
                        <GraduationCap size={14} />
                        {t('training.analysis.assignButton')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
                {isSuccess ? (
                  <>
                    <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle className="text-emerald-500 w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">100% Match Found</h3>
                    <p className="text-slate-500 max-w-xs">App data perfectly aligns with tacho records for this period.</p>
                  </>
                ) : (
                  <>
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                      <FileText className="text-slate-300 w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{t('training.analysis.noData')}</h3>
                    <p className="text-slate-500 max-w-xs">{t('training.analysis.noDataSubtitle')}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
