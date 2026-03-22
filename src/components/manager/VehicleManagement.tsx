import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, AlertTriangle, Calendar, Plus, PenSquare, Gauge, Shield, Clock, Wrench, CheckCircle, X, Info, Save, Container } from 'lucide-react';
import { MaintenanceAuditTrail } from './MaintenanceAuditTrail';
import { useTranslation } from 'react-i18next';

interface Vehicle {
  id: string;
  reg_number: string;
  make: string;
  model: string | null;
  year: number | null;
  vehicle_type: string;
  vin_number: string | null;
  is_vor: boolean;
  status_notes: string | null;
  current_odometer: number;
  mot_due_date: string | null;
  pmi_due_date: string | null;
  tacho_calibration_due: string | null;
  loler_due_date: string | null;
  insurance_expiry: string | null;
  maintenance_called: boolean;
  created_at: string;
}

export function VehicleManagement() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [view, setView] = useState<'list' | 'details'>('list');
  const [triggerLogModal, setTriggerLogModal] = useState(false);

  useEffect(() => {
    if (profile?.company_id) {
      loadVehicles();
    }
  }, [profile]);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', profile!.company_id)
        .order('reg_number', { ascending: true });

      if (error) throw error;
      const vehicleList = data || [];
      setVehicles(vehicleList);

      if (selectedVehicle) {
        const updated = vehicleList.find(v => v.id === selectedVehicle.id);
        if (updated) setSelectedVehicle(updated);
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (dateString: string | null) => {
    if (!dateString) return 'text-slate-400';
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-red-600 font-bold';
    if (diffDays < 14) return 'text-amber-500 font-bold';
    return 'text-green-600 font-medium';
  };

  const handleVehicleClick = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setView('details');
  };

  const toggleVOR = async () => {
    if (!selectedVehicle) return;
    const { error } = await supabase
      .from('vehicles')
      .update({
        is_vor: !selectedVehicle.is_vor,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedVehicle.id);
    if (!error) loadVehicles();
  };

  const toggleMaintenanceCalled = async () => {
    if (!selectedVehicle) return;
    const { error } = await supabase
      .from('vehicles')
      .update({
        maintenance_called: !selectedVehicle.maintenance_called,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedVehicle.id);
    if (!error) loadVehicles();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (view === 'details' && selectedVehicle) {
    const isTrailer = selectedVehicle.vehicle_type === 'Trailer';

    return (
      <div className="space-y-6">
        <button
          onClick={() => setView('list')}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
        >
          ← {t('fleet.backToList')}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-100 rounded-xl">
                    {isTrailer ? <Container size={32} className="text-blue-600" /> : <Truck size={32} className="text-blue-600" />}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedVehicle.reg_number}</h2>
                    <p className="text-slate-500 font-medium uppercase">
                      {selectedVehicle.make} {selectedVehicle.model} • {isTrailer ? t('fleet.labels.trailer') : selectedVehicle.vehicle_type}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedVehicle.maintenance_called && (
                    <span className="bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-black flex items-center gap-2 border border-amber-200">
                      <Clock size={18} /> {t('fleet.maintenanceCalled')}
                    </span>
                  )}
                  {selectedVehicle.is_vor ? (
                    <span className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-black flex items-center gap-2 border border-red-200">
                      <AlertTriangle size={18} /> {t('fleet.status.vor')}
                    </span>
                  ) : (
                    <span className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-black border border-green-200 uppercase">{t('fleet.status.active')}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {!isTrailer && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('fleet.labels.odometer')}</p>
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <Gauge size={16} className="text-blue-600" />
                      {selectedVehicle.current_odometer.toLocaleString()} km
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('fleet.labels.year')}</p>
                  <p className="text-slate-900 font-bold">{selectedVehicle.year || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('fleet.labels.vin')}</p>
                  <p className="text-slate-900 font-mono text-xs">{selectedVehicle.vin_number || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('fleet.labels.added')}</p>
                  <p className="text-slate-900 font-bold">{new Date(selectedVehicle.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide text-sm">
                  <Shield size={18} className="text-blue-600" /> {t('fleet.complianceBoard')}
                </h3>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <PenSquare size={14} /> Edit Dates
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">{isTrailer ? 'Annual Test' : t('fleet.labels.motDue')}</p>
                  <div className={`text-lg font-black ${getStatusColor(selectedVehicle.mot_due_date)}`}>
                    {selectedVehicle.mot_due_date || 'NOT SET'}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">{t('fleet.labels.pmiDue')}</p>
                  <div className={`text-lg font-black ${getStatusColor(selectedVehicle.pmi_due_date)}`}>
                    {selectedVehicle.pmi_due_date || 'NOT SET'}
                  </div>
                </div>
                {!isTrailer && (
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">{t('fleet.labels.tachoCal')}</p>
                    <div className={`text-lg font-black ${getStatusColor(selectedVehicle.tacho_calibration_due)}`}>
                      {selectedVehicle.tacho_calibration_due || 'NOT SET'}
                    </div>
                  </div>
                )}
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">LOLER (Tail-lift)</p>
                  <div className={`text-lg font-black ${getStatusColor(selectedVehicle.loler_due_date)}`}>
                    {selectedVehicle.loler_due_date || 'N/A'}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Insurance</p>
                  <div className={`text-lg font-black ${getStatusColor(selectedVehicle.insurance_expiry)}`}>
                    {selectedVehicle.insurance_expiry || 'NOT SET'}
                  </div>
                </div>
              </div>
            </div>

            <MaintenanceAuditTrail
              vehicleId={selectedVehicle.id}
              onUpdate={loadVehicles}
              triggerAddLog={triggerLogModal}
              onModalClose={() => setTriggerLogModal(false)}
            />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h3 className="font-bold text-slate-900 mb-2 uppercase tracking-wide text-sm">{t('fleet.maintenanceActions')}</h3>

              <button
                onClick={toggleMaintenanceCalled}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition group ${
                  selectedVehicle.maintenance_called ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className={selectedVehicle.maintenance_called ? "text-amber-600" : "text-amber-500"} size={20} />
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">{t('fleet.maintenanceCalled')}</p>
                    <p className="text-xs text-slate-500">{t('fleet.bookedWithGarage')}</p>
                  </div>
                </div>
                <CheckCircle size={18} className={selectedVehicle.maintenance_called ? "text-amber-600" : "text-slate-300 group-hover:text-amber-500"} />
              </button>

              <button
                onClick={() => setTriggerLogModal(true)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition group"
              >
                <div className="flex items-center gap-3">
                  <Wrench className="text-blue-600" size={20} />
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">{t('fleet.logRepair')}</p>
                    <p className="text-xs text-slate-500">{t('fleet.recordWork')}</p>
                  </div>
                </div>
                <Plus size={18} className="text-slate-300 group-hover:text-blue-600" />
              </button>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={toggleVOR}
                  className={`w-full py-3 rounded-lg font-bold transition shadow-sm ${
                    selectedVehicle.is_vor
                      ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-200'
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-red-200'
                  }`}
                >
                  {selectedVehicle.is_vor ? t('fleet.returnToService') : t('fleet.markVor')}
                </button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl p-6 text-white space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-amber-400">
                <Info size={18} />
                <h4 className="font-bold text-sm uppercase tracking-widest">{t('fleet.statusNotes')}</h4>
              </div>
              <p className="text-slate-300 text-sm italic leading-relaxed">
                {selectedVehicle.status_notes || t('fleet.noNotes')}
              </p>
            </div>
          </div>
        </div>

        {showEditModal && (
          <EditVehicleDatesModal
            vehicle={selectedVehicle}
            onClose={() => setShowEditModal(false)}
            onSuccess={() => {
              setShowEditModal(false);
              loadVehicles();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('fleet.title')}</h2>
            <p className="text-gray-600">{t('fleet.totalAssets', { count: vehicles.length })}</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition font-bold shadow-lg shadow-blue-200"
        >
          <Plus size={20} /> {t('fleet.addVehicle')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 bg-gradient-to-br from-white to-red-50/30">
          <h4 className="text-red-800 text-xs font-black uppercase tracking-widest mb-1">{t('fleet.status.vor')}</h4>
          <p className="text-4xl font-black text-red-600">
            {vehicles.filter(v => v.is_vor).length}
          </p>
          <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
            <AlertTriangle size={12} /> {t('fleet.status.requiresAttention')}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 bg-gradient-to-br from-white to-amber-50/30">
          <h4 className="text-amber-800 text-xs font-black uppercase tracking-widest mb-1">{t('fleet.status.critical')}</h4>
          <p className="text-4xl font-black text-amber-600">
            {vehicles.filter(v => {
              const motDiff = v.mot_due_date ? (new Date(v.mot_due_date).getTime() - new Date().getTime()) / (1000*3600*24) : 999;
              const pmiDiff = v.pmi_due_date ? (new Date(v.pmi_due_date).getTime() - new Date().getTime()) / (1000*3600*24) : 999;
              return (motDiff < 14) || (pmiDiff < 14);
            }).length}
          </p>
          <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
            <Calendar size={12} /> {t('fleet.status.compliancePending')}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100 bg-gradient-to-br from-white to-green-50/30">
          <h4 className="text-green-800 text-xs font-black uppercase tracking-widest mb-1">{t('fleet.status.operational')}</h4>
          <p className="text-4xl font-black text-green-600">
            {vehicles.filter(v => !v.is_vor).length}
          </p>
          <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
            <CheckCircle size={12} /> {t('fleet.status.ready')}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">{t('fleet.labels.regType')}</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">{t('fleet.labels.status')}</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">{t('fleet.labels.motDue')}</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">{t('fleet.labels.pmiDue')}</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">{t('fleet.labels.tachoCal')}</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">{t('fleet.labels.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <Truck className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">{t('fleet.noVehicles')}</p>
                    <button onClick={() => setShowAddModal(true)} className="text-blue-600 font-bold mt-2 hover:underline">
                      {t('fleet.addFirst')}
                    </button>
                  </td>
                </tr>
              ) : (
                vehicles.map(v => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/50 transition cursor-pointer"
                    onClick={() => handleVehicleClick(v)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {v.vehicle_type === 'Trailer' ? <Container size={20} className="text-slate-400" /> : <Truck size={20} className="text-slate-400" />}
                        <div>
                          <div className="font-black text-slate-900 text-lg tracking-tight">{v.reg_number}</div>
                          <div className="text-xs text-slate-500 font-bold uppercase">{v.make} • {v.vehicle_type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 items-center">
                        {v.maintenance_called && (
                          <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[9px] font-black uppercase border border-amber-200" title="Maintenance Called">
                            <Clock size={10} />
                          </div>
                        )}
                        {v.is_vor ? (
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 w-fit uppercase border border-red-200">
                            <AlertTriangle size={10} /> {t('fleet.status.vor')}
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black w-fit uppercase border border-green-200">{t('fleet.status.active')}</span>
                        )}
                      </div>
                    </td>
                    <td className={`p-4 text-sm font-mono ${getStatusColor(v.mot_due_date)}`}>{v.mot_due_date || '-'}</td>
                    <td className={`p-4 text-sm font-mono ${getStatusColor(v.pmi_due_date)}`}>{v.pmi_due_date || '-'}</td>
                    <td className={`p-4 text-sm font-mono ${getStatusColor(v.tacho_calibration_due)}`}>{v.vehicle_type === 'Trailer' ? 'N/A' : (v.tacho_calibration_due || '-')}</td>
                    <td className="p-4 text-right">
                      <button className="text-slate-400 hover:text-blue-600 p-2 transition">
                        <PenSquare size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddVehicleModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadVehicles();
          }}
        />
      )}
    </div>
  );
}

function EditVehicleDatesModal({ vehicle, onClose, onSuccess }: { vehicle: Vehicle, onClose: () => void, onSuccess: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const isTrailer = vehicle.vehicle_type === 'Trailer';
  const [formData, setFormData] = useState({
    mot_due_date: vehicle.mot_due_date || '',
    pmi_due_date: vehicle.pmi_due_date || '',
    tacho_calibration_due: vehicle.tacho_calibration_due || '',
    loler_due_date: vehicle.loler_due_date || '',
    insurance_expiry: vehicle.insurance_expiry || '',
    current_odometer: vehicle.current_odometer
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({
          mot_due_date: formData.mot_due_date || null,
          pmi_due_date: formData.pmi_due_date || null,
          tacho_calibration_due: isTrailer ? null : (formData.tacho_calibration_due || null),
          loler_due_date: formData.loler_due_date || null,
          insurance_expiry: formData.insurance_expiry || null,
          current_odometer: formData.current_odometer,
          updated_at: new Date().toISOString()
        })
        .eq('id', vehicle.id);

      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Calendar className="text-blue-600" /> Edit Compliance Dates
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition" type="button"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{isTrailer ? 'Annual Test Due' : t('fleet.labels.motDue')}</label>
              <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-bold bg-white" value={formData.mot_due_date} onChange={e => setFormData({...formData, mot_due_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.labels.pmiDue')}</label>
              <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-bold bg-white" value={formData.pmi_due_date} onChange={e => setFormData({...formData, pmi_due_date: e.target.value})} />
            </div>
            {!isTrailer && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.labels.tachoCal')}</label>
                <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-bold bg-white" value={formData.tacho_calibration_due} onChange={e => setFormData({...formData, tacho_calibration_due: e.target.value})} />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">LOLER (Tail-lift)</label>
              <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-bold bg-white" value={formData.loler_due_date} onChange={e => setFormData({...formData, loler_due_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Insurance Expiry</label>
              <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-bold bg-white" value={formData.insurance_expiry} onChange={e => setFormData({...formData, insurance_expiry: e.target.value})} />
            </div>
            {!isTrailer && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.labels.odometer')} (km)</label>
                <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-bold bg-white" value={formData.current_odometer} onChange={e => setFormData({...formData, current_odometer: parseInt(e.target.value) || 0})} />
              </div>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl font-black text-slate-400 hover:bg-slate-50 transition uppercase tracking-widest text-[10px]">{t('common.cancel')}</button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition disabled:opacity-50 shadow-lg shadow-blue-200 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
            >
              {loading ? t('common.loading') : <><Save size={16} /> Save Dates</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddVehicleModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    reg_number: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vehicle_type: 'Van',
    vin_number: '',
    mot_due_date: '',
    pmi_due_date: '',
    tacho_calibration_due: '',
    insurance_expiry: '',
    current_odometer: 0
  });

  const isTrailer = formData.vehicle_type === 'Trailer';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!profile?.company_id) {
      setError(t('fleet.modal.errors.companyId'));
      setLoading(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('vehicles')
        .insert({
          ...formData,
          company_id: profile.company_id,
          reg_number: formData.reg_number.toUpperCase().trim(),
          vin_number: formData.vin_number.trim() || null,
          mot_due_date: formData.mot_due_date || null,
          pmi_due_date: formData.pmi_due_date || null,
          tacho_calibration_due: isTrailer ? null : (formData.tacho_calibration_due || null),
          insurance_expiry: formData.insurance_expiry || null
        });

      if (insertError) throw insertError;
      onSuccess();
    } catch (err: any) {
      console.error('Error adding vehicle:', err);
      if (err.code === '23505') {
        setError(t('fleet.modal.errors.duplicate'));
      } else {
        setError(err.message || t('fleet.modal.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Truck className="text-blue-600" /> {t('fleet.modal.title')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition" type="button"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-shake">
              <AlertTriangle className="text-red-600 shrink-0" size={20} />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] border-b border-blue-50 pb-2">{t('fleet.modal.identity')}</h3>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.modal.regNumber')}</label>
                <input
                  required
                  type="text"
                  placeholder="E.G. AB12 CDE"
                  className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase font-mono font-bold text-slate-900 bg-white transition-all shadow-sm"
                  value={formData.reg_number}
                  onChange={e => setFormData({...formData, reg_number: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.modal.make')}</label>
                  <input required type="text" placeholder="Scania" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white transition-all shadow-sm" value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.modal.model')}</label>
                  <input type="text" placeholder="R450" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white transition-all shadow-sm" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.modal.type')}</label>
                <select
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 transition-all shadow-sm appearance-none cursor-pointer"
                  value={formData.vehicle_type}
                  onChange={e => setFormData({...formData, vehicle_type: e.target.value})}
                >
                  <option value="Van">Van</option>
                  <option value="7.5t">7.5t Truck</option>
                  <option value="Class 2">Class 2 (Rigid)</option>
                  <option value="Class 1">Class 1 (Tractor)</option>
                  <option value="Trailer">Trailer</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.modal.vinNumber')}</label>
                <input type="text" placeholder="Optional" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-slate-900 bg-white transition-all shadow-sm" value={formData.vin_number} onChange={e => setFormData({...formData, vin_number: e.target.value})} />
              </div>
            </div>

            <div className="space-y-5">
              <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] border-b border-amber-50 pb-2">{t('fleet.modal.compliance')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{isTrailer ? 'Annual Test Due' : t('fleet.modal.motDue')}</label>
                  <input type="date" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white transition-all shadow-sm" value={formData.mot_due_date} onChange={e => setFormData({...formData, mot_due_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.modal.pmiDue')}</label>
                  <input type="date" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white transition-all shadow-sm" value={formData.pmi_due_date} onChange={e => setFormData({...formData, pmi_due_date: e.target.value})} />
                </div>
                {!isTrailer && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.modal.tachoDue')}</label>
                    <input type="date" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white transition-all shadow-sm" value={formData.tacho_calibration_due} onChange={e => setFormData({...formData, tacho_calibration_due: e.target.value})} />
                  </div>
                )}
                {!isTrailer && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('fleet.modal.currentOdo')}</label>
                    <input type="number" placeholder="0" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white transition-all shadow-sm" value={formData.current_odometer || ''} onChange={e => setFormData({...formData, current_odometer: parseInt(e.target.value) || 0})} />
                  </div>
                )}
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                <Shield className="text-slate-400 mt-0.5 shrink-0" size={16} />
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  {t('fleet.modal.footnote')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 border border-slate-200 rounded-xl font-black text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest text-xs">{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200 uppercase tracking-widest text-xs">
              {loading ? t('fleet.modal.adding') : t('fleet.modal.register')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
