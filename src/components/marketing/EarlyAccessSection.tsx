import { Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { HWCard } from '../ui/HWCard';
import { HWButton } from '../ui/HWButton';
import { useState, type FormEvent } from 'react';

const earlyAccessEmail = 'info@hourwiseeu.co.uk';

const ROLES = [
  'Solo driver',
  'Fleet driver',
  'Transport manager',
  'Fleet owner',
  'Compliance consultant',
  'Workshop / maintenance',
  'Other'
];

const INTERESTS = [
  { id: 'driver-app', label: 'Driver App' },
  { id: 'fleet-portal', label: 'Fleet Portal' },
  { id: 'tachograph', label: 'Tachograph Analysis' },
  { id: 'atlas', label: 'Atlas AI Assistant' },
  { id: 'beta', label: 'Beta Testing' }
];

export function EarlyAccessSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    company: '',
    fleetSize: '',
    interests: [] as string[],
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleInterestToggle = (id: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter(i => i !== id)
        : [...prev.interests, id]
    }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.email || !formData.name || !formData.role) return;

    const subject = encodeURIComponent('HourWise EU Early Access Request');
    const body = encodeURIComponent(
      `HourWise EU Early Access Request\n\n` +
      `Name: ${formData.name}\n` +
      `Email: ${formData.email}\n` +
      `Role: ${formData.role}\n` +
      `Company: ${formData.company || 'N/A'}\n` +
      `Fleet Size: ${formData.fleetSize || 'N/A'}\n` +
      `Interests: ${formData.interests.join(', ') || 'None specified'}\n` +
      `Message: ${formData.message || 'No message'}`
    );

    setSubmitted(true);
    window.location.href = `mailto:${earlyAccessEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <section id="early-access" className="bg-hw-navy-900 py-24 relative overflow-hidden border-t border-white/5">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-hw-blue-600/30 to-transparent"></div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-hw-blue-600/10 border border-hw-blue-600/20 mb-8">
             <Sparkles size={14} className="text-hw-blue-600" />
             <span className="text-[10px] font-bold text-hw-blue-600 uppercase tracking-widest">Help shape HourWise before launch</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-hw-white mb-6">Join early access</h2>
          <p className="text-lg text-hw-slate-400 max-w-2xl mx-auto">
            We are looking for drivers, fleets, and transport managers to test HourWise EU and provide feedback before full release.
          </p>
        </div>

        {submitted ? (
          <HWCard variant="glass" className="py-16 border-hw-green-500/30 text-center animate-in zoom-in duration-500">
             <div className="w-16 h-16 bg-hw-green-500/10 border border-hw-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={32} className="text-hw-green-500" />
             </div>
             <h3 className="text-2xl font-bold text-hw-white mb-4">Email request ready</h3>
             <p className="text-hw-slate-300 max-w-md mx-auto mb-8">
               Thanks — your request is prepared. Please send the drafted email to <span className="text-hw-blue-600 font-bold">{earlyAccessEmail}</span> to join the list.
             </p>
             <HWButton variant="outline" onClick={() => setSubmitted(false)}>
               Edit Information
             </HWButton>
          </HWCard>
        ) : (
          <HWCard variant="glass" className="p-8 sm:p-12 border-white/10 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-hw-slate-400 uppercase tracking-widest">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-hw-navy-950 border border-white/10 rounded-xl px-4 py-3 text-hw-white focus:outline-none focus:border-hw-blue-600 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-hw-slate-400 uppercase tracking-widest">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-hw-navy-950 border border-white/10 rounded-xl px-4 py-3 text-hw-white focus:outline-none focus:border-hw-blue-600 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-hw-slate-400 uppercase tracking-widest">Your Role *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full bg-hw-navy-950 border border-white/10 rounded-xl px-4 py-3 text-hw-white focus:outline-none focus:border-hw-blue-600 transition-colors appearance-none"
                  >
                    <option value="">Select your role</option>
                    {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-hw-slate-400 uppercase tracking-widest">Company / Fleet Size</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Company"
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      className="w-full bg-hw-navy-950 border border-white/10 rounded-xl px-4 py-3 text-hw-white text-xs focus:outline-none focus:border-hw-blue-600 transition-colors"
                    />
                    <input
                      type="text"
                      placeholder="Size (e.g. 5-10)"
                      value={formData.fleetSize}
                      onChange={(e) => setFormData(prev => ({ ...prev, fleetSize: e.target.value }))}
                      className="w-full bg-hw-navy-950 border border-white/10 rounded-xl px-4 py-3 text-hw-white text-xs focus:outline-none focus:border-hw-blue-600 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-hw-slate-400 uppercase tracking-widest">I'm interested in:</label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map(interest => (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => handleInterestToggle(interest.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                        formData.interests.includes(interest.id)
                          ? 'bg-hw-blue-600 border-hw-blue-600 text-white'
                          : 'bg-white/5 border-white/5 text-hw-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {interest.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-hw-slate-400 uppercase tracking-widest">Message (Optional)</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                  className="w-full bg-hw-navy-950 border border-white/10 rounded-xl px-4 py-3 text-hw-white focus:outline-none focus:border-hw-blue-600 transition-colors resize-none"
                />
              </div>

              <div className="pt-4">
                <HWButton type="submit" size="lg" className="w-full group">
                  Get launch updates
                  <Send size={18} className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </HWButton>
                <p className="mt-4 text-[10px] text-center text-hw-slate-500 uppercase tracking-widest">
                  We'll send launch updates and beta opportunities as they become available.
                </p>
              </div>
            </form>
          </HWCard>
        )}
      </div>
    </section>
  );
}
