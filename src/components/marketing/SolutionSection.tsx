import { Smartphone, LayoutDashboard, Share2, ArrowRight } from 'lucide-react';
import { HWCard } from '../ui/HWCard';

export function SolutionSection() {
  return (
    <section className="bg-hw-navy-900 py-24 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-hw-blue-600 uppercase tracking-[0.3em] mb-4">Our Solution</h2>
          <h3 className="text-3xl lg:text-5xl font-bold text-hw-white mb-6">
            Connecting the driver, the vehicle,<br className="hidden lg:block" /> and the transport office.
          </h3>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <SolutionCard
            icon={Smartphone}
            title="Driver App"
            items={[
              "Track work, drive, break & POA",
              "Real-time regulatory alerts",
              "Submit checks, expenses & incidents"
            ]}
          />
          <SolutionCard
            icon={LayoutDashboard}
            title="Fleet Portal"
            items={[
              "Manage drivers and vehicles",
              "Review shift logs and documents",
              "Analyse tachograph data"
            ]}
          />
          <SolutionCard
            icon={Share2}
            title="Connected Workflow"
            items={[
              "Instant office-to-cab messaging",
              "Automated compliance reminders",
              "Integrated payroll reporting"
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function SolutionCard({ icon: Icon, title, items }: { icon: any, title: string, items: string[] }) {
  return (
    <HWCard className="relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={120} />
      </div>

      <div className="relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-hw-blue-600 flex items-center justify-center mb-8 shadow-lg shadow-hw-blue-600/20">
          <Icon size={28} className="text-white" />
        </div>

        <h4 className="text-2xl font-bold text-hw-white mb-6">{title}</h4>

        <ul className="space-y-4">
          {items.map((item, i) => (
            <li key={i} className="flex items-center space-x-3 text-hw-slate-300">
              <div className="w-1.5 h-1.5 rounded-full bg-hw-blue-600"></div>
              <span className="text-sm font-medium">{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 pt-6 border-t border-white/5 flex items-center text-hw-blue-600 font-bold text-sm uppercase tracking-widest group-hover:translate-x-2 transition-transform cursor-pointer">
          Learn More
          <ArrowRight size={16} className="ml-2" />
        </div>
      </div>
    </HWCard>
  );
}
