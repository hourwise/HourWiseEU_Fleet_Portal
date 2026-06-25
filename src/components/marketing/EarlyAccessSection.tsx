import { Send, Sparkles } from 'lucide-react';
import { HWCard } from '../ui/HWCard';
import { HWButton } from '../ui/HWButton';
import { useState } from 'react';

export function EarlyAccessSection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      // In a real app, this would send to an API
    }
  };

  return (
    <section className="bg-hw-navy-900 py-24 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-hw-blue-600/50 to-transparent"></div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-hw-blue-600/10 border border-hw-blue-600/20 mb-8">
           <Sparkles size={14} className="text-hw-blue-600" />
           <span className="text-[10px] font-bold text-hw-blue-600 uppercase tracking-widest">Beta testing now open</span>
        </div>

        <h2 className="text-3xl lg:text-5xl font-bold text-hw-white mb-6">Help shape HourWise before launch.</h2>
        <p className="text-xl text-hw-slate-300 mb-12 leading-relaxed">
          We are looking for drivers, small fleets, and transport managers to test HourWise and provide feedback before our full release.
        </p>

        {submitted ? (
          <HWCard variant="glass" className="py-12 border-hw-green-500/30 animate-in zoom-in duration-500">
             <div className="text-hw-green-500 font-bold text-2xl mb-2">You're on the list!</div>
             <p className="text-hw-slate-300">We'll reach out soon with more information about early access.</p>
          </HWCard>
        ) : (
          <form onSubmit={handleSubmit} className="relative max-w-lg mx-auto">
            <input
              type="email"
              placeholder="Enter your work email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-hw-navy-950 border-2 border-hw-navy-800 rounded-2xl px-6 py-4 text-hw-white placeholder:text-hw-slate-600 focus:outline-none focus:border-hw-blue-600 transition-colors shadow-2xl"
            />
            <HWButton
              type="submit"
              className="mt-4 sm:mt-0 sm:absolute sm:right-2 sm:top-2 sm:bottom-2"
            >
              Join Early Access
              <Send size={16} className="ml-2" />
            </HWButton>
          </form>
        )}

        <p className="mt-8 text-sm text-hw-slate-500">
           By joining, you agree to receive occasional updates about the HourWise platform.
        </p>
      </div>
    </section>
  );
}
