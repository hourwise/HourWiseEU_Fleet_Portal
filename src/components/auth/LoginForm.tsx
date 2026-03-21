import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, Lock, AlertCircle, Home } from 'lucide-react';
import { Link } from '../common/Link';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'signIn' | 'forgotPassword' | 'magicLink'>('signIn');
  const { signIn, loading } = useAuth();
  const { t } = useTranslation();

  const handlePasswordSignIn = async () => {
    setError('');
    setMessage('');
    const { error } = await signIn(email, password);
    if (error) setError(error.message);
  };
  
  const handlePasswordReset = async () => {
    setError('');
    setMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setMessage(t('auth.messages.resetSent'));
  };

  const handleMagicLinkSignIn = async () => {
    setError('');
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setMessage(t('auth.messages.magicLinkSent'));
  };
  
  const renderForm = () => {
    switch(view) {
        case 'forgotPassword':
            return (
                <div className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">{t('auth.email')}</label>
                        <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-brand-dark border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-white" placeholder="your.email@company.com" required /></div>
                    </div>
                    <button onClick={handlePasswordReset} disabled={loading} className="w-full bg-brand-accent-dark text-white py-3 rounded-lg font-medium hover:bg-brand-accent transition disabled:opacity-50">{loading ? t('common.loading') : t('auth.sendResetLink')}</button>
                </div>
            );
        case 'magicLink':
            return (
                <div className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">{t('auth.email')}</label>
                        <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-brand-dark border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-white" placeholder="your.email@company.com" required /></div>
                    </div>
                    <button onClick={handleMagicLinkSignIn} disabled={loading} className="w-full bg-brand-accent-dark text-white py-3 rounded-lg font-medium hover:bg-brand-accent transition disabled:opacity-50">{loading ? t('common.loading') : t('auth.sendMagicLink')}</button>
                </div>
            );
        case 'signIn':
        default:
            return (
                <div className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">{t('auth.email')}</label>
                        <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-brand-dark border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-white" placeholder="manager@company.com" required /></div>
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">{t('auth.password')}</label>
                        <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-brand-dark border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-white" placeholder="••••••••" required /></div>
                    </div>
                    <button onClick={handlePasswordSignIn} disabled={loading} className="w-full bg-brand-accent-dark text-white py-3 rounded-lg font-medium hover:bg-brand-accent transition disabled:opacity-50">{loading ? t('common.loading') : t('auth.login')}</button>
                </div>
            );
    }
  }

  return (
    <div className="w-full max-w-md bg-brand-card rounded-2xl shadow-xl p-8 border border-brand-border">
      <div className="flex justify-between items-start mb-8">
        <div className="text-left">
          <h1 className="text-3xl font-bold text-white mb-2">{t('app.name')}</h1>
          <p className="text-slate-400">
              {view === 'signIn' && t('auth.signInSubtitle')}
              {view === 'forgotPassword' && t('auth.forgotPasswordSubtitle')}
              {view === 'magicLink' && t('auth.magicLinkSubtitle')}
          </p>
        </div>
        <Link href="/" className="p-2 text-slate-400 hover:text-white transition" title={t('navigation.home')}>
          <Home className="w-6 h-6" />
        </Link>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
      {message && (
        <div className="bg-green-900/50 border border-green-700 rounded-lg p-4 flex items-start gap-3 mb-4">
          <p className="text-sm text-green-300">{message}</p>
        </div>
      )}

      {renderForm()}

      <div className="mt-6 space-y-3">
        <div className="flex justify-between items-center text-sm">
            <button onClick={() => setView('magicLink')} className="font-medium text-brand-accent hover:text-brand-accent-dark">{t('auth.magicLink')}</button>
            <button onClick={() => setView('forgotPassword')} className="font-medium text-brand-accent hover:text-brand-accent-dark">{t('auth.forgotPassword')}</button>
        </div>
        {view !== 'signIn' && <button onClick={() => setView('signIn')} className="w-full text-center font-medium text-slate-300 hover:text-white">{t('auth.backToSignIn')}</button>}

        <div className="relative pt-3">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-brand-border" /></div>
          <div className="relative flex justify-center text-sm"><span className="px-2 bg-brand-card text-slate-400">{t('auth.newToApp')}</span></div>
        </div>

        <Link href="/signup" className="block w-full border border-brand-border text-slate-300 py-3 rounded-lg font-medium hover:bg-brand-dark transition text-center">
          {t('auth.createAccount')}
        </Link>
      </div>
    </div>
  );
}
