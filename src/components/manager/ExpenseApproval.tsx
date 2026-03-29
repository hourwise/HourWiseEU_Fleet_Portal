import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Receipt, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Database } from '../../lib/database.types';

type Expense = Database['public']['Tables']['expenses']['Row'] & {
  profiles: { full_name: string } | null;
};

export function ExpenseApproval() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPendingExpenses = useCallback(async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
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
  }, [profile?.company_id]);

  useEffect(() => {
    if (profile?.company_id) {
      loadPendingExpenses();
    }
  }, [loadPendingExpenses, profile?.company_id]);

  const handleUpdateStatus = async (expenseId: string, newStatus: 'approved' | 'rejected') => {
    setActionLoading(expenseId);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status: newStatus })
        .eq('id', expenseId);

      if (error) throw error;
      setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
    } catch (err) {
      console.error(`Error updating expense status to ${newStatus}:`, err);
      alert(t('expensesManager.errors.actionFailed', { action: t(`expensesManager.${newStatus === 'approved' ? 'approve' : 'reject'}`).toLowerCase() }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadReceipt = async (path: string | null) => {
      if (!path) {
          alert(t('expensesManager.errors.noPath'));
          return;
      }
      const { data, error } = await supabase.storage.from('expense-receipts').download(path);
      if (error) {
          console.error("Error downloading receipt:", error);
          alert(t('expensesManager.errors.downloadFailed'));
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
          <h2 className="text-2xl font-bold text-gray-900">{t('expensesManager.title')}</h2>
          <p className="text-gray-600">{t('expensesManager.subtitle', { count: expenses.length })}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        {loading ? (
          <div className="text-center py-12">{t('expensesManager.loading')}</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12">
            <Check className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">{t('expensesManager.allClear')}</h3>
            <p className="text-gray-600">{t('expensesManager.noPending')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('expensesManager.headers.driver')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('expensesManager.headers.date')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('expensesManager.headers.amount')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('expensesManager.headers.description')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('expensesManager.headers.receipt')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('expensesManager.headers.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{exp.profiles?.full_name || t('audit.unknown')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(exp.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">£{exp.amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{exp.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button onClick={() => handleDownloadReceipt(exp.receipt_path)} className="text-blue-600 hover:underline">{t('expensesManager.viewReceipt')}</button>
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
