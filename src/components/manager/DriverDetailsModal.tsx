// src/components/manager/DriverDetailsModal.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { X, Save, Upload, Paperclip, Trash2 } from 'lucide-react';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Document = Database['public']['Tables']['driver_documents']['Row'];

interface DriverDetailsModalProps {
  driver: Profile;
  onClose: () => void;
  onSave: () => void;
}

export function DriverDetailsModal({ driver, onClose, onSave }: DriverDetailsModalProps) {
  const [formData, setFormData] = useState<Partial<Profile>>(driver);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  useEffect(() => {
    fetchDocuments();
  }, [driver.id]);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('driver_documents')
      .select('*')
      .eq('user_id', driver.id);
    if (error) console.error("Error fetching documents:", error);
    else setDocuments(data || []);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value || null }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const filePath = `${driver.company_id}/${driver.id}/${documentType}_${Date.now()}`;
    
    try {
      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('driver_documents')
        .insert({
          user_id: driver.id,
          company_id: driver.company_id!,
          document_type: documentType,
          storage_path: filePath,
        });
      
      if (dbError) throw dbError;
      
      await fetchDocuments(); // Refresh the document list

    } catch (error) {
      console.error("Error uploading document:", error);
      alert("Failed to upload document.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, storagePath: string) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      try {
        const { error: storageError } = await supabase.storage
          .from('driver-documents')
          .remove([storagePath]);
        
        if (storageError) throw storageError;

        const { error: dbError } = await supabase
          .from('driver_documents')
          .delete()
          .eq('id', docId);

        if (dbError) throw dbError;

        await fetchDocuments(); // Refresh list

      } catch (error) {
        console.error("Error deleting document:", error);
        alert("Failed to delete document.");
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update(formData)
      .eq('id', driver.id);

    if (error) {
      console.error("Error updating profile:", error);
      alert("Failed to save driver details.");
    } else {
      onSave();
    }
    setIsSaving(false);
  };
  
  // Helper for rendering form fields
  const renderInput = (label: string, name: keyof Profile, type = "text") => (
    <div>
        <label className="text-sm font-medium text-gray-500 block mb-1">{label}</label>
        <input
            type={type}
            name={name}
            value={formData[name] as string || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Edit Driver Details: {driver.full_name}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Personal & Payroll Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderInput("Payroll Number*", "payroll_number")}
            {renderInput("Phone Number", "phone_number")}
            {renderInput("Date of Birth", "date_of_birth", "date")}
            {renderInput("National Insurance Number", "national_insurance_number")}
            {renderInput("Emergency Contact Name", "emergency_contact_name")}
            {renderInput("Emergency Contact Phone", "emergency_contact_phone")}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-sm font-medium text-gray-500 block mb-1">Full Address</label>
              <textarea
                  name="full_address"
                  value={formData.full_address || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          
          {/* Licence & CPC Details */}
          <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderInput("Driving Licence Number", "driving_licence_number")}
            {renderInput("Driving Licence Expiry", "driving_licence_expiry", "date")}
            {renderInput("CPC/DQC Number", "cpc_dqc_number")}
            {renderInput("CPC/DQC Expiry", "cpc_dqc_expiry", "date")}
            {renderInput("CPC Training Hours Done", "cpc_training_hours_done", "number")}
          </div>

          {/* Document Uploads */}
          <div className="border-t pt-6">
             <h3 className="text-lg font-semibold text-gray-800 mb-4">Driver Documents*</h3>
             <div className="space-y-4">
                {/* Upload Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <label className="text-sm font-medium text-gray-600 mb-2 block">Licence (Front)</label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'licence_front')} className="text-sm" />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <label className="text-sm font-medium text-gray-600 mb-2 block">Licence (Back)</label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'licence_back')} className="text-sm" />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <label className="text-sm font-medium text-gray-600 mb-2 block">CPC/Tacho Card</label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'cpc_tacho')} className="text-sm" />
                  </div>
                </div>
                {isUploading && <p className="text-sm text-blue-600">Uploading...</p>}
                
                {/* Existing Documents List */}
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex justify-between items-center p-2 border rounded-md">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium">{doc.document_type}</span>
                      </div>
                      <button onClick={() => handleDeleteDocument(doc.id, doc.storage_path)} className="p-1 text-red-600 hover:text-red-800">
                         <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>

        <div className="flex justify-end items-center p-6 border-t bg-gray-50">
          <p className="text-sm text-gray-600 mr-4">*Payroll Number and Document uploads are required for payroll export.</p>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
