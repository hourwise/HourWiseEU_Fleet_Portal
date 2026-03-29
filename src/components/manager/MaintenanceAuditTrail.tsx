import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Wrench, Download, Plus, X, Upload, Loader2, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

interface MaintenanceAuditTrailProps {
  vehicleId: string;
  isTrailer?: boolean;
  onUpdate?: () => void;
  triggerAddLog?: boolean;
  onModalClose?: () => void;
}

export function MaintenanceAuditTrail({ vehicleId, isTrailer, onUpdate, triggerAddLog, onModalClose }: MaintenanceAuditTrailProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchLogs = useCallback(async () => {
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
  }, [vehicleId]);

  useEffect(() => {
    if (vehicleId) {
      fetchLogs();
    }
  }, [vehicleId, fetchLogs]);

  useEffect(() => {
    if (triggerAddLog) {
      setShowAddModal(true);
    }
  }, [triggerAddLog]);

  const getEventTypeLabel = (type: string) => {
    const keyMap: Record<string, string> = {
      'PMI': 'pmi',
      'Defect Repair': 'repair',
      'MOT': 'mot',
      'Tacho Calibration': 'tacho',
      'Other': 'other'
    };
    return t(`maintenance.eventTypes.${keyMap[type] || 'other'}`);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    if (onModalClose) onModalClose();
  };

  if (loading) return <div className="p-4 text-center animate-pulse text-slate-400">{t('common.loading')}</div>;

  return (
    <div id="maintenance-audit-trail" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-blue-600" />
          <h3 className="font-bold text-slate-800">{t('maintenance.title')}</h3>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-blue-600 hover:text-blue-700 p-1.5 rounded-full hover:bg-blue-50 transition border border-blue-100 bg-white shadow-sm flex items-center gap-1 px-3"
        >
          <Plus size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">{t('maintenance.logWork')}</span>
        </button>
      </div>

      <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-10" />
            <p className="text-sm font-medium">{t('maintenance.noRecords')}</p>
            <p className="text-[10px] mt-1 uppercase tracking-widest opacity-60 font-bold">{t('maintenance.complianceRequired')}</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-slate-50 transition flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${
                    log.event_type === 'PMI' ? 'bg-blue-600 text-white' :
                    log.event_type === 'MOT' ? 'bg-slate-900 text-white' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {getEventTypeLabel(log.event_type)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {log.service_provider}
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-medium leading-snug">{log.description}</p>
                <div className="text-[10px] text-slate-400 font-black flex gap-4 mt-1.5">
                  <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(log.completed_at).toLocaleDateString()}</span>
                  {!isTrailer && <span>{t('maintenance.labels.odo')}: {log.odometer_at_service?.toLocaleString()} km</span>}
                  {log.cost > 0 && <span className="text-green-600">{t('maintenance.labels.cost')}: £{Number(log.cost).toFixed(2)}</span>}
                </div>
              </div>

              {log.document_url && (
                <a
                  href={log.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition border border-transparent hover:border-blue-100 bg-slate-50"
                  title={t('common.details')}
                >
                  <Download size={18} />
                </a>
              )}
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <AddLogModal
          vehicleId={vehicleId}
          isTrailer={isTrailer}
          onClose={handleModalClose}
          onSuccess={() => {
            handleModalClose();
            fetchLogs();
            if (onUpdate) onUpdate();
          }}
        />
      )}
    </div>
  );
}

