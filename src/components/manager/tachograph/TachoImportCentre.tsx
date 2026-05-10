import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, CreditCard, FileUp, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { useTachoImports } from '../../../hooks/useTachoImports';

export function TachoImportCentre() {
  const { data, loading, error } = useTachoImports();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tacho Import Centre</p>
            <h2 className="text-3xl font-black text-slate-900 mt-1">Import Driver Cards And VU Files</h2>
            <p className="text-sm text-slate-500 mt-2">
              This first sprint keeps the browser upload flow and exposes parser states, duplicates, and processing history in one place.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition shadow-sm shadow-blue-200">
            <FileUp size={16} />
            Upload Files
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Processing Now" value={loading ? '...' : String(data.filter((item) => item.status === 'processing').length)} tone="warning" />
        <StatCard label="Completed Today" value={loading ? '...' : String(data.filter((item) => item.status === 'complete').length)} tone="good" />
        <StatCard label="Failed Imports" value={loading ? '...' : String(data.filter((item) => item.status === 'failed').length)} tone="danger" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent Imports</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading import queue...</div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">{error}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((item) => (
              <div key={item.id} className="p-6 hover:bg-slate-50 transition">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${item.sourceType === 'driver_card' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                      {item.sourceType === 'driver_card' ? <CreditCard className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-sm font-black text-slate-900">{item.fileName}</p>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusStyles(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.sourceType === 'driver_card' ? item.driverName : item.vehicleReg} • {format(new Date(item.importedAt), 'dd MMM yyyy HH:mm')}
                      </p>
                      <p className="text-sm text-slate-600 mt-2">{item.summary}</p>
                    </div>
                  </div>

                  <div className="w-full lg:w-64">
                    <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      <span>Processing</span>
                      <span>{item.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          item.status === 'failed' ? 'bg-rose-500' : item.status === 'complete' ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <InfoCard
          icon={<Clock3 className="w-5 h-5 text-blue-600" />}
          title="Processing states"
          text="The mocked queue already exposes the states the backend contract needs: uploaded, queued, processing, complete, partial, and failed."
        />
        <InfoCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          title="Driver card flow"
          text="Card-reader live progress will map onto the same import lifecycle later, so this screen can stay stable when the desktop helper lands."
        />
        <InfoCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          title="Parser diagnostics"
          text="Failed and partial imports will surface parser messages here rather than silently dropping records into the background."
        />
      </div>
    </div>
  );
}

function statusStyles(status: string) {
  if (status === 'failed') return 'bg-rose-100 text-rose-700';
  if (status === 'complete') return 'bg-emerald-100 text-emerald-700';
  if (status === 'processing') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'warning' | 'good' | 'danger' }) {
  const styles = {
    warning: 'bg-amber-50 border-amber-100 text-amber-700',
    good: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    danger: 'bg-rose-50 border-rose-100 text-rose-700',
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-3xl font-black mt-2">{value}</p>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}
