import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, AlertCircle, Download, Calendar, User, MapPin } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type DriverLog = Database['public']['Tables']['driver_logs']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface InfractionWithDriver extends DriverLog {
  driver: Profile;
}

export function InfractionReport() {
  const { profile } = useAuth();
  const [infractions, setInfractions] = useState<InfractionWithDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'violation' | 'warning'>('all');

  useEffect(() => {
    if (profile?.company_id) {
      loadInfractions();
    }
  }, [profile]);

  const loadInfractions = async () => {
    try {
      const { data: logs, error: logsError } = await supabase
        .from('driver_logs')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .in('status_code', ['warning', 'violation'])
        .order('start_time', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      const driverIds = [...new Set(logs?.map((log) => log.driver_id) || [])];

      const { data: drivers, error: driversError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', driverIds);

      if (driversError) throw driversError;

      const driverMap = new Map(drivers?.map((d) => [d.id, d]) || []);

      const infractionsWithDrivers: InfractionWithDriver[] = (logs || []).map((log) => ({
        ...log,
        driver: driverMap.get(log.driver_id)!,
      }));

      setInfractions(infractionsWithDrivers);
    } catch (error) {
      console.error('Error loading infractions:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    const filtered = filter === 'all' ? infractions : infractions.filter((i) => i.status_code === filter);

    const csv = [
      ['Date', 'Driver', 'Activity', 'Status', 'Infraction Type', 'Duration (min)', 'Location Start', 'Notes'].join(','),
      ...filtered.map((inf) =>
        [
          new Date(inf.start_time).toLocaleString(),
          inf.driver.full_name,
          inf.activity_type,
          inf.status_code,
          inf.infraction_type || 'N/A',
          inf.duration_minutes || 'N/A',
          inf.location_start || 'N/A',
          inf.notes || 'N/A',
        ]
          .map((field) => `"${field}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `infraction-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredInfractions = filter === 'all'
    ? infractions
    : infractions.filter((i) => i.status_code === filter);

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
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Infraction Reports</h2>
            <p className="text-gray-600">Track and analyze compliance issues</p>
          </div>
        </div>

        <button
          onClick={exportReport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({infractions.length})
          </button>
          <button
            onClick={() => setFilter('violation')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'violation'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Violations ({infractions.filter((i) => i.status_code === 'violation').length})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'warning'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Warnings ({infractions.filter((i) => i.status_code === 'warning').length})
          </button>
        </div>

        {filteredInfractions.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No infractions found</h3>
            <p className="text-gray-600">Your fleet is maintaining excellent compliance</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInfractions.map((infraction) => (
              <div
                key={infraction.id}
                className={`border-2 rounded-lg p-4 ${
                  infraction.status_code === 'violation'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle
                      className={`w-6 h-6 ${
                        infraction.status_code === 'violation' ? 'text-red-600' : 'text-yellow-600'
                      }`}
                    />
                    <div>
                      <h4 className="font-bold text-gray-900">
                        {infraction.infraction_type || 'Compliance Issue'}
                      </h4>
                      <p className="text-sm text-gray-600 capitalize">{infraction.activity_type} Activity</p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      infraction.status_code === 'violation'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {infraction.status_code.toUpperCase()}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <div>
                      <span className="text-gray-600 block text-xs">Driver</span>
                      <span className="font-medium text-gray-900">{infraction.driver.full_name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <div>
                      <span className="text-gray-600 block text-xs">Date & Time</span>
                      <span className="font-medium text-gray-900">
                        {new Date(infraction.start_time).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <div>
                      <span className="text-gray-600 block text-xs">Location</span>
                      <span className="font-medium text-gray-900">
                        {infraction.location_start || 'Not recorded'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-600 block text-xs">Duration</span>
                    <span className="font-medium text-gray-900">
                      {infraction.duration_minutes ? `${infraction.duration_minutes} min` : 'Ongoing'}
                    </span>
                  </div>
                </div>

                {infraction.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <span className="text-xs font-medium text-gray-500">Notes:</span>
                    <p className="text-sm text-gray-700 mt-1">{infraction.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
