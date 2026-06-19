import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface InviteDriverModalProps {
  onClose: () => void;
  onInviteSent: () => void;
  initialFullName?: string;
  tachographCardSnapshot?: {
    cardNumber: string;
    holderName?: string | null;
    cardExpiry?: string | null;
    issuingAuthority?: string | null;
    sourceImportId?: string | null;
  };
}

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

export function InviteDriverModal({ onClose, onInviteSent, initialFullName = '', tachographCardSnapshot }: InviteDriverModalProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [fullName, setFullName] = useState(initialFullName);
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
        setError(t('inviteDriver.errors.noCompany'));
        return;
    }
    setLoading(true);

    const payConfigSnapshot = {
        hourly_rate: parseFloat(hourlyRate) || 0,
        unpaid_break_minutes: parseInt(unpaidBreakMinutes, 10) || 0,
        overtime_threshold_hours: parseFloat(overtimeThreshold) || null,
        overtime_threshold_unit: overtimeThresholdUnit,
        overtime_rate_multiplier: parseFloat(overtimeMultiplier) || null,
        additional_overtime_tiers: additionalTiers
          .map((tier) => ({
            threshold: parseFloat(tier.threshold),
            unit: tier.unit,
            rate: parseFloat(tier.rate),
          }))
          .filter(t => !isNaN(t.threshold) && !isNaN(t.rate)),
        allowance_tiers: allowanceTiers
          .map((tier) => ({
            amount: parseFloat(tier.amount),
            unit: tier.unit,
          }))
          .filter(t => !isNaN(t.amount)),
    };

    try {
        const { data, error: functionError } = await supabase.functions.invoke('create-driver-invite', {
            body: {
                companyId: profile.company_id,
                inviteEmail: email,
                inviteFullName: fullName,
                payConfigSnapshot,
                tachographCardSnapshot,
            },
        });

        if (functionError) {
          const detailedError = data?.error || functionError.message;
          throw new Error(detailedError);
        }

        onInviteSent();
        onClose();
    } catch (err: unknown) {
        console.error("Error sending invite:", err);
        setError(err instanceof Error ? err.message : t('inviteDriver.errors.generic'));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="border-b p-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">{t('inviteDriver.modal.title')}</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><X/></button>
        </div>

        <form onSubmit={handleSendInvite} className="p-6 space-y-6 overflow-y-auto">
            {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg">{error}</div>}

            {tachographCardSnapshot?.cardNumber ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Tachograph Card Prefill</p>
                <p className="mt-2">
                  This invite will remember card {tachographCardSnapshot.cardNumber}
                  {tachographCardSnapshot.cardExpiry ? `, expiring ${tachographCardSnapshot.cardExpiry}` : ''}.
                  When the driver accepts, their profile will be paired to this card number.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('inviteDriver.modal.fullName')}</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('inviteDriver.modal.email')}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
                </div>
            </div>

            <div className="border-t pt-6 space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">{t('inviteDriver.modal.payConfig')}</h3>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-gray-50">
                    <div>
                        <label className="block text-sm font-medium text-gray-600">{t('inviteDriver.modal.hourlyRate')}</label>
                        <input type="number" step="0.01" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} required className="w-full mt-1 px-3 py-2 border border-gray-300 rounded bg-white text-gray-900" placeholder="15.50" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600">{t('inviteDriver.modal.unpaidBreak')}</label>
                        <input type="number" value={unpaidBreakMinutes} onChange={e => setUnpaidBreakMinutes(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded bg-white text-gray-900" placeholder="30" />
                    </div>
                </div>

                <div className="p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-semibold text-gray-700 mb-2">{t('inviteDriver.modal.allowances')}</h4>
                    {allowanceTiers.map((tier) => (
                        <div key={tier.id} className="flex items-end gap-2 mb-2">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">{t('inviteDriver.modal.allowanceAmount')}</label>
                                <input type="number" step="0.01" value={tier.amount} onChange={e => setAllowanceTiers(p => p.map(i => i.id === tier.id ? {...i, amount: e.target.value} : i))} className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">{t('inviteDriver.modal.unit')}</label>
                                <select value={tier.unit} onChange={e => setAllowanceTiers(p => p.map(i => i.id === tier.id ? {...i, unit: e.target.value as AllowanceUnit} : i))} className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900 h-[34px]">
                                    <option value="hour">{t('inviteDriver.modal.units.hour')}</option>
                                    <option value="day">{t('inviteDriver.modal.units.day')}</option>
                                    <option value="week">{t('inviteDriver.modal.units.week')}</option>
                                    <option value="month">{t('inviteDriver.modal.units.month')}</option>
                                    <option value="shift">{t('inviteDriver.modal.units.shift')}</option>
                                </select>
                            </div>
                            <button type="button" onClick={() => setAllowanceTiers(p => p.filter(i => i.id !== tier.id))} className="p-2 bg-red-100 rounded text-red-600 hover:bg-red-200 transition"><Trash2 size={16} /></button>
                        </div>
                    ))}
                    <button type="button" onClick={() => setAllowanceTiers(p => [...p, {id: Date.now().toString(), amount: '', unit: 'shift'}])} className="text-sm text-blue-600 mt-2 flex items-center gap-2 hover:text-blue-700 transition font-medium"><Plus size={16} /> {t('inviteDriver.modal.addAllowance')}</button>
                </div>

                <div className="p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-semibold text-gray-700 mb-4">{t('inviteDriver.modal.overtime')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-600">{t('inviteDriver.modal.otThreshold')}</label>
                            <input type="number" step="0.1" value={overtimeThreshold} onChange={e => setOvertimeThreshold(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded bg-white text-gray-900" placeholder="8" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600">{t('inviteDriver.modal.otUnit')}</label>
                            <select value={overtimeThresholdUnit} onChange={e => setOvertimeThresholdUnit(e.target.value as OvertimeUnit)} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded bg-white text-gray-900 h-[42px]">
                               <option value="day">{t('inviteDriver.modal.units.daily')}</option>
                               <option value="week">{t('inviteDriver.modal.units.weekly')}</option>
                               <option value="month">{t('inviteDriver.modal.units.monthly')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600">{t('inviteDriver.modal.otMultiplier')}</label>
                            <input type="number" step="0.1" value={overtimeMultiplier} onChange={e => setOvertimeMultiplier(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded bg-white text-gray-900" placeholder="1.5" />
                        </div>
                    </div>
                     <h4 className="font-semibold text-gray-700 mb-2 mt-4 text-sm">{t('inviteDriver.modal.additionalTiers')}</h4>
                    {additionalTiers.map((tier) => (
                        <div key={tier.id} className="flex items-end gap-2 mb-2">
                             <div className="flex-1">
                                <label className="text-xs text-gray-500">{t('inviteDriver.modal.afterHours')}</label>
                                <input type="number" step="0.1" value={tier.threshold} onChange={e => setAdditionalTiers(p => p.map(i => i.id === tier.id ? {...i, threshold: e.target.value} : i))} className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">{t('inviteDriver.modal.unit')}</label>
                                <select value={tier.unit} onChange={e => setAdditionalTiers(p => p.map(i => i.id === tier.id ? {...i, unit: e.target.value as OvertimeUnit} : i))} className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900 h-[34px]">
                                   <option value="day">{t('inviteDriver.modal.units.daily')}</option>
                                   <option value="week">{t('inviteDriver.modal.units.weekly')}</option>
                                   <option value="month">{t('inviteDriver.modal.units.monthly')}</option>
                                </select>
                            </div>
                             <div className="flex-1">
                                <label className="text-xs text-gray-500">{t('inviteDriver.modal.newMultiplier')}</label>
                                <input type="number" step="0.1" value={tier.rate} onChange={e => setAdditionalTiers(p => p.map(i => i.id === tier.id ? {...i, rate: e.target.value} : i))} className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900" />
                            </div>
                            <button type="button" onClick={() => setAdditionalTiers(p => p.filter(i => i.id !== tier.id))} className="p-2 bg-red-100 rounded text-red-600 hover:bg-red-200 transition"><Trash2 size={16} /></button>
                        </div>
                    ))}
                    <button type="button" onClick={() => setAdditionalTiers(p => [...p, {id: Date.now().toString(), threshold: '', unit: 'day', rate: ''}])} className="text-sm text-blue-600 mt-2 flex items-center gap-2 hover:text-blue-700 transition font-medium"><Plus size={16} /> {t('inviteDriver.modal.addOtTier')}</button>
                </div>
            </div>

            <div className="flex gap-3 pt-6 border-t">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition font-medium">{t('common.cancel')}</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition font-bold shadow-sm">
                    {loading ? t('inviteDriver.modal.submitting') : t('inviteDriver.modal.submit')}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
