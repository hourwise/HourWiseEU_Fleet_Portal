import React, { useState } from 'react';
import { HWCard } from '../ui/HWCard';
import { HWButton } from '../ui/HWButton';
import { CheckCircle2, ChevronRight, User, Users, Briefcase, ShieldCheck } from 'lucide-react';

type Role = 'solo' | 'fleet-driver' | 'manager' | 'compliance';

interface TabContent {
  title: string;
  headline: string;
  bullets: string[];
  cta: string;
  icon: React.ElementType;
}

const TAB_DATA: Record<Role, TabContent> = {
  solo: {
    title: 'Solo Driver',
    headline: 'Keep your working day organised from one app.',
    bullets: [
      'Track work, driving, breaks and POA.',
      'Get alerts before key limits.',
      'Keep daily reports and calendar history.',
      'Log expenses and estimate pay.',
      'Export records when needed.',
    ],
    cta: 'Get app launch updates',
    icon: User,
  },
  'fleet-driver': {
    title: 'Fleet Driver',
    headline: 'Send the office what they need without extra paperwork.',
    bullets: [
      'Clock in/out or submit shift activity.',
      'Complete vehicle checks.',
      'Report defects and incidents.',
      'Submit expenses and receipts.',
      'Receive messages and reminders.',
    ],
    cta: 'Join fleet driver beta',
    icon: Users,
  },
  manager: {
    title: 'Transport Manager',
    headline: 'See the records that need attention before they become a problem.',
    bullets: [
      'View driver activity and submitted records.',
      'Monitor missing checks and open defects.',
      'Review expenses, incidents and reports.',
      'Manage vehicles and document reminders.',
      'Use tachograph analysis and summaries.',
    ],
    cta: 'Request fleet portal access',
    icon: Briefcase,
  },
  compliance: {
    title: 'Compliance / Admin',
    headline: 'Build a clearer audit trail across drivers, vehicles and files.',
    bullets: [
      'Tachograph file import and analysis.',
      'Driver card and VU file storage.',
      'Activity timelines and legal totals.',
      'Infringement and event review.',
      'Exportable reports and supporting evidence.',
    ],
    cta: 'Get compliance updates',
    icon: ShieldCheck,
  },
};

export function RoleTabs() {
  const [activeTab, setActiveTab] = useState<Role>('solo');

  return (
    <section id="product" className="py-24 bg-hw-navy-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-hw-white mb-4">Choose your view</h2>
          <p className="text-hw-slate-400 max-w-2xl mx-auto">
            HourWise EU provides specific tools for every role in the transport team. Select your role to see how it helps you.
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {(Object.keys(TAB_DATA) as Role[]).map((role) => {
            const Icon = TAB_DATA[role].icon;
            const isActive = activeTab === role;
            return (
              <button
                key={role}
                onClick={() => setActiveTab(role)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                  isActive
                    ? 'bg-hw-blue-600 text-white shadow-lg shadow-hw-blue-600/20'
                    : 'bg-white/5 text-hw-slate-400 hover:bg-white/10 border border-white/5'
                }`}
              >
                <Icon size={18} />
                <span>{TAB_DATA[role].title}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            <h3 className="text-2xl sm:text-3xl font-bold text-hw-white mb-6">
              {TAB_DATA[activeTab].headline}
            </h3>
            <ul className="space-y-4 mb-10">
              {TAB_DATA[activeTab].bullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start space-x-3">
                  <CheckCircle2 size={20} className="text-hw-blue-600 shrink-0 mt-1" />
                  <span className="text-hw-slate-300">{bullet}</span>
                </li>
              ))}
            </ul>
            <HWButton
              className="group"
              onClick={() => document.getElementById('early-access')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {TAB_DATA[activeTab].cta}
              <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </HWButton>
          </div>

          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <HWCard variant="glass" padding="none" className="aspect-[4/3] relative overflow-hidden group">
              {/* Placeholder for Mockup */}
              <div className="absolute inset-0 bg-hw-navy-900 flex items-center justify-center">
                <div className="text-center opacity-20 group-hover:opacity-30 transition-opacity">
                  {React.createElement(TAB_DATA[activeTab].icon, {
                    size: 80,
                    className: "mx-auto text-hw-blue-600 mb-4"
                  })}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-hw-white">
                    {TAB_DATA[activeTab].title} Mockup
                  </span>
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute top-4 left-4 right-4 h-6 bg-white/5 rounded-lg border border-white/5"></div>
              <div className="absolute bottom-4 left-4 right-20 h-4 bg-white/5 rounded-lg border border-white/5"></div>
              <div className="absolute bottom-12 left-4 right-10 h-4 bg-white/5 rounded-lg border border-white/5"></div>
            </HWCard>
          </div>
        </div>
      </div>
    </section>
  );
}
