import { HWCard } from '../ui/HWCard';
import { Quote } from 'lucide-react';

export function FounderStorySection() {
  return (
    <section className="py-24 bg-hw-navy-950 border-t border-white/5 relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-hw-blue-600/20 to-transparent"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-hw-blue-600/10 border border-hw-blue-600/20 mb-8">
               <span className="text-[10px] font-bold text-hw-blue-600 uppercase tracking-widest">Our Story</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-hw-white mb-6">
              Built from real driver and operator problems.
            </h2>
            <div className="space-y-6 text-lg text-hw-slate-400 leading-relaxed">
              <p>
                HourWise started as a practical driver app for tracking work, driving, breaks and POA. It was born out of the frustration of managing complex compliance records with tools that didn't feel built for the actual job.
              </p>
              <p>
                It is now growing into a connected platform for operators who need clearer records, simpler reporting and better visibility across drivers, vehicles and compliance workflows.
              </p>
            </div>
          </div>

          <div className="relative">
            <HWCard variant="glass" className="p-8 sm:p-12 relative z-10 border-white/10 bg-hw-navy-900/50">
              <Quote size={40} className="text-hw-blue-600/20 absolute top-6 right-6" />
              <div className="relative z-10">
                <p className="text-xl sm:text-2xl font-medium text-hw-white leading-relaxed mb-8 italic">
                  "Transport compliance is serious, but the tools we use shouldn't be a burden. HourWise EU is about making the daily workflow practical for everyone — from the cab to the office."
                </p>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-hw-blue-600/20 border border-hw-blue-600/30 flex items-center justify-center">
                    <span className="text-hw-blue-600 font-bold">HW</span>
                  </div>
                  <div>
                    <div className="text-hw-white font-bold">HourWise EU</div>
                    <div className="text-hw-slate-500 text-xs font-bold uppercase tracking-widest">Founder & Developer</div>
                  </div>
                </div>
              </div>
            </HWCard>

            {/* Background Decoration */}
            <div className="absolute -top-6 -right-6 w-full h-full bg-hw-blue-600/10 rounded-3xl -rotate-2 pointer-events-none"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
