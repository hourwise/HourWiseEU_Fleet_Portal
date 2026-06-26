import { Check } from 'lucide-react';
import { HWCard } from '../ui/HWCard';
import { HWButton } from '../ui/HWButton';
import { HWBadge } from '../ui/HWBadge';

export function PricingSection() {
  return (
    <section className="bg-hw-navy-950 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-hw-blue-600 uppercase tracking-[0.3em] mb-4">Transparent Pricing</h2>
          <h3 className="text-3xl lg:text-5xl font-bold text-hw-white mb-6">Simple plans for every scale.</h3>
          <p className="text-lg text-hw-slate-400 max-w-2xl mx-auto">
             Whether you're a solo driver or a multi-vehicle operator, HourWise has a plan to keep you compliant.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <PricingCard
            title="Solo Driver"
            price="£2.99"
            subtitle="per month"
            description="Perfect for individual drivers tracking their own hours and reports."
            features={[
              "All shift & drive timers",
              "HOS & WTD alerts",
              "Calendar shift history",
              "Downloadable PDF reports",
              "Expense & allowance logging"
            ]}
          />

          <PricingCard
            title="Fleet Portal"
            price="£19.99"
            subtitle="from / month"
            description="For operators managing drivers, vehicles, and company compliance."
            features={[
              "Full manager dashboard",
              "Vehicle check management",
              "Tacho file analysis tools",
              "Fleet-wide messaging",
              "Payroll & WTD summaries"
            ]}
            highlight={true}
          />

          <PricingCard
            title="Fleet Driver"
            price="£2.99"
            subtitle="per driver / month"
            description="Add-on for drivers connected directly to your fleet portal account."
            features={[
              "Auto-sync to fleet portal",
              "Digital walkaround checks",
              "Defect & incident reporting",
              "Receive office broadcasts",
              "Company assigned vehicles"
            ]}
          />
        </div>

        <div className="mt-12 text-center">
           <p className="text-xs font-bold text-hw-slate-500 uppercase tracking-widest">
             * Pricing may vary during early access and beta testing. All prices exclude VAT where applicable.
           </p>
        </div>
      </div>
    </section>
  );
}

function PricingCard({ title, price, subtitle, description, features, highlight = false }: any) {
  return (
    <HWCard variant={highlight ? 'default' : 'outline'} className={`relative flex flex-col ${highlight ? 'border-hw-blue-600/50 scale-105 z-10' : ''}`}>
      {highlight && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
           <HWBadge variant="info" className="px-4 py-1">Most Popular</HWBadge>
        </div>
      )}

      <div className="mb-8">
        <h4 className="text-xl font-bold text-hw-white mb-2">{title}</h4>
        <p className="text-sm text-hw-slate-400 leading-relaxed">{description}</p>
      </div>

      <div className="mb-8">
        <div className="flex items-baseline space-x-2">
          <span className="text-4xl font-bold text-hw-white">{price}</span>
          <span className="text-hw-slate-500 font-medium">{subtitle}</span>
        </div>
      </div>

      <ul className="space-y-4 mb-10 flex-1">
        {features.map((f: string, i: number) => (
          <li key={i} className="flex items-start space-x-3">
            <Check size={18} className="text-hw-blue-600 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-hw-slate-300">{f}</span>
          </li>
        ))}
      </ul>

      <HWButton variant={highlight ? 'primary' : 'outline'} className="w-full" onClick={() => window.location.href = '/contact'}>
        Contact us
      </HWButton>
    </HWCard>
  );
}
