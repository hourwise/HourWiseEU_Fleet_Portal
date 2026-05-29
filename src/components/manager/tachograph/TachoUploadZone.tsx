import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, History } from 'lucide-react';

export function TachoUploadZone({ onUploaded }: { onUploaded?: () => void }) {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!profile?.company_id || acceptedFiles.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      for (const file of acceptedFiles) {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        // Standard tachograph file extensions
        if (!['ddd', 'v1b', 'c1b', 'tgd'].includes(fileExt || '')) {
          throw new Error(`Unsupported file type: .${fileExt}. Please upload .DDD or .V1B files.`);
        }

        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `${profile.company_id}/${fileName}`;

        // 1. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('tachograph-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Insert record into database to trigger processing
        const { error: dbError } = await supabase
          .from('tachograph_files' as never)
          .insert({
            company_id: profile.company_id,
            filename: file.name,
            file_path: filePath,
            file_type: fileExt,
            status: 'pending'
          } as never);

        if (dbError) throw dbError;
      }

      setSuccess(true);
      onUploaded?.();
    } catch (err: unknown) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }, [onUploaded, profile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.ddd', '.v1b', '.c1b', '.tgd', '.esm'],
    },
    multiple: true
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Import Tachograph Data</h3>
            <p className="text-sm text-slate-500 font-medium">Upload card or VU files when the desktop helper is unavailable or a manual import is preferred.</p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center">
            {uploading ? (
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            ) : success ? (
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
            ) : error ? (
              <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
            ) : (
              <div className={`p-4 rounded-full mb-4 ${isDragActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <Upload className={`w-8 h-8 ${isDragActive ? 'text-blue-600' : 'text-slate-400'}`} />
              </div>
            )}

            <p className="text-base font-bold text-slate-900 mb-1">
              {uploading ? 'Uploading and processing...' :
               isDragActive ? 'Drop files here' : 'Drag & drop tachograph files'}
            </p>
            <p className="text-sm text-slate-500 font-medium">
              Supports .DDD, .V1B, .C1B, .TGD, .ESM (Max 50MB)
            </p>

            {!uploading && !success && !error && (
              <button className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-slate-800 transition">
                Select Files
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-rose-900">Upload Failed</p>
              <p className="text-[11px] text-rose-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
              <X size={14} />
            </button>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-xs font-bold text-emerald-900 flex-1">
              Files uploaded successfully! Analysis is running in the background.
            </p>
            <button onClick={() => setSuccess(false)} className="text-emerald-400 hover:text-emerald-600">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={14} className="text-slate-400" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity: 12 files processed today</span>
        </div>
        <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition">
          View Detailed History
        </button>
      </div>
    </div>
  );
}
