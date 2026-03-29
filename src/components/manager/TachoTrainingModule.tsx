import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, FileText, AlertTriangle, CheckCircle, GraduationCap, ArrowRight, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Discrepancy {
  time: string;
  tacho: string;
  app: string;
  severity: 'low' | 'high';
  reason: string;
}

export function TachoTrainingModule() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);

  const loadDrivers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', profile!.company_id)
      .eq('role', 'driver');
    setDrivers(data || []);
  }, [profile?.company_id]);

  useEffect(() => {
    if (profile?.company_id) {
      loadDrivers();
    }
  }, [loadDrivers, profile?.company_id]);

  const simulateComparison = () => {
    setLoading(true);
    // In a real scenario, this would compare DB records from work_sessions vs tacho_activities
    setTimeout(() => {
      setDiscrepancies([
        {
          time: '10:15 - 10:45',
          tacho: 'Driving',
          app: 'Break',
          severity: 'high',
          reason: 'Mode Switch Error: Driver was driving while App recorded a Break.'
        },
        {
          time: '14:00 - 14:15',
          tacho: 'Work',
          app: 'Rest',
          severity: 'low',
          reason: 'Context Missing: App shows Rest but Tacho shows Other Work (Loading?).'
        }
      ]);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('training.title')}</h2>
            <p className="text-gray-600">{t('training.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Import & Controls */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Upload size={18} className="text-blue-600" /> {t('training.import.title')}
            </h3>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('training.import.selectDriver')}</label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 font-bold text-sm"
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
              >
                <option value="">{t('training.import.selectPlaceholder')}</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>

            <div className="border-2 border-dashed border-slate-100 rounded-xl p-8 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">{t('training.import.uploadLabel')}</p>
              <button className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline">
                {t('training.import.browse')}
              </button>
            </div>

            <button
              onClick={simulateComparison}
              disabled={!selectedDriver || loading}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all disabled:opacity-50"
            >
              {loading ? t('training.import.analyzing') : t('training.import.runButton')}
            </button>
          </div>

          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-900/20">
            <h4 className="font-black uppercase tracking-widest text-[10px] mb-4 opacity-80 flex items-center gap-2">
              <Info size={14} /> {t('training.suggestion.title')}
            </h4>
            <p className="text-sm font-medium leading-relaxed">
              {t('training.suggestion.description')}
            </p>
          </div>
        </div>

        {/* Right: Discrepancy View */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" /> {t('training.analysis.title')}
              </h3>
              {discrepancies.length > 0 && (
                <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-1 rounded uppercase">
                  {t('training.analysis.conflictsFound', { count: discrepancies.length })}
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {discrepancies.length === 0 ? (
                <div className="p-20 text-center text-slate-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="font-medium">{t('training.analysis.noData')}</p>
                  <p className="text-xs">{t('training.analysis.noDataSubtitle')}</p>
                </div>
              ) : (
                discrepancies.map((d, idx) => (
                  <div key={idx} className="p-6 hover:bg-slate-50 transition space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs font-black uppercase tracking-tighter">
                        <div className="px-3 py-1 bg-slate-900 text-white rounded">{d.time}</div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span>{t('training.analysis.tacho')}: <span className="text-slate-900">{t('training.analysis.activities.' + d.tacho.toLowerCase())}</span></span>
                          <ArrowRight size={12} />
                          <span>{t('training.analysis.app')}: <span className="text-blue-600">{t('training.analysis.activities.' + d.app.toLowerCase())}</span></span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        d.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        {t('training.analysis.priorities.' + d.severity)}
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-xl flex gap-3 items-start">
                      <GraduationCap size={20} className="text-blue-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-slate-900 mb-1">{t('training.analysis.insightTitle')}</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{d.reason}</p>
                        <button className="mt-3 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">
                          {t('training.analysis.assignButton')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
