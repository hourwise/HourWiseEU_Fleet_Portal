import { useState } from 'react';
import { Mail, Lock, User, AlertCircle, Building2, Home } from 'lucide-react';
import { Link } from '../common/Link';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const { signUp, loading } = useAuth();
  const { t } = useTranslation();

  const handleManagerSignup = async () => {
    setError('');
    const { error: signUpError } = await signUp(email, password, fullName, 'manager', companyName);
    if (signUpError) setError(signUpError.message);
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 relative">
      <div className="absolute top-6 right-6">
        <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 transition" title={t('navigation.home')}>
          <Home className="w-6 h-6" />
        </Link>
      </div>

      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.managerSignup')}</h1>
        <p className="text-gray-600">{t('auth.createCompanyAccountSubtitle')}</p>
      </div>

      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-orange-900 font-medium">{t('auth.billingNotice')}</p>
          <p className="text-xs text-orange-700 mt-1">{t('auth.codeNotice')}</p>
        </div>

        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">{t('auth.companyName')}</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input id="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white" placeholder="Acme Logistics" required />
          </div>
        </div>

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">{t('auth.fullName')}</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white" placeholder="John Smith" required />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">{t('auth.email')}</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white" placeholder="manager@company.com" required />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">{t('auth.password')}</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white" placeholder="••••••••" required minLength={6} />
          </div>
        </div>

        <button onClick={handleManagerSignup} disabled={loading} className="w-full bg-orange-600 text-white py-3 rounded-lg font-medium hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? t('auth.creatingAccount') : t('auth.createFleetAccount')}
        </button>
      </div>

      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">{t('auth.alreadyHaveAccount')}</Link>
      </div>
    </div>
  );
}
