/**
 * DriverOnboardingModal
 *
 * A guided 4-step wizard that collects all employment, personal, and compliance
 * details for a new driver in one flow. On completion it:
 *   1. Updates the driver's profiles row with all personal/compliance fields
 *   2. Uploads any documents provided (licence, CPC, tacho) to Supabase Storage
 *   3. Inserts corresponding driver_documents rows
 */
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  X, ChevronRight, ChevronLeft, CheckCircle,
  User, Briefcase, ShieldCheck, ClipboardList,
  BadgeCheck, GraduationCap, CreditCard, Upload,
} from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface Props {
  driver: Profile;
  onClose: () => void;
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Step data shapes
// ---------------------------------------------------------------------------

interface PersonalData {
  full_name: string;
  date_of_birth: string;
  phone_number: string;
  national_insurance_number: string;
  full_address: string;
}

interface EmploymentData {
  payroll_number: string;
  employment_start_date: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  is_contractor: boolean;
  agency_name: string;
}

interface ComplianceData {
  // Driving Licence
  driving_licence_number: string;
  driving_licence_expiry: string;
  licence_file: File | null;
  // CPC / DQC
  cpc_dqc_number: string;
  cpc_dqc_expiry: string;
  cpc_file: File | null;
  // Tacho Card
  tacho_number: string;
  tacho_expiry: string;
  tacho_file: File | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, label: 'Personal',    Icon: User },
  { id: 2, label: 'Employment',  Icon: Briefcase },
  { id: 3, label: 'Compliance',  Icon: ShieldCheck },
  { id: 4, label: 'Review',      Icon: ClipboardList },
];

const inputClass =
  'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelClass =
  'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5';

