import { useEffect, useState } from 'react';
import { ClipboardList, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ShiftOption {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  profiles?: { full_name: string } | null;
}

export function JobPlanner() {
  const { profile } = useAuth();
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [shiftId, setShiftId] = useState('');
  const [reference, setReference] = useState('');
  const [title, setTitle] = useState('');
  const [jobType, setJobType] = useState('delivery');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duration, setDuration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.company_id) return;
    supabase.from('shifts').select('id, date, start_time, end_time, profiles:driver_id(full_name)')
      .eq('company_id', profile.company_id).in('status', ['published', 'updated']).gte('date', new Date().toISOString().slice(0, 10))
      .order('date').order('start_time').then(({ data, error }) => {
        if (error) { setMessage(error.message); return; }
        const loaded = (data ?? []) as ShiftOption[];
        setShifts(loaded);
        if (loaded[0]) setShiftId(loaded[0].id);
      });
  }, [profile?.company_id]);

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shiftId) return;
    setSubmitting(true); setMessage(null);
    try {
      const { error } = await supabase.rpc('create_job_assignment_with_event' as never, {
        p_shift_id: shiftId, p_reference: reference, p_title: title, p_job_type: jobType,
        p_address_text: address, p_customer_name: customerName || null, p_instructions: instructions || null,
        p_expected_duration_minutes: duration ? Number(duration) : null, p_requires_ack: true,
      } as never);
      if (error) throw error;
      setReference(''); setTitle(''); setCustomerName(''); setAddress(''); setInstructions(''); setDuration('');
      setMessage('Job published to the assigned driver.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to publish job.');
    } finally { setSubmitting(false); }
  };

  return <div className="mx-auto max-w-3xl space-y-6">
    <div className="flex items-center gap-3"><ClipboardList className="text-brand-accent" /><div><h2 className="text-2xl font-bold text-white">Job Planner</h2><p className="text-sm text-slate-400">Publish a planned job to a driver’s existing shift.</p></div></div>
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">Route estimates are advisory only. Drivers must use approved HGV navigation, road signs, site rules, traffic conditions, and professional judgement.</div>
    <form onSubmit={publish} className="space-y-4 rounded-2xl border border-brand-border bg-brand-card p-6">
      <Field label="Published shift"><select required value={shiftId} onChange={e => setShiftId(e.target.value)} className="input"><option value="">Choose a shift</option>{shifts.map(s => <option key={s.id} value={s.id}>{s.date} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.profiles?.full_name ?? 'Driver'}</option>)}</select></Field>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Job reference"><input required value={reference} onChange={e => setReference(e.target.value)} className="input" placeholder="JOB-123" /></Field><Field label="Job type"><select value={jobType} onChange={e => setJobType(e.target.value)} className="input"><option value="delivery">Delivery</option><option value="collection">Collection</option><option value="service">Service</option><option value="other">Other</option></select></Field></div>
      <Field label="Job title"><input required value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Deliver palletised goods" /></Field>
      <Field label="Customer / site"><input value={customerName} onChange={e => setCustomerName(e.target.value)} className="input" placeholder="Customer name" /></Field>
      <Field label="Address"><textarea required value={address} onChange={e => setAddress(e.target.value)} className="input min-h-20" placeholder="Full delivery or collection address" /></Field>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Expected duration (minutes)"><input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} className="input" placeholder="30" /></Field><Field label="Manager instructions"><input value={instructions} onChange={e => setInstructions(e.target.value)} className="input" placeholder="Site access / load notes" /></Field></div>
      {message ? <p className={message.startsWith('Job published') ? 'text-emerald-300 text-sm' : 'text-red-300 text-sm'}>{message}</p> : null}
      <button disabled={submitting || shifts.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Send size={16} />{submitting ? 'Publishing…' : 'Publish job to driver'}</button>
    </form>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-slate-300"><span className="mb-1.5 block">{label}</span>{children}</label>; }
