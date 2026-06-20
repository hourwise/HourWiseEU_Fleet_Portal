import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Search, UserCheck, Mail, Clock, UserPlus, Trash2, Edit, AlertTriangle, CheckCircle, RefreshCw, Link as LinkIcon, Info } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import { InviteDriverModal } from './InviteDriverModal';
import { DriverDetailsModal } from './DriverDetailsModal';
import { DriverOnboardingModal } from './DriverOnboardingModal';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Invite = Database['public']['Tables']['driver_invites']['Row'];
type Document = Database['public']['Tables']['driver_documents']['Row'];
type InviteWithTacho = Invite & {
  tacho_card_number?: string | null;
  tacho_card_holder_name?: string | null;
  tacho_card_expiry?: string | null;
  tacho_card_issuing_authority?: string | null;
};
type DriverListItem = Profile & {
  type: 'driver';
  compliance: ReturnType<typeof getDriverComplianceStatus>;
};
type InviteListItem = InviteWithTacho & {
  type: 'invite';
  isGhost: boolean;
};
type CombinedListItem = DriverListItem | InviteListItem;

async function getFunctionErrorMessage(error: { message?: string; context?: unknown }) {
  const fallback = error.message ?? 'Unknown error';
  const context = error.context;

  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
}

const getDriverComplianceStatus = (driverId: string, allDocuments: Document[], t: TFunction) => {
  const driverDocs = allDocuments.filter(doc => doc.user_id === driverId);
  if (driverDocs.length === 0) {
    return { level: 'amber', text: t('driverManagement.status.noDocuments'), Icon: AlertTriangle, color: 'text-amber-600' };
  }

  let mostUrgentStatus = { level: 'green', daysDiff: Infinity };

  for (const doc of driverDocs) {
    if (!doc.expiry_date) {
      if (mostUrgentStatus.level !== 'red') {
        mostUrgentStatus = { level: 'amber', daysDiff: 999 };
      }
      continue;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(doc.expiry_date);
    const timeDiff = expiry.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      return { level: 'red', text: t('driverManagement.status.expired'), Icon: AlertTriangle, color: 'text-red-600' };
    }
    if (daysDiff <= 30 && daysDiff < mostUrgentStatus.daysDiff) {
      mostUrgentStatus = { level: 'amber', daysDiff };
    }
  }

  if (mostUrgentStatus.level === 'amber') {
    return {
      level: 'amber',
      text: mostUrgentStatus.daysDiff === 999 ? t('driverManagement.status.checkExpiry') : t('driverManagement.status.expiresIn', { days: mostUrgentStatus.daysDiff }),
      Icon: AlertTriangle,
      color: 'text-amber-600'
    };
  }

  return { level: 'green', text: t('driverManagement.status.compliant'), Icon: CheckCircle, color: 'text-green-600' };
};

interface PendingInviteUpdate {
  full_name: string;
  email: string;
  tacho_card_number: string | null;
  tacho_card_holder_name: string | null;
  tacho_card_expiry: string | null;
  tacho_card_issuing_authority: string | null;
}

interface PendingInviteUpdateQuery {
  update(values: PendingInviteUpdate): {
    eq(column: string, value: unknown): {
      eq(column: string, value: unknown): Promise<{ error: { message: string } | null }>;
    };
  };
}

