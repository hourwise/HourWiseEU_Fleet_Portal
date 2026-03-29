import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, AlertTriangle, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VehicleWarning {
  id: string;
  reg_number: string;
  type: 'MOT' | 'PMI' | 'TACHO' | 'VOR';
  due_date?: string;
  days_remaining?: number;
}

export function VehicleComplianceSnapshot({ onAction }: { onAction: () => void }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [warnings, setWarnings] = useState<VehicleWarning[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWarnings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', profile!.company_id);

      if (error) throw error;

      const vehicleData = data || [];
      const newWarnings: VehicleWarning[] = [];
      const today = new Date();

      vehicleData.forEach(v => {
        // VOR Check
        if (v.is_vor) {
          newWarnings.push({
            id: v.id,
            reg_number: v.reg_number,
            type: 'VOR'
          });
        }

        // MOT Check
        if (v.mot_due_date) {
          const motDate = new Date(v.mot_due_date);
          const diff = Math.ceil((motDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff < 14) {
            newWarnings.push({
              id: v.id,
              reg_number: v.reg_number,
              type: 'MOT',
              due_date: v.mot_due_date,
              days_remaining: diff
            });
          }
        }

        // PMI Check
        if (v.pmi_due_date) {
          const pmiDate = new Date(v.pmi_due_date);
          const diff = Math.ceil((pmiDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff < 14) {
            newWarnings.push({
              id: v.id,
              reg_number: v.reg_number,
              type: 'PMI',
              due_date: v.pmi_due_date,
              days_remaining: diff
            });
          }
        }

        // Tacho Check
        if (v.tacho_calibration_due) {
          const tachoDate = new Date(v.tacho_calibration_due);
          const diff = Math.ceil((tachoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff < 14) {
            newWarnings.push({
              id: v.id,
              reg_number: v.reg_number,
              type: 'TACHO',
              due_date: v.tacho_calibration_due,
              days_remaining: diff
            });
          }
        }
      });

      // Sort by urgency (days remaining)
      setWarnings(newWarnings.sort((a, b) => (a.days_remaining || 0) - (b.days_remaining || 0)));
    } catch (error) {
      console.error('Error loading vehicle warnings:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    if (profile?.company_id) {
      loadWarnings();
    }
  }, [loadWarnings, profile?.company_id]);

  if (loading) return <div className="animate-pulse bg-brand-card rounded-xl h-48 border border-brand-border" />;

  return (
    <div className="bg-brand-card rounded-xl shadow-sm border border-brand-border overflow-hidden">
      <div className="p-4 border-b border-brand-border flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Truck className="w-5 h-5 text-brand-accent" />
          {t('vehicleCompliance.title')}
        </h3>
        <span className="bg-red-500/10 text-red-500 text-xs font-black px-2 py-1 rounded">
          {t('vehicleCompliance.urgent', { count: warnings.length })}
        </span>
      </div>

      <div className="p-2 max-h-[300px] overflow-y-auto">
        {warnings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">{t('vehicleCompliance.noAlerts')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {warnings.map((w, idx) => (
              <button
                key={`${w.id}-${w.type}-${idx}`}
                onClick={onAction}
                className="w-full flex items-center justify-between p-3 hover:bg-brand-dark/50 rounded-lg transition group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${w.type === 'VOR' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    <AlertTriangle size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{w.reg_number}</p>
                    <p className="text-xs text-slate-400">
                      {w.type === 'VOR'
                        ? t('vehicleCompliance.offRoad')
                        : w.days_remaining! < 0
                          ? t('vehicleCompliance.dueOverdue', { type: w.type })
                          : t('vehicleCompliance.dueInDays', { type: w.type, days: w.days_remaining })}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition" />
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onAction}
        className="w-full p-3 text-xs font-bold text-slate-400 hover:text-white hover:bg-brand-dark/50 border-t border-brand-border transition uppercase tracking-widest"
      >
        {t('vehicleCompliance.viewFullList')}
      </button>
    </div>
  );
}
