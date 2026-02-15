import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanyCompliance } from '../../hooks/useCompanyCompliance';
import { VIOLATION_DETAILS } from '../../lib/compliance';
import { Activity, Users, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react'; // Changed: Added Users

const getScoreColor = (score: number): { text: string; bg: string; } => {
  if (score >= 90) return { text: 'text-green-700', bg: 'bg-green-500' };
  if (score >= 70) return { text: 'text-amber-700', bg: 'bg-amber-500' };
  return { text: 'text-red-700', bg: 'bg-red-500' };
};

export function ComplianceScoreboard() {
  const { profile } = useAuth();
  const { complianceSummary, loading } = useCompanyCompliance(profile?.company_id, 7); // Fetch data for the last 7 days

  const overallStats = React.useMemo(() => {
    const totalDrivers = complianceSummary.length;
    if (totalDrivers === 0) return { avgScore: 100, totalViolations: 0, driversInViolation: 0 };

    const totalScore = complianceSummary.reduce((sum, driver) => sum + driver.averageScore, 0);
    const totalViolations = complianceSummary.reduce((sum, driver) => sum + driver.totalViolations, 0);
    const driversInViolation = complianceSummary.filter(d => d.averageScore < 90).length;

    return {
      avgScore: Math.round(totalScore / totalDrivers),
      totalViolations,
      driversInViolation,
    };
  }, [complianceSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Compliance Scoreboard</h2>
          <p className="text-gray-600">Driver compliance summary for the last 7 days.</p>
        </div>
      </div>
      
      {/* Overall Stats */}
      <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 border">
            <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                <span className={`text-3xl font-bold ${getScoreColor(overallStats.avgScore).text}`}>{overallStats.avgScore}%</span>
            </div>
            <p className="font-medium text-gray-800">Fleet Average Score</p>
          </div>
           <div className="bg-white rounded-xl p-6 border">
            <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <span className="text-3xl font-bold text-red-800">{overallStats.totalViolations}</span>
            </div>
            <p className="font-medium text-gray-800">Total Infringements</p>
          </div>
          <div className="bg-white rounded-xl p-6 border">
            <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-amber-600" />
                <span className="text-3xl font-bold text-amber-800">{overallStats.driversInViolation}</span>
            </div>
            <p className="font-medium text-gray-800">Drivers with Violations</p>
          </div>
      </div>

      {/* Driver List */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Driver Compliance Details</h3>
        {complianceSummary.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No active drivers with recent data</h3>
            <p className="text-gray-600">Invite drivers to see their compliance scores here.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-4 font-semibold">Driver</th>
                <th className="p-4 font-semibold">Compliance Score</th>
                <th className="p-4 font-semibold">Infringements (Last 7 Days)</th>
              </tr>
            </thead>
            <tbody>
              {complianceSummary.map((driver) => {
                  const scoreColors = getScoreColor(driver.averageScore);
                  return (
                    <tr key={driver.driverId} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-medium">{driver.driverName}</td>
                        <td className="p-4">
                            <div className="flex items-center gap-3">
                                <span className={`font-bold text-lg ${scoreColors.text}`}>{driver.averageScore}%</span>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div className={`${scoreColors.bg} h-2.5 rounded-full`} style={{ width: `${driver.averageScore}%` }}></div>
                                </div>
                            </div>
                        </td>
                        <td className="p-4">
                            <span className={`font-bold ${driver.totalViolations > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                {driver.totalViolations}
                            </span>
                        </td>
                    </tr>
                  )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
