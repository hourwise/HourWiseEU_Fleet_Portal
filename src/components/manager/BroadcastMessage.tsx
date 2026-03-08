import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, MessageSquare } from 'lucide-react';

export function BroadcastMessage() {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSendBroadcast = async () => {
    // --- DEBUG LOGS from Gemini ---
    console.log("Attempting to send broadcast...");
    console.log("Current Profile Auth ID:", profile?.id);
    console.log("Company ID being sent:", profile?.company_id);

    if (!content.trim()) {
      setError("Message content cannot be empty.");
      return;
    }
    if (!profile?.id || !profile?.company_id) {
      setError("User profile or Company ID not loaded. Please refresh and try again.");
      return;
    }

    setIsSending(true);
    setError('');
    setSuccess(false);

    try {
      const { error: insertError } = await supabase
        .from('broadcasts')
        .insert({
          company_id: profile.company_id,
          sent_by: profile.id,
          content: content.trim(),
        });

      if (insertError) throw insertError;

      setSuccess(true);
      setContent('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-600" />
          Send Fleet Broadcast
        </h3>
      </div>
      <div className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Type your message to all drivers here..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
        />
        <button
          onClick={handleSendBroadcast}
          disabled={isSending}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
          {isSending ? 'Sending...' : 'Send to All Drivers'}
        </button>
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        {success && <p className="text-sm text-green-600 text-center">Broadcast sent successfully!</p>}
      </div>
    </div>
  );
}
