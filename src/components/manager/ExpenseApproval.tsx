import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Receipt, Check, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Database } from '../../lib/database.types';

type Expense = Database['public']['Tables']['expenses']['Row'] & { profiles: { full_name: string | null } | null };
type ExpenseReview = Database['public']['Tables']['expense_reviews']['Row'];
type ReviewFilter = 'pending' | 'approved' | 'rejected';

export function ExpenseApproval() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reviews, setReviews] = useState<ExpenseReview[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    if (!profile?.company_id) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data: drivers, error: driversError } = await supabase
        .from('profiles').select('id, full_name').eq('company_id', profile.company_id).eq('role', 'driver');
      if (driversError) throw driversError;
      const driverIds = (drivers ?? []).map(driver => driver.id);
      if (driverIds.length === 0) { setExpenses([]); setReviews([]); return; }
      const { data, error: expensesError } = await supabase.from('expenses').select('*').in('user_id', driverIds).order('date', { ascending: false });
      if (expensesError) throw expensesError;
      const expenseIds = (data ?? []).map(expense => expense.id);
      const { data: reviewData, error: reviewsError } = expenseIds.length > 0
        ? await supabase.from('expense_reviews').select('*').in('expense_id', expenseIds)
        : { data: [], error: null };
      if (reviewsError) throw reviewsError;
      const driverMap = new Map((drivers ?? []).map(driver => [driver.id, { full_name: driver.full_name }]));
      setExpenses((data ?? []).map(expense => ({ ...expense, profiles: driverMap.get(expense.user_id) ?? null })));
      setReviews(reviewData ?? []);
    } catch (loadError) {
      console.error('Error loading expense review:', loadError);
      setError('Unable to load expense review data. Please try again.');
    } finally { setLoading(false); }
  }, [profile?.company_id]);

  useEffect(() => { void loadExpenses(); }, [loadExpenses]);

  const reviewFor = (expenseId: string) => reviews.find(review => review.expense_id === expenseId);
  const visibleExpenses = expenses.filter(expense => {
    const review = reviewFor(expense.id);
    return filter === 'pending' ? !review : review?.decision === filter;
  });

  const handleReview = async (expense: Expense, decision: 'approved' | 'rejected') => {
    const current = reviewFor(expense.id);
    const note = decision === 'rejected' ? window.prompt('Optional rejection reason:') : null;
    setActingOn(expense.id); setError(null);
    try {
      const { data, error: reviewError } = await supabase.rpc('review_expense', {
        p_expense_id: expense.id,
        p_decision: decision,
        p_note: note ?? undefined,
        p_expected_updated_at: current?.updated_at ?? undefined
      });
      if (reviewError) throw reviewError;
      const authoritative = data;
      if (!authoritative) throw new Error('Review returned no authoritative record');
      setReviews(previous => [...previous.filter(review => review.id !== authoritative.id), authoritative]);
    } catch (reviewError) {
      console.error('Error saving expense review:', reviewError);
      setError('The review was not saved. The record may have changed; reload and try again.');
      await loadExpenses();
    } finally { setActingOn(null); }
  };

  const handleDownloadReceipt = async (path: string | null) => {
    if (!path) { alert(t('expensesManager.errors.noPath')); return; }
    const { data, error: downloadError } = await supabase.storage.from('expense-receipts').download(path);
    if (downloadError) { console.error(downloadError); alert(t('expensesManager.errors.downloadFailed')); return; }
    const url = URL.createObjectURL(data); const link = document.createElement('a');
    link.href = url; link.download = path.split('/').pop() || 'receipt'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Receipt className="w-8 h-8 text-blue-600" /><div>
        <h2 className="text-2xl font-bold text-gray-900">Expense Review</h2>
        <p className="text-gray-600">Captured expenses awaiting an operational manager decision.</p>
      </div></div>
      <button onClick={() => void loadExpenses()} className="p-2 text-slate-500 hover:text-blue-600" title="Reload"><RefreshCw size={18} /></button>
    </div>
    <div className="flex gap-2 border-b border-slate-200">
      {(['pending', 'approved', 'rejected'] as const).map(state => <button key={state} onClick={() => setFilter(state)} className={`px-4 py-2 text-sm font-bold capitalize border-b-2 ${filter === state ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>{state}</button>)}
    </div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    <div className="bg-white rounded-xl shadow-sm p-6">
      {loading ? <div className="text-center py-12">Loading expense review...</div> : visibleExpenses.length === 0 ? <div className="text-center py-12">
        {expenses.length === 0 ? <><Receipt className="w-16 h-16 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900">No expenses recorded</h3><p className="text-gray-600">Driver expense submissions will appear here.</p></> : <><Check className="w-16 h-16 text-green-400 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900">No expenses awaiting review</h3><p className="text-gray-600">There are no expenses in the {filter} state.</p></>}
      </div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{['Driver','Date','Amount','Category / merchant','Notes','Receipt','Decision','Actions'].map(header => <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>)}</tr></thead><tbody className="bg-white divide-y divide-gray-200">{visibleExpenses.map(expense => { const review = reviewFor(expense.id); return <tr key={expense.id}>
        <td className="px-4 py-4 text-sm font-medium text-gray-900">{expense.profiles?.full_name || t('audit.unknown')}</td><td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">{new Date(expense.date).toLocaleDateString()}</td><td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">{expense.currency || 'GBP'} {expense.amount}</td><td className="px-4 py-4 text-sm text-gray-500">{expense.category}{expense.merchant ? ` · ${expense.merchant}` : ''}</td><td className="px-4 py-4 text-sm text-gray-500 max-w-xs">{expense.notes || '—'}</td><td className="px-4 py-4 text-sm">{expense.image_url ? <button onClick={() => void handleDownloadReceipt(expense.image_url)} className="text-blue-600 hover:underline">View</button> : '—'}</td><td className="px-4 py-4 text-sm">{review ? <div className="capitalize font-bold">{review.decision}<div className="text-xs font-normal text-slate-500">{new Date(review.reviewed_at).toLocaleString()}{review.note ? ` · ${review.note}` : ''}</div></div> : <span className="text-amber-600 font-bold">Pending</span>}</td><td className="px-4 py-4 text-sm whitespace-nowrap">{filter === 'pending' ? <div className="flex gap-2"><button disabled={actingOn === expense.id} onClick={() => void handleReview(expense, 'approved')} className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50">Approve</button><button disabled={actingOn === expense.id} onClick={() => void handleReview(expense, 'rejected')} className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50">Reject</button></div> : <button disabled={actingOn === expense.id} onClick={() => void handleReview(expense, review?.decision === 'approved' ? 'rejected' : 'approved')} className="text-blue-600 hover:underline">Change decision</button>}</td>
      </tr>; })}</tbody></table></div>}
    </div>
  </div>;
}
