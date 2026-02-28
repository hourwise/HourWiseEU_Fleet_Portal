// src/components/manager/DriverDetailsModal.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { X, Save, Upload, Paperclip, Trash2, AlertTriangle, CheckCircle, Edit, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ShiftEditModal } from './ShiftEditModal';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Document = Database['public']['Tables']['driver_documents']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];

// ... (Helper functions remain the same) ...

// New component for the location analysis heatmap
const LocationAnalysisMap = ({ driverId }: { driverId: string }) => {
  const [locations, setLocations] = useState<{ lat: number, lng: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocationHistory = async () => {
      setLoading(true);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('work_sessions')
        .select('start_lat, start_lng')
        .eq('user_id', driverId)
        .gte('start_time', thirtyDaysAgo)
        .not('start_lat', 'is', null)
        .not('start_lng', 'is', null);

      if (error) {
        console.error("Error fetching location history:", error);
      } else {
        setLocations(data.map(loc => ({ lat: loc.start_lat!, lng: loc.start_lng! })));
      }
      setLoading(false);
    };

    fetchLocationHistory();
  }, [driverId]);

  const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!accessToken) return <p className="text-sm text-red-500">Mapbox token not configured.</p>;

  if (loading) return <div className="text-center p-8">Loading location data...</div>;
  if (locations.length === 0) return <p className="text-sm text-gray-500">No start location data recorded in the last 30 days.</p>;

  // Create markers for the Mapbox API (up to 100)
  const markers = locations
    .slice(0, 100)
    .map((loc, index) => `pin-s-${index + 1}+0074D9(${loc.lng},${loc.lat})`)
    .join(',');

  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${markers}/auto/800x400@2x?access_token=${accessToken}`;

  return <img src={mapUrl} alt="Map of recent start locations" className="rounded-lg shadow-md w-full" />;
};


export function DriverDetailsModal({ driver, onClose, onSave }: DriverDetailsModalProps) {
  // ... (All existing state and functions remain the same) ...
  const [editingShift, setEditingShift] = useState<WorkSession | null>(null);

  // ...

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* ... Modal Header ... */}

          <div className="p-6 space-y-6 overflow-y-auto">
            {/* ... Compliance, Documents, and Recent Shifts sections ... */}

            {/* NEW: Location Analysis Section */}
            <div className="border-b pb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Location Analysis (Last 30 Days)
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-4">This map shows a "heatmap" of the driver's shift start locations over the past 30 days. Clusters of pins indicate frequent start points.</p>
                <LocationAnalysisMap driverId={driver.id} />
              </div>
            </div>

            {/* ... Payroll & Personal Information section ... */}
          </div>

          <div className="flex justify-end items-center p-6 border-t bg-gray-50">
            {/* ... Save Changes button ... */}
          </div>
        </div>
      </div>

      {editingShift && (
        <ShiftEditModal
          shift={editingShift}
          onClose={() => setEditingShift(null)}
          onSave={() => {
            setEditingShift(null);
            // You might want to refresh shifts here: fetchRecentShifts();
          }}
        />
      )}
    </>
  );
}
