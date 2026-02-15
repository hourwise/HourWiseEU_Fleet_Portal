import React, { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle } from 'lucide-react';

interface MfaChallengeScreenProps {
  onSuccess: () => void;
}

export function MfaChallengeScreen({ onSuccess }: MfaChallengeScreenProps) {
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const cleanedCode = useMemo(() => verifyCode.replace(/\D/g, '').slice(0, 6), [verifyCode]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // If the user already has an AAL2 session, no need to challenge.
      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) throw aalError;

      if (aal.currentLevel === 'aal2' || aal.nextLevel === 'aal1') {
        onSuccess();
        return;
      }

      // Get the user's enrolled factors and select the verified TOTP factor
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const totpFactor = factors?.totp?.find((f) => f.status === 'verified') ?? null;

      if (!totpFactor) {
        setError('No verified authenticator found. Please enroll an authenticator first.');
        return;
      }

      // One-step helper: creates challenge then verifies the code
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: cleanedCode,
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? 'MFA verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark to-brand-card flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-brand-card rounded-2xl shadow-xl p-8 border border-brand-border">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Check Your Authenticator</h1>
          <p className="text-slate-400">Enter the 6-digit code from your authenticator app.</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-slate-300 mb-2">
              Verification Code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              value={cleanedCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              maxLength={6}
              className="w-full text-center tracking-[0.5em] text-2xl font-semibold pl-4 pr-4 py-3 bg-brand-dark border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent text-white"
              placeholder="123456"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || cleanedCode.length !== 6}
            className="w-full bg-brand-accent-dark text-white py-3 rounded-lg font-medium hover:bg-brand-accent transition disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
}
