import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { UserCheck, AlertTriangle, ChevronRight, GraduationCap } from 'lucide-react';

interface DriverWarning {
  driver_id: string;
  driver_name: string;
  doc_type: string;
  expiry_date: string;
  days_remaining: number;
}

export function DriverComplianceSnapshot({ onAction }: { onAction: () => void }) {
  const { profile } = useAuth();
  const [warnings, setWarnings] = useState<DriverWarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.company_id) {
      loadDocumentWarnings();
    }
  }, [profile]);

  const loadDocumentWarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_documents')
        .select(`
          expiry_date,
          document_type,
          user_id,
          profiles:user_id (full_name)
        `)
        .eq('company_id', profile!.company_id);

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const newWarnings: DriverWarning[] = [];

      data?.forEach((doc: any) => {
        if (!doc.expiry_date) return;

        const expiry = new Date(doc.expiry_date);
        const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Flag if expired or expiring within 30 days
        if (diff <= 30) {
          newWarnings.push({
            driver_id: doc.user_id,
            driver_name: doc.profiles?.full_name || 'Unknown Driver',
            doc_type: doc.document_type.replace('_', ' '),
            expiry_date: doc.expiry_date,
            days_remaining: diff
          });
        }
      });

      // Sort by urgency (expired first)
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
          Driver Qualification Alerts
        </h3>
        <span className={`text-xs font-black px-2 py-1 rounded ${warnings.length > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
          {warnings.length} {warnings.length === 1 ? 'ALERT' : 'ALERTS'}
        </span>
      </div>

      <div className="p-2 max-h-[300px] overflow-y-auto">
        {warnings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">All driver documents are up to date.</p>
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
                      {w.doc_type}: {w.days_remaining < 0 ? 'EXPIRED' : `EXPIRES IN ${w.days_remaining} DAYS`}
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
        Manage Driver Documents
      </button>
    </div>
  );
}
