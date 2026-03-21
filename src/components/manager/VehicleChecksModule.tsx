import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Search, Calendar, AlertTriangle, CheckCircle, ChevronRight, FileText, Truck, Gauge } from 'lucide-react';
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

export function VehicleChecksModule() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [checks, setChecks] = useState<VehicleCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCheck, setSelectedCheck] = useState<VehicleCheck | null>(null);

  useEffect(() => {
    if (profile?.company_id) {
      loadVehicleChecks();
    }
  }, [profile]);

  const loadVehicleChecks = async () => {
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
    } catch (error) {
      console.error('Error loading vehicle checks:', error);
    } finally {
      setLoading(false);
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
              className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                      <p className="font-semibold text-gray-900">{check.profiles.full_name}</p>
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
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
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
                  <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="text-amber-800 font-bold flex items-center gap-2 mb-2">
                      <AlertTriangle size={20} />
                      {t('vehicleChecklist.manager.details.defectsTitle')}
                    </h4>
                    <p className="text-amber-900 whitespace-pre-wrap">{selectedCheck.defect_details || t('vehicleChecklist.manager.details.noDefects')}</p>
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
