import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Plus, Trash2 } from 'lucide-react';

// ... (interfaces and types remain the same) ...

export function InviteDriverModal({ onClose, onInviteSent }: InviteDriverModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // ... (form state remains the same) ...

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!profile?.company_id) {
        setError("You are not associated with a company.");
        return;
    }
    setLoading(true);

    // ... (payConfigSnapshot construction remains the same) ...

    try {
        // --- MODIFIED FOR DEBUGGING ---
        const { data, error: functionError } = await supabase.functions.invoke('create-driver-invite', {
            body: {
                companyId: profile.company_id,
                inviteEmail: email,
                inviteFullName: fullName,
                payConfigSnapshot,
            },
        });

        // If there's an error, its details will be in the 'data' object from the function's response
        if (functionError) {
          // The 'data' object from a failed invoke call often contains the real error message
          const detailedError = data?.error || functionError.message;
          throw new Error(detailedError);
        }
        // --- END OF MODIFICATION ---

        onInviteSent();
        onClose();
    } catch (err: any) {
        console.error("Error sending invite:", err);
        // Display the detailed error directly in the UI
        setError(err.message || "An unknown error occurred.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* ... (Modal JSX remains the same) ... */}

        <form onSubmit={handleSendInvite} className="p-6 space-y-6 overflow-y-auto">
            {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg">{error}</div>}

            {/* ... (The rest of the form JSX remains the same) ... */}
        </form>
      </div>
    </div>
  );
}
