'use client';

// Ablegen unter: app/gruppen/[id]/eltern/page.tsx

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

interface LinkRow {
  l_id: string;
  l_parent_id: string;
  l_parent_name: string | null;
  l_child_id: string;
  l_child_name: string | null;
  l_confirmed: boolean;
}

export default function ElternPage() {
  const params = useParams();
  const groupId = params?.id as string;
  const { kumpel } = useKumpel();
  const myId = kumpel?.id;

  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (groupId && myId) load();
  }, [groupId, myId]);

  async function load() {
    const { data: g } = await supabase.from('groups').select('name, invite_code').eq('id', groupId).maybeSingle();
    setGroupName(g?.name || '');
    setInviteCode(g?.invite_code || '');
    const { data: m } = await supabase.rpc('get_group_members', { p_group_id: groupId });
    setMembers((m as MemberRow[]) || []);
    const { data: l, error: err } = await supabase.rpc('get_parent_links', { p_group_id: groupId });
    if (err) setError('Verknüpfungen konnten nicht geladen werden: ' + err.message);
    setLinks((l as LinkRow[]) || []);
    setLoading(false);
  }

  async function run(fn: string, args: Record<string, string>) {
    setError(null);
    const { error: err } = await supabase.rpc(fn, args);
    if (err) setError(err.message);
    await load();
  }

  const me = members.find((m) => m.user_id === myId);
  const isAdmin = me?.role === 'admin';
  const isChild = me?.role === 'child';
  const children = members.filter((m) => m.role === 'child');
  const myLinks = links.filter((l) => l.l_parent_id === myId);
  const childName = (c: MemberRow) => c.display_name || c.username;

  const reminder =
    `Hallo zusammen, bitte macht in der Fussball-App ${groupName} mit:\n` +
    `1. Seite öffnen: ${typeof window !== 'undefined' ? window.location.origin : ''}\n` +
    `2. Mit Vorname und Nachname anmelden (damit der Trainer euch erkennt) und den angezeigten Hyphen-Schlüssel gut aufbewahren\n` +
    `3. Bei «Gruppen» den Code ${inviteCode} eingeben\n` +
    `4. Bei «Eltern & Kinder» euer Kind antippen\n` +
    `Vater und Mutter melden sich je mit eigenem Zugang an.`;

  async function copyReminder() {
    try {
      await navigator.clipboard.writeText(reminder);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Kopieren nicht möglich, bitte den Text von Hand markieren.');
    }
  }

  return (
    <div className="min-h-screen bg-[#141412] text-white font-sans pb-12">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <AppHeader title="Eltern & Kinder" subtitle={groupName} backHref={`/gruppen/${groupId}`} />

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Lade...</p>}

        {!loading && !me && (
          <div className="rounded-xl p-5 bg-[#1c1c1a]">
            <p className="text-sm text-slate-400">Diese Seite ist nur für Mitglieder der Gruppe sichtbar.</p>
          </div>
        )}

        {!loading && isChild && (
          <div className="rounded-xl p-5 bg-[#1c1c1a]">
            <p className="text-sm text-slate-400">Diese Seite ist für Eltern und Trainer.</p>
          </div>
        )}

        {!loading && me && !isChild && (
          <>
            {/* Mein Kind */}
            <div className="rounded-xl p-5 bg-[#1c1c1a] mb-4">
              <p className="text-sm font-semibold text-white mb-1">Mein Kind</p>
              <p className="text-xs text-slate-500 mb-3">Tippe auf dein Kind. Der Trainer bestätigt danach einmal.</p>
              {children.length === 0 && (
                <p className="text-sm text-slate-500">Noch keine Kinder in der Gruppe. Sie müssen sich zuerst anmelden.</p>
              )}
              <div className="flex flex-col gap-2">
                {children.map((c) => {
                  const mine = myLinks.find((l) => l.l_child_id === c.user_id);
                  return (
                    <div key={c.user_id} className="flex items-center justify-between bg-[#2a2a27] rounded-lg px-4 py-3">
                      <p className="text-sm text-white">{childName(c)}</p>
                      {!mine && (
                        <button
                          onClick={() => run('link_child', { p_group_id: groupId, p_child_id: c.user_id })}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg"
                        >
                          Mein Kind
                        </button>
                      )}
                      {mine && (
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-semibold ${mine.l_confirmed ? 'text-emerald-400' : 'text-amber-300'}`}>
                            {mine.l_confirmed ? 'Bestätigt' : 'Wartet auf den Trainer'}
                          </span>
                          <button
                            onClick={() => run('remove_parent_link', { p_link_id: mine.l_id })}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Entfernen
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Übersicht (nur Trainer) */}
            {isAdmin && (
              <div className="rounded-xl p-5 bg-[#1c1c1a]">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <p className="text-sm font-semibold text-white">Übersicht</p>
                  <button
                    onClick={copyReminder}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg"
                  >
                    {copied ? 'Kopiert' : 'Anleitung für Eltern kopieren'}
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {children.map((c) => {
                    const ps = links.filter((l) => l.l_child_id === c.user_id);
                    return (
                      <div key={c.user_id} className="bg-[#2a2a27] rounded-lg px-4 py-3">
                        <p className="text-sm font-medium text-white">{childName(c)}</p>
                        {ps.length === 0 && <p className="text-xs text-amber-300 mt-1">Noch keine Eltern</p>}
                        {ps.map((l) => (
                          <div key={l.l_id} className="flex items-center justify-between mt-2">
                            <p className="text-xs text-slate-300">
                              {l.l_parent_name || 'Unbekannt'}
                              {!l.l_confirmed && <span className="text-amber-300"> · wartet</span>}
                            </p>
                            <div className="flex items-center gap-3">
                              {!l.l_confirmed && (
                                <button
                                  onClick={() => run('confirm_parent_link', { p_link_id: l.l_id })}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1 rounded-lg"
                                >
                                  Passt
                                </button>
                              )}
                              <button
                                onClick={() => run('remove_parent_link', { p_link_id: l.l_id })}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Entfernen
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
