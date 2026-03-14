import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Wrench, CheckCircle, Download, Plus } from 'lucide-react';

interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  event_type: string;
  service_provider: string;
  odometer_at_service: number;
  cost: number;
  description: string;
  document_url: string | null;
  completed_at: string;
}

export function MaintenanceAuditTrail({ vehicleId }: { vehicleId: string }) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (vehicleId) {
      fetchLogs();
    }
  }, [vehicleId]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-center animate-pulse text-slate-400">Loading audit trail...</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <FileText size={18} className="text-blue-600" /> Maintenance Audit Trail
        </h3>
        <button className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition">
          <Plus size={18} />
        </button>
      </div>

      <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Wrench className="w-12 h-12 mx-auto mb-2 opacity-10" />
            <p className="text-sm">No maintenance records found.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-slate-50 transition flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{log.event_type}</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase">
                    {log.service_provider}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{log.description}</p>
                <div className="text-xs text-slate-400 font-bold flex gap-4 mt-1">
                  <span>DATE: {new Date(log.completed_at).toLocaleDateString()}</span>
                  <span>ODO: {log.odometer_at_service?.toLocaleString()} km</span>
                </div>
              </div>

              {log.document_url && (
                <a
                  href={log.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="View Document"
                >
                  <Download size={18} />
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
