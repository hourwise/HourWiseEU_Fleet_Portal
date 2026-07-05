import React, { useState } from 'react';
import { HWCard } from '../ui/HWCard';
import { HWButton } from '../ui/HWButton';
import { Clock, Gauge, ShieldCheck, Receipt, MessageSquare, Bot, ChevronRight, CheckCircle2 } from 'lucide-react';

type Feature = 'hours' | 'tachograph' | 'checks' | 'expenses' | 'messaging' | 'atlas';

interface FeatureTab {
  id: Feature;
  title: string;
  icon: React.ElementType;
  headline: string;
  cards: string[];
  disclaimer?: string;
  beta?: boolean;
}

const FEATURE_DATA: FeatureTab[] = [
  {
    id: 'hours',
    title: 'Hours & Alerts',
    icon: Clock,
    headline: 'Track the working day before it becomes a paperwork problem.',
    cards: ['Work timer', 'Driving timer', 'Break and POA tracking', 'Spoken and push alerts', 'Daily report history'],
  },
  {
    id: 'tachograph',
    title: 'Tachograph',
    icon: Gauge,
    headline: 'Make driver card and vehicle unit files easier to review.',
    cards: ['Driver card import', 'VU file import', 'Activity timeline', 'Legal totals', 'Events and infringements'],
    disclaimer: 'HourWise supports review and record keeping. It does not replace legally required tachograph equipment or operator responsibilities.',
  },
  {
    id: 'checks',
    title: 'Checks & Defects',
    icon: ShieldCheck,
    headline: 'Keep daily checks and defects visible to the office.',
    cards: ['Walkaround checks', 'Defect reports', 'Open defect status', 'Vehicle assignment', 'Maintenance reminders', 'PMI calendar'],
  },
  {
    id: 'expenses',
    title: 'Expenses & Reports',
    icon: Receipt,
    headline: 'Turn receipts and shift records into usable reports.',
    cards: ['Fuel, toll and mileage logging', 'Receipt capture', 'Driver expenses', 'Pay estimate support', 'Downloadable reports'],
  },
  {
    id: 'messaging',
    title: 'Messaging',
    icon: MessageSquare,
    headline: 'Connect transport office messages with driver acknowledgements.',
    cards: ['Driver messages', 'Announcements', 'Acknowledgement tracking', 'Reminders', 'Policy updates'],
  },
  {
    id: 'atlas',
    title: 'Atlas Assistant',
    icon: Bot,
    headline: 'Ask Atlas what needs attention across your fleet.',
    cards: ['Missing checks summary', 'Upcoming document expiry', 'Driver risk flags', 'Weekly digest', 'Tachograph issue summaries'],
    beta: true,
  },
];

export function FeatureExplorer() {
  const [activeFeature, setActiveFeature] = useState<Feature>('hours');

  const current = FEATURE_DATA.find(f => f.id === activeFeature)!;

  return (
    <section id="features" className="py-24 bg-hw-navy-950 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-hw-white mb-6">Explore the platform</h2>
          <p className="text-hw-slate-400 max-w-2xl mx-auto">
            A comprehensive set of tools designed for the modern transport operator.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Vertical Tabs for Desktop */}
          <div className="hidden lg:flex flex-col space-y-2">
            {FEATURE_DATA.map((feature) => (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
                className={`flex items-center space-x-3 px-6 py-4 rounded-xl font-bold text-sm transition-all border ${
                  activeFeature === feature.id
                    ? 'bg-hw-blue-600 text-white border-hw-blue-600 shadow-lg shadow-hw-blue-600/20'
                    : 'bg-white/5 text-hw-slate-400 border-white/5 hover:bg-white/10'
                }`}
              >
                <feature.icon size={20} />
                <span>{feature.title}</span>
                {feature.beta && (
                  <span className="ml-auto text-[8px] px-1.5 py-0.5 bg-hw-teal-500/20 text-hw-teal-500 rounded uppercase">Beta</span>
                )}
              </button>
            ))}
          </div>

          {/* Horizontal Scroll for Mobile */}
          <div className="lg:hidden flex overflow-x-auto pb-4 gap-2 no-scrollbar scroll-snap-x">
            {FEATURE_DATA.map((feature) => (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-bold text-xs transition-all border shrink-0 scroll-snap-align-start ${
                  activeFeature === feature.id
                    ? 'bg-hw-blue-600 text-white border-hw-blue-600'
                    : 'bg-white/5 text-hw-slate-400 border-white/5'
                }`}
              >
                <feature.icon size={16} />
                <span>{feature.title}</span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <HWCard variant="glass" className="h-full animate-in fade-in duration-500">
              <div className="grid md:grid-cols-2 gap-12 p-4">
                <div>
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-hw-blue-600/10 border border-hw-blue-600/20 mb-6">
                    <current.icon size={14} className="text-hw-blue-600" />
                    <span className="text-[10px] font-bold text-hw-blue-600 uppercase tracking-widest">{current.title}</span>
                    {current.beta && <span className="text-[8px] font-bold text-hw-teal-500 uppercase ml-2">Planned / Beta Feature</span>}
                  </div>
                  <h3 className="text-2xl font-bold text-hw-white mb-6 leading-tight">
                    {current.headline}
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4 mb-8">
                    {current.cards.map((card, idx) => (
                      <div key={idx} className="flex items-center space-x-2 text-sm text-hw-slate-300">
                        <CheckCircle2 size={16} className="text-hw-blue-600 shrink-0" />
                        <span>{card}</span>
                      </div>
                    ))}
                  </div>
                  {current.disclaimer && (
                    <div className="p-4 bg-hw-navy-950/50 rounded-lg border border-white/5 text-[10px] text-hw-slate-500 leading-relaxed italic mb-8">
                      {current.disclaimer}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <HWButton
                      variant="outline"
                      size="sm"
                      className="group"
                      onClick={() => document.getElementById('early-access')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      Learn more
                      <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </HWButton>
                    {current.id === 'atlas' && (
                      <HWButton
                        variant="ghost"
                        size="sm"
                        className="text-hw-cyan-500 hover:text-hw-cyan-400 p-0 h-auto"
                        onClick={() => window.location.href = 'mailto:Atlas@hourwiseeu.co.uk?subject=Feedback for Atlas Assistant'}
                      >
                        Feedback for Atlas? Email the team
                      </HWButton>
                    )}
                  </div>
                </div>

                <div className="hidden md:block relative group">
                  <div className="aspect-[4/5] bg-hw-navy-950 rounded-2xl border border-white/10 overflow-hidden relative">
                     {/* Mockup Placeholder */}
                     <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-30 transition-opacity">
                        <current.icon size={120} className="text-hw-blue-600" />
                     </div>
                     <div className="absolute inset-0 bg-gradient-to-t from-hw-navy-950 via-transparent to-transparent"></div>
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
