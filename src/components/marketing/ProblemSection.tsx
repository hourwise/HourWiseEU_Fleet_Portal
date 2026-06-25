import { AlertTriangle, Clock, FileWarning, Search, ZapOff } from 'lucide-react';
import { HWCard } from '../ui/HWCard';

const problems = [
  {
    icon: AlertTriangle,
    title: "Fragmented Data",
    description: "Transport compliance is often spread across paper logs, spreadsheets, and disconnected apps."
  },
  {
    icon: Clock,
    title: "Manual Tracking",
    description: "Drivers rely on memory or manual logs, leading to unintentional hours-of-service infringements."
  },
  {
    icon: FileWarning,
    title: "Audit Anxiety",
    description: "Chasing missing vehicle checks, fuel receipts, and tacho files makes audit preparation stressful."
  },
  {
    icon: Search,
    title: "Hidden Risks",
    description: "Without real-time visibility, managers only discover compliance issues days or weeks after they occur."
  },
  {
    icon: ZapOff,
    title: "Complex Analysis",
    description: "Interpreting raw tachograph files is difficult without expensive, enterprise-heavy software."
  }
];

export function ProblemSection() {
  return (
    <section className="bg-hw-navy-950 py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-hw-blue-600 uppercase tracking-[0.3em] mb-4">The Challenge</h2>
          <h3 className="text-3xl lg:text-5xl font-bold text-hw-white mb-6">
            Transport compliance is still spread<br className="hidden lg:block" /> across too many tools.
          </h3>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((problem, index) => (
            <HWCard key={index} variant="outline" className="group hover:border-hw-blue-600/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-hw-navy-900 flex items-center justify-center mb-6 group-hover:bg-hw-blue-600/10 transition-colors">
                <problem.icon size={24} className="text-hw-blue-600" />
              </div>
              <h4 className="text-xl font-bold text-hw-white mb-3">{problem.title}</h4>
              <p className="text-hw-slate-400 leading-relaxed">{problem.description}</p>
            </HWCard>
          ))}

          <HWCard variant="glass" className="flex flex-col justify-center border-dashed border-hw-blue-600/30">
            <h4 className="text-xl font-bold text-hw-blue-600 mb-2">Sound familiar?</h4>
            <p className="text-hw-slate-300">HourWise was built specifically to solve these gaps for UK and EU operators.</p>
          </HWCard>
        </div>
      </div>
    </section>
  );
}
