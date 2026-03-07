import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Plus, Trash2 } from 'lucide-react';

interface InviteDriverModalProps {
  onClose: () => void;
  onInviteSent: () => void;
}

// Mirroring types from the mobile app for consistency
type OvertimeUnit = 'day' | 'week' | 'month';
type AllowanceUnit = 'hour' | 'day' | 'week' | 'month' | 'shift';

interface AdditionalTier {
  id: string;
  threshold: string;
  unit: OvertimeUnit;
  rate: string;
}

interface AllowanceTier {
  id: string;
  amount: string;
  unit: AllowanceUnit;
}

export function InviteDriverModal({ onClose, onInviteSent }: InviteDriverModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [unpaidBreakMinutes, setUnpaidBreakMinutes] = useState('');
  const [overtimeThreshold, setOvertimeThreshold] = useState('');
  const [overtimeThresholdUnit, setOvertimeThresholdUnit] = useState<OvertimeUnit>('day');
  const [overtimeMultiplier, setOvertimeMultiplier] = useState('1.5');
  const [additionalTiers, setAdditionalTiers] = useState<AdditionalTier[]>([]);
  const [allowanceTiers, setAllowanceTiers] = useState<AllowanceTier[]>([]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!profile?.company_id) {
        setError("You are not associated with a company.");
        return;
    }
    setLoading(true);

    const payConfigSnapshot = { /* ... */ };

    try {
        const { data, error: functionError } = await supabase.functions.invoke('create-driver-invite', {
            body: {
                companyId: profile.company_id,
                inviteEmail: email,
                inviteFullName: fullName,
                payConfigSnapshot,
            },
        });

        if (functionError) {
          const detailedError = data?.error || functionError.message;
          throw new Error(detailedError);
        }

        onInviteSent();
        onClose();
    } catch (err: any) {
        console.error("Error sending invite:", err);
        setError(err.message || "An unknown error occurred.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* THIS IS THE RESTORED JSX */}
        <div className="border-b p-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Invite New Driver</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X/></button>
        </div>

        <form onSubmit={handleSendInvite} className="p-6 space-y-6 overflow-y-auto">
            {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-gray-900" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-gray-900" />
                </div>
            </div>

            <div className="border-t pt-6 space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">Pay Configuration</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                    {/* ... Basic Pay inputs ... */}
                </div>
                <div className="p-4 border rounded-lg">
                    {/* ... Allowances inputs ... */}
                </div>
                <div className="p-4 border rounded-lg">
                    {/* ... Overtime inputs ... */}
                </div>
            </div>

            <div className="flex gap-3 pt-6 border-t">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                    {loading ? 'Sending Invite...' : 'Send Invite'}
                </button>
            </div>
        </form>
        {/* END OF RESTORED JSX */}
      </div>
    </div>
  );
}
