import { Play, ChevronRight, ShieldCheck, Gauge, Users, Clock } from 'lucide-react';
import { HWButton } from '../ui/HWButton';
import { HWCard } from '../ui/HWCard';
import { useTranslation } from 'react-i18next';

export function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden hw-hero-bg">
      <div className="absolute inset-0 hw-grid-overlay opacity-20"></div>

      {/* Background Motifs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-hw-blue-600/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-hw-teal-500/10 rounded-full blur-[120px]"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-hw-blue-600/10 border border-hw-blue-600/20 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <span className="flex h-2 w-2 rounded-full bg-hw-blue-600 animate-pulse"></span>
              <span className="text-[10px] font-bold text-hw-blue-600 uppercase tracking-widest">Connected Fleet Compliance</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold text-hw-white mb-6 leading-[1.1] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Driver hours, tacho insight <span className="text-hw-blue-600">&</span> fleet compliance.
            </h1>

            <p className="text-xl text-hw-slate-300 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              HourWise EU connects the driver app with a powerful fleet portal. Track shifts, manage vehicle checks, and analyse tachograph data — all in one platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <HWButton size="lg" className="group" onClick={() => window.location.href = '/contact'}>
                Request Early Access
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </HWButton>
              <HWButton variant="outline" size="lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore Features
              </HWButton>
            </div>

            <div className="mt-12 flex flex-wrap justify-center lg:justify-start gap-8 opacity-50 animate-in fade-in duration-1000 delay-500">
               <div className="flex items-center space-x-2">
                 <ShieldCheck size={20} className="text-hw-blue-600" />
                 <span className="text-xs font-bold uppercase tracking-widest text-hw-slate-300">GDPR Compliant</span>
               </div>
               <div className="flex items-center space-x-2">
                 <Gauge size={20} className="text-hw-blue-600" />
                 <span className="text-xs font-bold uppercase tracking-widest text-hw-slate-300">Tacho Ready</span>
               </div>
               <div className="flex items-center space-x-2">
                 <Users size={20} className="text-hw-blue-600" />
                 <span className="text-xs font-bold uppercase tracking-widest text-hw-slate-300">Built for Fleets</span>
               </div>
            </div>
          </div>

          <div className="relative animate-in zoom-in fade-in duration-1000 delay-300">
            {/* Main Portal Mockup */}
            <HWCard variant="glass" padding="none" className="overflow-hidden shadow-2xl border-white/10 ring-1 ring-white/5">
              <div className="bg-hw-navy-950/80 px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                  <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
                  <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                </div>
                <div className="text-[10px] font-bold text-hw-slate-500 uppercase tracking-widest">Fleet Control Centre</div>
                <div className="w-10"></div>
              </div>
              <div className="aspect-[4/3] bg-hw-navy-950 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-32 bg-hw-navy-900 rounded-lg border border-white/5 p-4 flex flex-col justify-between">
                    <div className="w-8 h-8 rounded-lg bg-hw-blue-600/20 flex items-center justify-center">
                      <Users size={16} className="text-hw-blue-600" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-hw-slate-500 uppercase">Active Drivers</div>
                      <div className="text-2xl font-bold text-hw-white">24</div>
                    </div>
                  </div>
                  <div className="h-32 bg-hw-navy-900 rounded-lg border border-white/5 p-4 flex flex-col justify-between">
                    <div className="w-8 h-8 rounded-lg bg-hw-amber-500/20 flex items-center justify-center">
                      <ShieldCheck size={16} className="text-hw-amber-500" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-hw-slate-500 uppercase">Alerts</div>
                      <div className="text-2xl font-bold text-hw-white">3</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 h-48 bg-hw-navy-900 rounded-lg border border-white/5 p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-xs font-bold text-hw-white uppercase tracking-wider">Weekly Compliance</div>
                    <div className="flex space-x-2">
                       <div className="w-12 h-2 bg-hw-blue-600 rounded-full"></div>
                       <div className="w-12 h-2 bg-hw-navy-800 rounded-full"></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 rounded-full bg-hw-navy-800 border border-white/5"></div>
                          <div className="h-2 w-20 bg-hw-slate-500/20 rounded"></div>
                        </div>
                        <div className="h-4 w-12 bg-hw-blue-600/10 border border-hw-blue-600/20 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </HWCard>

            {/* Mobile App Floating Mockup */}
            <div className="absolute -bottom-10 -left-10 w-56 h-[400px] hidden md:block animate-bounce-slow">
              <HWCard variant="glass" padding="none" className="h-full rounded-[2.5rem] border-4 border-hw-navy-800 shadow-2xl overflow-hidden ring-4 ring-black/20">
                <div className="h-6 w-24 bg-hw-navy-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-xl z-10"></div>
                <div className="h-full bg-hw-navy-950 p-6 flex flex-col">
                  <div className="mt-8 flex justify-between items-center">
                    <div className="h-10 w-10 bg-hw-blue-600 rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold">H</span>
                    </div>
                    <div className="text-right">
                       <div className="text-[8px] font-bold text-hw-slate-500 uppercase">Driving Today</div>
                       <div className="text-lg font-bold text-hw-white">04:32</div>
                    </div>
                  </div>

                  <div className="mt-12 aspect-square rounded-full border-8 border-hw-navy-900 flex items-center justify-center relative">
                    <div className="absolute inset-0 border-8 border-hw-blue-600 rounded-full border-t-transparent -rotate-45"></div>
                    <div className="text-center">
                       <div className="text-3xl font-bold text-hw-white">01:58</div>
                       <div className="text-[10px] font-bold text-hw-blue-600 uppercase">Next Break</div>
                    </div>
                  </div>

                  <div className="mt-auto space-y-3">
                     <div className="h-12 bg-hw-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-hw-blue-600/30">DRIVING</div>
                     <div className="grid grid-cols-3 gap-2">
                        <div className="h-10 bg-hw-navy-900 rounded-lg flex items-center justify-center text-[10px] font-bold text-hw-slate-400">WORK</div>
                        <div className="h-10 bg-hw-navy-900 rounded-lg flex items-center justify-center text-[10px] font-bold text-hw-slate-400">REST</div>
                        <div className="h-10 bg-hw-navy-900 rounded-lg flex items-center justify-center text-[10px] font-bold text-hw-slate-400">POA</div>
                     </div>
                  </div>
                </div>
              </HWCard>
            </div>

            {/* Floating Metric Card */}
            <div className="absolute -top-6 -right-6 hidden lg:block animate-float">
               <HWCard variant="glass" className="p-4 border-hw-green-500/20">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-hw-green-500/10 rounded-lg">
                      <ShieldCheck size={20} className="text-hw-green-500" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-hw-slate-500 uppercase">Check Submitted</div>
                      <div className="text-sm font-bold text-hw-white">Vehicle OK</div>
                    </div>
                  </div>
               </HWCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
