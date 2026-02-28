import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Receipt, Search, Check, X, Download, AlertTriangle } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Expense = Database['public']['Tables']['expenses']['Row'] & {
  profiles: { full_name: string } | null;
};

export function ExpenseApproval() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // To show loading on specific buttons

  useEffect(() => {
    if (profile?.company_id) {
      loadPendingExpenses();
    }
  }, [profile]);

  const loadPendingExpenses = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, profiles(full_name)')
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setExpenses(data as Expense[]);
    } catch (err) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (expenseId: string, newStatus: 'approved' | 'rejected') => {
    setActionLoading(expenseId);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status: newStatus })
        .eq('id', expenseId);

      if (error) throw error;
      // Refresh the list by removing the item that was actioned
      setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
    } catch (err) {
      console.error(`Error updating expense status to ${newStatus}:`, err);
      alert(`Failed to ${newStatus} the expense.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadReceipt = async (path: string | null) => {
      if (!path) {
          alert("No receipt path found.");
          return;
      }
      const { data, error } = await supabase.storage.from('expense-receipts').download(path);
      if (error) {
          console.error("Error downloading receipt:", error);
          alert("Failed to download receipt.");
          return;
      }
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', path.split('/').pop() || 'receipt');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Receipt className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Expense Approval</h2>
          <p className="text-gray-600">{expenses.length} pending expenses require your review.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        {loading ? (
          <div className="text-center py-12">Loading pending expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12">
            <Check className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">All Clear!</h3>
            <p className="text-gray-600">There are no pending expenses to review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{exp.profiles?.full_name || 'Unknown Driver'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(exp.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">£{exp.amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{exp.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button onClick={() => handleDownloadReceipt(exp.receipt_path)} className="text-blue-600 hover:underline">View</button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleUpdateStatus(exp.id, 'approved')} disabled={actionLoading === exp.id} className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                      <button onClick={() => handleUpdateStatus(exp.id, 'rejected')} disabled={actionLoading === exp.id} className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200 disabled:opacity-50"><X className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
