import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { X, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type WorkSession = Database['public']['Tables']['work_sessions']['Row'];

interface ShiftEditModalProps {
  shift: WorkSession;
  onClose: () => void;
  onSave: () => void;
}

export function ShiftEditModal({ shift, onClose, onSave }: ShiftEditModalProps) {
  const { t } = useTranslation();
  const [endTime, setEndTime] = useState(shift.end_time ? new Date(shift.end_time).toISOString().slice(0, 16) : '');
  const [notes, setNotes] = useState(shift.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!endTime) {
      setError(t('shiftEdit.errors.endRequired'));
      return;
    }
    if (!notes) {
      setError(t('shiftEdit.errors.reasonRequired'));
      return;
    }

    setIsSaving(true);
    setError('');

    const startTime = new Date(shift.start_time);
    const newEndTime = new Date(endTime);

    if (newEndTime <= startTime) {
      setError(t('shiftEdit.errors.invalidEnd'));
      setIsSaving(false);
      return;
    }

    const durationMs = newEndTime.getTime() - startTime.getTime();

    try {
      const { error: updateError } = await supabase
        .from('work_sessions')
        .update({
          end_time: newEndTime.toISOString(),
          status: 'ended',
          duration_ms: durationMs,
          notes: `${t('shiftEdit.auditNotePrefix')}${notes}`,
        })
        .eq('id', shift.id);

      if (updateError) throw updateError;

      onSave();
    } catch (err: any) {
      setError(err.message || t('shiftEdit.errors.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">{t('shiftEdit.title')}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('shiftEdit.labels.start')}</label>
            <input
              type="datetime-local"
              readOnly
              value={new Date(shift.start_time).toISOString().slice(0, 16)}
              className="w-full px-3 py-2 border bg-gray-100 border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('shiftEdit.labels.end')}</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('shiftEdit.labels.reason')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t('shiftEdit.labels.reasonPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end items-center p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-200 mr-2">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? t('shiftEdit.buttons.saving') : t('shiftEdit.buttons.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
