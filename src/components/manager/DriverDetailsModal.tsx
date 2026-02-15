import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { X, Calendar, Clock, Briefcase, Coffee } from 'lucide-react';

type Profile = Database['public']['Tables']['profiles']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];

interface DriverDetailsModalProps {
  driver: Profile;
  onClose: () => void;
}

const formatHHMM = (minutes: number) => {
  if (minutes === null || isNaN(minutes)) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-gray-300';
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
};

export function DriverDetailsModal({ driver, onClose }: DriverDetailsModalProps) {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkSessions = async () => {
      try {
        const { data, error } = await supabase
          .from('work_sessions')
          .select('*')
          .eq('user_id', driver.user_id)
          .order('date', { ascending: false })
          .limit(30); // Load last 30 sessions for performance

        if (error) throw error;
        setSessions(data || []);
      } catch (error) {
        console.error('Error loading work sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkSessions();
  }, [driver]);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{driver.full_name}</h2>
            <p className="text-gray-600">{driver.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
             <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-24">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Work History Found</h3>
                <p className="text-gray-600">This driver has not recorded any shifts yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map(session => (
                <div key={session.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-lg text-gray-800">{new Date(session.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p className="text-sm text-gray-500">
                                {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {session.end_time ? new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 text-sm font-semibold text-white rounded-full ${getScoreColor(session.compliance_score)}`}>
                                Score: {session.compliance_score ?? 'N/A'}
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-200 pt-4">
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-blue-600" />
                            <div>
                                <p className="text-xs text-gray-500">Work</p>
                                <p className="font-semibold">{formatHHMM(session.total_work_minutes)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-green-600" />
                            <div>
                                <p className="text-xs text-gray-500">Driving</p>
                                <p className="font-semibold">{formatHHMM(session.other_data?.driving || 0)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Coffee className="w-5 h-5 text-yellow-600" />
                            <div>
                                <p className="text-xs text-gray-500">Break</p>
                                <p className="font-semibold">{formatHHMM(session.total_break_minutes)}</p>
                            </div>
                        </div>
                        {session.compliance_violations && session.compliance_violations.length > 0 && (
                            <div className="col-span-2 md:col-span-4 mt-2">
                                <p className="text-xs font-semibold text-red-600 mb-1">Violations:</p>
                                <div className="flex flex-wrap gap-2">
                                    {session.compliance_violations.map((v, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">{v.split('(')[0].replace(/_/g, ' ')}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
