import { Clock, CheckCircle2, Shield, Smartphone, ArrowRight } from 'lucide-react';
import { HWCard } from '../ui/HWCard';
import { HWBadge } from '../ui/HWBadge';

export function DriverAppSection() {
  return (
    <section id="features" className="bg-hw-navy-950 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-sm font-bold text-hw-blue-600 uppercase tracking-[0.3em] mb-4">Driver Companion</h2>
            <h3 className="text-3xl lg:text-5xl font-bold text-hw-white mb-6">
              A practical daily app for professional drivers.
            </h3>
            <p className="text-lg text-hw-slate-400 mb-10 leading-relaxed">
              For solo drivers, HourWise helps keep daily hours, breaks and reports organised. For fleet drivers, the same app becomes a direct link to the transport office.
            </p>

            <div className="space-y-8">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <HWBadge variant="info">Solo Drivers</HWBadge>
                  <h4 className="text-lg font-bold text-hw-white">Independent Tracking</h4>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm text-hw-slate-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 size={16} className="text-hw-blue-600 flex-shrink-0" />
                    <span>Shift & drive timers</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 size={16} className="text-hw-blue-600 flex-shrink-0" />
                    <span>4h30 break warnings</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 size={16} className="text-hw-blue-600 flex-shrink-0" />
                    <span>Expense & pay logging</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 size={16} className="text-hw-blue-600 flex-shrink-0" />
                    <span>Compliance heatmaps</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <div className="flex items-center space-x-2 mb-4">
                  <HWBadge variant="success">Fleet Drivers</HWBadge>
                  <h4 className="text-lg font-bold text-hw-white">Connected Features</h4>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm text-hw-slate-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 size={16} className="text-hw-blue-600 flex-shrink-0" />
                    <span>Clock in/out to portal</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 size={16} className="text-hw-blue-600 flex-shrink-0" />
                    <span>Walkaround checks</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 size={16} className="text-hw-blue-600 flex-shrink-0" />
                    <span>Defect & incident reports</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 size={16} className="text-hw-blue-600 flex-shrink-0" />
                    <span>Office announcements</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            {/* Visual representation of the app's advanced layout */}
            <HWCard variant="outline" padding="none" className="w-full max-w-sm rounded-[3rem] border-hw-navy-800 bg-hw-navy-950 p-4 ring-8 ring-hw-navy-900/50 shadow-2xl overflow-hidden aspect-[9/19]">
              <div className="h-full border border-white/5 rounded-[2.5rem] bg-hw-navy-900 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-bold text-hw-slate-500 uppercase tracking-widest">HourWise EU</span>
                    <div className="w-3 h-3 rounded-full bg-hw-green-500 animate-pulse"></div>
                  </div>

                  <HWCard variant="default" className="mb-4 bg-hw-navy-950 border-white/5">
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-hw-slate-500 uppercase mb-1">Accumulated Drive (Week)</div>
                      <div className="text-3xl font-bold text-hw-white tracking-wider">34h 12m</div>
                      <div className="text-[10px] text-hw-slate-400 mt-1">Limit: 56h</div>
                    </div>
                  </HWCard>

                  <div className="grid grid-cols-2 gap-3">
                    <HWCard variant="default" className="p-3 bg-hw-navy-950 border-white/5 text-center">
                      <div className="text-[8px] font-bold text-hw-slate-500 uppercase">Daily Drive</div>
                      <div className="text-lg font-bold text-hw-white mt-1">07h 45m</div>
                    </HWCard>
                    <HWCard variant="default" className="p-3 bg-hw-navy-950 border-white/5 text-center">
                      <div className="text-[8px] font-bold text-hw-slate-500 uppercase">Continuous</div>
                      <div className="text-lg font-bold text-hw-white mt-1">03h 15m</div>
                    </HWCard>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-hw-blue-600 rounded-xl py-3 text-center font-bold text-white shadow-lg shadow-hw-blue-600/20 cursor-pointer hover:bg-hw-blue-700 transition-colors">
                    ACTIVE DRIVE
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                     <div className="bg-hw-navy-950 border border-white/5 py-2.5 rounded-lg text-center text-[10px] font-bold text-hw-slate-400 cursor-pointer">WORK</div>
                     <div className="bg-hw-navy-950 border border-white/5 py-2.5 rounded-lg text-center text-[10px] font-bold text-hw-slate-400 cursor-pointer">BREAK</div>
                     <div className="bg-hw-navy-950 border border-white/5 py-2.5 rounded-lg text-center text-[10px] font-bold text-hw-slate-400 cursor-pointer">POA</div>
                  </div>
                </div>
              </div>
            </HWCard>
          </div>
        </div>
      </div>
    </section>
  );
}
