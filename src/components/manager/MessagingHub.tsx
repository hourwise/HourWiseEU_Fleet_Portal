import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageSquare, Send, Users, Megaphone, ChevronRight,
  CheckCheck, Clock, RefreshCw, PenSquare, X,
} from 'lucide-react';
import type { Database } from '../../lib/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = Database['public']['Tables']['profiles']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

interface MessageWithProfiles extends Message {
  sender?: { full_name: string } | null;
  recipient?: { full_name: string } | null;
}

type ThreadType = 'broadcast' | string; // 'broadcast' or driver's user_id

interface ThreadMeta {
  type: ThreadType;
  driverId?: string;
  driverName?: string;
  lastBody: string;
  lastAt: string;
  unreadCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtTime = (s: string) => {
  const d = new Date(s);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// ─── Message Bubble ───────────────────────────────────────────────────────────

function Bubble({ msg, isMe }: { msg: MessageWithProfiles; isMe: boolean }) {
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isMe && (
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
            {msg.sender?.full_name ?? 'Driver'}
          </p>
        )}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isMe
            ? 'bg-brand-accent text-white rounded-br-sm'
            : 'bg-brand-card border border-brand-border text-slate-200 rounded-bl-sm'
        }`}>
          {msg.body}
        </div>
        <div className={`flex items-center gap-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-slate-500">{fmtTime(msg.created_at)}</span>
          {isMe && msg.read_at && <CheckCheck size={11} className="text-brand-accent" />}
          {isMe && !msg.read_at && <Clock size={11} className="text-slate-500" />}
        </div>
      </div>
    </div>
  );
}

// ─── Compose Modal ────────────────────────────────────────────────────────────

