import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Info, Check, X, ShieldCheck, Truck, Car } from 'lucide-react';

const INTERNAL_CHECKS = [
  { id: 'mirrors', label: 'Mirrors and Glass', hint: 'Check for cracks/stickers; ensure mirrors are aligned.' },
  { id: 'wipers', label: 'Wipers and Washers', hint: 'Check operation and fluid levels.' },
  { id: 'front_view', label: 'Front View', hint: 'Full visibility through cab front window.' },
  { id: 'warning_lamps', label: 'Warning Lamps', hint: 'Ensure vehicle warning lights function correctly.' },
  { id: 'steering', label: 'Steering', hint: 'Smooth movement and correct operation.' },
  { id: 'horn', label: 'Horn', hint: 'Test for clear, working sound.' },
  { id: 'brakes_air', label: 'Brakes and Air Build-up', hint: 'Check brake function and air pressure build-up.' },
  { id: 'height_marker', label: 'Height Marker', hint: 'Correct height marker displayed.' },
  { id: 'seatbelts', label: 'Seatbelts', hint: 'Check all belts are working correctly.' },
];

const EXTERNAL_CHECKS = [
  { id: 'lights_ind', label: 'Lights and Indicators', hint: 'All lights/indicators working correctly.' },
  { id: 'leaks', label: 'Fuel/Oil Leaks', hint: 'Check for any fluid on the ground or chassis.' },
  { id: 'battery', label: 'Battery Security', hint: 'Check battery is secure and in good condition.' },
  { id: 'adblue', label: 'AdBlue Fluid', hint: 'Sufficient exhaust fluid levels.' },
  { id: 'smoke', label: 'Excessive Exhaust Smoke', hint: 'Check for heavy smoke emissions.' },
  { id: 'body_wings', label: 'Security of Body/Wings', hint: 'Ensure no parts are loose or falling off.' },
  { id: 'spray', label: 'Spray Suppression', hint: 'Fitted securely and meets legislation.' },
  { id: 'tyres_wheels', label: 'Tyres and Wheel Fixing', hint: 'Nuts/bolts tight. Tread and pressure within law.' },
  { id: 'brake_line', label: 'Brake Line', hint: 'Check for damage or air leaks.' },
  { id: 'electrical', label: 'Electrical Connections', hint: 'Individual tests for all connections.' },
  { id: 'coupling', label: 'Coupling Security', hint: 'Check vehicle is securely attached to load.' },
  { id: 'load_security', label: 'Security of Load', hint: 'Weight evenly distributed and load secured.' },
  { id: 'number_plate', label: 'Number Plate', hint: 'Secure and fully visible.' },
  { id: 'reflectors', label: 'Reflectors and Lights', hint: 'Securely attached and visible.' },
  { id: 'markers', label: 'Markers', hint: 'All required markers securely attached.' },
];

export function OfficialVehicleChecklist() {
  const { profile } = useAuth();
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [regNumber, setRegNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Van');
  const [vehicleMake, setVehicleMake] = useState('');
  const [showHints, setShowHints] = useState<string | null>(null);
  const [defectDetails, setDefectDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    // Validation
    const totalItems = INTERNAL_CHECKS.length + EXTERNAL_CHECKS.length;
    if (Object.keys(answers).length < totalItems) {
      setError('Please complete all 24 safety checks before submitting.');
      return;
    }
    if (!regNumber.trim()) {
      setError('Vehicle Registration Number is required.');
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
          items: answers, // Storing the map directly
          defect_details: hasDefects ? defectDetails : null,
        });

      if (submitError) throw submitError;
      setSuccess(true);
    } catch (err: any) {
      console.error('Error submitting checklist:', err);
      setError(err.message || 'Failed to submit checklist');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-3xl mx-auto p-4 text-center">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
          <ShieldCheck className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-900 mb-2">Checklist Submitted</h2>
          <p className="text-green-700">Daily vehicle safety check recorded successfully.</p>
        </div>
      </div>
    );
  }

  const renderSection = (title: string, items: typeof INTERNAL_CHECKS) => (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">{title}</h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">{item.label}</span>
                <button onClick={() => setShowHints(showHints === item.id ? null : item.id)} type="button">
                  <Info size={16} className="text-blue-500" />
                </button>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setAnswers({...answers, [item.id]: true})}
                  className={`p-2 rounded-full border transition ${answers[item.id] === true ? 'bg-green-100 border-green-500 text-green-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  <Check size={20} />
                </button>
                <button
                  onClick={() => setAnswers({...answers, [item.id]: false})}
                  className={`p-2 rounded-full border transition ${answers[item.id] === false ? 'bg-red-100 border-red-500 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            {showHints === item.id && (
              <p className="mt-2 text-sm text-blue-600 italic bg-blue-50 p-2 rounded">
                Hint: {item.hint}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="text-green-600 w-8 h-8" />
        <h2 className="text-2xl font-bold">Daily Vehicle Safety Check</h2>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Vehicle Info Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Truck size={18} /> Vehicle Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">REGISTRATION NO.</label>
            <input
              type="text"
              placeholder="E.G. AB12 CDE"
              className="w-full p-2 border border-slate-300 rounded uppercase font-bold text-lg"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">VEHICLE TYPE</label>
            <select
              className="w-full p-2.5 border border-slate-300 rounded"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
            >
              <option value="Van">Van</option>
              <option value="7.5t">7.5t Truck</option>
              <option value="HGV">HGV</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">MAKE (OPTIONAL)</label>
            <input
              type="text"
              placeholder="E.G. FORD, IVECO"
              className="w-full p-2 border border-slate-300 rounded uppercase"
              value={vehicleMake}
              onChange={(e) => setVehicleMake(e.target.value)}
            />
          </div>
        </div>
      </div>

      {renderSection("INTERNAL CHECKS", INTERNAL_CHECKS)}
      {renderSection("EXTERNAL CHECKS", EXTERNAL_CHECKS)}

      {/* DEFECT REPORTING BOX */}
      {Object.values(answers).some(a => a === false) && (
        <div className="mt-8 p-6 bg-red-50 rounded-xl border-2 border-red-200">
          <h3 className="text-red-800 font-bold mb-2 flex items-center gap-2">
            <AlertCircle /> FAULT REPORTING / ACTION TAKEN
          </h3>
          <textarea
            className="w-full h-32 p-3 border border-red-300 rounded-lg"
            placeholder="Describe the fault and any immediate action taken..."
            value={defectDetails}
            onChange={(e) => setDefectDetails(e.target.value)}
          />
        </div>
      )}

      <div className="mt-8">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Checklist'}
        </button>
      </div>
    </div>
  );
}
