import React, { useState } from 'react';
import { Send, X, CheckCircle2 } from 'lucide-react';
import { HWButton } from '../../ui/HWButton';

interface AtlasFeedbackFormProps {
  initialMessage?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AtlasFeedbackForm({ initialMessage = '', onClose, onSuccess }: AtlasFeedbackFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: initialMessage,
    type: 'question' as 'question' | 'feature_request',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const atlasEmail = 'Atlas@hourwiseeu.co.uk';
    const subject = encodeURIComponent(`Atlas Preview: ${formData.type === 'question' ? 'Question' : 'Feature Request'}`);
    const body = encodeURIComponent(
      `Name: ${formData.name || 'Not provided'}\n` +
      `Email: ${formData.email || 'Not provided'}\n` +
      `Type: ${formData.type}\n` +
      `Message: ${formData.message}`
    );

    // Simulate success and open mailto
    setTimeout(() => {
      window.location.href = `mailto:${atlasEmail}?subject=${subject}&body=${body}`;
      setSubmitted(true);
      setIsSubmitting(false);
      onSuccess();
    }, 800);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in duration-300">
        <div className="w-12 h-12 bg-hw-green-500/10 border border-hw-green-500/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 size={24} className="text-hw-green-500" />
        </div>
        <h3 className="text-lg font-bold text-hw-white mb-2">Message Prepared</h3>
        <p className="text-hw-slate-400 text-xs mb-6 max-w-[240px]">
          Your feedback has been prepared. Please send the drafted email to reach the Atlas team.
        </p>
        <HWButton size="sm" onClick={onClose}>Close</HWButton>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-hw-white uppercase tracking-widest">Send to Atlas Team</h3>
        <button onClick={onClose} className="p-1 text-hw-slate-500 hover:text-hw-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormData(f => ({ ...f, type: 'question' }))}
            className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
              formData.type === 'question'
                ? 'bg-hw-blue-600 border-hw-blue-600 text-white'
                : 'bg-white/5 border-white/5 text-hw-slate-500'
            }`}
          >
            Ask Question
          </button>
          <button
            type="button"
            onClick={() => setFormData(f => ({ ...f, type: 'feature_request' }))}
            className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
              formData.type === 'feature_request'
                ? 'bg-hw-blue-600 border-hw-blue-600 text-white'
                : 'bg-white/5 border-white/5 text-hw-slate-500'
            }`}
          >
            Suggest Feature
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-hw-slate-500 uppercase tracking-widest">Your Name (Optional)</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-hw-navy-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-hw-white focus:outline-none focus:border-hw-blue-600 transition-colors"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-hw-slate-500 uppercase tracking-widest">Your Email (Optional)</label>
          <input
            type="email"
            value={formData.email}
            onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
            className="w-full bg-hw-navy-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-hw-white focus:outline-none focus:border-hw-blue-600 transition-colors"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-hw-slate-500 uppercase tracking-widest">Message *</label>
          <textarea
            required
            rows={3}
            value={formData.message}
            onChange={e => setFormData(f => ({ ...f, message: e.target.value }))}
            className="w-full bg-hw-navy-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-hw-white focus:outline-none focus:border-hw-blue-600 transition-colors resize-none"
          />
        </div>

        <HWButton type="submit" disabled={isSubmitting} className="w-full group">
          {isSubmitting ? 'Preparing...' : 'Send to Atlas'}
          <Send size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
        </HWButton>

        <p className="text-[9px] text-hw-slate-600 text-center leading-relaxed">
          By submitting, you agree we may use your message to improve HourWise.
        </p>
      </form>
    </div>
  );
}
