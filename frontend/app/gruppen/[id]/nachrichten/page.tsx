'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { useKumpel } from '@/contexts/KumpelProvider';
import { supabase } from '@/lib/supabaseClient';

interface MemberRow {
  user_id: string;
  username: string;
  display_name: string | null;
  role: string;
}

interface MessageRow {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  readCount: number;
  iRead: boolean;
}

export default function KlappPage() {
  const params = useParams();
  const groupId = params?.id as string;
  const { kumpel } = useKumpel();

  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (groupId) loadAll();
  }, [groupId]);

  async function loadAll() {
    setLoading(true);

    const { data: groupData } = await supabase
      .from('groups')
      .select('name')
      .eq('id', groupId)
      .maybeSingle();
    setGroupName(groupData?.name || '');

    const { data: memberData } = await supabase.rpc('get_group_members', { p_group_id: groupId });
    const memberList = (memberData as MemberRow[]) || [];
    setMembers(memberList);

    const mine = memberList.find((m) => m.user_id === kumpel?.id);
    setIsAdmin(mine?.role === 'admin');

    const { data: msgData, error: msgError } = await supabase
      .from('group_messages')
      .select('id, sender_id, content, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (msgError) {
      console.error('Fehler beim Laden der Nachrichten:', msgError.message);
      setLoading(false);
      return;
    }

    const msgs = msgData || [];
    const enriched: MessageRow[] = [];

    for (const m of msgs) {
      const { data: reads } = await supabase
        .from('group_message_reads')
        .select('user_id')
        .eq('message_id', m.id);

      const readIds = (reads || []).map((r) => r.user_id);
      enriched.push({
        ...m,
        readCount: readIds.length,
        iRead: kumpel ? readIds.includes(kumpel.id) : false,
      });

      // nicht-Admins markieren beim Laden automatisch als gelesen
      if (kumpel && !readIds.includes(kumpel.id)) {
        await supabase.rpc('mark_message_read', { p_message_id: m.id });
      }
    }

    setMessages(enriched);
    setLoading(false);
  }

  async function handleSend() {
    const trimmed = newMessage.trim();
    if (!trimmed || !kumpel) return;
    setSending(true);
    setSendError(null);

    const { error } = await supabase
      .from('group_messages')
      .insert({ group_id: groupId, sender_id: kumpel.id, content: trimmed });

    if (error) {
      setSendError('Nachricht konnte nicht gesendet werden: ' + error.message);
    } else {
      setNewMessage('');
      await loadAll();
    }
    setSending(false);
  }

  function senderName(senderId: string) {
    const m = members.find((mm) => mm.user_id === senderId);
    return m?.display_name || m?.username || 'Unbekannt';
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="min-h-screen bg-[#141412] text-white font-sans pb-12">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <AppHeader title="Nachrichten" subtitle={groupName} backHref={`/gruppen/${groupId}`} />

        {isAdmin && (
          <div className="rounded-xl p-5 bg-[#1c1c1a] mb-4">
            <p className="text-sm font-semibold text-white mb-3">Neue Nachricht an alle</p>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="z.B. Training morgen 18 Uhr, bitte Trainingsanzug mitbringen"
              rows={3}
              className="w-full bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 mb-3"
            />
            <button
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {sending ? 'Sende...' : 'Senden'}
            </button>
            {sendError && <p className="text-red-400 text-xs mt-2">{sendError}</p>}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {loading && <p className="text-sm text-slate-500">Lade Nachrichten...</p>}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-slate-500">Noch keine Nachrichten.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl p-5 bg-[#1c1c1a]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-white">{senderName(m.sender_id)}</p>
                <p className="text-xs text-slate-500">{formatTime(m.created_at)}</p>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{m.content}</p>
              <p className="text-xs text-slate-500 mt-3">
                {isAdmin
                  ? `${m.readCount} von ${members.length} gelesen`
                  : m.iRead ? '✓ gelesen' : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}