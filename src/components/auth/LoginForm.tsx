import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { Link } from '../common/Link';
import { supabase } from '../../lib/supabase';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'signIn' | 'forgotPassword' | 'magicLink'>('signIn');
  const { signIn, loading } = useAuth(); // Use the global loading state

  const handlePasswordSignIn = async () => {
    setError('');
    setMessage('');

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
    }
    // App.tsx will handle the redirect on successful login
  };
  
  const handlePasswordReset = async () => {
    setError('');
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
    });

    if (error) setError(error.message);
    else setMessage('Password reset link has been sent to your email.');
  };

  const handleMagicLinkSignIn = async () => {
    setError('');
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) setError(error.message);
    else setMessage('Check your email for the sign-in link.');
  };
  
  const renderForm = () => {
    switch(view) {
        case 'forgotPassword':
            return (
                <div className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                        <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-brand-dark border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-white" placeholder="your.email@company.com" required /></div>
                    </div>
                    <button onClick={handlePasswordReset} disabled={loading} className="w-full bg-brand-accent-dark text-white py-3 rounded-lg font-medium hover:bg-brand-accent transition disabled:opacity-50">{loading ? 'Sending...' : 'Send Reset Link'}</button>
                </div>
            );
        case 'magicLink':
            return (
                <div className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                        <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-brand-dark border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-white" placeholder="your.email@company.com" required /></div>
                    </div>
                    <button onClick={handleMagicLinkSignIn} disabled={loading} className="w-full bg-brand-accent-dark text-white py-3 rounded-lg font-medium hover:bg-brand-accent transition disabled:opacity-50">{loading ? 'Sending...' : 'Send Magic Link'}</button>
                </div>
            );
        case 'signIn':
        default:
            return (
                <div className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                        <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-brand-dark border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-white" placeholder="manager@company.com" required /></div>
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                        <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-brand-dark border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-white" placeholder="••••••••" required /></div>
                    </div>
                    <button onClick={handlePasswordSignIn} disabled={loading} className="w-full bg-brand-accent-dark text-white py-3 rounded-lg font-medium hover:bg-brand-accent transition disabled:opacity-50">{loading ? 'Signing in...' : 'Sign In'}</button>
                </div>
            );
    }
  }

  return (
    <div className="w-full max-w-md bg-brand-card rounded-2xl shadow-xl p-8 border border-brand-border">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">HourWise EU</h1>
        <p className="text-slate-400">
            {view === 'signIn' && 'Sign in to your fleet dashboard'}
            {view === 'forgotPassword' && 'Reset your password'}
            {view === 'magicLink' && 'Get a magic link to sign in'}
        </p>
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
            <button onClick={() => setView('magicLink')} className="font-medium text-brand-accent hover:text-brand-accent-dark">Sign in with Magic Link</button>
            <button onClick={() => setView('forgotPassword')} className="font-medium text-brand-accent hover:text-brand-accent-dark">Forgot password?</button>
        </div>
        {view !== 'signIn' && <button onClick={() => setView('signIn')} className="w-full text-center font-medium text-slate-300 hover:text-white">Back to Sign In</button>}

        <div className="relative pt-3">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-brand-border" /></div>
          <div className="relative flex justify-center text-sm"><span className="px-2 bg-brand-card text-slate-400">New to HourWise?</span></div>
        </div>

        <Link href="/signup" className="block w-full border border-brand-border text-slate-300 py-3 rounded-lg font-medium hover:bg-brand-dark transition text-center">
          Create Fleet Manager Account
        </Link>
      </div>
    </div>
  );
}