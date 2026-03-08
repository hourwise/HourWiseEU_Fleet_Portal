// src/components/manager/DriverDetailsModal.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { X, Save, Upload, Paperclip, Trash2, AlertTriangle, CheckCircle, Edit, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ShiftEditModal } from './ShiftEditModal';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Document = Database['public']['Tables']['driver_documents']['Row'];
type WorkSession = Database['public']['Tables']['work_sessions']['Row'];

interface DriverDetailsModalProps {
  driver: Profile;
  onClose: () => void;
  onSave: () => void;
}

const useDocumentUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [idNumber, setIdNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const reset = () => { setFile(null); setIdNumber(''); setExpiryDate(''); };
  return { file, setFile, idNumber, setIdNumber, expiryDate, setExpiryDate, reset };
};

const getDocumentStatus = (expiryDate: string | null | undefined) => {
  if (!expiryDate) return { text: 'Missing Expiry', color: 'text-gray-500', Icon: AlertTriangle };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  const daysDiff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));
  if (daysDiff < 0) return { text: `Expired on ${expiry.toLocaleDateString()}`, color: 'text-red-600 font-bold', Icon: AlertTriangle };
  if (daysDiff <= 30) return { text: `Expires in ${daysDiff} days`, color: 'text-orange-500 font-semibold', Icon: AlertTriangle };
  return { text: `Expires on ${expiry.toLocaleDateString()}`, color: 'text-green-600', Icon: CheckCircle };
};

const LocationAnalysisMap = ({ driverId }: { driverId: string }) => {
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
  if (loading) return <div className="text-center p-4">Loading map...</div>;
  if (locations.length === 0) return <p className="text-sm text-gray-500 text-center p-4">No location data for heatmap.</p>;
  const markers = locations.slice(0, 50).map((loc, i) => `pin-s-${i+1}+2563EB(${loc.lng},${loc.lat})`).join(',');
  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${markers}/auto/600x300@2x?access_token=${accessToken}`;
  return <img src={mapUrl} alt="Heatmap" className="rounded-lg w-full" />;
};

export function DriverDetailsModal({ driver, onClose, onSave }: DriverDetailsModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Partial<Profile>>(driver);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [shifts, setShifts] = useState<WorkSession[]>([]);
  const [editingShift, setEditingShift] = useState<WorkSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const licenceState = useDocumentUpload();
  const cpcState = useDocumentUpload();

  useEffect(() => {
    fetchDocuments();
    fetchRecentShifts();
  }, [driver.id]);

  const fetchDocuments = async () => {
    const { data } = await supabase.from('driver_documents').select('*').eq('user_id', driver.id);
    setDocuments(data || []);
  };

  const fetchRecentShifts = async () => {
    const { data } = await supabase.from('work_sessions').select('*').eq('user_id', driver.id).order('start_time', { ascending: false }).limit(10);
    setShifts(data || []);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value || null }));
  };

  const handleDocumentSubmit = async (state: any, type: string) => {
    if (!state.file || !state.idNumber || !state.expiryDate) return alert("Please fill all document fields.");
    setIsUploading(true);
    const filePath = `${driver.company_id}/${driver.id}/${type}_${Date.now()}`;
    try {
      await supabase.storage.from('driver-documents').upload(filePath, state.file);
      await supabase.from('driver_documents').insert({ user_id: driver.id, company_id: driver.company_id!, document_type: type, storage_path: filePath, id_number: state.idNumber, expiry_date: state.expiryDate, uploaded_by: user?.id });
      state.reset();
      fetchDocuments();
    } finally { setIsUploading(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase.from('profiles').update(formData).eq('id', driver.id);
    if (!error) {
      onSave();
      onClose();
    }
    setIsSaving(false);
  };

  const renderInput = (label: string, name: keyof Profile, type = "text") => (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
      <input type={type} name={name} value={(formData[name] as string) || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" style={{ color: '#111827' }} />
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">Driver Details: {driver.full_name}</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-600"><X /></button>
          </div>

          <div className="p-6 space-y-8 overflow-y-auto">
            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Profile & Payroll</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderInput("Full Name", "full_name")}
                {renderInput("Payroll Number", "payroll_number")}
                {renderInput("Phone", "phone_number")}
                {renderInput("Date of Birth", "date_of_birth", "date")}
                {renderInput("NI Number", "national_insurance_number")}
                {renderInput("Emergency Contact", "emergency_contact_name")}
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-500 block mb-1">Full Address</label>
                <textarea name="full_address" value={formData.full_address || ''} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" style={{ color: '#111827' }} />
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Compliance Documents</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                  <p className="font-bold text-sm text-gray-700">Upload HGV Licence</p>
                  <input type="text" placeholder="Licence No" value={licenceState.idNumber} onChange={e => licenceState.setIdNumber(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" style={{ color: '#111827' }} />
                  <input type="date" value={licenceState.expiryDate} onChange={e => licenceState.setExpiryDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" style={{ color: '#111827' }} />
                  <input type="file" onChange={e => licenceState.setFile(e.target.files?.[0] || null)} className="text-xs text-gray-600" />
                  <button onClick={() => handleDocumentSubmit(licenceState, 'HGV_Licence')} className="w-full py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 transition">Upload</button>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                  <p className="font-bold text-sm text-gray-700">Upload CPC/Tacho</p>
                  <input type="text" placeholder="Card No" value={cpcState.idNumber} onChange={e => cpcState.setIdNumber(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" style={{ color: '#111827' }} />
                  <input type="date" value={cpcState.expiryDate} onChange={e => cpcState.setExpiryDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" style={{ color: '#111827' }} />
                  <input type="file" onChange={e => cpcState.setFile(e.target.files?.[0] || null)} className="text-xs text-gray-600" />
                  <button onClick={() => handleDocumentSubmit(cpcState, 'CPC_Tacho')} className="w-full py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 transition">Upload</button>
                </div>
              </div>
              <div className="space-y-2">{documents.map(doc => { const status = getDocumentStatus(doc.expiry_date); return (<div key={doc.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-white"><div className="flex items-center gap-3"><Paperclip className="w-4 h-4 text-gray-400" /><div><p className="text-sm font-bold text-gray-800">{doc.document_type} ({doc.id_number})</p><p className={`text-xs flex items-center gap-1 ${status.color}`}><status.Icon size={12}/> {status.text}</p></div></div></div>);})}</div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Recent Shifts</h3>
              <div className="space-y-2">{shifts.length > 0 ? shifts.map(s => (<div key={s.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-white"><div><p className="text-sm font-bold text-gray-800">{new Date(s.start_time).toLocaleString()}</p><p className="text-xs text-gray-500">Duration: {s.duration_ms ? (s.duration_ms / 3600000).toFixed(2) : '?'} hrs</p></div><div className="flex gap-2"><button onClick={() => setEditingShift(s)} className="p-2 hover:bg-gray-100 rounded border border-gray-200 text-gray-600 transition"><Edit size={14}/></button>{s.start_lat && <a href={`https://www.google.com/maps?q=${s.start_lat},${s.start_lng}`} target="_blank" className="p-2 hover:bg-gray-100 rounded border border-gray-200 text-blue-600 transition"><MapPin size={14}/></a>}</div></div>)) : <p className="text-sm text-gray-500 italic">No recent shifts recorded.</p>}</div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2"><MapPin size={18}/> Start Location Clusters</h3>
              <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200"><LocationAnalysisMap driverId={driver.id} /></div>
            </section>
          </div>

          <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-100 transition">Cancel</button>
            <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50">
              <Save size={18}/> {isSaving ? 'Saving...' : 'Save All Changes'}
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
