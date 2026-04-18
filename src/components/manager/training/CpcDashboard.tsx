import { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { Database } from '../../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

function getDqcStatus(driver: Profile) {
  const expiry = driver.cpc_dqc_expiry ? new Date(driver.cpc_dqc_expiry) : null;
  const daysToExpiry = expiry
    ? Math.ceil((expiry.getTime() - Date.now()) / 86_400_000)
    : null;

  if (!expiry || daysToExpiry === null || daysToExpiry < 0) {
    return { daysToExpiry, colour: 'red' as const, label: 'Expired / No DQC' };
  }
  if (daysToExpiry < 90) {
    return { daysToExpiry, colour: 'red' as const, label: 'Expires Soon' };
  }
  if (daysToExpiry < 180) {
    return { daysToExpiry, colour: 'amber' as const, label: 'Renew Soon' };
  }
  return { daysToExpiry, colour: 'green' as const, label: 'Valid' };
}

interface CpcDashboardProps {
  drivers: Profile[];
}

export function CpcDashboard({ drivers }: CpcDashboardProps) {
  const [search, setSearch] = useState('');

  const activeDrivers = drivers.filter(d => d.role === 'driver' && d.is_active);
  const allStatuses = activeDrivers.map(d => getDqcStatus(d));
  const redCount   = allStatuses.filter(s => s.colour === 'red').length;
  const amberCount = allStatuses.filter(s => s.colour === 'amber').length;
  const greenCount = allStatuses.filter(s => s.colour === 'green').length;

  const filtered = activeDrivers.filter(d =>
    !search || (d.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'DQC Valid',      count: greenCount, colour: 'emerald', Icon: CheckCircle },
          { label: 'Renew Soon',     count: amberCount, colour: 'amber',   Icon: Clock },
          { label: 'Expired / None', count: redCount,   colour: 'red',     Icon: AlertTriangle },
        ].map(({ label, count, colour, Icon }) => (
          <div key={label} className={`bg-${colour}-50 border border-${colour}-100 rounded-xl p-4 flex items-center gap-3`}>
            <Icon className={`w-6 h-6 text-${colour}-500`} />
            <div>
              <p className={`text-2xl font-black text-${colour}-700`}>{count}</p>
              <p className={`text-xs font-bold text-${colour}-600 uppercase tracking-widest`}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search drivers…"
        className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
      />

      {/* Per-driver cards */}
      <div className="space-y-3">
        {activeDrivers.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-12">No active drivers found.</p>
        )}
        {filtered.map(driver => {
          const { daysToExpiry, colour, label } = getDqcStatus(driver);

          const badgeCls = colour === 'green'
            ? 'bg-emerald-100 text-emerald-700'
            : colour === 'amber'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700';

          const expiryColour = colour === 'red'
            ? 'text-red-600'
            : colour === 'amber'
            ? 'text-amber-600'
            : 'text-emerald-600';

          return (
            <div key={driver.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-900 truncate">{driver.full_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  DQC: <span className="font-semibold text-slate-600">{driver.cpc_dqc_number ?? '—'}</span>
                  {driver.cpc_dqc_expiry && (
                    <span className="ml-3">
                      Expires: {new Date(driver.cpc_dqc_expiry).toLocaleDateString()}
                      {daysToExpiry !== null && (
                        <span className={`ml-1 font-bold ${expiryColour}`}>
                          ({daysToExpiry > 0 ? `${daysToExpiry}d remaining` : 'EXPIRED'})
                        </span>
                      )}
                    </span>
                  )}
                </p>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap ${badgeCls}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 text-center pt-2">
        DQC details are entered during driver onboarding and can be updated from the driver's profile in Driver Management.
      </p>
    </div>
  );
}
