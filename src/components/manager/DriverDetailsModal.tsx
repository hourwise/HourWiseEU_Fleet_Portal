// src/components/manager/DriverDetailsModal.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { X, Save, Trash2, Edit, MapPin, CreditCard, ShieldCheck, BadgeCheck, Clock, GraduationCap, Check, Ban } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ShiftEditModal } from './ShiftEditModal';
import { useTranslation } from 'react-i18next';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Document = Database['public']['Tables']['driver_documents']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];

interface DriverDetailsModalProps {
  driver: Profile;
  onClose: () => void;
  onSave: () => void;
}

interface DocumentSubmitPayload {
  file: File | null;
  idNumber: string;
  expiryDate: string;
}

const useDocumentUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [idNumber, setIdNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const reset = () => { setFile(null); setIdNumber(''); setExpiryDate(''); };
  return { file, setFile, idNumber, setIdNumber, expiryDate, setExpiryDate, reset };
};

const getDocumentStatus = (expiryDate: string | null | undefined, t: any) => {
  if (!expiryDate) return { text: t('driverDetails.status.missingExpiry'), color: 'text-gray-500', Icon: () => null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  const daysDiff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));
  if (daysDiff < 0) return { text: t('driverDetails.status.expired', { date: expiry.toLocaleDateString() }), color: 'text-red-600 font-bold', Icon: () => null };
  if (daysDiff <= 30) return { text: t('driverDetails.status.expiresIn', { days: daysDiff }), color: 'text-orange-500 font-semibold', Icon: () => null };
  return { text: t('driverDetails.status.expiresOn', { date: expiry.toLocaleDateString() }), color: 'text-green-600', Icon: () => null };
};