function PendingInviteDetailsModal({
  invite,
  onClose,
  onSaved,
}: {
  invite: InviteWithTacho;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(invite.full_name ?? '');
  const [email, setEmail] = useState(invite.email ?? '');
  const [tachoCardNumber, setTachoCardNumber] = useState(invite.tacho_card_number ?? '');
  const [tachoCardHolderName, setTachoCardHolderName] = useState(invite.tacho_card_holder_name ?? invite.full_name ?? '');
  const [tachoCardExpiry, setTachoCardExpiry] = useState(invite.tacho_card_expiry ?? '');
  const [tachoCardIssuer, setTachoCardIssuer] = useState(invite.tacho_card_issuing_authority ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }

    setSaving(true);
    setError(null);

    const updateData: PendingInviteUpdate = {
      full_name: fullName.trim(),
      email: email.trim(),
      tacho_card_number: tachoCardNumber.trim() ? tachoCardNumber.trim().toUpperCase() : null,
      tacho_card_holder_name: tachoCardHolderName.trim() || null,
      tacho_card_expiry: tachoCardExpiry || null,
      tacho_card_issuing_authority: tachoCardIssuer.trim() || null,
    };

    try {
      const inviteTable = supabase.from('driver_invites') as unknown as PendingInviteUpdateQuery;
      const { error: saveError } = await inviteTable
        .update(updateData)
        .eq('id', invite.id)
        .eq('company_id', invite.company_id);

      if (saveError) throw new Error(saveError.message);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save pending invite.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="border-b p-6 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pending Invite</p>
            <h2 className="text-2xl font-bold text-gray-900">Driver Invite Details</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">x</button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {error ? <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
            </label>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Tachograph Pairing</p>
            <p className="mt-1 text-sm text-blue-900">
              These card details will be written to the driver profile when this invite is accepted.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-sm font-medium text-blue-900 mb-2">Card number</span>
                <input value={tachoCardNumber} onChange={(event) => setTachoCardNumber(event.target.value)} className="w-full px-3 py-2 border border-blue-200 rounded-lg bg-white text-gray-900 font-mono uppercase" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-blue-900 mb-2">Card holder name</span>
                <input value={tachoCardHolderName} onChange={(event) => setTachoCardHolderName(event.target.value)} className="w-full px-3 py-2 border border-blue-200 rounded-lg bg-white text-gray-900" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-blue-900 mb-2">Card expiry</span>
                <input type="date" value={tachoCardExpiry} onChange={(event) => setTachoCardExpiry(event.target.value)} className="w-full px-3 py-2 border border-blue-200 rounded-lg bg-white text-gray-900" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-blue-900 mb-2">Issuing authority</span>
                <input value={tachoCardIssuer} onChange={(event) => setTachoCardIssuer(event.target.value)} className="w-full px-3 py-2 border border-blue-200 rounded-lg bg-white text-gray-900" />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <p><span className="font-black uppercase tracking-widest text-slate-500">Invite code:</span> {invite.invite_code}</p>
            <p className="mt-1"><span className="font-black uppercase tracking-widest text-slate-500">Status:</span> {invite.status}</p>
          </div>
        </div>

        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-5 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition font-medium">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-5 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition font-bold">
            {saving ? 'Saving...' : 'Save Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DriverManagement({
  onOpenDriverTacho,
  onOpenDriverCompliance,
  onOpenDriverTraining,
  focusedDriverId,
}: {
  onOpenDriverTacho?: (driverId: string) => void;
  onOpenDriverCompliance?: (driverId: string) => void;
  onOpenDriverTraining?: (driverId: string) => void;
  focusedDriverId?: string;
}) {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'agency'>('all');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingDriverId, setRemovingDriverId] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Profile | null>(null);
  const [onboardingDriver, setOnboardingDriver] = useState<Profile | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<InviteWithTacho | null>(null);

  const isOnboardingIncomplete = (driver: Profile) =>
    !driver.phone_number || !driver.driving_licence_number || !driver.date_of_birth;

  const loadData = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data: driversData, error: driversError } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .neq('role', 'manager');

      const { data: invitesData, error: invitesError } = await supabase
        .from('driver_invites')
        .select('*')
        .eq('company_id', profile.company_id);

      const { data: documentsData, error: documentsError } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('company_id', profile.company_id);

      if (driversError) throw driversError;
      if (invitesError) throw invitesError;
      if (documentsError) throw documentsError;

      setDrivers(driversData || []);
      setInvites(invitesData || []);
      setDocuments(documentsData || []);
    } catch (error) {
      console.error('Error loading driver data:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!focusedDriverId || drivers.length === 0) return;
    const match = drivers.find((entry) => entry.id === focusedDriverId);
    if (match) {
      setSelectedDriver(match);
    }
  }, [drivers, focusedDriverId]);

  const handleRemoveDriver = async (driverId: string, driverName: string) => {
    if (window.confirm(t('common.confirmDelete', { name: driverName }))) {
      setRemovingDriverId(driverId);
      try {
        const { data, error } = await supabase.functions.invoke('remove-driver', { body: { driverId } });
        if (error) {
          const detail = await getFunctionErrorMessage(error);
          throw new Error(`Failed to remove driver: ${detail}`);
        }
        if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
          throw new Error(`Failed to remove driver: ${data.error}`);
        }
        await loadData();
      } catch (error) {
        console.error('Removal error:', error);
        alert((error as Error).message);
      } finally {
        setRemovingDriverId(null);
      }
    }
  };

  const handleClearInvite = async (inviteId: string) => {
    if (window.confirm('Delete this broken invite? This will not delete the driver\'s account, but will clear the record from your portal.')) {
      const { error } = await supabase.from('driver_invites').delete().eq('id', inviteId);
      if (!error) loadData();
    }
  };

  const combinedList = useMemo(() => {
    const activeEmails = new Set(drivers.map(d => d.email?.toLowerCase()));
    const activeIds = new Set(drivers.map(d => d.id));

    const list: CombinedListItem[] = [
      ...drivers.map(d => ({
        ...d,
        type: 'driver' as const,
        compliance: getDriverComplianceStatus(d.id, documents, t)
      })),

      ...invites
        .filter(i => {
          if (i.status === 'pending') return true;
          if (i.status === 'accepted') {
            const emailInFleet = activeEmails.has(i.email?.toLowerCase());
            const idInFleet = i.accepted_by_user_id ? activeIds.has(i.accepted_by_user_id) : false;
            return !emailInFleet && !idInFleet;
          }
          return false;
        })
        .map(i => ({
          ...i,
          type: 'invite' as const,
          isGhost: i.status === 'accepted'
        }))
    ];

    return list.filter(item => {
      const name = item.full_name || '';
      const email = item.email || '';
      const query = searchQuery.toLowerCase();

      const matchesSearch = name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      if (item.type === 'driver') {
        const isAgency = item.is_contractor;
        if (filterType === 'direct') return !isAgency;
        if (filterType === 'agency') return isAgency;
      } else {
        // Invites are usually for direct drivers unless marked otherwise (future-proofing)
        if (filterType === 'agency') return false;
      }

      return true;
    });
  }, [drivers, invites, documents, searchQuery, filterType, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('driverManagement.title')}</h2>
            <p className="text-gray-600">{drivers.length} {t('driverManagement.activeDrivers')}, {invites.filter(i => i.status === 'pending').length} {t('driverManagement.pendingInvites')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadData()}
            className="p-2 text-slate-400 hover:text-blue-600 transition"
            title={t('common.refresh')}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold"
          >
            <UserPlus className="w-5 h-5" />
            {t('driverManagement.inviteDriver')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search')}
              className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white font-medium"
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(['all', 'direct', 'agency'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-md transition-all ${
                  filterType === type
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {type === 'all' ? 'All' : type === 'direct' ? 'Direct' : 'Agency'}
              </button>
            ))}
          </div>
        </div>

        {loading && combinedList.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <Clock className="animate-spin text-blue-600" />
            <p className="text-slate-500 font-medium">{t('common.syncing')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {combinedList.length === 0 ? (
                <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{t('driverManagement.noDrivers')}</h3>
                    <p className="text-gray-600">{t('driverManagement.noDriversSubtitle', 'Invite drivers or click the refresh icon.')}</p>
                </div>
            ) : combinedList.map((item) => {
              const isInvite = item.type === 'invite';
              const isGhost = isInvite && item.isGhost;
              const ComplianceIcon = !isInvite ? item.compliance.Icon : null;

              return (
                <div key={item.id} className={`flex items-center justify-between p-4 border rounded-xl transition ${
                  !isInvite ? 'border-gray-200 hover:border-blue-300 bg-white shadow-sm' :
                  isGhost ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'
                }`}>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 items-center gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('driverManagement.labels.name')}</label>
                      <p className="font-bold text-slate-900">{item.full_name || t('driverManagement.incompleteSetup')}</p>
                      {isInvite && item.tacho_card_number && (
                        <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          Tacho: {item.tacho_card_number}
                        </span>
                      )}
                      {item.is_contractor && (
                        <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          Agency: {item.agency_name || 'Unspecified'}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('driverManagement.labels.email')}</label>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <p className="text-sm text-slate-600 font-medium">{item.email}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('driverManagement.labels.compliance')}</label>
                      {!isInvite ? (
                        <div className={`flex items-center gap-2 font-black text-[10px] uppercase ${item.compliance.color}`}>
                          {ComplianceIcon && <ComplianceIcon className="w-4 h-4" />}
                          <span>{item.compliance.text}</span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                          {isGhost ? t('driverManagement.status.linkMismatch') : t('driverManagement.status.pendingSetup', 'Pending Setup')}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('driverManagement.labels.status')}</label>
                      <div className="flex items-center gap-2">
                        {!isInvite ? (
                          <><UserCheck className="w-4 h-4 text-green-500" /><p className="text-[10px] font-black text-green-700 uppercase tracking-widest">{t('driverManagement.status.active')}</p></>
                        ) : isGhost ? (
                          <div className="flex items-center gap-2 text-red-600">
                            <LinkIcon className="w-4 h-4" />
                            <p className="text-[10px] font-black uppercase tracking-tighter">{t('driverManagement.status.lost')}</p>
                          </div>
                        ) : (
                          <><Clock className="w-4 h-4 text-amber-500" /><p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">{t('driverManagement.status.inviteSent')}</p></>
                        )}
                      </div>
                    </div>
                  </div>
                  {!isInvite && (
                    <div className="ml-4 flex gap-2 items-center">
                      {isOnboardingIncomplete(item as Profile) && (
                        <button
                          onClick={() => setOnboardingDriver(item as Profile)}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition tracking-widest shadow-sm shadow-amber-200"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Onboard</span>
                        </button>
                      )}
                      <button onClick={() => setSelectedDriver(item as Profile)} className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition tracking-widest">
                        <Edit className="w-3.5 h-3.5" />
                        <span>{t('common.details')}</span>
                      </button>
                      <button onClick={() => handleRemoveDriver(item.id, item.full_name ?? 'this driver')} disabled={removingDriverId === item.id} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 transition border border-red-100">
                        {removingDriverId === item.id ? <Clock className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                  {isInvite && !isGhost && (
                    <div className="ml-4 flex gap-2 items-center">
                      <button
                        onClick={() => setSelectedInvite(item as InviteWithTacho)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition tracking-widest"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Invite Details</span>
                      </button>
                      <button
                        onClick={() => handleClearInvite(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition border border-red-100"
                        title="Delete Pending Invite"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                  {isGhost && (
                    <div className="ml-4 flex gap-2">
                      <div className="group relative">
                        <Info className="w-5 h-5 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {t('driverManagement.lostInviteNotice')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleClearInvite(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition border border-red-100"
                        title="Clear Broken Invite"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showInviteModal && (<InviteDriverModal onClose={() => setShowInviteModal(false)} onInviteSent={loadData} />)}
      {selectedInvite && (
        <PendingInviteDetailsModal
          invite={selectedInvite}
          onClose={() => setSelectedInvite(null)}
          onSaved={() => { setSelectedInvite(null); loadData(); }}
        />
      )}
      {selectedDriver && (
        <DriverDetailsModal
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          onSave={() => { setSelectedDriver(null); loadData(); }}
          onOpenDriverTacho={onOpenDriverTacho}
          onOpenDriverCompliance={onOpenDriverCompliance}
          onOpenDriverTraining={onOpenDriverTraining}
        />
      )}
      {onboardingDriver && (<DriverOnboardingModal driver={onboardingDriver} onClose={() => setOnboardingDriver(null)} onComplete={() => { setOnboardingDriver(null); loadData(); }} />)}
    </div>
  );
}
