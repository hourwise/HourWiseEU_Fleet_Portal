// src/components/manager/VehicleDetailsModal.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { X, Save, Trash2, Edit, ShieldCheck, FileText, Download, ShieldAlert, AlertTriangle, LifeBuoy, Scan, Check, Clock, Ban } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { scanDocument } from '../../lib/ocr';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

interface VehicleDocument {
  id: string;
  vehicle_id: string;
  company_id: string;
  document_type: string;
  storage_path: string;
  id_number: string | null;
  expiry_date: string | null;
  uploaded_at: string;
  verified_at: string | null;
}

interface VehicleIncident {
  id: string;
  type: string;
  occurred_at: string;
  description: string;
  has_injury: boolean;
  status: string;
  profiles: { full_name: string };
}

interface VehicleDetailsModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onSave: () => void;
}

const useDocumentUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [idNumber, setIdNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const reset = () => { setFile(null); setIdNumber(''); setExpiryDate(''); setIsScanning(false); };

  const handleScan = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsScanning(true);
    try {
      const result = await scanDocument(selectedFile);
      if (result.data.idNumber) setIdNumber(result.data.idNumber);
      if (result.data.expiryDate) setExpiryDate(result.data.expiryDate);
    } catch (err) {
      console.error('OCR Scanning failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  return { file, setFile, idNumber, setIdNumber, expiryDate, setExpiryDate, reset, isScanning, handleScan };
};

export function VehicleDetailsModal({ vehicle, onClose, onSave }: VehicleDetailsModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [formData, setFormData] = useState<Partial<Vehicle>>(vehicle);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [incidents, setIncidents] = useState<VehicleIncident[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const docState = useDocumentUpload();

  const fetchData = useCallback(async () => {
    const [docsRes, incRes] = await Promise.all([
      supabase.from('vehicle_documents').select('*').eq('vehicle_id', vehicle.id),
      supabase.from('incidents').select('*, profiles:driver_id(full_name)').eq('vehicle_id', vehicle.id).order('occurred_at', { ascending: false })
    ]);
    setDocuments(docsRes.data || []);
    setIncidents(incRes.data || []);
  }, [vehicle.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value || null }));
  };

  const handleDocumentStatus = async (docId: string, status: 'verified' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('vehicle_documents')
        .update({ verified_at: status === 'verified' ? new Date().toISOString() : null })
        .eq('id', docId);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert("Verification failed: " + err.message);
    }
  };

  const handleDocumentSubmit = async (type: string) => {
    if (!docState.file) return alert("Please select a file.");
    setIsUploading(true);
    const filePath = `${vehicle.company_id}/${vehicle.id}/${type}_${Date.now()}`;
    try {
      const { error: uploadError } = await supabase.storage.from('vehicle-documents').upload(filePath, docState.file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('vehicle_documents').insert({
        vehicle_id: vehicle.id,
        company_id: vehicle.company_id,
        document_type: type,
        storage_path: filePath,
        id_number: docState.idNumber || null,
        expiry_date: docState.expiryDate || null,
        uploaded_by: user?.id
      });
      if (dbError) throw dbError;

      docState.reset();
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally { setIsUploading(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('vehicles').update(formData).eq('id', vehicle.id);
      if (error) throw error;
      onSave();
      onClose();
    } catch (err: any) {
      alert(t('common.error') + ": " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-6 border-b bg-slate-50 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Vehicle File: {vehicle.reg_number}</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{vehicle.make} {vehicle.model}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition"><X /></button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto">
          {/* 1. CORE ASSET DETAILS */}
          <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 border-b border-blue-50 pb-2">
              <Edit size={14}/> Core Asset Identity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Registration</label>
                <input name="reg_number" value={formData.reg_number || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold uppercase" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Make</label>
                <input name="make" value={formData.make || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Model</label>
                <input name="model" value={formData.model || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">VIN Number</label>
                <input name="vin_number" value={formData.vin_number || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Year</label>
                <input type="number" name="year" value={formData.year || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" />
              </div>
            </div>
          </section>

          {/* 2. VEHICLE DOCUMENTS (THE NEW PART) */}
          <section className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <h3 className="text-xs font-black text-amber-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 border-b border-amber-100 pb-2">
              <ShieldCheck size={14}/> Asset Documentation (V5C, Insurance, Leases)
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-slate-900 uppercase">Upload New Document</p>
                  {docState.isScanning && (
                    <span className="text-[10px] font-black text-blue-600 animate-pulse uppercase tracking-widest">Scanning...</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <select
                    className="col-span-2 w-full p-2 border border-slate-200 rounded text-sm font-bold bg-slate-50"
                    id="doc-type-select"
                  >
                    <option value="V5C">V5C Logbook</option>
                    <option value="Insurance">Insurance Certificate</option>
                    <option value="Lease">Lease/Finance Agreement</option>
                    <option value="Inspection">Plating Certificate</option>
                    <option value="Other">Other Document</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Ref / Policy No"
                    value={docState.idNumber}
                    onChange={e => docState.setIdNumber(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded text-sm font-bold"
                  />
                  <input
                    type="date"
                    value={docState.expiryDate}
                    onChange={e => docState.setExpiryDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded text-sm font-bold"
                  />
                </div>
                <input
                  type="file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) docState.handleScan(file);
                  }}
                  className="text-[10px] text-slate-500 w-full"
                />
                <button
                  onClick={() => handleDocumentSubmit((document.getElementById('doc-type-select') as HTMLSelectElement).value)}
                  disabled={isUploading || docState.isScanning}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  {isUploading ? 'Uploading...' : (
                    <>
                      {docState.isScanning && <Scan size={14} className="animate-spin" />}
                      Store Document
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {documents.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-8 text-center bg-white rounded-xl border border-dashed">No documents stored for this asset.</p>
                ) : (
                  documents.map(doc => (
                    <div key={doc.id} className="flex justify-between items-center p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 rounded-lg"><FileText className="w-4 h-4 text-slate-400" /></div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">{doc.document_type}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {doc.expiry_date && <p className="text-[10px] font-bold text-slate-500 uppercase">Expires: {new Date(doc.expiry_date).toLocaleDateString()}</p>}
                            {doc.verified_at ? (
                              <span className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded uppercase">
                                <Check size={10}/> Verified
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">
                                <Clock size={10}/> Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!doc.verified_at ? (
                          <button
                            onClick={() => handleDocumentStatus(doc.id, 'verified')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                            title="Verify Document"
                          >
                            <Check size={16}/>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDocumentStatus(doc.id, 'rejected')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Unverify Document"
                          >
                            <Ban size={16}/>
                          </button>
                        )}
                        <button className="p-2 text-slate-300 hover:text-blue-600 transition"><Download size={16}/></button>
                        <button className="p-2 text-slate-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* 3. INCIDENT HISTORY */}
          <section className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <h3 className="text-xs font-black text-red-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 border-b border-red-100 pb-2">
              <ShieldAlert size={14}/> Incident & Accident History
            </h3>

            {incidents.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-8 text-center bg-white rounded-xl border border-dashed">No incidents recorded for this asset.</p>
            ) : (
              <div className="space-y-3">
                {incidents.map(incident => (
                  <div key={incident.id} className="flex justify-between items-center p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${incident.type === 'accident' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                        {incident.type === 'accident' ? <AlertTriangle size={18} /> : <LifeBuoy size={18} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-900 uppercase">{incident.type}</p>
                          <span className="text-[10px] font-bold text-slate-400">•</span>
                          <p className="text-[10px] font-bold text-slate-500">{format(new Date(incident.occurred_at), 'PPp')}</p>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-1">{incident.description}</p>
                        <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Driver: {incident.profiles.full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {incident.has_injury && (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">Injury</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        incident.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {incident.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="p-6 border-t bg-slate-50 flex justify-end gap-4 rounded-b-2xl">
          <button onClick={onClose} className="px-8 py-3 border border-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-white transition-all">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50">
            <Save size={16}/> {isSaving ? 'Saving...' : 'Update Asset File'}
          </button>
        </div>
      </div>
    </div>
  );
}
