import { ArrowRight, Smartphone, LayoutDashboard, Database, FileCheck } from 'lucide-react';
import { HWCard } from '../ui/HWCard';

export function ConnectedWorkflowSection() {
  return (
    <section className="bg-hw-navy-950 py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-hw-blue-600 uppercase tracking-[0.3em] mb-4">The Ecosystem</h2>
          <h3 className="text-3xl lg:text-5xl font-bold text-hw-white mb-6">
            One connected workflow<br className="hidden lg:block" /> from cab to office.
          </h3>
        </div>

        <div className="relative">
          {/* Connection Line Visual */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-hw-blue-600/0 via-hw-blue-600/20 to-hw-blue-600/0 -translate-y-1/2 hidden lg:block"></div>

          <div className="grid lg:grid-cols-4 gap-8 relative z-10">
            <WorkflowStep
              icon={Smartphone}
              title="Driver App Sends"
              items={["Shift records", "Vehicle checks", "Incidents", "Expenses"]}
              color="hw-blue-600"
            />
            <WorkflowStep
              icon={Database}
              title="Secure Processing"
              items={["Real-time sync", "HOS validation", "Encrypted storage", "Audit trails"]}
              color="hw-cyan-500"
            />
            <WorkflowStep
              icon={LayoutDashboard}
              title="Portal Management"
              items={["Manager review", "Defect action", "Tacho analysis", "Risk highlights"]}
              color="hw-teal-500"
            />
            <WorkflowStep
              icon={FileCheck}
              title="Compliance Output"
              items={["Payroll exports", "Audit evidence", "Invoiced shifts", "Performance data"]}
              color="hw-green-500"
            />
          </div>
        </div>

        <div className="mt-16 text-center">
           <p className="text-hw-slate-400 max-w-2xl mx-auto leading-relaxed italic">
             "Drivers capture the information during the day. Managers review, action and report on it from the portal."
           </p>
        </div>
      </div>
    </section>
  );
}

function WorkflowStep({ icon: Icon, title, items, color }: { icon: any, title: string, items: string[], color: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className={`w-16 h-16 rounded-2xl bg-${color}/10 border border-${color}/20 flex items-center justify-center mb-6 shadow-xl`}>
        <Icon size={28} className={`text-${color}`} />
      </div>
      <h4 className="text-lg font-bold text-hw-white mb-4">{title}</h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-xs font-medium text-hw-slate-400 uppercase tracking-wider">{item}</li>
        ))}
      </ul>
    </div>
  );
}
