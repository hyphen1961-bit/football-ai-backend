'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { useKumpel } from '@/contexts/KumpelProvider';
import { supabase } from '@/lib/supabaseClient';

type Channel = 'mit_trainer' | 'nur_kinder';

interface MemberRow {
  user_id: string;
  username: string;
  display_name: string | null;
  role: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
  deleted: boolean;
}

const CHANNEL_LABELS: Record<Channel, string> = {
  mit_trainer: 'Mit Trainer',
  nur_kinder: 'Nur Kinder',
};

export default function ChatPage() {
  const params = useParams();
  const groupId = params?.id as string;
  const { kumpel } = useKumpel();

  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [channel, setChannel] = useState<Channel>('mit_trainer');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const myRole = members.find((m) => m.user_id === kumpel?.id)?.role || null;

  // Welche Reiter darf ich sehen? Trainer (admin) sieht "Nur Kinder" nie.
  const channels: Channel[] =
    myRole === 'admin'
      ? ['mit_trainer']
      : myRole === 'child' || myRole === 'parent'
        ? ['mit_trainer', 'nur_kinder']
        : [];

  const canWrite =
    (channel === 'mit_trainer' && (myRole === 'admin' || myRole === 'child')) ||
    (channel === 'nur_kinder' && myRole === 'child');

  const canDelete = myRole === 'admin' && channel === 'mit_trainer';

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      const { data: groupData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .maybeSingle();
      setGroupName(groupData?.name || '');

      const { data: memberData } = await supabase.rpc('get_group_members', { p_group_id: groupId });
      setMembers((memberData as MemberRow[]) || []);
      setMembersLoaded(true);
    })();
  }, [groupId]);

  async function loadMessages(showSpinner: boolean) {
    if (!groupId || !channels.includes(channel)) return;
    if (showSpinner) setLoading(true);

    const { data, error: err } = await supabase.rpc('get_chat_messages', {
      p_group_id: groupId,
      p_channel: channel,
      p_limit: 100,
    });

    if (err) {
      setError('Chat konnte nicht geladen werden: ' + err.message);
    } else {
      setError(null);
      setMessages((data as ChatMessage[]) || []);
    }
    if (showSpinner) setLoading(false);
  }

  // Laden beim Start und beim Reiterwechsel, danach alle 8 Sekunden aktualisieren
  useEffect(() => {
    if (!membersLoaded || !myRole) {
      if (membersLoaded) setLoading(false);
      return;
    }
    setMessages([]);
    loadMessages(true);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages(false);
    }, 8000);
    return () => clearInterval(timer);
  }, [membersLoaded, myRole, channel, groupId]);

  // Nach unten scrollen, wenn neue Nachrichten da sind
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);

    const { error: err } = await supabase.rpc('send_chat_message', {
      p_group_id: groupId,
      p_channel: channel,
      p_content: trimmed,
    });

    if (err) {
      setError('Nachricht konnte nicht gesendet werden: ' + err.message);
    } else {
      setText('');
      await loadMessages(false);
    }
    setSending(false);
  }

  async function handleDelete(messageId: string) {
    if (!confirm('Diese Nachricht für alle löschen?')) return;
    const { error: err } = await supabase.rpc('delete_chat_message', { p_message_id: messageId });
    if (err) {
      setError('Löschen nicht möglich: ' + err.message);
    } else {
      await loadMessages(false);
    }
  }

  function senderName(senderId: string) {
    const m = members.find((mm) => mm.user_id === senderId);
    return m?.display_name || m?.username || 'Unbekannt';
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    return (
      d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
    );
  }

  function hint() {
    if (channel === 'nur_kinder') {
      return myRole === 'child'
        ? 'Hier schreiben nur Kinder. Eltern lesen mit, der Trainer sieht diesen Chat nicht.'
        : 'Du kannst mitlesen. Schreiben dürfen die Kinder.';
    }
    return myRole === 'parent'
      ? 'Du kannst mitlesen. Schreiben dürfen Kinder und Trainer.'
      : 'Kinder, Trainer und Eltern (lesend).';
  }

  return (
    <div className="min-h-screen bg-[#141412] text-white font-sans pb-12">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <AppHeader title="Chat" subtitle={groupName} backHref={`/gruppen/${groupId}`} />

        {membersLoaded && channels.length === 0 && (
          <div className="rounded-xl p-5 bg-[#1c1c1a]">
            <p className="text-sm text-slate-400">
              Für den Chat braucht es die Rolle Kind, Elternteil oder Trainer. Der Trainer weist sie dir in der
              Mitgliederliste zu.
            </p>
          </div>
        )}

        {channels.length > 0 && (
          <>
            {channels.length > 1 && (
              <div className="flex gap-2 mb-3">
                {channels.map((c) => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={`flex-1 text-sm font-semibold py-2 rounded-lg ${
                      channel === c ? 'bg-indigo-600 text-white' : 'bg-[#1c1c1a] text-slate-400'
                    }`}
                  >
                    {CHANNEL_LABELS[c]}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-500 mb-3">{hint()}</p>

            <div className="rounded-xl p-4 bg-[#1c1c1a] mb-3 min-h-[320px] max-h-[60vh] overflow-y-auto flex flex-col gap-2">
              {loading && <p className="text-sm text-slate-500">Lade Chat...</p>}
              {!loading && messages.length === 0 && (
                <p className="text-sm text-slate-500">Noch keine Nachrichten.</p>
              )}

              {messages.map((m) => {
                const mine = m.sender_id === kumpel?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 ${
                        mine ? 'bg-indigo-600/80' : 'bg-[#2a2a27]'
                      }`}
                    >
                      {!mine && (
                        <p className="text-xs font-semibold text-amber-300 mb-0.5">
                          {senderName(m.sender_id)}
                        </p>
                      )}
                      {m.deleted ? (
                        <p className="text-sm italic text-slate-500">Nachricht gelöscht</p>
                      ) : (
                        <p className="text-sm text-white whitespace-pre-wrap break-words">{m.content}</p>
                      )}
                      <div className="flex items-center justify-between gap-3 mt-1">
                        <p className="text-[10px] text-slate-400">{formatTime(m.created_at)}</p>
                        {canDelete && !m.deleted && (
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="text-[10px] text-red-300 hover:text-red-200"
                          >
                            Löschen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

            {canWrite && (
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  maxLength={1000}
                  placeholder="Nachricht schreiben..."
                  className="flex-1 bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !text.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                >
                  {sending ? '...' : 'Senden'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
