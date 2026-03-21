import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { UserCheck, AlertTriangle, ChevronRight, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DriverWarning {
  driver_id: string;
  driver_name: string;
  doc_type: string;
  expiry_date: string;
  days_remaining: number;
}

export function DriverComplianceSnapshot({ onAction }: { onAction: () => void }) {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [warnings, setWarnings] = useState<DriverWarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.company_id) {
      loadDocumentWarnings();
    }
  }, [profile]);

  const loadDocumentWarnings = async () => {
    try {
      const { data: docData, error: docError } = await supabase
        .from('driver_documents')
        .select(`
          expiry_date,
          document_type,
          user_id,
          profiles:user_id (full_name)
        `)
        .eq('company_id', profile!.company_id);

      if (docError) throw docError;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, driving_licence_expiry, cpc_dqc_expiry')
        .eq('company_id', profile!.company_id)
        .eq('role', 'driver');

      if (profileError) throw profileError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const newWarnings: DriverWarning[] = [];
      const processedKeys = new Set<string>();

      docData?.forEach((doc: any) => {
        if (!doc.expiry_date) return;

        const expiry = new Date(doc.expiry_date);
        const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diff <= 30) {
          const type = doc.document_type.replace('_', ' ');
          newWarnings.push({
            driver_id: doc.user_id,
            driver_name: doc.profiles?.full_name || 'Unknown Driver',
            doc_type: type,
            expiry_date: doc.expiry_date,
            days_remaining: diff
          });
          processedKeys.add(`${doc.user_id}-${type}`);
        }
      });

      profileData?.forEach((p: any) => {
        if (p.driving_licence_expiry && !processedKeys.has(`${p.id}-HGV Licence`)) {
          const expiry = new Date(p.driving_licence_expiry);
          const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff <= 30) {
            newWarnings.push({
              driver_id: p.id,
              driver_name: p.full_name,
              doc_type: 'Driving Licence',
              expiry_date: p.driving_licence_expiry,
              days_remaining: diff
            });
          }
        }

        if (p.cpc_dqc_expiry && !processedKeys.has(`${p.id}-CPC Tacho`)) {
          const expiry = new Date(p.cpc_dqc_expiry);
          const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff <= 30) {
            newWarnings.push({
              driver_id: p.id,
              driver_name: p.full_name,
              doc_type: 'CPC Card',
              expiry_date: p.cpc_dqc_expiry,
              days_remaining: diff
            });
          }
        }
      });

      setWarnings(newWarnings.sort((a, b) => a.days_remaining - b.days_remaining));
    } catch (error) {
      console.error('Error loading driver warnings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="animate-pulse bg-brand-card rounded-xl h-48 border border-brand-border" />;

  return (
    <div className="bg-brand-card rounded-xl shadow-sm border border-brand-border overflow-hidden">
      <div className="p-4 border-b border-brand-border flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-brand-accent" />
          {t('dashboard.manager.snapshots.driver')}
        </h3>
        <span className={`text-xs font-black px-2 py-1 rounded ${warnings.length > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
          {warnings.length === 1 ? t('dashboard.manager.snapshots.alertSingle') : t('dashboard.manager.snapshots.alerts', { count: warnings.length })}
        </span>
      </div>

      <div className="p-2 max-h-[300px] overflow-y-auto">
        {warnings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">{t('dashboard.manager.snapshots.noDriverAlerts')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {warnings.map((w, idx) => (
              <button
                key={`${w.driver_id}-${w.doc_type}-${idx}`}
                onClick={onAction}
                className="w-full flex items-center justify-between p-3 hover:bg-brand-dark/50 rounded-lg transition group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${w.days_remaining < 0 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    <AlertTriangle size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{w.driver_name}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                      {w.doc_type}: {w.days_remaining < 0 ? t('fleet.status.overdue') : t('fleet.status.expiresIn', { days: w.days_remaining })}
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
        className="w-full p-3 text-[10px] font-black text-slate-400 hover:text-white hover:bg-brand-dark/50 border-t border-brand-border transition uppercase tracking-[0.2em]"
      >
        {t('dashboard.manager.snapshots.manageDocs')}
      </button>
    </div>
  );
}
