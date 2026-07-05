import { Smartphone, LayoutDashboard, Database, FileCheck, ArrowRight } from 'lucide-react';
import { HWCard } from '../ui/HWCard';

export function ConnectedWorkflowSection() {
  return (
    <section className="bg-hw-navy-950 py-24 relative overflow-hidden border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-hw-white mb-6">
            One workflow from cab to office
          </h2>
          <p className="text-hw-slate-400 max-w-2xl mx-auto">
            Drivers capture the day as it happens. Managers review, action and report from the portal.
          </p>
        </div>

        <div className="relative">
          {/* Connection Line Visual */}
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-hw-blue-600/30 to-transparent -translate-y-1/2 hidden lg:block"></div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            <WorkflowStep
              icon={Smartphone}
              title="Driver App Captures"
              items={["Work, drive, break records", "Vehicle checks & defects", "Incidents & expenses", "Message acknowledgements"]}
              color="hw-blue-600"
            />
            <WorkflowStep
              icon={Database}
              title="Secure Cloud Sync"
              items={["Supabase-backed data", "Role-based access", "Real-time updates", "Separate marketing routes"]}
              color="hw-cyan-500"
            />
            <WorkflowStep
              icon={LayoutDashboard}
              title="Fleet Portal Reviews"
              items={["Driver & vehicle records", "Defect management", "Tachograph file import", "Manager dashboards"]}
              color="hw-teal-500"
            />
            <WorkflowStep
              icon={FileCheck}
              title="Reports & Actions"
              items={["Payroll support", "Compliance review", "Document reminders", "Downloadable exports"]}
              color="hw-green-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowStep({ icon: Icon, title, items, color }: { icon: any, title: string, items: string[], color: string }) {
  // Mapping color strings to actual Tailwind classes to ensure they are compiled
  const colorMap: Record<string, { bg: string, border: string, text: string }> = {
    'hw-blue-600': { bg: 'bg-hw-blue-600/10', border: 'border-hw-blue-600/20', text: 'text-hw-blue-600' },
    'hw-cyan-500': { bg: 'bg-hw-cyan-500/10', border: 'border-hw-cyan-500/20', text: 'text-hw-cyan-500' },
    'hw-teal-500': { bg: 'bg-hw-teal-500/10', border: 'border-hw-teal-500/20', text: 'text-hw-teal-500' },
    'hw-green-500': { bg: 'bg-hw-green-500/10', border: 'border-hw-green-500/20', text: 'text-hw-green-500' },
  };

  const colors = colorMap[color] || colorMap['hw-blue-600'];

  return (
    <HWCard variant="glass" className="flex flex-col items-center text-center p-8 group hover:border-white/20 transition-colors">
      <div className={`w-16 h-16 rounded-2xl ${colors.bg} ${colors.border} border flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 transition-transform`}>
        <Icon size={28} className={colors.text} />
      </div>
      <h4 className="text-lg font-bold text-hw-white mb-6 h-12 flex items-center">{title}</h4>
      <ul className="space-y-3 w-full">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-hw-slate-400 leading-relaxed">{item}</li>
        ))}
      </ul>
    </HWCard>
  );
}