function FieldInput({
  id, label, type = 'text', value, onChange, placeholder, required,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}

function FileUploadSlot({
  id, label, colour, file, onChange,
}: {
  id: string; label: string; colour: string; file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label} <span className="text-slate-300 font-normal normal-case">(optional)</span></label>
      <label
        htmlFor={id}
        className={`flex items-center gap-3 px-3 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition
          ${file ? `border-${colour}-300 bg-${colour}-50` : 'border-slate-200 hover:border-slate-300'}`}
      >
        <Upload size={14} className={file ? `text-${colour}-500` : 'text-slate-400'} />
        <span className={`text-xs font-bold truncate ${file ? `text-${colour}-700` : 'text-slate-400'}`}>
          {file ? file.name : 'Choose file…'}
        </span>
        <input id={id} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only"
          onChange={e => onChange(e.target.files?.[0] ?? null)} />
      </label>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-xs font-bold ${value ? 'text-slate-800' : 'text-slate-300 italic'}`}>
        {value || 'Not provided'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DriverOnboardingModal({ driver, onClose, onComplete }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step data
  const [personal, setPersonal] = useState<PersonalData>({
    full_name: driver.full_name ?? '',
    date_of_birth: driver.date_of_birth ?? '',
    phone_number: driver.phone_number ?? '',
    national_insurance_number: driver.national_insurance_number ?? '',
    full_address: driver.full_address ?? '',
  });

  const [employment, setEmployment] = useState<EmploymentData>({
    payroll_number: driver.payroll_number ?? '',
    employment_start_date: '',
    emergency_contact_name: driver.emergency_contact_name ?? '',
    emergency_contact_phone: driver.emergency_contact_phone ?? '',
    is_contractor: (driver as any).is_contractor ?? false,
    agency_name: (driver as any).agency_name ?? '',
  });

  const [compliance, setCompliance] = useState<ComplianceData>({
    driving_licence_number: driver.driving_licence_number ?? '',
    driving_licence_expiry: driver.driving_licence_expiry ?? '',
    licence_file: null,
    cpc_dqc_number: driver.cpc_dqc_number ?? '',
    cpc_dqc_expiry: driver.cpc_dqc_expiry ?? '',
    cpc_file: null,
    tacho_number: '',
    tacho_expiry: '',
    tacho_file: null,
  });

  // --- Validation per step ---
  const canProceed = () => {
    if (step === 1) return personal.full_name.trim().length > 0;
    if (step === 2) return true; // employment all optional
    if (step === 3) return true; // files all optional
    return true;
  };

  // --- Upload a single document file ---
  const uploadDoc = async (
    file: File,
    type: string,
    idNumber: string,
    expiryDate: string,
  ) => {
    const filePath = `${driver.company_id}/${driver.id}/${type}_${Date.now()}`;
    const { error: uploadErr } = await supabase.storage
      .from('driver-documents')
      .upload(filePath, file);
    if (uploadErr) throw uploadErr;

    const { error: dbErr } = await supabase.from('driver_documents').insert({
      user_id: driver.id,
      company_id: driver.company_id!,
      document_type: type,
      storage_path: filePath,
      id_number: idNumber || null,
      expiry_date: expiryDate || null,
      uploaded_by: user?.id ?? null,
    });
    if (dbErr) throw dbErr;
  };

  // --- Final save ---
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // 1. Update profiles
      const profileUpdate: Partial<Profile> = {
        full_name: personal.full_name || driver.full_name,
        date_of_birth: personal.date_of_birth || null,
        phone_number: personal.phone_number || null,
        national_insurance_number: personal.national_insurance_number || null,
        full_address: personal.full_address || null,
        payroll_number: employment.payroll_number || null,
        emergency_contact_name: employment.emergency_contact_name || null,
        emergency_contact_phone: employment.emergency_contact_phone || null,
        is_contractor: employment.is_contractor,
        agency_name: employment.is_contractor ? employment.agency_name : null,
        driving_licence_number: compliance.driving_licence_number || null,
        driving_licence_expiry: compliance.driving_licence_expiry || null,
        cpc_dqc_number: compliance.cpc_dqc_number || null,
        cpc_dqc_expiry: compliance.cpc_dqc_expiry || null,
      };

      const { error: profileErr } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', driver.id);
      if (profileErr) throw profileErr;

      // 2. Upload documents if provided
      if (compliance.licence_file) {
        await uploadDoc(
          compliance.licence_file,
          'HGV_Licence',
          compliance.driving_licence_number,
          compliance.driving_licence_expiry,
        );
      }
      if (compliance.cpc_file) {
        await uploadDoc(
          compliance.cpc_file,
          'CPC_Card',
          compliance.cpc_dqc_number,
          compliance.cpc_dqc_expiry,
        );
      }
      if (compliance.tacho_file) {
        await uploadDoc(
          compliance.tacho_file,
          'Tacho_Card',
          compliance.tacho_number,
          compliance.tacho_expiry,
        );
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render steps
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Personal details for {driver.full_name}'s employment record.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FieldInput id="ob-fullname" label="Full Legal Name" value={personal.full_name}
          onChange={v => setPersonal(p => ({ ...p, full_name: v }))} required
          placeholder="As it appears on driving licence" />
        <FieldInput id="ob-dob" label="Date of Birth" type="date" value={personal.date_of_birth}
          onChange={v => setPersonal(p => ({ ...p, date_of_birth: v }))} />
        <FieldInput id="ob-phone" label="Mobile / Phone" value={personal.phone_number}
          onChange={v => setPersonal(p => ({ ...p, phone_number: v }))}
          placeholder="+44 7700 000000" />
        <FieldInput id="ob-ni" label="National Insurance Number" value={personal.national_insurance_number}
          onChange={v => setPersonal(p => ({ ...p, national_insurance_number: v.toUpperCase() }))}
          placeholder="AB 12 34 56 C" />
      </div>
      <div>
        <label htmlFor="ob-address" className={labelClass}>Home Address</label>
        <textarea
          id="ob-address"
          rows={3}
          value={personal.full_address}
          onChange={e => setPersonal(p => ({ ...p, full_address: e.target.value }))}
          placeholder="Full postal address"
          className={inputClass + ' resize-none'}
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Employment record and emergency contact information.</p>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Agency / Contractor Driver?</label>
          <button
            type="button"
            onClick={() => setEmployment(p => ({ ...p, is_contractor: !p.is_contractor }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${employment.is_contractor ? 'bg-blue-600' : 'bg-slate-200'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${employment.is_contractor ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {employment.is_contractor && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <FieldInput
              id="ob-agency"
              label="Agency Name"
              value={employment.agency_name}
              onChange={v => setEmployment(p => ({ ...p, agency_name: v }))}
              placeholder="e.g. Manpower, Pertemps"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FieldInput id="ob-payroll" label="Payroll / Employee Number"
          value={employment.payroll_number}
          onChange={v => setEmployment(p => ({ ...p, payroll_number: v }))}
          placeholder="e.g. EMP-00147" />
        <FieldInput id="ob-startdate" label="Employment Start Date" type="date"
          value={employment.employment_start_date}
          onChange={v => setEmployment(p => ({ ...p, employment_start_date: v }))} />
      </div>
      <div className="pt-2 border-t border-slate-100">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Emergency Contact</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FieldInput id="ob-ecname" label="Contact Name"
            value={employment.emergency_contact_name}
            onChange={v => setEmployment(p => ({ ...p, emergency_contact_name: v }))}
            placeholder="e.g. Jane Smith" />
          <FieldInput id="ob-ecphone" label="Contact Phone"
            value={employment.emergency_contact_phone}
            onChange={v => setEmployment(p => ({ ...p, emergency_contact_phone: v }))}
            placeholder="+44 7700 000000" />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Enter licence and card details. Upload documents now or add them later via the driver file.
      </p>

      {/* Driving Licence */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-blue-700 font-black text-xs uppercase tracking-widest">
          <BadgeCheck size={15} /> HGV Driving Licence
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldInput id="ob-lic-num" label="Licence Number"
            value={compliance.driving_licence_number}
            onChange={v => setCompliance(p => ({ ...p, driving_licence_number: v.toUpperCase() }))}
            placeholder="SMITH751124AB9IJ" />
          <FieldInput id="ob-lic-exp" label="Expiry Date" type="date"
            value={compliance.driving_licence_expiry}
            onChange={v => setCompliance(p => ({ ...p, driving_licence_expiry: v }))} />
        </div>
        <FileUploadSlot id="ob-lic-file" label="Upload Licence Scan" colour="blue"
          file={compliance.licence_file}
          onChange={f => setCompliance(p => ({ ...p, licence_file: f }))} />
      </div>

      {/* CPC / DQC */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-amber-700 font-black text-xs uppercase tracking-widest">
          <GraduationCap size={15} /> CPC / DQC Card
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldInput id="ob-cpc-num" label="DQC Card Number"
            value={compliance.cpc_dqc_number}
            onChange={v => setCompliance(p => ({ ...p, cpc_dqc_number: v.toUpperCase() }))}
            placeholder="GB123456789" />
          <FieldInput id="ob-cpc-exp" label="DQC Expiry Date" type="date"
            value={compliance.cpc_dqc_expiry}
            onChange={v => setCompliance(p => ({ ...p, cpc_dqc_expiry: v }))} />
        </div>
        <div className="bg-amber-100/60 rounded-lg px-3 py-2 text-xs text-amber-800 font-medium">
          ℹ️ The DQC expiry date is tracked in the <strong>CPC Dashboard</strong> tab of the Training Centre and will alert you when renewal is approaching.
        </div>
        <FileUploadSlot id="ob-cpc-file" label="Upload Check My CPC PDF" colour="amber"
          file={compliance.cpc_file}
          onChange={f => setCompliance(p => ({ ...p, cpc_file: f }))} />
      </div>

      {/* Tacho Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-black text-xs uppercase tracking-widest">
          <CreditCard size={15} /> Digital Tachograph Card
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldInput id="ob-tacho-num" label="Card Number"
            value={compliance.tacho_number}
            onChange={v => setCompliance(p => ({ ...p, tacho_number: v.toUpperCase() }))}
            placeholder="GB-12345678-0" />
          <FieldInput id="ob-tacho-exp" label="Expiry Date" type="date"
            value={compliance.tacho_expiry}
            onChange={v => setCompliance(p => ({ ...p, tacho_expiry: v }))} />
        </div>
        <FileUploadSlot id="ob-tacho-file" label="Upload Tacho Card Scan" colour="slate"
          file={compliance.tacho_file}
          onChange={f => setCompliance(p => ({ ...p, tacho_file: f }))} />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Review everything before saving. You can go back to make changes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Personal */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <User size={11} /> Personal Details
          </p>
          <ReviewRow label="Full Name" value={personal.full_name} />
          <ReviewRow label="Date of Birth" value={personal.date_of_birth ? new Date(personal.date_of_birth).toLocaleDateString() : null} />
          <ReviewRow label="Phone" value={personal.phone_number} />
          <ReviewRow label="NI Number" value={personal.national_insurance_number} />
          <ReviewRow label="Address" value={personal.full_address} />
        </div>

        {/* Employment */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Briefcase size={11} /> Employment
          </p>
          <ReviewRow label="Type" value={employment.is_contractor ? `Agency (${employment.agency_name})` : 'Direct Employee'} />
          <ReviewRow label="Payroll No" value={employment.payroll_number} />
          <ReviewRow label="Start Date" value={employment.employment_start_date ? new Date(employment.employment_start_date).toLocaleDateString() : null} />
          <ReviewRow label="Emergency Contact" value={employment.emergency_contact_name} />
          <ReviewRow label="Emergency Phone" value={employment.emergency_contact_phone} />
        </div>

        {/* Compliance */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 md:col-span-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <ShieldCheck size={11} /> Compliance
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8">
            <div>
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">HGV Licence</p>
              <ReviewRow label="Number" value={compliance.driving_licence_number} />
              <ReviewRow label="Expiry" value={compliance.driving_licence_expiry ? new Date(compliance.driving_licence_expiry).toLocaleDateString() : null} />
              <ReviewRow label="Document" value={compliance.licence_file?.name ?? null} />
            </div>
            <div>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2">CPC / DQC</p>
              <ReviewRow label="DQC Number" value={compliance.cpc_dqc_number} />
              <ReviewRow label="Expiry" value={compliance.cpc_dqc_expiry ? new Date(compliance.cpc_dqc_expiry).toLocaleDateString() : null} />
              <ReviewRow label="Document" value={compliance.cpc_file?.name ?? null} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Tacho Card</p>
              <ReviewRow label="Card Number" value={compliance.tacho_number} />
              <ReviewRow label="Expiry" value={compliance.tacho_expiry ? new Date(compliance.tacho_expiry).toLocaleDateString() : null} />
              <ReviewRow label="Document" value={compliance.tacho_file?.name ?? null} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}
    </div>
  );

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4][step - 1];

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-black text-slate-900">Driver Onboarding</h2>
            <p className="text-xs text-slate-400 mt-0.5">{driver.full_name} · {driver.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => step > s.id && setStep(s.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition
                    ${step === s.id ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : step > s.id ? 'text-emerald-600 cursor-pointer hover:bg-emerald-50'
                    : 'text-slate-400 cursor-default'}`}
                >
                  {step > s.id
                    ? <CheckCircle size={13} />
                    : <s.Icon size={13} />}
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${step > s.id ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {stepContent?.()}
        </div>

        {/* Footer navigation */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-white transition"
          >
            <ChevronLeft size={14} />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <span className="text-xs text-slate-400 font-bold">Step {step} of {STEPS.length}</span>

          {step < STEPS.length ? (
            <button
              onClick={() => canProceed() && setStep(s => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40 transition shadow-sm shadow-blue-200"
            >
              Continue <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm shadow-emerald-200"
            >
              <CheckCircle size={14} />
              {saving ? 'Saving…' : 'Complete Onboarding'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
