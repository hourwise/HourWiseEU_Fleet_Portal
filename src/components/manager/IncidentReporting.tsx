import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle,
  Search,
  Plus,
  Filter,
  Calendar,
  MapPin,
  User,
  Truck,
  ChevronRight,
  LifeBuoy,
  ShieldAlert,
  Clock,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera
} from 'lucide-react';
import { format } from 'date-fns';

interface Incident {
  id: string;
  type: 'accident' | 'incident' | 'injury';
  occurred_at: string;
  location: string;
  description: string;
  has_injury: boolean;
  status: 'reported' | 'investigating' | 'closed';
  vehicle_id: string | null;
  driver_id: string;
  police_ref: string | null;
  profiles: {
    full_name: string;
  };
  vehicles: {
    reg_number: string;
  } | null;
}

export function IncidentReporting() {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, [profile?.company_id]);

  async function fetchIncidents() {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          profiles:driver_id(full_name),
          vehicles:vehicle_id(reg_number)
        `)
        .eq('company_id', profile.company_id)
        .order('occurred_at', { ascending: false });

      if (error) throw error;
      setIncidents(data || []);
    } catch (err) {
      console.error('Error fetching incidents:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch =
      incident.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === 'all' || incident.type === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-red-500" />
            Incidents & Injury Reporting
          </h2>
          <p className="text-slate-400 text-sm font-medium">Compliance audit trail for insurance and O-Licence defense.</p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-900/20"
        >
          <Plus size={18} />
          Report New Incident
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-brand-card border border-brand-border p-5 rounded-2xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Reported</p>
          <p className="text-2xl font-black text-white">{incidents.length}</p>
        </div>
        <div className="bg-brand-card border border-brand-border p-5 rounded-2xl">
          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Open Cases</p>
          <p className="text-2xl font-black text-white">{incidents.filter(i => i.status !== 'closed').length}</p>
        </div>
        <div className="bg-brand-card border border-brand-border p-5 rounded-2xl">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Injuries</p>
          <p className="text-2xl font-black text-white">{incidents.filter(i => i.has_injury).length}</p>
        </div>
        <div className="bg-brand-card border border-brand-border p-5 rounded-2xl">
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">This Month</p>
          <p className="text-2xl font-black text-white">
            {incidents.filter(i => {
              const d = new Date(i.occurred_at);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search by driver, location or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-brand-dark border border-brand-border rounded-xl py-3 pl-12 pr-4 text-sm focus:border-brand-accent transition outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm font-bold focus:border-brand-accent outline-none"
          >
            <option value="all">All Types</option>
            <option value="accident">Accidents</option>
            <option value="incident">Incidents</option>
            <option value="injury">Injuries</option>
          </select>
          <button className="p-3 bg-brand-card border border-brand-border rounded-xl text-slate-400 hover:text-white transition">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Incident List */}
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mx-auto mb-4" />
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Loading records...</p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-brand-dark rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-border">
              <CheckCircle2 className="text-slate-600" size={32} />
            </div>
            <h3 className="text-white font-bold mb-1">No incidents found</h3>
            <p className="text-slate-500 text-sm">All clear! No safety issues have been reported recently.</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {filteredIncidents.map((incident) => (
              <div key={incident.id} className="p-5 hover:bg-brand-dark/50 transition cursor-pointer group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 p-2 rounded-lg ${
                      incident.type === 'accident' ? 'bg-red-500/10 text-red-500' :
                      incident.type === 'injury' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-blue-500/10 text-blue-500'
                    }`}>
                      {incident.type === 'accident' ? <AlertTriangle size={20} /> :
                       incident.type === 'injury' ? <LifeBuoy size={20} /> :
                       <ShieldAlert size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                          incident.status === 'closed' ? 'bg-green-500/20 text-green-500' :
                          incident.status === 'investigating' ? 'bg-blue-500/20 text-blue-500' :
                          'bg-red-500/20 text-red-500'
                        }`}>
                          {incident.status}
                        </span>
                        <span className="text-slate-500 text-xs font-bold">
                          {format(new Date(incident.occurred_at), 'PPP p')}
                        </span>
                      </div>
                      <h4 className="text-white font-bold group-hover:text-brand-accent transition">{incident.description.substring(0, 100)}...</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase">
                          <User size={14} className="text-slate-600" />
                          {incident.profiles.full_name}
                        </div>
                        {incident.vehicles && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase">
                            <Truck size={14} className="text-slate-600" />
                            {incident.vehicles.reg_number}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase">
                          <MapPin size={14} className="text-slate-600" />
                          {incident.location}
                        </div>
                        {incident.has_injury && (
                          <div className="flex items-center gap-1.5 text-red-400 text-[11px] font-black uppercase">
                            <AlertCircle size={14} />
                            Injury Reported
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-600 hover:text-white transition">
                      <MoreVertical size={20} />
                    </button>
                    <ChevronRight className="text-slate-700 group-hover:text-brand-accent transition" size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          onSuccess={() => {
            setShowReportModal(false);
            fetchIncidents();
          }}
        />
      )}
    </div>
  );
}

function ReportModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    type: 'accident',
    occurred_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    location: '',
    description: '',
    driver_id: '',
    vehicle_id: '',
    has_injury: false,
    injury_details: '',
    is_third_party_involved: false,
    police_ref: '',
    status: 'reported'
  });

  useEffect(() => {
    async function loadData() {
      if (!profile?.company_id) return;

      const [vRes, dRes] = await Promise.all([
        supabase.from('vehicles').select('id, reg_number').eq('company_id', profile.company_id),
        supabase.from('profiles').select('id, full_name').eq('company_id', profile.company_id)
      ]);

      setVehicles(vRes.data || []);
      setDrivers(dRes.data || []);
    }
    loadData();
  }, [profile?.company_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('incidents').insert({
        ...formData,
        company_id: profile.company_id,
        vehicle_id: formData.vehicle_id || null,
        occurred_at: new Date(formData.occurred_at).toISOString()
      });

      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      alert('Error reporting incident: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-brand-card border border-brand-border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-brand-border flex items-center justify-between">
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Report Incident / Injury</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Report Type</label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm font-bold focus:border-brand-accent outline-none appearance-none"
              >
                <option value="accident">Accident (Vehicle)</option>
                <option value="incident">Minor Incident</option>
                <option value="injury">Workplace Injury</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Date & Time</label>
              <input
                type="datetime-local"
                required
                value={formData.occurred_at}
                onChange={(e) => setFormData({...formData, occurred_at: e.target.value})}
                className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm font-bold focus:border-brand-accent outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Driver Involved</label>
              <select
                required
                value={formData.driver_id}
                onChange={(e) => setFormData({...formData, driver_id: e.target.value})}
                className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm font-bold focus:border-brand-accent outline-none"
              >
                <option value="">Select Driver</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Vehicle (Optional)</label>
              <select
                value={formData.vehicle_id}
                onChange={(e) => setFormData({...formData, vehicle_id: e.target.value})}
                className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm font-bold focus:border-brand-accent outline-none"
              >
                <option value="">N/A</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.reg_number}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Location</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-3.5 text-slate-600" size={16} />
              <input
                type="text"
                required
                placeholder="e.g. Depot Yard, M6 J12 Southbound..."
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="w-full bg-brand-dark border border-brand-border rounded-xl py-3 pl-12 pr-4 text-sm font-bold focus:border-brand-accent outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Detailed Description</label>
            <textarea
              required
              rows={4}
              placeholder="Provide a clear account of what happened..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm font-bold focus:border-brand-accent outline-none resize-none"
            />
          </div>

          <div className="flex flex-col gap-4 bg-brand-dark/50 p-4 rounded-xl border border-brand-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                  <LifeBuoy size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-widest">Injury Sustained?</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Must be recorded for RIDDOR compliance</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.has_injury}
                  onChange={(e) => setFormData({...formData, has_injury: e.target.checked})}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {formData.has_injury && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <textarea
                  placeholder="Details of injuries and treatment given..."
                  value={formData.injury_details}
                  onChange={(e) => setFormData({...formData, injury_details: e.target.value})}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm font-bold focus:border-brand-accent outline-none resize-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between bg-brand-dark/50 p-4 rounded-xl border border-brand-border">
              <span className="text-xs font-black text-white uppercase tracking-widest">Third Party?</span>
              <input
                type="checkbox"
                checked={formData.is_third_party_involved}
                onChange={(e) => setFormData({...formData, is_third_party_involved: e.target.checked})}
                className="w-5 h-5 rounded border-brand-border bg-brand-dark text-brand-accent focus:ring-brand-accent"
              />
            </div>
            <div className="space-y-1">
              <input
                type="text"
                placeholder="Police Ref (Optional)"
                value={formData.police_ref}
                onChange={(e) => setFormData({...formData, police_ref: e.target.value})}
                className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm font-bold focus:border-brand-accent outline-none"
              />
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-brand-border bg-brand-dark/20 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-6 border border-brand-border rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-brand-card transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition shadow-lg shadow-red-900/20 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Log Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
