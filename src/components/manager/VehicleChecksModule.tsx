import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Calendar, AlertTriangle, CheckCircle, ChevronRight, FileText, Truck, Gauge, Search, ArrowRight, Camera, X, ZoomIn } from 'lucide-react';
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
  profiles: {
    full_name: string;
  };
}

interface FleetVehicle {
  is_vor: boolean;
  maintenance_called: boolean;
  status_notes: string | null;
  make: string;
  model: string | null;
}

interface DefectPhoto {
  id: string;
  storage_path: string;
  publicUrl: string;
}

interface Props {
  onNavigateToFleet: () => void;
}

export function VehicleChecksModule({ onNavigateToFleet }: Props) {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [checks, setChecks] = useState<VehicleCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCheck, setSelectedCheck] = useState<VehicleCheck | null>(null);
  // undefined = loading, null = not registered in fleet tab, object = found
  const [fleetVehicle, setFleetVehicle] = useState<FleetVehicle | null | undefined>(undefined);
  const [defectPhotos, setDefectPhotos] = useState<DefectPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

  // When a check is selected, look up the matching vehicle in the fleet tab
  useEffect(() => {
    if (!selectedCheck || !profile?.company_id) {
      setFleetVehicle(undefined);
      return;
    }
    setFleetVehicle(undefined); // show loading
    supabase
      .from('vehicles')
      .select('is_vor, maintenance_called, status_notes, make, model')
      .eq('reg_number', selectedCheck.reg_number)
      .eq('company_id', profile.company_id)
      .maybeSingle()
      .then(({ data }) => setFleetVehicle(data ?? null));
  }, [selectedCheck?.id, profile?.company_id]);

  // Fetch defect photos when a defect check is selected
  useEffect(() => {
    if (!selectedCheck || selectedCheck.check_status !== 'defect') {
      setDefectPhotos([]);
      return;
    }
    setPhotosLoading(true);
    supabase
      .from('defect_photos')
      .select('id, storage_path, uploaded_at')
      .eq('vehicle_check_id', selectedCheck.id)
      .order('uploaded_at')
      .then(({ data }) => {
        const photos: DefectPhoto[] = (data ?? []).map(row => ({
          id: row.id,
          storage_path: row.storage_path,
          publicUrl: supabase.storage.from('defect-photos').getPublicUrl(row.storage_path).data.publicUrl,
        }));
        setDefectPhotos(photos);
        setPhotosLoading(false);
      });
  }, [selectedCheck?.id]);

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
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="Defect photo"
            className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

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
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-red-100 text-red-700">
                            DEFECT
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

                    {/* DEFECT PHOTOS */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Camera size={13} /> Defect Photos
                        {defectPhotos.length > 0 && (
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-black">{defectPhotos.length}</span>
                        )}
                      </h4>
                      {photosLoading ? (
                        <div className="flex gap-2">
                          {[1,2,3].map(i => <div key={i} className="w-24 h-24 bg-slate-100 rounded-lg animate-pulse" />)}
                        </div>
                      ) : defectPhotos.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No photos attached to this defect report.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {defectPhotos.map(photo => (
                            <button
                              key={photo.id}
                              onClick={() => setLightboxUrl(photo.publicUrl)}
                              className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-400 transition group"
                            >
                              <img
                                src={photo.publicUrl}
                                alt="Defect photo"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                                <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* FLEET STATUS — mirrors the Fleet tab for this vehicle */}
                    <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Truck size={14} className="text-blue-600" /> Fleet Status — {selectedCheck.reg_number}
                      </h4>

                      {fleetVehicle === undefined ? (
                        <div className="flex justify-center py-6">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                        </div>
                      ) : fleetVehicle === null ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500">
                          <p className="font-bold text-slate-700 mb-1">{selectedCheck.reg_number} is not registered in the Fleet tab.</p>
                          <p>Add it to the Fleet tab to track VOR status, maintenance, and repairs.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className={`p-4 rounded-xl border ${fleetVehicle.is_vor ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'}`}>
                              <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 text-slate-500">VOR Status</p>
                              <p className={`font-black text-sm ${fleetVehicle.is_vor ? 'text-red-700' : 'text-green-700'}`}>
                                {fleetVehicle.is_vor ? '🔴 Vehicle Off Road' : '🟢 Operational'}
                              </p>
                            </div>
                            <div className={`p-4 rounded-xl border ${fleetVehicle.maintenance_called ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                              <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 text-slate-500">Maintenance</p>
                              <p className={`font-black text-sm ${fleetVehicle.maintenance_called ? 'text-amber-700' : 'text-slate-400'}`}>
                                {fleetVehicle.maintenance_called ? '⚠ Booked with Garage' : 'Not booked'}
                              </p>
                            </div>
                          </div>
                          {fleetVehicle.status_notes && (
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fleet Notes</p>
                              <p className="text-sm text-slate-600 italic">{fleetVehicle.status_notes}</p>
                            </div>
                          )}
                          <p className="text-xs text-slate-400 leading-relaxed">
                            To mark VOR, book maintenance, or log a repair — manage this vehicle in the Fleet tab.
                          </p>
                        </div>
                      )}

                      <button
                        onClick={onNavigateToFleet}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition"
                      >
                        Go to Fleet Tab <ArrowRight size={14} />
                      </button>
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
