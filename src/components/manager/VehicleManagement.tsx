import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, AlertTriangle, Calendar, Plus, PenSquare, Gauge, Shield, Clock, Wrench, CheckCircle, X, Info } from 'lucide-react';
import { MaintenanceAuditTrail } from './MaintenanceAuditTrail';

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
  created_at: string;
}

export function VehicleManagement() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [view, setView] = useState<'list' | 'details'>('list');

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
      setVehicles(data || []);
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
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-red-600 font-bold'; // Overdue
    if (diffDays < 14) return 'text-amber-500 font-bold'; // Due soon
    return 'text-green-600 font-medium';
  };

  const handleVehicleClick = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setView('details');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (view === 'details' && selectedVehicle) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setView('list')}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
        >
          ← Back to Fleet List
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Vehicle Header */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedVehicle.reg_number}</h2>
                  <p className="text-slate-500 font-medium uppercase">{selectedVehicle.make} {selectedVehicle.model} • {selectedVehicle.vehicle_type}</p>
                </div>
                {selectedVehicle.is_vor ? (
                  <span className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-black flex items-center gap-2">
                    <AlertTriangle size={18} /> VOR
                  </span>
                ) : (
                  <span className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-black">ACTIVE</span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">Odometer</p>
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <Gauge size={16} className="text-blue-600" />
                    {selectedVehicle.current_odometer.toLocaleString()} km
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">Year</p>
                  <p className="text-slate-900 font-bold">{selectedVehicle.year || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">VIN</p>
                  <p className="text-slate-900 font-mono text-xs">{selectedVehicle.vin_number || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">Added</p>
                  <p className="text-slate-900 font-bold">{new Date(selectedVehicle.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Compliance Matrix */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Shield size={20} className="text-blue-600" /> Compliance Dates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">MOT / Plating</p>
                  <div className={`text-lg font-black ${getStatusColor(selectedVehicle.mot_due_date)}`}>
                    {selectedVehicle.mot_due_date || 'NOT SET'}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">PMI (Service)</p>
                  <div className={`text-lg font-black ${getStatusColor(selectedVehicle.pmi_due_date)}`}>
                    {selectedVehicle.pmi_due_date || 'NOT SET'}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Tacho Calibration</p>
                  <div className={`text-lg font-black ${getStatusColor(selectedVehicle.tacho_calibration_due)}`}>
                    {selectedVehicle.tacho_calibration_due || 'NOT SET'}
                  </div>
                </div>
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

            {/* Audit Trail */}
            <MaintenanceAuditTrail vehicleId={selectedVehicle.id} />
          </div>

          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h3 className="font-bold text-slate-900 mb-2">Maintenance Actions</h3>

              <button className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition group">
                <div className="flex items-center gap-3">
                  <Clock className="text-amber-500" size={20} />
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">Maintenance Called</p>
                    <p className="text-xs text-slate-500">Mark as booked with garage</p>
                  </div>
                </div>
                <CheckCircle size={18} className="text-slate-300 group-hover:text-amber-500" />
              </button>

              <button className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition group">
                <div className="flex items-center gap-3">
                  <Wrench className="text-blue-600" size={20} />
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">Log Repair/PMI</p>
                    <p className="text-xs text-slate-500">Record work and upload sheet</p>
                  </div>
                </div>
                <Plus size={18} className="text-slate-300 group-hover:text-blue-600" />
              </button>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={async () => {
                    const { error } = await supabase
                      .from('vehicles')
                      .update({ is_vor: !selectedVehicle.is_vor })
                      .eq('id', selectedVehicle.id);
                    if (!error) loadVehicles();
                  }}
                  className={`w-full py-3 rounded-lg font-bold transition ${
                    selectedVehicle.is_vor
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {selectedVehicle.is_vor ? 'Return to Service (Safe)' : 'Mark as VOR'}
                </button>
              </div>
            </div>

            {/* Status Notes */}
            <div className="bg-slate-900 rounded-xl p-6 text-white space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Info size={18} />
                <h4 className="font-bold text-sm uppercase">Status Notes</h4>
              </div>
              <p className="text-slate-300 text-sm italic">
                {selectedVehicle.status_notes || 'No active alerts or notes for this vehicle.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Fleet Management</h2>
            <p className="text-gray-600">{vehicles.length} Total Assets</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition font-bold shadow-lg shadow-blue-200"
        >
          <Plus size={20} /> Add Vehicle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 bg-gradient-to-br from-white to-red-50/30">
          <h4 className="text-red-800 text-xs font-black uppercase tracking-widest mb-1">VOR / Off Road</h4>
          <p className="text-4xl font-black text-red-600">
            {vehicles.filter(v => v.is_vor).length}
          </p>
          <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
            <AlertTriangle size={12} /> Requires immediate attention
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 bg-gradient-to-br from-white to-amber-50/30">
          <h4 className="text-amber-800 text-xs font-black uppercase tracking-widest mb-1">Critical Due (14d)</h4>
          <p className="text-4xl font-black text-amber-600">
            {vehicles.filter(v => {
              const motDiff = v.mot_due_date ? (new Date(v.mot_due_date).getTime() - new Date().getTime()) / (1000*3600*24) : 999;
              const pmiDiff = v.pmi_due_date ? (new Date(v.pmi_due_date).getTime() - new Date().getTime()) / (1000*3600*24) : 999;
              return (motDiff > -365 && motDiff < 14) || (pmiDiff > -365 && pmiDiff < 14);
            }).length}
          </p>
          <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
            <Calendar size={12} /> Compliance inspections pending
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100 bg-gradient-to-br from-white to-green-50/30">
          <h4 className="text-green-800 text-xs font-black uppercase tracking-widest mb-1">Operational</h4>
          <p className="text-4xl font-black text-green-600">
            {vehicles.filter(v => !v.is_vor).length}
          </p>
          <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
            <CheckCircle size={12} /> Ready for assignment
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Vehicle Details</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">MOT Due</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">PMI Due</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Tacho Cal</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <Truck className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No vehicles registered in your fleet yet.</p>
                    <button onClick={() => setShowAddModal(true)} className="text-blue-600 font-bold mt-2 hover:underline">
                      Add your first vehicle
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
                      <div className="font-black text-slate-900 text-lg tracking-tight">{v.reg_number}</div>
                      <div className="text-xs text-slate-500 font-bold uppercase">{v.make} • {v.vehicle_type}</div>
                    </td>
                    <td className="p-4">
                      {v.is_vor ? (
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 w-fit uppercase border border-red-200">
                          <AlertTriangle size={10} /> VOR
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black w-fit uppercase border border-green-200">ACTIVE</span>
                      )}
                    </td>
                    <td className={`p-4 text-sm font-mono ${getStatusColor(v.mot_due_date)}`}>{v.mot_due_date || '-'}</td>
                    <td className={`p-4 text-sm font-mono ${getStatusColor(v.pmi_due_date)}`}>{v.pmi_due_date || '-'}</td>
                    <td className={`p-4 text-sm font-mono ${getStatusColor(v.tacho_calibration_due)}`}>{v.tacho_calibration_due || '-'}</td>
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

function AddVehicleModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('vehicles')
        .insert({
          ...formData,
          company_id: profile!.company_id,
          reg_number: formData.reg_number.toUpperCase().trim()
        });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error adding vehicle:', error);
      alert('Error adding vehicle. Make sure the Registration is unique.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Truck className="text-blue-600" /> Add New Fleet Vehicle
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Identity */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b pb-1">Vehicle Identity</h3>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Registration Number *</label>
                <input
                  required
                  type="text"
                  placeholder="E.G. AB12 CDE"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 uppercase font-mono font-bold"
                  value={formData.reg_number}
                  onChange={e => setFormData({...formData, reg_number: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Make *</label>
                  <input required type="text" placeholder="Scania" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Model</label>
                  <input type="text" placeholder="R450" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vehicle Type *</label>
                <select
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  value={formData.vehicle_type}
                  onChange={e => setFormData({...formData, vehicle_type: e.target.value})}
                >
                  <option value="Van">Van</option>
                  <option value="7.5t">7.5t Truck</option>
                  <option value="Class 2">Class 2 (Rigid)</option>
                  <option value="Class 1">Class 1 (Artic)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">VIN Number</label>
                <input type="text" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono" value={formData.vin_number} onChange={e => setFormData({...formData, vin_number: e.target.value})} />
              </div>
            </div>

            {/* Compliance */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest border-b pb-1">Compliance Dates</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">MOT Due</label>
                  <input type="date" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={formData.mot_due_date} onChange={e => setFormData({...formData, mot_due_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Next PMI</label>
                  <input type="date" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={formData.pmi_due_date} onChange={e => setFormData({...formData, pmi_due_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tacho Cal Due</label>
                  <input type="date" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={formData.tacho_calibration_due} onChange={e => setFormData({...formData, tacho_calibration_due: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Odo</label>
                  <input type="number" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500" value={formData.current_odometer} onChange={e => setFormData({...formData, current_odometer: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                <Shield className="text-blue-600 mt-1" size={16} />
                <p className="text-[10px] text-blue-700 font-medium">
                  Setting these dates will enable automatic reminders and the traffic-light compliance board.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50">
              {loading ? 'Adding...' : 'Register Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
