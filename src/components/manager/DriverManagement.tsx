import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Search, UserCheck, Mail, Clock, UserPlus, Trash2, Edit, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import { InviteDriverModal } from './InviteDriverModal';
import { DriverDetailsModal } from './DriverDetailsModal';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Invite = Database['public']['Tables']['driver_invites']['Row'];
type Document = Database['public']['Tables']['driver_documents']['Row'];

const getDriverComplianceStatus = (driverId: string, allDocuments: Document[]) => {
  const driverDocs = allDocuments.filter(doc => doc.user_id === driverId);
  if (driverDocs.length === 0) {
    return { level: 'amber', text: 'No Documents', Icon: AlertTriangle, color: 'text-amber-600' };
  }

  let mostUrgentStatus = { level: 'green', daysDiff: Infinity };

  for (const doc of driverDocs) {
    if (!doc.expiry_date) {
      if (mostUrgentStatus.level !== 'red') {
        mostUrgentStatus = { level: 'amber', daysDiff: 999 };
      }
      continue;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(doc.expiry_date);
    const timeDiff = expiry.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      return { level: 'red', text: 'Document Expired', Icon: AlertTriangle, color: 'text-red-600' };
    }
    if (daysDiff <= 30 && daysDiff < mostUrgentStatus.daysDiff) {
      mostUrgentStatus = { level: 'amber', daysDiff };
    }
  }

  if (mostUrgentStatus.level === 'amber') {
    return {
      level: 'amber',
      text: mostUrgentStatus.daysDiff === 999 ? 'Check Expiry' : `Expires in ${mostUrgentStatus.daysDiff} days`,
      Icon: AlertTriangle,
      color: 'text-amber-600'
    };
  }

  return { level: 'green', text: 'Compliant', Icon: CheckCircle, color: 'text-green-600' };
};

export function DriverManagement() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingDriverId, setRemovingDriverId] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Profile | null>(null);

  const loadData = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      // More inclusive query: get ANYONE in this company who isn't a manager
      const { data: driversData, error: driversError } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .neq('role', 'manager');

      const { data: invitesData, error: invitesError } = await supabase
        .from('driver_invites')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'pending');

      const { data: documentsData, error: documentsError } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('company_id', profile.company_id);

      if (driversError) throw driversError;
      if (invitesError) throw invitesError;
      if (documentsError) throw documentsError;

      setDrivers(driversData || []);
      setInvites(invitesData || []);
      setDocuments(documentsData || []);
    } catch (error) {
      console.error('Error loading driver data:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemoveDriver = async (driverId: string, driverName: string) => {
    if (window.confirm(`Are you sure you want to remove ${driverName}? This will permanently delete their account and data.`)) {
      setRemovingDriverId(driverId);
      try {
        const { error } = await supabase.functions.invoke('remove-driver', { body: { driverId } });
        if (error) throw new Error(`Failed to remove driver: ${error.message}`);
        await loadData();
      } catch (error) {
        console.error('Removal error:', error);
        alert((error as Error).message);
      } finally {
        setRemovingDriverId(null);
      }
    }
  };

  const combinedList = useMemo(() => {
    const list = [
      ...drivers.map(d => ({ ...d, type: 'driver' as const, compliance: getDriverComplianceStatus(d.id, documents) })),
      ...invites.map(i => ({ ...i, type: 'invite' as const }))
    ];

    return list.filter(item => {
      const name = item.full_name || '';
      const email = item.email || '';
      const query = searchQuery.toLowerCase();
      return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
    });
  }, [drivers, invites, documents, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Driver Management</h2>
            <p className="text-gray-600">{drivers.length} active drivers, {invites.length} pending invites</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadData()}
            className="p-2 text-slate-400 hover:text-blue-600 transition"
            title="Refresh List"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold"
          >
            <UserPlus className="w-5 h-5" />
            Invite Driver
          </button>
        </div>
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
              className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white font-medium"
            />
          </div>
        </div>

        {loading && combinedList.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <Clock className="animate-spin text-blue-600" />
            <p className="text-slate-500 font-medium">Syncing driver roster...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {combinedList.length === 0 ? (
                <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers or invites found</h3>
                    <p className="text-gray-600">Click "Invite Driver" to get started or refresh the list.</p>
                </div>
            ) : combinedList.map((item) => (
              <div key={item.id} className={`flex items-center justify-between p-4 border rounded-xl transition ${item.type === 'driver' ? 'border-gray-200 hover:border-blue-300 bg-white shadow-sm' : 'border-amber-200 bg-amber-50/50'}`}>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 items-center gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Name</label>
                    <p className="font-bold text-slate-900">{item.full_name || 'Incomplete Setup'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <p className="text-sm text-slate-600 font-medium">{item.email}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Compliance</label>
                    {item.type === 'driver' ? (
                      <div className={`flex items-center gap-2 font-black text-[10px] uppercase ${item.compliance.color}`}>
                        <item.compliance.Icon className="w-4 h-4" />
                        <span>{item.compliance.text}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-medium">-</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                    <div className="flex items-center gap-2">
                      {item.type === 'driver' ? (
                        <><UserCheck className="w-4 h-4 text-green-500" /><p className="text-[10px] font-black text-green-700 uppercase">Active</p></>
                      ) : (
                        <><Clock className="w-4 h-4 text-amber-500" /><p className="text-[10px] font-black text-amber-700 uppercase tracking-tighter">Invite Pending</p></>
                      )}
                    </div>
                  </div>
                </div>
                {item.type === 'driver' && (
                  <div className="ml-4 flex gap-2">
                    <button onClick={() => setSelectedDriver(item as Profile)} className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition tracking-widest">
                      <Edit className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                    <button onClick={() => handleRemoveDriver(item.id, item.full_name ?? 'this driver')} disabled={removingDriverId === item.id} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 transition border border-red-100">
                      {removingDriverId === item.id ? <Clock className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showInviteModal && (<InviteDriverModal onClose={() => setShowInviteModal(false)} onInviteSent={loadData} />)}
      {selectedDriver && (<DriverDetailsModal driver={selectedDriver} onClose={() => setSelectedDriver(null)} onSave={() => { setSelectedDriver(null); loadData(); }} />)}
    </div>
  );
}
