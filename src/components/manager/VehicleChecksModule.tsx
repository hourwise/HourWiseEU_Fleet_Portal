import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Calendar, AlertTriangle, CheckCircle, ChevronRight, FileText, Truck, Gauge, Wrench, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VehicleCheck {
  id: string;
  driver_id: string;
  check_date: string;
  reg_number: string;
  vehicle_type: string;
  vehicle_make: string | null;
  check_status: 'pass' | 'defect';
  defect_details: string | null;
  items: Record<string, boolean>;
  odometer_reading: number | null;
  created_at: string;
  defect_lifecycle_status?: 'reported' | 'in_progress' | 'fixed';
  resolution_notes?: string;
  resolved_at?: string;
  resolved_by?: string;
  profiles: {
    full_name: string;
  };
}

export function VehicleChecksModule() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [checks, setChecks] = useState<VehicleCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCheck, setSelectedCheck] = useState<VehicleCheck | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updatingLifecycle, setUpdatingLifecycle] = useState(false);

  const loadVehicleChecks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_checks')
        .select(`
          *,
          profiles:driver_id (full_name)
        `)
        .eq('company_id', profile!.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChecks(data || []);

      if (selectedCheck) {
        const updated = data?.find(c => c.id === selectedCheck.id);
        if (updated) setSelectedCheck(updated);
      }
    } catch (error) {
      console.error('Error loading vehicle checks:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, selectedCheck?.id]);

  useEffect(() => {
    if (profile?.company_id) {
      loadVehicleChecks();
    }
  }, [loadVehicleChecks, profile?.company_id]);

  const handleUpdateDefectStatus = async (newStatus: 'in_progress' | 'fixed') => {
    if (!selectedCheck) return;
    setUpdatingLifecycle(true);
    try {
      const updates: any = {
        defect_lifecycle_status: newStatus,
        resolution_notes: resolutionNotes || selectedCheck.resolution_notes
      };

      if (newStatus === 'fixed') {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = profile?.id;
      }

      const { error } = await supabase
        .from('vehicle_checks')
        .update(updates)
        .eq('id', selectedCheck.id);

      if (error) throw error;
      await loadVehicleChecks();
      setResolutionNotes('');
    } catch (err: any) {
      alert("Status update failed: " + err.message);
    } finally {
      setUpdatingLifecycle(false);
    }
  };

  const filteredChecks = checks.filter(check =>
    check.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    check.reg_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('vehicleChecklist.manager.title')}</h2>
            <p className="text-gray-600">{t('vehicleChecklist.manager.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('vehicleChecklist.manager.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredChecks.length === 0 ? (
                <div className="p-8 text-center text-gray-500">{t('vehicleChecklist.manager.noChecks')}</div>
              ) : (
                filteredChecks.map((check) => (
                  <button
                    key={check.id}
                    onClick={() => setSelectedCheck(check)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition flex items-center justify-between ${
                      selectedCheck?.id === check.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{check.profiles.full_name}</p>
                        {check.check_status === 'defect' && (
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                            check.defect_lifecycle_status === 'fixed' ? 'bg-green-100 text-green-700' :
                            check.defect_lifecycle_status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {check.defect_lifecycle_status || 'REPORTED'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-blue-600 uppercase">{check.reg_number}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <Calendar size={14} />
                        {new Date(check.check_date || check.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {check.check_status === 'defect' ? (
                        <AlertTriangle className="text-amber-500 w-5 h-5" />
                      ) : (
                        <CheckCircle className="text-green-500 w-5 h-5" />
                      )}
                      <ChevronRight className="text-gray-400 w-4 h-4" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedCheck ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedCheck.profiles.full_name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm font-bold text-blue-600 uppercase flex items-center gap-1">
                      <Truck size={14} /> {selectedCheck.reg_number}
                    </span>
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar size={14} /> {new Date(selectedCheck.check_date || selectedCheck.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  <FileText size={16} />
                  {t('vehicleChecklist.manager.printExport')}
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('vehicleChecklist.manager.details.vehicleType')}</label>
                    <p className="font-bold text-gray-900">{selectedCheck.vehicle_type}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('vehicleChecklist.manager.details.vehicleMake')}</label>
                    <p className="font-bold text-gray-900">{selectedCheck.vehicle_make || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('vehicleChecklist.manager.details.odometer')}</label>
                    <div className="flex items-center gap-1">
                      <Gauge size={14} className="text-blue-600" />
                      <p className="font-bold text-gray-900">{selectedCheck.odometer_reading?.toLocaleString() || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('vehicleChecklist.manager.details.status')}</label>
                    <span className={`font-bold ${selectedCheck.check_status === 'defect' ? 'text-amber-600' : 'text-green-600'}`}>
                      {t(`vehicleChecklist.manager.status.${selectedCheck.check_status}`).toUpperCase()}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('vehicleChecklist.manager.details.timeRecorded')}</label>
                    <p className="font-bold text-gray-900">{new Date(selectedCheck.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>

                {selectedCheck.check_status === 'defect' && (
                  <div className="mb-8 space-y-6">
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                      <h4 className="text-red-800 font-bold flex items-center gap-2 mb-2">
                        <AlertTriangle size={20} />
                        {t('vehicleChecklist.manager.details.defectsTitle')}
                      </h4>
                      <p className="text-red-900 whitespace-pre-wrap font-medium">{selectedCheck.defect_details || t('vehicleChecklist.manager.details.noDefects')}</p>
                    </div>

                    {/* DEFECT LIFECYCLE MANAGEMENT */}
                    <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Wrench size={14}/> Defect Resolution Tracking
                      </h4>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-tight">{t('vehicleChecklist.manager.details.defectStatus')}</label>
                            <div className="flex gap-2">
                              {['reported', 'in_progress', 'fixed'].map((status) => (
                                <span key={status} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                                  selectedCheck.defect_lifecycle_status === status
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}>
                                  {status.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                          {selectedCheck.resolved_at && (
                            <div className="flex items-center gap-2 text-xs text-green-600 font-bold">
                              <CheckCircle size={14} /> {t('vehicleChecklist.manager.details.fixedBy', { date: new Date(selectedCheck.resolved_at).toLocaleDateString() })}
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-tight">{t('vehicleChecklist.manager.details.resolutionNotes')}</label>
                          <textarea
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            placeholder={selectedCheck.resolution_notes || "Workshop notes, parts used, or mechanic name..."}
                            className="w-full p-3 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateDefectStatus('in_progress')}
                              disabled={updatingLifecycle || selectedCheck.defect_lifecycle_status === 'in_progress'}
                              className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-black transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <Clock size={14} /> {t('vehicleChecklist.manager.details.markInProgress')}
                            </button>
                            <button
                              onClick={() => handleUpdateDefectStatus('fixed')}
                              disabled={updatingLifecycle || selectedCheck.defect_lifecycle_status === 'fixed'}
                              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <Check size={14} /> {t('vehicleChecklist.manager.details.markFixed')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                  {Object.entries(selectedCheck.items).map(([id, status]) => (
                    <div key={id} className="flex items-center justify-between py-2 border-b border-gray-50">
                      <span className="text-sm text-gray-700">{t(`vehicleChecklist.items.${id}`)}</span>
                      {status ? (
                        <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                          <CheckCircle size={12} /> {t('vehicleChecklist.manager.status.pass')}
                        </span>
                      ) : (
                        <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                          <AlertTriangle size={12} /> {t('vehicleChecklist.manager.status.fail')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <ShieldCheck className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">{t('vehicleChecklist.manager.selectCheck')}</h3>
              <p className="text-gray-500">{t('vehicleChecklist.manager.selectCheckSubtitle')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
