import { useState } from 'react';
import { Mail, Lock, User, AlertCircle, Building2, Home, ShieldCheck } from 'lucide-react';
import { Link } from '../common/Link';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [signupMode, setSignupMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState('');
  const { signUp, loading } = useAuth();
  const { t } = useTranslation();

  const handleSignup = async () => {
    setError('');

    if (signupMode === 'join') {
      if (!authCode.trim()) {
        setError('Please enter a company authorization code.');
        return;
      }

      // Verify Auth Code
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('auth_code', authCode.trim().toUpperCase())
        .single();

      if (companyError || !company) {
        setError('Invalid authorization code. Please check with your fleet manager.');
        return;
      }

      // Sign up and join company
      const { error: signUpError } = await signUp(email, password, fullName, 'manager', company.name);
      if (signUpError) setError(signUpError.message);
    } else {
      // Standard manager signup (creates new company)
      const { error: signUpError } = await signUp(email, password, fullName, 'manager', companyName);
      if (signUpError) setError(signUpError.message);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 relative">
      <div className="absolute top-6 right-6">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 transition" title={t('navigation.home')}>
          <Home className="w-6 h-6" />
        </Link>
      </div>

      <div className="text-center mb-8">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
          signupMode === 'create' ? 'bg-orange-500' : 'bg-blue-600'
        }`}>
          {signupMode === 'create' ? <Building2 className="w-8 h-8 text-white" /> : <ShieldCheck className="w-8 h-8 text-white" />}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {signupMode === 'create' ? t('auth.managerSignup') : 'Supervisor Signup'}
        </h1>
        <p className="text-gray-600">
          {signupMode === 'create' ? t('auth.createCompanyAccountSubtitle') : 'Join an existing fleet dashboard'}
        </p>
      </div>

      <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
        <button
          onClick={() => setSignupMode('create')}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition ${
            signupMode === 'create' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'
          }`}
        >
          Create New Fleet
        </button>
        <button
          onClick={() => setSignupMode('join')}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition ${
            signupMode === 'join' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
          }`}
        >
          Join Existing
        </button>
      </div>

      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {signupMode === 'create' ? (
          <>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <p className="text-sm text-orange-900 font-medium">{t('auth.billingNotice')}</p>
            </div>
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">{t('auth.companyName')}</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input id="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-gray-900 bg-white" placeholder="Acme Logistics" />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-900 font-medium">Enter the code provided by your administrator.</p>
            </div>
            <div>
              <label htmlFor="authCode" className="block text-sm font-medium text-gray-700 mb-2">Company Auth Code</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input id="authCode" type="text" value={authCode} onChange={(e) => setAuthCode(e.target.value.toUpperCase())} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 text-gray-900 bg-white font-mono font-bold" placeholder="XJ39KL2P" />
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">{t('auth.fullName')}</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 text-gray-900 bg-white" placeholder="John Smith" required />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">{t('auth.email')}</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 text-gray-900 bg-white" placeholder="manager@company.com" required />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">{t('auth.password')}</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 text-gray-900 bg-white" placeholder="••••••••" required minLength={6} />
          </div>
        </div>

        <button
          onClick={handleSignup}
          disabled={loading}
          className={`w-full py-3 rounded-lg font-bold text-white transition disabled:opacity-50 ${
            signupMode === 'create' ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
          } shadow-lg`}
        >
          {loading ? t('auth.creatingAccount') : signupMode === 'create' ? t('auth.createFleetAccount') : 'Join Fleet Dashboard'}
        </button>
      </div>

      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">{t('auth.alreadyHaveAccount')}</Link>
      </div>
    </div>
  );
}
