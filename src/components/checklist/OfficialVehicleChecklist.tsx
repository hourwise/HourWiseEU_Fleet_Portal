import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Info, Check, X, ShieldCheck, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const INTERNAL_CHECKS = [
  { id: 'mirrors' },
  { id: 'wipers' },
  { id: 'front_view' },
  { id: 'warning_lamps' },
  { id: 'steering' },
  { id: 'horn' },
  { id: 'brakes_air' },
  { id: 'height_marker' },
  { id: 'seatbelts' },
];

const EXTERNAL_CHECKS = [
  { id: 'lights_ind' },
  { id: 'leaks' },
  { id: 'battery' },
  { id: 'adblue' },
  { id: 'smoke' },
  { id: 'body_wings' },
  { id: 'spray' },
  { id: 'tyres_wheels' },
  { id: 'brake_line' },
  { id: 'electrical' },
  { id: 'coupling' },
  { id: 'load_security' },
  { id: 'number_plate' },
  { id: 'reflectors' },
  { id: 'markers' },
];

const TRAILER_CHECKS = [
  { id: 'landing_legs' },
  { id: 'trailer_brakes' },
  { id: 'curtains_doors' },
];

export function OfficialVehicleChecklist() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [regNumber, setRegNumber] = useState('');
  const [trailerReg, setTrailerReg] = useState('');
  const [vehicleType, setVehicleType] = useState('Van');
  const [vehicleMake, setVehicleMake] = useState('');
  const [showHints, setShowHints] = useState<string | null>(null);
  const [defectDetails, setDefectDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isTractor = vehicleType === 'HGV' || vehicleType === 'Class 1' || vehicleType === 'Class 2';

  const handleSubmit = async () => {
    const requiredItems = [...INTERNAL_CHECKS, ...EXTERNAL_CHECKS];
    if (isTractor) {
      requiredItems.push(...TRAILER_CHECKS);
    }

    if (Object.keys(answers).length < requiredItems.length) {
      setError(t('vehicleChecklist.errors.incomplete'));
      return;
    }
    if (!regNumber.trim()) {
      setError(t('vehicleChecklist.errors.missingReg'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const hasDefects = Object.values(answers).some(a => a === false);

      const { error: submitError } = await supabase
        .from('vehicle_checks')
        .insert({
          driver_id: profile?.id,
          company_id: profile?.company_id,
          reg_number: regNumber.toUpperCase().trim(),
          vehicle_type: vehicleType,
          vehicle_make: vehicleMake.trim(),
          check_status: hasDefects ? 'defect' : 'pass',
          items: {
            ...answers,
            trailer_reg: trailerReg.toUpperCase().trim() || null
          },
          defect_details: hasDefects ? defectDetails : null,
        });

      if (submitError) throw submitError;
      setSuccess(true);
    } catch (err: any) {
      console.error('Error submitting checklist:', err);
      setError(err.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-3xl mx-auto p-4 text-center">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 shadow-sm">
          <ShieldCheck className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-900 mb-2">{t('vehicleChecklist.success.title')}</h2>
          <p className="text-green-700">{t('vehicleChecklist.success.message')}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition"
          >
            Start New Check
          </button>
        </div>
      </div>
    );
  }

  const renderSection = (titleKey: string, items: { id: string }[]) => (
    <div className="mb-8">
      <h3 className="text-lg font-black text-slate-800 mb-4 border-b border-slate-100 pb-2 tracking-wide uppercase">{t(titleKey)}</h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">{t(`vehicleChecklist.items.${item.id}`)}</span>
                <button onClick={() => setShowHints(showHints === item.id ? null : item.id)} type="button" className="p-1 hover:bg-blue-50 rounded-full transition-colors">
                  <Info size={16} className="text-blue-500" />
                </button>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setAnswers({...answers, [item.id]: true})}
                  className={`p-2 rounded-lg border transition-all ${answers[item.id] === true ? 'bg-green-100 border-green-500 text-green-600 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  <Check size={20} />
                </button>
                <button
                  onClick={() => setAnswers({...answers, [item.id]: false})}
                  className={`p-2 rounded-lg border transition-all ${answers[item.id] === false ? 'bg-red-100 border-red-500 text-red-600 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            {showHints === item.id && (
              <div className="mt-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg animate-in slide-in-from-top-1 duration-200">
                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                  <span className="font-black uppercase text-[10px] mr-2">{t('vehicleChecklist.labels.hint')}:</span>
                  {t(`vehicleChecklist.items.${item.id}Hint`)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="text-green-600 w-10 h-10" />
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('vehicleChecklist.title')}</h2>
          <p className="text-sm text-slate-500 font-medium">Professional DVSA-Standard Inspection</p>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3 shadow-sm animate-shake">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Vehicle Info Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-10 space-y-6">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-slate-50 pb-2">
          <Truck size={14} className="text-blue-600" /> {t('vehicleChecklist.sections.vehicleDetails')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('vehicleChecklist.labels.regNumber')}</label>
            <input
              type="text"
              placeholder="E.G. AB12 CDE"
              className="w-full p-3 border border-slate-200 rounded-xl uppercase font-black text-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm bg-slate-50"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('vehicleChecklist.labels.vehicleType')}</label>
            <select
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-900 font-bold appearance-none cursor-pointer shadow-sm"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
            >
              <option value="Van">Van</option>
              <option value="7.5t">7.5t Truck</option>
              <option value="HGV">HGV (Artic)</option>
              <option value="Class 2">Class 2 (Rigid)</option>
              <option value="Trailer">Trailer Only</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('vehicleChecklist.labels.vehicleMake')}</label>
            <input
              type="text"
              placeholder="E.G. SCANIA, DAF"
              className="w-full p-3 border border-slate-200 rounded-xl uppercase font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all bg-slate-50"
              value={vehicleMake}
              onChange={(e) => setVehicleMake(e.target.value)}
            />
          </div>
          {isTractor && (
            <div className="animate-in slide-in-from-left-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">{t('vehicleChecklist.labels.trailerReg')}</label>
              <input
                type="text"
                placeholder="E.G. T12345"
                className="w-full p-3 border border-amber-200 rounded-xl uppercase font-black text-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all shadow-sm bg-amber-50/30"
                value={trailerReg}
                onChange={(e) => setTrailerReg(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {renderSection("vehicleChecklist.sections.internal", INTERNAL_CHECKS)}
      {renderSection("vehicleChecklist.sections.external", EXTERNAL_CHECKS)}

      {isTractor && renderSection("vehicleChecklist.sections.trailer", TRAILER_CHECKS)}

      {/* DEFECT REPORTING BOX */}
      {Object.values(answers).some(a => a === false) && (
        <div className="mt-10 p-6 bg-red-50 border border-red-200 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-red-800 font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 border-b border-red-100 pb-2">
            <AlertCircle size={16} /> {t('vehicleChecklist.sections.defects')}
          </h3>
          <textarea
            className="w-full h-32 p-4 border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 font-medium resize-none shadow-inner"
            placeholder={t('vehicleChecklist.labels.defectPlaceholder')}
            value={defectDetails}
            onChange={(e) => setDefectDetails(e.target.value)}
          />
        </div>
      )}

      <div className="mt-12">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:bg-blue-700 transition-all disabled:opacity-50 shadow-xl shadow-blue-900/20 active:scale-[0.98]"
        >
          {submitting ? t('vehicleChecklist.labels.submitting') : t('vehicleChecklist.labels.submit')}
        </button>
      </div>
    </div>
  );
}
