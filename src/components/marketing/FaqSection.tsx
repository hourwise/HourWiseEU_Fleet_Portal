import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { HWCard } from '../ui/HWCard';

const faqs = [
  {
    q: "What is HourWise EU?",
    a: "HourWise EU is a connected driver app and fleet portal for UK/EU commercial transport teams. It helps drivers track work, driving, breaks and POA while helping operators manage checks, defects, incidents, expenses, tachograph data, reports and compliance workflows."
  },
  {
    q: "Is HourWise a tachograph replacement?",
    a: "No. HourWise is a compliance support, analysis and workflow tool. It does not replace legally required tachograph equipment, official records or operator responsibilities."
  },
  {
    q: "Who is HourWise for?",
    a: "HourWise is being built for solo drivers, fleet drivers, small fleets, growing operators, transport managers and compliance teams working in UK/EU commercial transport."
  },
  {
    q: "Does HourWise support solo drivers?",
    a: "Yes. Solo drivers can use the app to track their hours, receive alerts, and generate reports for their own records or to share with clients."
  },
  {
    q: "Does HourWise support fleet operators?",
    a: "Yes. The fleet portal allows managers to oversee multiple drivers, track vehicle checks, manage defects, and review compliance data in real-time."
  },
  {
    q: "Does HourWise support tachograph files?",
    a: "The fleet portal is being built to support driver card and vehicle unit file import and analysis where compatible data is available, including formats such as DDD, C1B and V1B where supported."
  },
  {
    q: "Is HourWise live now?",
    a: "HourWise is preparing for launch and early access. Drivers and fleets can join the update list to hear about beta testing and release news."
  },
  {
    q: "How do I join early access?",
    a: "You can join early access by clicking the 'Join early access' button and providing your email and role. We'll contact you with updates and beta opportunities."
  }
];

export function FaqSection() {
  return (
    <section id="faq" className="bg-hw-navy-950 py-24 border-t border-white/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-hw-white mb-6">Frequently asked questions</h2>
          <p className="text-hw-slate-400">Direct answers to common questions about HourWise EU.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <FaqItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string, a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <HWCard
      variant="outline"
      padding="none"
      className={`overflow-hidden transition-all duration-300 ${open ? 'border-hw-blue-600/30 bg-hw-navy-900/40' : 'bg-white/5 border-white/5'}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-5 flex items-center justify-between text-left group"
      >
        <span className={`font-bold transition-colors ${open ? 'text-hw-blue-600' : 'text-hw-white group-hover:text-hw-blue-600'}`}>{q}</span>
        {open ? <ChevronUp size={20} className="text-hw-blue-600" /> : <ChevronDown size={20} className="text-hw-slate-500" />}
      </button>

      <div className={`transition-all duration-300 ease-in-out ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
        <div className="px-6 pb-6 text-hw-slate-400 text-sm leading-relaxed">
          {a}
        </div>
      </div>
    </HWCard>
  );
}
