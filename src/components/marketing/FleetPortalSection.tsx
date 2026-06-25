import { LayoutDashboard, Users, FileText, Gauge, ShieldCheck, PieChart, Bell, Sparkles } from 'lucide-react';
import { HWCard } from '../ui/HWCard';

const features = [
  {
    icon: Users,
    title: "Driver Management",
    description: "Full profiles, document tracking, and direct app connection."
  },
  {
    icon: Gauge,
    title: "Tacho Analysis",
    description: "Import .DDD files and view interactive activity timelines."
  },
  {
    icon: ShieldCheck,
    title: "Compliance Centre",
    description: "Manage walkarounds, defects, and maintenance schedules."
  },
  {
    icon: PieChart,
    title: "Admin & Payroll",
    description: "Automated working time summaries and expense review."
  },
  {
    icon: Bell,
    title: "Actionable Alerts",
    description: "Instant notifications for missing checks or legal risks."
  },
  {
    icon: Sparkles,
    title: "AI Fleet Assistant",
    description: "Ask Atlas for risk summaries and compliance highlights."
  }
];

export function FleetPortalSection() {
  return (
    <section className="bg-hw-navy-900 py-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.05)_0,transparent_70%)]"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-hw-blue-600 uppercase tracking-[0.3em] mb-4">Fleet Operations</h2>
          <h3 className="text-3xl lg:text-5xl font-bold text-hw-white mb-6">
            A clearer control centre for<br className="hidden lg:block" /> transport managers.
          </h3>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="group cursor-pointer">
              <HWCard variant="glass" className="h-full border-white/5 group-hover:border-hw-blue-600/30 group-hover:bg-hw-navy-900/60 transition-all">
                <div className="w-12 h-12 rounded-xl bg-hw-blue-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon size={24} className="text-hw-blue-600" />
                </div>
                <h4 className="text-xl font-bold text-hw-white mb-3 group-hover:text-hw-blue-600 transition-colors">{feature.title}</h4>
                <p className="text-hw-slate-400 leading-relaxed text-sm">{feature.description}</p>
              </HWCard>
            </div>
          ))}
        </div>

        {/* Placeholder for a large portal dashboard mockup */}
        <div className="mt-20 relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-hw-blue-600/30 to-hw-cyan-500/30 rounded-2xl blur-xl opacity-30"></div>
          <HWCard variant="default" padding="none" className="relative overflow-hidden border-white/10 shadow-3xl">
            <div className="bg-hw-navy-950/80 px-6 py-4 border-b border-white/5 flex items-center space-x-4">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-white/10"></div>
                <div className="w-3 h-3 rounded-full bg-white/10"></div>
                <div className="w-3 h-3 rounded-full bg-white/10"></div>
              </div>
              <div className="h-4 w-64 bg-white/5 rounded"></div>
            </div>
            <div className="p-8 aspect-[16/7] bg-hw-navy-950 grid grid-cols-12 gap-6">
               <div className="col-span-3 space-y-4">
                  <div className="h-40 bg-hw-navy-900 rounded-xl border border-white/5"></div>
                  <div className="h-40 bg-hw-navy-900 rounded-xl border border-white/5"></div>
               </div>
               <div className="col-span-6">
                  <div className="h-full bg-hw-navy-900 rounded-xl border border-white/5 p-6">
                     <div className="h-6 w-32 bg-white/10 rounded mb-8"></div>
                     <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="h-10 bg-white/5 rounded-lg border border-white/5"></div>
                        ))}
                     </div>
                  </div>
               </div>
               <div className="col-span-3 space-y-4">
                  <div className="h-full bg-hw-navy-900 rounded-xl border border-white/5 p-4">
                     <div className="h-4 w-24 bg-hw-blue-600/20 rounded mb-6"></div>
                     <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex space-x-3">
                            <div className="w-8 h-8 rounded bg-white/5"></div>
                            <div className="flex-1 space-y-2">
                               <div className="h-2 w-full bg-white/10 rounded"></div>
                               <div className="h-2 w-1/2 bg-white/5 rounded"></div>
                            </div>
                          </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          </HWCard>
        </div>
      </div>
    </section>
  );
}
