import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { HWCard } from '../ui/HWCard';

const faqs = [
  {
    q: "Is HourWise a tachograph replacement?",
    a: "No. HourWise is a support, analysis and record-keeping tool. It does not replace legally required tachograph equipment or operator responsibilities."
  },
  {
    q: "Can solo drivers use the app?",
    a: "Yes. Solo drivers can use the mobile app to track hours, receive alerts, record expenses and generate reports independently."
  },
  {
    q: "Can fleet drivers connect to an operator?",
    a: "Yes. Fleet-connected drivers can send shift data, checks, incidents and expenses directly to their company's portal."
  },
  {
    q: "Does the portal support tachograph files?",
    a: "Yes. The portal supports driver card (.DDD, .C1B) and vehicle unit file imports for analysis and audit archiving."
  },
  {
    q: "Is this for UK or EU drivers?",
    a: "HourWise is designed for UK/EU commercial driver workflows, supporting both GB domestic and EU drivers' hours rules."
  },
  {
    q: "Is HourWise suitable for small fleets?",
    a: "Absolutely. HourWise is specifically designed to be affordable and accessible for small to medium operators who need professional compliance tools."
  }
];

export function FaqSection() {
  return (
    <section className="bg-hw-navy-950 py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-hw-blue-600 uppercase tracking-[0.3em] mb-4">Questions</h2>
          <h3 className="text-3xl lg:text-4xl font-bold text-hw-white mb-6">Frequently Asked</h3>
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
      className={`overflow-hidden transition-all duration-300 ${open ? 'border-hw-blue-600/30 bg-hw-navy-900/40' : ''}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-5 flex items-center justify-between text-left"
      >
        <span className="font-bold text-hw-white">{q}</span>
        {open ? <ChevronUp size={20} className="text-hw-blue-600" /> : <ChevronDown size={20} className="text-hw-slate-500" />}
      </button>

      <div className={`transition-all duration-300 ease-in-out ${open ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
        <div className="px-6 pb-6 text-hw-slate-400 text-sm leading-relaxed">
          {a}
        </div>
      </div>
    </HWCard>
  );
}
