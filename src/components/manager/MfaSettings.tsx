import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, CheckCircle, Shield } from 'lucide-react';

export function MfaSettings() {
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
      setSuccess('Multi-Factor Authentication has been successfully enabled!');
      setMfaEnabled(true);
      setQrCodeUrl(null); // Clear QR code
    }
    setLoading(false);
  };
  
  const handleUnenroll = async () => {
    setError('');
    setSuccess('');
    if (!window.confirm('Are you sure you want to disable Multi-Factor Authentication?')) return;
    
    setLoading(true);
    const totpFactor = user?.factors?.find(f => f.factor_type === 'totp' && f.status === 'verified');
    if (totpFactor) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
        if (error) {
            setError(error.message);
        } else {
            setSuccess('Multi-Factor Authentication has been disabled.');
            setMfaEnabled(false);
        }
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">Multi-Factor Authentication (MFA)</h3>
      </div>
      <p className="text-gray-600 mb-6">
        Add an extra layer of security to your account by requiring a code from an authenticator app on your phone.
      </p>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4">{success}</div>}

      {mfaEnabled ? (
        <div className="flex items-center justify-between bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <p className="font-semibold text-green-800">MFA is currently enabled.</p>
          </div>
          <button onClick={handleUnenroll} disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50">
            {loading ? 'Disabling...' : 'Disable'}
          </button>
        </div>
      ) : qrCodeUrl ? (
        <div>
          <p className="mb-4">1. Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy).</p>
          <div className="flex justify-center p-4 bg-white border rounded-lg mb-4">
            <img src={qrCodeUrl} alt="MFA QR Code" />
          </div>
          <p className="mb-4">2. Enter the 6-digit code from the app below to verify and complete setup.</p>
          <form onSubmit={handleVerify} className="flex gap-4">
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </form>
        </div>
      ) : (
        <button onClick={handleEnroll} disabled={loading} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50">
          {loading ? 'Starting...' : 'Enable MFA'}
        </button>
      )}
    </div>
  );
}
