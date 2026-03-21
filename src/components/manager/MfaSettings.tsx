import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function MfaSettings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user has MFA enrolled
    if (user?.factors) {
      const isEnrolled = user.factors.some(factor => factor.status === 'verified' && factor.factor_type === 'totp');
      setMfaEnabled(isEnrolled);
    }
  }, [user]);

  const handleEnroll = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
    });

    if (error) {
      setError(error.message);
    } else if (data) {
      setQrCodeUrl(data.totp.qr_code);
      setChallengeId(data.id); // Save challenge ID for verification
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      challengeId: challengeId!,
      code: verifyCode,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(t('mfa.successEnabled'));
      setMfaEnabled(true);
      setQrCodeUrl(null); // Clear QR code
    }
    setLoading(false);
  };
  
  const handleUnenroll = async () => {
    setError('');
    setSuccess('');
    if (!window.confirm(t('mfa.confirmDisable'))) return;
    
    setLoading(true);
    const totpFactor = user?.factors?.find(f => f.factor_type === 'totp' && f.status === 'verified');
    if (totpFactor) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
        if (error) {
            setError(error.message);
        } else {
            setSuccess(t('mfa.successDisabled'));
            setMfaEnabled(false);
        }
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">{t('mfa.title')}</h3>
      </div>
      <p className="text-gray-600 mb-6">
        {t('mfa.subtitle')}
      </p>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4">{success}</div>}

      {mfaEnabled ? (
        <div className="flex items-center justify-between bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <p className="font-semibold text-green-800">{t('mfa.enabled')}</p>
          </div>
          <button onClick={handleUnenroll} disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50">
            {loading ? t('mfa.disabling') : t('mfa.disableButton')}
          </button>
        </div>
      ) : qrCodeUrl ? (
        <div>
          <p className="mb-4">{t('mfa.step1')}</p>
          <div className="flex justify-center p-4 bg-white border rounded-lg mb-4">
            <img src={qrCodeUrl} alt="MFA QR Code" />
          </div>
          <p className="mb-4">{t('mfa.step2')}</p>
          <form onSubmit={handleVerify} className="flex gap-4">
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder={t('mfa.placeholder')}
              maxLength={6}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {loading ? t('mfa.verifying') : t('mfa.verifyButton')}
            </button>
          </form>
        </div>
      ) : (
        <button onClick={handleEnroll} disabled={loading} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50">
          {loading ? t('mfa.starting') : t('mfa.enableButton')}
        </button>
      )}
    </div>
  );
}