const LocationAnalysisMap = ({ driverId }: { driverId: string }) => {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<{ lat: number, lng: number }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchLocationHistory = async () => {
      setLoading(true);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('work_sessions').select('start_lat, start_lng').eq('user_id', driverId).gte('start_time', thirtyDaysAgo).not('start_lat', 'is', null);
      if (data) setLocations(data.map(loc => ({ lat: loc.start_lat!, lng: loc.start_lng! })));
      setLoading(false);
    };
    fetchLocationHistory();
  }, [driverId]);
  const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!accessToken) return null;
  if (loading) return <div className="text-center p-4">{t('driverDetails.labels.loadingMap')}</div>;
  if (locations.length === 0) return <p className="text-sm text-gray-500 text-center p-4">{t('driverDetails.labels.noMapData')}</p>;
  const markers = locations.slice(0, 50).map((loc, i) => `pin-s-${i+1}+2563EB(${loc.lng},${loc.lat})`).join(',');
  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${markers}/auto/600x300@2x?access_token=${accessToken}`;
  return <img src={mapUrl} alt="Heatmap" className="rounded-lg w-full" />;
};

export function DriverDetailsModal({ driver, onClose, onSave }: DriverDetailsModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [formData, setFormData] = useState<Partial<Profile>>(driver);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [shifts, setShifts] = useState<WorkSession[]>([]);
  const [editingShift, setEditingShift] = useState<WorkSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const licenceState = useDocumentUpload();
  const cpcState = useDocumentUpload();
  const tachoState = useDocumentUpload();

  const fetchDocuments = useCallback(async () => {
    const { data } = await supabase.from('driver_documents').select('*').eq('user_id', driver.id).order('uploaded_at', { ascending: false });
    setDocuments(data || []);
  }, [driver.id]);

  const fetchRecentShifts = useCallback(async () => {
    const { data } = await supabase.from('work_sessions').select('*').eq('user_id', driver.id).order('start_time', { ascending: false }).limit(10);
    setShifts(data || []);
  }, [driver.id]);

  useEffect(() => {
    fetchDocuments();
    fetchRecentShifts();
  }, [fetchDocuments, fetchRecentShifts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'is_active') {
      setFormData(prev => ({ ...prev, is_active: value === 'true' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value || null }));
    }
  };

  const handleDocumentStatus = async (docId: string, status: 'verified' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('driver_documents')
        .update({ verified_at: status === 'verified' ? new Date().toISOString() : null })
        .eq('id', docId);

      if (error) throw error;
      fetchDocuments();
    } catch (err: Error | unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert("Verification failed: " + errorMessage);
    }
  };

  const handleDocumentSubmit = async (state: DocumentSubmitPayload, type: string) => {
    if (!state.file || !state.idNumber || !state.expiryDate) return alert(t('driverDetails.errors.fillAll'));
    setIsUploading(true);
    const filePath = `${driver.company_id}/${driver.id}/${type}_${Date.now()}`;
    try {
      const { error: uploadError } = await supabase.storage.from('driver-documents').upload(filePath, state.file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('driver_documents').insert({
        user_id: driver.id,
        company_id: driver.company_id!,
        document_type: type,
        storage_path: filePath,
        id_number: state.idNumber,
        expiry_date: state.expiryDate,
        uploaded_by: user?.id
      });
      if (dbError) throw dbError;

      // Update profile master fields automatically
      const profileUpdates: Partial<Profile> = {};
      if (type === 'HGV_Licence') {
        profileUpdates.driving_licence_number = state.idNumber;
        profileUpdates.driving_licence_expiry = state.expiryDate;
      } else if (type === 'CPC_Card') {
        profileUpdates.cpc_dqc_number = state.idNumber;
        profileUpdates.cpc_dqc_expiry = state.expiryDate;
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: updateError } = await supabase.from('profiles').update(profileUpdates).eq('id', driver.id);
        if (updateError) throw updateError;
        setFormData(prev => ({ ...prev, ...profileUpdates }));
      }

      state.reset();
      fetchDocuments();
    } catch (err: Error | unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(t('driverDetails.errors.uploadError', { message: err.message }));
    } finally { setIsUploading(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);

    const updateData = {
      full_name: formData.full_name,
      payroll_number: formData.payroll_number,
      national_insurance_number: formData.national_insurance_number,
      date_of_birth: formData.date_of_birth,
      phone_number: formData.phone_number,
      emergency_contact_name: formData.emergency_contact_name,
      emergency_contact_phone: formData.emergency_contact_phone,
      is_active: formData.is_active,
      full_address: formData.full_address,
      driving_licence_number: formData.driving_licence_number,
      driving_licence_expiry: formData.driving_licence_expiry,
      cpc_dqc_number: formData.cpc_dqc_number,
      cpc_dqc_expiry: formData.cpc_dqc_expiry
    };

    try {
      const { error } = await supabase.from('profiles').update(updateData).eq('id', driver.id);
      if (error) throw error;
      onSave();
      onClose();
    } catch (err: any) {
      console.error("Save failed:", err);
      alert(t('driverDetails.errors.updateFailed') + ": " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderInput = (label: string, name: keyof Profile, type = "text") => (
    <div>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={(formData[name] as string) || ''}
        onChange={handleInputChange}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 font-bold"
      />
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center p-6 border-b bg-slate-50 rounded-t-2xl">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('driverDetails.title', { name: driver.full_name })}</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{driver.email}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition"><X /></button>
          </div>

          <div className="p-6 space-y-8 overflow-y-auto">
            {/* 1. MASTER PROFILE SECTION */}
            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 border-b border-blue-50 pb-2">
                <Edit size={14}/> {t('driverDetails.sections.profile')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {renderInput(t('driverDetails.labels.fullName'), "full_name")}
                {renderInput(t('driverDetails.labels.payrollNo'), "payroll_number")}
                {renderInput(t('driverDetails.labels.niNumber'), "national_insurance_number")}
                {renderInput(t('driverDetails.labels.dob'), "date_of_birth", "date")}
                {renderInput(t('driverDetails.labels.phone'), "phone_number")}
                {renderInput(t('driverDetails.labels.emergencyName'), "emergency_contact_name")}
                {renderInput(t('driverDetails.labels.emergencyPhone'), "emergency_contact_phone")}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('driverDetails.labels.status')}</label>
                  <select
                    name="is_active"
                    value={formData.is_active ? 'true' : 'false'}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 font-bold"
                  >
                    <option value="true">{t('driverDetails.status.active')}</option>
                    <option value="false">{t('driverDetails.status.inactive')}</option>
                  </select>
                </div>
              </div>

              {/* QUICK COMPLIANCE EDIT */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Compliance Details (Quick Edit)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {renderInput(t('driverDetails.labels.licenceNo'), "driving_licence_number")}
                  {renderInput(t('driverDetails.labels.qualExpiry') + " (Licence)", "driving_licence_expiry", "date")}
                  {renderInput(t('driverDetails.labels.cpcNo'), "cpc_dqc_number")}
                  {renderInput(t('driverDetails.labels.qualExpiry') + " (CPC)", "cpc_dqc_expiry", "date")}
                </div>
              </div>

              <div className="mt-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('driverDetails.labels.address')}</label>
                <textarea name="full_address" value={formData.full_address || ''} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white font-medium" />
              </div>
            </section>

            {/* 2. COMPLIANCE DOCUMENTS SECTION */}
            <section className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <h3 className="text-xs font-black text-amber-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 border-b border-amber-100 pb-2">
                <ShieldCheck size={14}/> {t('driverDetails.sections.compliance')} (Evidence Upload)
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* A. DRIVING LICENCE */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase">
                    <BadgeCheck size={16} className="text-blue-600" /> {t('driverDetails.labels.licence')}
                  </div>
                  <input type="text" placeholder={t('driverDetails.labels.licenceNo')} value={licenceState.idNumber} onChange={e => licenceState.setIdNumber(e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-slate-50 font-bold uppercase" />
                  <input type="date" value={licenceState.expiryDate} onChange={e => licenceState.setExpiryDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-slate-50 font-bold" />
                  <input type="file" onChange={e => licenceState.setFile(e.target.files?.[0] || null)} className="text-[10px] text-slate-500 w-full" />
                  <button onClick={() => handleDocumentSubmit(licenceState, 'HGV_Licence')} disabled={isUploading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100">{t('driverDetails.buttons.uploadLicence')}</button>
                </div>

                {/* B. CPC CARD */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase">
                    <GraduationCap size={16} className="text-amber-600" /> {t('driverDetails.labels.cpc')}
                  </div>
                  <input type="text" placeholder={t('driverDetails.labels.cpcNo')} value={cpcState.idNumber} onChange={e => cpcState.setIdNumber(e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-slate-50 font-bold uppercase" />
                  <input type="date" value={cpcState.expiryDate} onChange={e => cpcState.setExpiryDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-slate-50 font-bold" />
                  <input type="file" onChange={e => cpcState.setFile(e.target.files?.[0] || null)} className="text-[10px] text-slate-500 w-full" />
                  <button onClick={() => handleDocumentSubmit(cpcState, 'CPC_Card')} disabled={isUploading} className="w-full py-2.5 bg-amber-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-700 transition shadow-lg shadow-amber-100">{t('driverDetails.buttons.uploadCpc')}</button>
                </div>

                {/* C. TACHO CARD */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase">
                    <CreditCard size={16} className="text-slate-900" /> {t('driverDetails.labels.tacho')}
                  </div>
                  <input type="text" placeholder={t('driverDetails.labels.tachoNo')} value={tachoState.idNumber} onChange={e => tachoState.setIdNumber(e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-slate-50 font-bold uppercase" />
                  <input type="date" value={tachoState.expiryDate} onChange={e => tachoState.setExpiryDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-slate-50 font-bold" />
                  <div className="pt-[76px]">
                    <input type="file" onChange={e => tachoState.setFile(e.target.files?.[0] || null)} className="text-[10px] text-slate-500 w-full" />
                  </div>
                  <button onClick={() => handleDocumentSubmit(tachoState, 'Tacho_Card')} disabled={isUploading} className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-black transition shadow-lg shadow-slate-200">{t('driverDetails.buttons.uploadTacho')}</button>
                </div>
              </div>

              {/* DOCUMENT HISTORY LIST */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map(doc => {
                  const status = getDocumentStatus(doc.expiry_date, t);
                  const isVerified = !!doc.verified_at;
                  return (
                    <div key={doc.id} className="flex justify-between items-center p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-blue-200 transition">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <Paperclip className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{doc.document_type.replace('_', ' ')}</p>
                          <p className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter">{t('driverDetails.labels.ref', { ref: doc.id_number })}</p>
                          <p className={`text-[10px] flex items-center gap-1 font-black uppercase mt-1 ${status.color}`}>
                            <status.Icon size={10}/> {status.text}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {isVerified ? (
                              <span className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded uppercase">
                                <Check size={10}/> {t('driverDetails.labels.verified')}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">
                                <Clock size={10}/> {t('driverDetails.labels.pending')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!isVerified ? (
                          <button
                            onClick={() => handleDocumentStatus(doc.id, 'verified')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                            title={t('driverDetails.labels.verify')}
                          >
                            <Check size={16}/>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDocumentStatus(doc.id, 'rejected')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title={t('driverDetails.labels.reject')}
                          >
                            <Ban size={16}/>
                          </button>
                        )}
                        <button className="p-2 text-slate-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3. RECENT ACTIVITY & LOCATION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <section>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Clock size={14}/> {t('driverDetails.sections.activity')}
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {shifts.length > 0 ? shifts.map(s => (
                    <div key={s.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-xl bg-white hover:bg-slate-50 transition shadow-sm">
                      <div>
                        <p className="text-xs font-black text-slate-900 uppercase">{new Date(s.start_time).toLocaleDateString()} @ {new Date(s.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{t('driverDetails.labels.duration', { hours: s.duration_ms ? (s.duration_ms / 3600000).toFixed(2) : '?' })}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingShift(s)} className="p-2 hover:bg-blue-50 rounded-lg border border-slate-100 text-blue-600 transition"><Edit size={14}/></button>
                        {s.start_lat && <a href={`https://www.google.com/maps?q=${s.start_lat},${s.start_lng}`} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-green-50 rounded-lg border border-slate-100 text-green-600 transition"><MapPin size={14}/></a>}
                      </div>
                    </div>
                  )) : <p className="text-xs text-slate-400 italic">{t('driverDetails.labels.noShifts')}</p>}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <MapPin size={14}/> {t('driverDetails.sections.locations')}
                </h3>
                <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 h-[300px] relative">
                  <LocationAnalysisMap driverId={driver.id} />
                </div>
              </section>
            </div>
          </div>

          <div className="p-6 border-t bg-slate-50 flex justify-end gap-4 rounded-b-2xl">
            <button onClick={onClose} className="px-8 py-3 border border-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-white transition-all">{t('common.cancel')}</button>
            <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50">
              <Save size={16}/> {isSaving ? t('driverDetails.buttons.saving') : t('driverDetails.buttons.commit')}
            </button>
          </div>
        </div>
      </div>

      {editingShift && (
        <ShiftEditModal shift={editingShift} onClose={() => setEditingShift(null)} onSave={() => { setEditingShift(null); fetchRecentShifts(); }} />
      )}
    </>
  );
}