export function AddLogModal({ vehicleId, isTrailer, onClose, onSuccess }: { vehicleId: string, isTrailer?: boolean, onClose: () => void, onSuccess: () => void }) {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    event_type: 'PMI',
    service_provider: '',
    odometer_at_service: 0,
    cost: '',
    description: '',
    completed_at: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let document_url = null;

      // 1. Upload Evidence
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${vehicleId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('maintenance-docs')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('maintenance-docs')
          .getPublicUrl(fileName);

        document_url = publicUrl;
      }

      // 2. Fetch current vehicle data to calculate next dates
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('pmi_interval_weeks, reg_number')
        .eq('id', vehicleId)
        .single();

      // 3. Save Log Entry
      const { error: insertError } = await supabase
        .from('maintenance_logs')
        .insert({
          vehicle_id: vehicleId,
          company_id: profile?.company_id,
          event_type: formData.event_type,
          service_provider: formData.service_provider.trim(),
          odometer_at_service: isTrailer ? 0 : formData.odometer_at_service,
          cost: parseFloat(formData.cost) || 0,
          description: formData.description.trim(),
          document_url,
          completed_at: formData.completed_at,
          created_by: profile?.id
        });

      if (insertError) throw insertError;

      // 4. AUTOMATED COMPLIANCE: Update Vehicle Master
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      if (!isTrailer) {
        updates.current_odometer = formData.odometer_at_service;
      }

      // If repair/pmi done, vehicle is likely safe
      if (formData.event_type === 'PMI' || formData.event_type === 'Defect Repair') {
        updates.is_vor = false;
        updates.maintenance_called = false; // Reset maintenance called flag
        updates.status_notes = `Last work: ${formData.event_type} on ${formData.completed_at}`;
      }

      // If PMI, calculate NEXT due date automatically
      if (formData.event_type === 'PMI' && vehicle?.pmi_interval_weeks) {
        const nextPmi = new Date(formData.completed_at);
        nextPmi.setDate(nextPmi.getDate() + (vehicle.pmi_interval_weeks * 7));
        updates.pmi_due_date = nextPmi.toISOString().split('T')[0];
      }

      // If MOT, set next year
      if (formData.event_type === 'MOT') {
        const nextMot = new Date(formData.completed_at);
        nextMot.setFullYear(nextMot.getFullYear() + 1);
        updates.mot_due_date = nextMot.toISOString().split('T')[0];
      }

      // If Tacho, set 2 years
      if (!isTrailer && formData.event_type === 'Tacho Calibration') {
        const nextTacho = new Date(formData.completed_at);
        nextTacho.setFullYear(nextTacho.getFullYear() + 2);
        updates.tacho_calibration_due = nextTacho.toISOString().split('T')[0];
      }

      await supabase
        .from('vehicles')
        .update(updates)
        .eq('id', vehicleId);

      onSuccess();
    } catch (err: any) {
      console.error('Error saving log:', err);
      setError(err.message || 'Failed to save maintenance record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wrench className="text-blue-600" size={20} />
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t('maintenance.modal.title')}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition" type="button"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('maintenance.labels.eventType')}</label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 text-sm font-bold"
                value={formData.event_type}
                onChange={e => setFormData({...formData, event_type: e.target.value})}
              >
                <option value="PMI">{t('maintenance.eventTypes.pmi')}</option>
                <option value="Defect Repair">{t('maintenance.eventTypes.repair')}</option>
                <option value="MOT">{isTrailer ? 'Annual Test' : t('maintenance.eventTypes.mot')}</option>
                {!isTrailer && <option value="Tacho Calibration">{t('maintenance.eventTypes.tacho')}</option>}
                <option value="Other">{t('maintenance.eventTypes.other')}</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('maintenance.labels.completedAt')}</label>
              <input
                type="date"
                required
                className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 text-sm font-bold"
                value={formData.completed_at}
                onChange={e => setFormData({...formData, completed_at: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('maintenance.labels.provider')}</label>
            <input
              required
              type="text"
              placeholder={t('maintenance.modal.providerPlaceholder')}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 text-sm font-bold transition-all"
              value={formData.service_provider}
              onChange={e => setFormData({...formData, service_provider: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {!isTrailer && (
                <>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('maintenance.labels.odo')} (km)</label>
                  <input
                    type="number"
                    required
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 text-sm font-bold transition-all"
                    value={formData.odometer_at_service || ''}
                    onChange={e => setFormData({...formData, odometer_at_service: parseInt(e.target.value) || 0})}
                  />
                </>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('maintenance.labels.cost')} (£)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 text-sm font-bold transition-all"
                value={formData.cost}
                onChange={e => setFormData({...formData, cost: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('maintenance.labels.description')}</label>
            <textarea
              rows={3}
              required
              placeholder={t('maintenance.modal.descriptionPlaceholder')}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 text-sm font-medium resize-none transition-all"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('maintenance.labels.evidence')}</label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 hover:bg-slate-50 cursor-pointer transition-colors bg-white group">
                <Upload size={20} className="text-slate-400 group-hover:text-blue-500 mb-1" />
                <span className="text-[10px] font-black text-slate-500 group-hover:text-blue-600 uppercase tracking-widest">
                  {file ? file.name : t('common.selectFile')}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,image/*"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </label>
              {file && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl font-black text-slate-400 hover:bg-slate-50 transition uppercase tracking-widest text-[10px]">{t('common.cancel')}</button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition disabled:opacity-50 shadow-lg shadow-blue-200 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t('maintenance.modal.saving')}
                </>
              ) : t('maintenance.modal.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
