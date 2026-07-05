import React, { useState } from 'react';
import { Send, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { HWButton } from '../../ui/HWButton';
import { submitAtlasFeedback } from './atlasService';

interface AtlasFeedbackFormProps {
  initialMessage?: string;
  matchedIntentId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AtlasFeedbackForm({ initialMessage = '', matchedIntentId, onClose, onSuccess }: AtlasFeedbackFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: initialMessage,
    type: 'question' as 'question' | 'feature_request',
    consent: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const result = await submitAtlasFeedback({
      name: formData.name,
      email: formData.email,
      message_type: formData.type,
      message_content: formData.message,
      atlas_matched_intent: matchedIntentId,
      consent_contact: formData.consent,
    });

    if (result.success) {
      setSubmitted(true);
      setIsSubmitting(false);
      onSuccess();
    } else {
      setIsSubmitting(false);
      setError("We couldn't reach the database, but you can still send via email.");
    }
  };

  const handleMailFallback = () => {
    const atlasEmail = 'Atlas@hourwiseeu.co.uk';
    const subject = encodeURIComponent(`Atlas Preview: ${formData.type === 'question' ? 'Question' : 'Feature Request'}`);
    const body = encodeURIComponent(
      `Name: ${formData.name || 'Not provided'}\n` +
      `Email: ${formData.email || 'Not provided'}\n` +
      `Type: ${formData.type}\n` +
      `Message: ${formData.message}`
    );
    window.location.href = `mailto:${atlasEmail}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in duration-300">
        <div className="w-12 h-12 bg-hw-green-500/10 border border-hw-green-500/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 size={24} className="text-hw-green-500" />
        </div>
        <h3 className="text-lg font-bold text-hw-white mb-2">Message Sent</h3>
        <p className="text-hw-slate-400 text-xs mb-6 max-w-[240px]">
          Thanks! Your message has been sent directly to the Atlas team. We'll review it shortly.
        </p>
        <HWButton size="sm" onClick={onClose}>Return to chat</HWButton>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-hw-white uppercase tracking-widest">Message Atlas Team</h3>
        <button onClick={onClose} className="p-1 text-hw-slate-500 hover:text-hw-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-hw-red-500/10 border border-hw-red-500/20 rounded-xl flex items-start space-x-3 mb-4">
            <AlertCircle size={16} className="text-hw-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[10px] text-hw-red-500 font-bold leading-tight">{error}</p>
              <button
                type="button"
                onClick={handleMailFallback}
                className="text-[10px] text-hw-white underline mt-1 hover:text-hw-blue-600 transition-colors"
              >
                Send via Email instead
              </button>
            </div>
          </div>
        )}

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

        <div className="flex items-center space-x-2 py-1">
          <input
            type="checkbox"
            id="consent"
            checked={formData.consent}
            onChange={e => setFormData(f => ({ ...f, consent: e.target.checked }))}
            className="rounded border-white/10 bg-hw-navy-950 text-hw-blue-600"
          />
          <label htmlFor="consent" className="text-[9px] text-hw-slate-500 uppercase tracking-widest font-bold">
            I'm happy to be contacted about this
          </label>
        </div>

        <HWButton type="submit" disabled={isSubmitting} className="w-full group">
          {isSubmitting ? 'Sending...' : 'Send Message'}
          <Send size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
        </HWButton>
      </form>
    </div>
  );
}
