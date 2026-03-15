import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, Search, UserCheck, UserX, Mail, Edit, X, Save, Clock } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function SupervisorManagement() {
  const { profile } = useAuth();
  const [supervisors, setSupervisors] = useState<Profile[]>([]);
  const [filteredSupervisors, setFilteredSupervisors] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState<Profile | null>(null);

  const loadSupervisors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .eq('role', 'manager')
        .neq('id', profile!.id) // Exclude self
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSupervisors(data || []);
    } catch (error) {
      console.error('Error loading supervisors:', error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.company_id) {
      loadSupervisors();
    }
  }, [profile, loadSupervisors]);

  useEffect(() => {
    let filtered = [...supervisors];
    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) =>
        statusFilter === 'active' ? s.is_active : !s.is_active
      );
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.full_name.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query)
      );
    }
    setFilteredSupervisors(filtered);
  }, [supervisors, searchQuery, statusFilter]);

  const toggleSupervisorStatus = async (supervisorId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', supervisorId);

      if (error) throw error;
      await loadSupervisors();
    } catch (error) {
      console.error('Error updating supervisor status:', error);
    }
  };

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
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Supervisor Management</h2>
            <p className="text-gray-600">{supervisors.length} total supervisors</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700 font-medium">
          Note: Supervisors join using your company auth code. This section allows you to manage their status and profile details.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>

          <div className="flex gap-2">
            {(['all', 'active', 'inactive'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition ${
                  statusFilter === filter
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredSupervisors.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No supervisors found</h3>
            </div>
          ) : (
            filteredSupervisors.map((supervisor) => (
              <div
                key={supervisor.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 bg-white transition shadow-sm"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Supervisor</label>
                    <p className="font-bold text-slate-900">{supervisor.full_name}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <p className="text-sm text-slate-600 font-medium">{supervisor.email}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                    <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      supervisor.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {supervisor.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setSelectedSupervisor(supervisor)}
                    className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg transition border border-transparent hover:border-blue-100"
                    title="Edit Details"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleSupervisorStatus(supervisor.id, supervisor.is_active)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition ${
                      supervisor.is_active
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-red-50 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    {supervisor.is_active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                    <span>{supervisor.is_active ? 'Active' : 'Inactive'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedSupervisor && (
        <SupervisorDetailsModal
          supervisor={selectedSupervisor}
          onClose={() => setSelectedSupervisor(null)}
          onSave={() => {
            setSelectedSupervisor(null);
            loadSupervisors();
          }}
        />
      )}
    </div>
  );
}

function SupervisorDetailsModal({ supervisor, onClose, onSave }: { supervisor: Profile, onClose: () => void, onSave: () => void }) {
  const [formData, setFormData] = useState({
    full_name: supervisor.full_name,
    phone_number: supervisor.phone_number || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', supervisor.id);

      if (error) throw error;
      onSave();
    } catch (error) {
      console.error('Error updating supervisor:', error);
      alert('Failed to update supervisor details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Shield className="text-blue-600" size={20} /> Supervisor Details
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Full Name</label>
            <input
              required
              type="text"
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white font-bold"
              value={formData.full_name}
              onChange={e => setFormData({...formData, full_name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Email (Read-only)</label>
            <input
              type="email"
              disabled
              className="w-full p-3 border border-slate-100 rounded-xl bg-slate-50 text-slate-400 font-medium cursor-not-allowed"
              value={supervisor.email}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Phone Number</label>
            <input
              type="tel"
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white font-bold"
              value={formData.phone_number}
              onChange={e => setFormData({...formData, phone_number: e.target.value})}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl font-black text-slate-400 hover:bg-slate-50 transition uppercase tracking-widest text-[10px]">Cancel</button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition disabled:opacity-50 shadow-lg shadow-blue-200 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
            >
              {loading ? <Clock className="animate-spin w-4 h-4" /> : <Save size={16} />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
