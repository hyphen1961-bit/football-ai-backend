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
  deleted: boolean;
}

interface ReplyRow {
  message_id: string;
  user_id: string;
  status: 'dabei' | 'nicht_dabei';
  note: string | null;
  updated_at: string;
}

interface Draft {
  status: 'dabei' | 'nicht_dabei' | null;
  note: string;
}

export default function KlappPage() {
  const params = useParams();
  const groupId = params?.id as string;
  const { kumpel } = useKumpel();

  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

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
      .select('id, sender_id, content, created_at, deleted_at')
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
        id: m.id,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
        deleted: !!m.deleted_at,
        readCount: readIds.filter((id) => id !== m.sender_id).length,
        iRead: kumpel ? readIds.includes(kumpel.id) : false,
      });

      // nicht-Admins markieren beim Laden automatisch als gelesen
      if (kumpel && m.sender_id !== kumpel.id && !readIds.includes(kumpel.id)) {
        await supabase.rpc('mark_message_read', { p_message_id: m.id });
      }
    }

    setMessages(enriched);

    // Antworten laden (Admin: alle, Mitglied: nur eigene)
    const { data: replyData, error: replyLoadError } = await supabase.rpc('get_message_replies', {
      p_group_id: groupId,
    });
    if (replyLoadError) {
      console.error('Fehler beim Laden der Antworten:', replyLoadError.message);
    }
    setReplies((replyData as ReplyRow[]) || []);

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

  async function handleDeleteMessage(messageId: string) {
    if (!confirm('Diese Nachricht für alle löschen?')) return;
    setReplyError(null);
    const { error } = await supabase.rpc('delete_group_message', { p_message_id: messageId });
    if (error) {
      setReplyError('Löschen nicht möglich: ' + error.message);
    } else {
      await loadAll();
    }
  }

  function myReplyFor(messageId: string): ReplyRow | undefined {
    return replies.find((r) => r.message_id === messageId && r.user_id === kumpel?.id);
  }

  function draftFor(messageId: string): Draft {
    if (drafts[messageId]) return drafts[messageId];
    const r = myReplyFor(messageId);
    return { status: r?.status ?? null, note: r?.note ?? '' };
  }

  function updateDraft(messageId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [messageId]: { ...draftFor(messageId), ...patch } }));
  }

  async function handleSaveReply(messageId: string) {
    const draft = draftFor(messageId);
    if (!draft.status) return;
    setSavingReplyId(messageId);
    setReplyError(null);

    const { error } = await supabase.rpc('set_message_reply', {
      p_message_id: messageId,
      p_status: draft.status,
      p_note: draft.note,
    });

    if (error) {
      setReplyError('Antwort konnte nicht gespeichert werden: ' + error.message);
    } else {
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[messageId];
        return copy;
      });
      const { data: replyData } = await supabase.rpc('get_message_replies', { p_group_id: groupId });
      setReplies((replyData as ReplyRow[]) || []);
    }
    setSavingReplyId(null);
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

  const replyingMembers = members.filter((m) => m.role !== 'admin');

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

        {replyError && <p className="text-red-400 text-xs mb-3">{replyError}</p>}

        <div className="flex flex-col gap-3">
          {loading && <p className="text-sm text-slate-500">Lade Nachrichten...</p>}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-slate-500">Noch keine Nachrichten.</p>
          )}
          {messages.map((m) => {
            const msgReplies = replies.filter((r) => r.message_id === m.id);
            const yes = msgReplies.filter((r) => r.status === 'dabei');
            const no = msgReplies.filter((r) => r.status === 'nicht_dabei');
            const open = Math.max(replyingMembers.length - msgReplies.length, 0);
            const draft = draftFor(m.id);
            const mine = myReplyFor(m.id);
            const unchanged =
              !!mine && mine.status === draft.status && (mine.note ?? '') === draft.note;

            if (m.deleted) {
              return (
                <div key={m.id} className="rounded-xl p-5 bg-[#1c1c1a]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-500">{senderName(m.sender_id)}</p>
                    <p className="text-xs text-slate-600">{formatTime(m.created_at)}</p>
                  </div>
                  <p className="text-sm italic text-slate-500">Nachricht vom Trainer gelöscht</p>
                </div>
              );
            }

            return (
              <div key={m.id} className="rounded-xl p-5 bg-[#1c1c1a]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white">{senderName(m.sender_id)}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-slate-500">{formatTime(m.created_at)}</p>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteMessage(m.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{m.content}</p>
                <p className="text-xs text-slate-500 mt-3">
                  {isAdmin
                    ? `${m.readCount} von ${members.filter((mm) => mm.user_id !== m.sender_id).length} gelesen`
                    : m.iRead ? '✓ gelesen' : ''}
                </p>

                {/* Admin: Übersicht der Rückmeldungen */}
                {isAdmin && (
                  <div className="mt-3 pt-3 border-t border-[#2a2a27]">
                    <p className="text-xs text-slate-300 mb-2">
                      <span className="text-green-400">{yes.length} dabei</span>
                      {' · '}
                      <span className="text-amber-400">{no.length} nicht dabei</span>
                      {' · '}
                      <span className="text-slate-500">{open} offen</span>
                    </p>
                    {msgReplies.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {msgReplies.map((r) => (
                          <li key={r.user_id} className="text-xs text-slate-300">
                            <span className={r.status === 'dabei' ? 'text-green-400' : 'text-amber-400'}>
                              {r.status === 'dabei' ? '✓' : '✗'}
                            </span>{' '}
                            {senderName(r.user_id)}
                            {r.note ? <span className="text-slate-500"> – {r.note}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Mitglied: Rückmeldung abgeben (nur Admin sieht sie) */}
                {!isAdmin && kumpel && (
                  <div className="mt-3 pt-3 border-t border-[#2a2a27]">
                    <p className="text-xs text-slate-500 mb-2">
                      Deine Rückmeldung (sieht nur der Trainer)
                    </p>
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => updateDraft(m.id, { status: 'dabei' })}
                        className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${
                          draft.status === 'dabei'
                            ? 'bg-green-600 text-white'
                            : 'bg-[#2a2a27] text-slate-300 hover:bg-[#33332f]'
                        }`}
                      >
                        Dabei
                      </button>
                      <button
                        onClick={() => updateDraft(m.id, { status: 'nicht_dabei' })}
                        className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${
                          draft.status === 'nicht_dabei'
                            ? 'bg-amber-600 text-white'
                            : 'bg-[#2a2a27] text-slate-300 hover:bg-[#33332f]'
                        }`}
                      >
                        Nicht dabei
                      </button>
                    </div>
                    {draft.status && (
                      <>
                        <input
                          type="text"
                          value={draft.note}
                          onChange={(e) => updateDraft(m.id, { note: e.target.value })}
                          placeholder={
                            draft.status === 'nicht_dabei'
                              ? 'Grund, z.B. Ferien, krank, Familie (optional)'
                              : 'Kurznotiz (optional)'
                          }
                          className="w-full bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 mb-2"
                        />
                        <button
                          onClick={() => handleSaveReply(m.id)}
                          disabled={savingReplyId === m.id || unchanged}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                        >
                          {savingReplyId === m.id ? 'Speichere...' : 'Rückmeldung senden'}
                        </button>
                      </>
                    )}
                    {mine && unchanged && (
                      <p className="text-xs text-green-400 mt-2">✓ Rückmeldung gespeichert</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
