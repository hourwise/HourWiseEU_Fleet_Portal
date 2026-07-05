import { Gauge, FileUp, Activity, AlertCircle, FileSearch, Archive, ShieldAlert } from 'lucide-react';
import { HWCard } from '../ui/HWCard';
import { HWBadge } from '../ui/HWBadge';

const features = [
  { icon: FileUp, title: "Driver Card Import", desc: "Support for DDD, C1B and other common formats." },
  { icon: Activity, title: "Activity Timelines", desc: "Clear visual breakdown of drive, work, rest and POA." },
  { icon: AlertCircle, title: "Events & Infringements", desc: "Identify potential issues before they become penalties." },
  { icon: FileSearch, title: "Legal Totals", desc: "Automated calculation of daily and weekly legal totals." },
  { icon: Archive, title: "VU File Support", desc: "Review vehicle unit data alongside driver records." },
  { icon: ShieldAlert, title: "Audit Support", desc: "Maintain a clearer digital audit trail for your fleet." }
];

export function TachographSection() {
  return (
    <section id="tachograph" className="bg-hw-navy-900 py-24 border-y border-white/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-hw-blue-600/5 blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 animate-in slide-in-from-left-4 duration-700">
            <HWCard variant="glass" padding="none" className="overflow-hidden border-white/10 shadow-2xl bg-hw-navy-950/80">
               <div className="bg-hw-navy-950/80 px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Gauge size={14} className="text-hw-blue-600" />
                    <span className="text-[10px] font-bold text-hw-white uppercase tracking-widest">Tachograph Timeline</span>
                  </div>
                  <HWBadge variant="info">Coming Soon / Beta</HWBadge>
               </div>
               <div className="p-8 bg-hw-navy-950/40 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="flex justify-between items-end">
                       <div className="space-y-1">
                          <div className="h-3 w-24 bg-white/20 rounded"></div>
                          <div className="h-2 w-16 bg-white/10 rounded"></div>
                       </div>
                       <div className="h-3 w-16 bg-white/5 rounded"></div>
                    </div>
                    {/* Timeline representation */}
                    <div className="space-y-2">
                      <div className="h-10 w-full bg-hw-navy-900 rounded-lg border border-white/5 flex overflow-hidden">
                         <div className="h-full w-[20%] bg-hw-blue-600/40 border-r border-hw-blue-600/20"></div>
                         <div className="h-full w-[10%] bg-hw-cyan-500/40 border-r border-hw-cyan-500/20"></div>
                         <div className="h-full w-[30%] bg-hw-teal-500/40 border-r border-hw-teal-500/20"></div>
                         <div className="h-full w-[5%] bg-hw-blue-600/40 border-r border-hw-blue-600/20"></div>
                         <div className="h-full w-[35%] bg-hw-navy-800"></div>
                      </div>
                      <div className="flex justify-between text-[8px] font-bold text-hw-slate-500 uppercase tracking-tighter">
                         <span>08:00</span>
                         <span>10:00</span>
                         <span>12:00</span>
                         <span>14:00</span>
                         <span>16:00</span>
                         <span>18:00</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-12">
                     <div className="p-3 bg-hw-navy-900/50 rounded-lg border border-white/5">
                        <div className="text-[8px] font-bold text-hw-slate-500 uppercase mb-1">Drive</div>
                        <div className="text-sm font-bold text-hw-white tracking-tight">04:15</div>
                     </div>
                     <div className="p-3 bg-hw-navy-900/50 rounded-lg border border-white/5">
                        <div className="text-[8px] font-bold text-hw-slate-500 uppercase mb-1">Work</div>
                        <div className="text-sm font-bold text-hw-white tracking-tight">02:30</div>
                     </div>
                     <div className="p-3 bg-hw-navy-900/50 rounded-lg border border-white/5 border-hw-teal-500/20">
                        <div className="text-[8px] font-bold text-hw-teal-500 uppercase mb-1">Status</div>
                        <div className="text-[10px] font-bold text-hw-white uppercase">Valid</div>
                     </div>
                  </div>
               </div>
            </HWCard>
          </div>

          <div className="order-1 lg:order-2 animate-in slide-in-from-right-4 duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold text-hw-white mb-6">
              Tachograph files made easier to understand.
            </h2>
            <p className="text-lg text-hw-slate-400 mb-10 leading-relaxed">
              HourWise EU is being built to support driver card and vehicle unit file review with clear timelines, totals, events, infringements and exportable reports.
            </p>

            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6 mb-12">
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

            <div className="p-5 bg-hw-navy-950/50 border border-white/5 rounded-2xl">
               <p className="text-[10px] text-hw-slate-500 leading-relaxed italic">
                 <span className="text-hw-amber-500 font-bold uppercase not-italic mr-2">Important:</span>
                 HourWise is designed to support drivers and operators with time tracking, reporting and compliance workflows. It does not replace legally required tachograph equipment, official records or the operator’s legal responsibilities.
               </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