function ComposeModal({
  drivers,
  onSend,
  onClose,
}: {
  drivers: Profile[];
  onSend: (body: string, recipientId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [body, setBody] = useState('');
  const [recipientId, setRecipientId] = useState<string | null>(null); // null = broadcast
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!body.trim()) { setError('Message cannot be empty.'); return; }
    setSending(true);
    setError('');
    try {
      await onSend(body.trim(), recipientId);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to send.');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h3 className="font-black text-white flex items-center gap-2"><PenSquare size={16} /> New Message</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-dark text-slate-400 hover:text-white transition"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">To</label>
            <select
              value={recipientId ?? ''}
              onChange={e => setRecipientId(e.target.value || null)}
              className="w-full px-3 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-slate-200 focus:ring-2 focus:ring-brand-accent"
            >
              <option value="">📢 All Drivers (Company Broadcast)</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder={recipientId ? 'Write a direct message...' : 'Write a broadcast to all drivers...'}
              className="w-full px-3 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-brand-accent resize-none"
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="p-5 border-t border-brand-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition">Cancel</button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2 bg-brand-accent hover:bg-brand-accent-dark text-white rounded-lg text-sm font-black transition disabled:opacity-50"
          >
            <Send size={14} /> {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MessagingHub() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<MessageWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<ThreadType | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Load drivers ──────────────────────────────────────────────────────────

  const loadDrivers = useCallback(async () => {
    if (!profile?.company_id) return;
    const { data } = await supabase.from('profiles').select('*').eq('company_id', profile.company_id).eq('role', 'driver').eq('is_active', true);
    setDrivers(data ?? []);
  }, [profile?.company_id]);

  // ── Load messages ─────────────────────────────────────────────────────────

  const loadMessages = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:sender_id(full_name), recipient:recipient_id(full_name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((data as MessageWithProfiles[]) ?? []);
    } catch (e) {
      console.error('Error loading messages:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.company_id) return;
    loadDrivers();
    loadMessages();

    const channel = supabase
      .channel(`messages:company:${profile.company_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `company_id=eq.${profile.company_id}` },
        payload => {
          // Re-fetch with joined profile names rather than merging partial payload
          loadMessages();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `company_id=eq.${profile.company_id}` },
        () => loadMessages()
      )
      .subscribe(status => {
        setRealtimeStatus(status === 'SUBSCRIBED' ? 'connected' : status === 'CLOSED' ? 'error' : 'connecting');
      });

    return () => { supabase.removeChannel(channel); };
  }, [profile?.company_id, loadDrivers, loadMessages]);

  // ── Scroll to bottom when thread changes or messages arrive ──────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedThread]);

  // ── Mark direct messages as read when thread is opened ───────────────────

  useEffect(() => {
    if (!selectedThread || selectedThread === 'broadcast' || !profile?.id) return;
    // Mark messages from this driver to this manager as read
    const unread = messages.filter(
      m => m.sender_id === selectedThread && m.recipient_id === profile.id && !m.read_at
    );
    if (unread.length === 0) return;
    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread.map(m => m.id))
      .then(() => loadMessages());
  }, [selectedThread, profile?.id]);

  // ── Build thread list ─────────────────────────────────────────────────────

  const threads: ThreadMeta[] = (() => {
    const result: ThreadMeta[] = [];

    // Broadcast thread — messages with recipient_id IS NULL
    const broadcasts = messages.filter(m => m.recipient_id === null);
    if (broadcasts.length > 0) {
      const last = broadcasts[broadcasts.length - 1];
      result.push({
        type: 'broadcast',
        lastBody: last.body,
        lastAt: last.created_at,
        unreadCount: 0, // broadcasts don't have per-manager read tracking
      });
    } else {
      // Always show broadcast thread so managers can compose
      result.push({ type: 'broadcast', lastBody: 'No broadcasts yet', lastAt: '', unreadCount: 0 });
    }

    // Per-driver direct threads
    const driverIds = new Set<string>();
    messages.forEach(m => {
      if (m.recipient_id === null) return; // skip broadcasts
      const otherId = m.sender_id === profile?.id ? m.recipient_id : m.sender_id;
      if (otherId) driverIds.add(otherId);
    });

    driverIds.forEach(driverId => {
      const thread = messages.filter(m =>
        m.recipient_id !== null &&
        (m.sender_id === driverId || m.recipient_id === driverId)
      );
      const last = thread[thread.length - 1];
      const unreadCount = thread.filter(m => m.sender_id === driverId && m.recipient_id === profile?.id && !m.read_at).length;
      const driver = drivers.find(d => d.id === driverId);
      result.push({
        type: driverId,
        driverId,
        driverName: driver?.full_name ?? last?.sender?.full_name ?? last?.recipient?.full_name ?? 'Driver',
        lastBody: last?.body ?? '',
        lastAt: last?.created_at ?? '',
        unreadCount,
      });
    });

    // Sort direct threads by latest message (descending), broadcasts always first
    return [
      result[0], // broadcast always first
      ...result.slice(1).sort((a, b) => (b.lastAt > a.lastAt ? 1 : -1)),
    ];
  })();

  // ── Thread messages ───────────────────────────────────────────────────────

  const threadMessages = selectedThread === null
    ? []
    : selectedThread === 'broadcast'
    ? messages.filter(m => m.recipient_id === null)
    : messages.filter(m =>
        m.recipient_id !== null &&
        (m.sender_id === selectedThread || m.recipient_id === selectedThread)
      );

  const totalUnread = threads.reduce((s, t) => s + t.unreadCount, 0);

  // ── Send ──────────────────────────────────────────────────────────────────

  const sendMessage = async (body: string, recipientId: string | null) => {
    if (!profile?.company_id || !profile?.id) throw new Error('Not authenticated');
    const { error } = await supabase.from('messages').insert({
      company_id: profile.company_id,
      sender_id: profile.id,
      recipient_id: recipientId,
      body,
    });
    if (error) throw error;
  };

  const handleReply = async () => {
    if (!reply.trim() || !selectedThread || selectedThread === 'broadcast') return;
    setSending(true);
    try {
      await sendMessage(reply.trim(), selectedThread);
      setReply('');
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-brand-accent/10 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-brand-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              Messages
              {totalUnread > 0 && (
                <span className="text-sm bg-red-500 text-white px-2 py-0.5 rounded-full font-black">{totalUnread}</span>
              )}
            </h2>
            <p className="text-sm text-slate-400 flex items-center gap-2">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${realtimeStatus === 'connected' ? 'bg-green-400' : realtimeStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
              {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
              {' · '}{drivers.length} drivers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadMessages} className="p-2 rounded-lg bg-brand-card border border-brand-border text-slate-400 hover:text-white hover:bg-brand-dark transition" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-accent hover:bg-brand-accent-dark text-white rounded-xl text-sm font-black transition"
          >
            <PenSquare size={14} /> New Message
          </button>
        </div>
      </div>

      {/* Main panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 bg-brand-card border border-brand-border rounded-2xl overflow-hidden" style={{ height: '72vh' }}>

        {/* Thread list */}
        <div className="lg:col-span-1 border-r border-brand-border flex flex-col">
          <div className="p-3 border-b border-brand-border">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-brand-border/50">
            {loading && messages.length === 0 ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-accent" /></div>
            ) : (
              threads.map(thread => (
                <button
                  key={thread.type}
                  onClick={() => setSelectedThread(thread.type)}
                  className={`w-full text-left p-4 hover:bg-brand-dark/50 transition flex items-start gap-3 ${selectedThread === thread.type ? 'bg-brand-dark/70 border-l-2 border-brand-accent' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${thread.type === 'broadcast' ? 'bg-blue-500/20' : 'bg-brand-accent/15'}`}>
                    {thread.type === 'broadcast'
                      ? <Megaphone size={15} className="text-blue-400" />
                      : <Users size={15} className="text-brand-accent" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-sm text-white truncate">
                        {thread.type === 'broadcast' ? 'Company Broadcast' : thread.driverName}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {thread.unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{thread.unreadCount}</span>
                        )}
                        {thread.lastAt && <span className="text-[10px] text-slate-500">{fmtTime(thread.lastAt)}</span>}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{thread.lastBody}</p>
                    {thread.type === 'broadcast' && (
                      <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider">All Drivers</span>
                    )}
                  </div>
                </button>
              ))
            )}
            {threads.length === 0 && !loading && (
              <div className="p-8 text-center">
                <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No messages yet.</p>
                <p className="text-xs text-slate-500 mt-1">Send a broadcast or direct message to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Thread view */}
        <div className="lg:col-span-2 flex flex-col">
          {selectedThread === null ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageSquare className="w-16 h-16 text-slate-700 mb-4" />
              <h3 className="text-lg font-bold text-slate-400">Select a conversation</h3>
              <p className="text-sm text-slate-500 mt-1">Choose a thread on the left, or start a new message.</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="p-4 border-b border-brand-border flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedThread === 'broadcast' ? 'bg-blue-500/20' : 'bg-brand-accent/15'}`}>
                  {selectedThread === 'broadcast' ? <Megaphone size={14} className="text-blue-400" /> : <Users size={14} className="text-brand-accent" />}
                </div>
                <div>
                  <p className="font-black text-white text-sm">
                    {selectedThread === 'broadcast' ? 'Company Broadcast' : threads.find(t => t.type === selectedThread)?.driverName ?? 'Driver'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {selectedThread === 'broadcast' ? 'Visible to all drivers in your company' : 'Direct message thread'}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {threadMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare className="w-12 h-12 text-slate-700 mb-3" />
                    <p className="text-sm text-slate-400">No messages in this thread yet.</p>
                    {selectedThread === 'broadcast' && (
                      <button
                        onClick={() => setShowCompose(true)}
                        className="mt-3 px-4 py-2 bg-brand-accent text-white rounded-lg text-xs font-black hover:bg-brand-accent-dark transition"
                      >
                        Send First Broadcast
                      </button>
                    )}
                  </div>
                ) : (
                  threadMessages.map(msg => (
                    <Bubble key={msg.id} msg={msg} isMe={msg.sender_id === profile?.id} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Reply box — only for direct threads */}
              {selectedThread !== 'broadcast' ? (
                <div className="p-3 border-t border-brand-border flex items-end gap-2">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    placeholder={`Reply to ${threads.find(t => t.type === selectedThread)?.driverName ?? 'driver'}… (Enter to send)`}
                    className="flex-1 px-3 py-2.5 bg-brand-dark border border-brand-border rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-brand-accent resize-none"
                  />
                  <button
                    onClick={handleReply}
                    disabled={sending || !reply.trim()}
                    className="p-3 bg-brand-accent hover:bg-brand-accent-dark text-white rounded-xl transition disabled:opacity-40 flex-shrink-0"
                  >
                    <Send size={16} className={sending ? 'animate-pulse' : ''} />
                  </button>
                </div>
              ) : (
                <div className="p-3 border-t border-brand-border">
                  <button
                    onClick={() => setShowCompose(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-dark border border-brand-border hover:border-brand-accent text-slate-300 hover:text-white rounded-xl text-sm font-bold transition"
                  >
                    <Megaphone size={14} /> New Company Broadcast
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Compose modal */}
      {showCompose && (
        <ComposeModal
          drivers={drivers}
          onSend={sendMessage}
          onClose={() => setShowCompose(false)}
        />
      )}
    </div>
  );
}
