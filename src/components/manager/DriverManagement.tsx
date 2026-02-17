import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Search, UserCheck, Mail, Clock, UserPlus, Trash2, Edit } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import { InviteDriverModal } from './InviteDriverModal';
import { DriverDetailsModal } from './DriverDetailsModal'; // Import the new modal

type Profile = Database['public']['Tables']['profiles']['Row'];
type Invite = Database['public']['Tables']['driver_invites']['Row'];

export function DriverManagement() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingDriverId, setRemovingDriverId] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Profile | null>(null); // For the details modal

  useEffect(() => {
    if (profile?.company_id) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const driversPromise = supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('role', 'driver');
      
      const invitesPromise = supabase
        .from('driver_invites')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'pending');

      const [{ data: driversData, error: driversError }, { data: invitesData, error: invitesError }] = await Promise.all([driversPromise, invitesPromise]);

      if (driversError) throw driversError;
      if (invitesError) throw invitesError;
      
      setDrivers(driversData || []);
      setInvites(invitesData || []);
    } catch (error) {
      console.error('Error loading driver data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDriver = async (driverId: string, driverName: string) => {
    if (window.confirm(`Are you sure you want to remove ${driverName}? This will permanently delete their account and data.`)) {
      setRemovingDriverId(driverId);
      try {
        const { error } = await supabase.functions.invoke('remove-driver', {
          body: { driverId },
        });

        if (error) {
          throw new Error(`Failed to remove driver: ${error.message}`);
        }
        
        await loadData();

      } catch (error) {
        console.error('Removal error:', error);
        alert((error as Error).message);
      } finally {
        setRemovingDriverId(null);
      }
    }
  };

  const combinedList = [
    ...drivers.map(d => ({ ...d, type: 'driver' as const })),
    ...invites.map(i => ({ ...i, type: 'invite' as const }))
  ].filter(item => 
    item.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <UserPlus className="w-5 h-5" />
          Invite Driver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? <div className="text-center py-12">Loading...</div> : (
          <div className="space-y-3">
            {combinedList.length === 0 ? (
                <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers or invites found</h3>
                    <p className="text-gray-600">Click "Invite Driver" to get started.</p>
                </div>
            ) : combinedList.map((item) => (
              <div key={item.id} className={`flex items-center justify-between p-4 border rounded-lg ${item.type === 'driver' ? 'border-gray-200' : 'border-amber-300 bg-amber-50'}`}>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                  {/* ... Driver info columns ... */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Name</label>
                    <p className="font-semibold text-gray-900">{item.full_name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <p className="text-sm text-gray-700">{item.email}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
                    <div className="flex items-center gap-2">
                      {item.type === 'driver' ? (
                        <>
                          <UserCheck className="w-4 h-4 text-green-500" />
                          <p className="text-sm font-medium text-green-700">Active</p>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-amber-500" />
                          <p className="text-sm font-medium text-amber-700">Invite Pending</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {item.type === 'driver' && (
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => setSelectedDriver(item as Profile)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Details</span>
                    </button>
                    <button
                      onClick={() => handleRemoveDriver(item.id, item.full_name ?? 'this driver')}
                      disabled={removingDriverId === item.id}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-700 bg-red-100 rounded-lg hover:bg-red-200 disabled:bg-gray-200 disabled:text-gray-500 transition"
                    >
                      {removingDriverId === item.id ? (
                        <span>Removing...</span>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showInviteModal && (
        <InviteDriverModal
          onClose={() => setShowInviteModal(false)}
          onInviteSent={loadData}
        />
      )}
      {selectedDriver && (
        <DriverDetailsModal
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          onSave={() => {
            setSelectedDriver(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
