import { Gauge, FileUp, Activity, AlertCircle, FileSearch, Archive } from 'lucide-react';
import { HWCard } from '../ui/HWCard';
import { HWBadge } from '../ui/HWBadge';

const features = [
  { icon: FileUp, title: "Driver Card Import", desc: "Upload .DDD / .C1B files directly from the portal." },
  { icon: Activity, title: "Interactive Timelines", desc: "Visualise drive, work, and rest modes with clarity." },
  { icon: AlertCircle, title: "Infringement Logs", desc: "Quickly identify potential legal infringements." },
  { icon: Archive, title: "Audit Archive", desc: "Keep original files securely for regulatory requests." },
  { icon: FileSearch, title: "Validation Reports", desc: "Review parsed data totals against legal requirements." },
  { icon: Gauge, title: "Vehicle Unit Data", desc: "Support for vehicle unit file analysis planned soon." }
];

export function TachographSection() {
  return (
    <section className="bg-hw-navy-900 py-24 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <HWCard variant="glass" padding="none" className="overflow-hidden border-white/10 shadow-2xl">
               <div className="bg-hw-navy-950/80 px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Gauge size={14} className="text-hw-blue-600" />
                    <span className="text-[10px] font-bold text-hw-white uppercase tracking-widest">Tacho Timeline Viewer</span>
                  </div>
                  <HWBadge variant="info">v1.2 Beta</HWBadge>
               </div>
               <div className="p-6 bg-hw-navy-950 h-80 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                       <div className="h-4 w-32 bg-white/10 rounded"></div>
                       <div className="h-3 w-16 bg-white/5 rounded"></div>
                    </div>
                    {/* Timeline representation */}
                    <div className="h-12 w-full bg-hw-navy-900 rounded-lg border border-white/5 flex overflow-hidden">
                       <div className="h-full w-[20%] bg-hw-blue-600/40 border-r border-hw-blue-600/20"></div>
                       <div className="h-full w-[15%] bg-hw-cyan-500/40 border-r border-hw-cyan-500/20"></div>
                       <div className="h-full w-[35%] bg-hw-teal-500/40 border-r border-hw-teal-500/20"></div>
                       <div className="h-full w-[10%] bg-hw-blue-600/40 border-r border-hw-blue-600/20"></div>
                       <div className="h-full w-[20%] bg-hw-navy-800"></div>
                    </div>
                    <div className="flex justify-between text-[8px] font-bold text-hw-slate-500 uppercase">
                       <span>06:00</span>
                       <span>09:00</span>
                       <span>12:00</span>
                       <span>15:00</span>
                       <span>18:00</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                     <div className="p-3 bg-hw-navy-900 rounded-lg border border-white/5">
                        <div className="text-[8px] font-bold text-hw-slate-500 uppercase">Drive</div>
                        <div className="text-sm font-bold text-hw-white">04:30</div>
                     </div>
                     <div className="p-3 bg-hw-navy-900 rounded-lg border border-white/5">
                        <div className="text-[8px] font-bold text-hw-slate-500 uppercase">Work</div>
                        <div className="text-sm font-bold text-hw-white">02:15</div>
                     </div>
                     <div className="p-3 bg-hw-navy-900 rounded-lg border border-white/5 border-hw-amber-500/20">
                        <div className="text-[8px] font-bold text-hw-amber-500 uppercase">Alerts</div>
                        <div className="text-sm font-bold text-hw-white">1 Found</div>
                     </div>
                  </div>
               </div>
            </HWCard>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="text-sm font-bold text-hw-blue-600 uppercase tracking-[0.3em] mb-4">Analysis Tools</h2>
            <h3 className="text-3xl lg:text-5xl font-bold text-hw-white mb-6">
              Tachograph files made easier to understand.
            </h3>
            <p className="text-lg text-hw-slate-400 mb-10 leading-relaxed">
              Upload driver card and vehicle unit data to view clear timelines, review legal totals, and keep your fleet audit-ready.
            </p>

            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
              {features.map((f, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className="mt-1">
                    <f.icon size={18} className="text-hw-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-hw-white mb-1">{f.title}</h4>
                    <p className="text-xs text-hw-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-10 text-[10px] font-bold text-hw-slate-500 uppercase tracking-widest bg-white/5 border border-white/5 p-4 rounded-lg">
              <span className="text-hw-amber-500 mr-2">Disclaimer:</span>
              HourWise is a compliance support tool. Operators remain responsible for checking records and meeting legal obligations.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
