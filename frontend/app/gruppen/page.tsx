'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { useKumpel } from '@/contexts/KumpelProvider';
import { supabase } from '@/lib/supabaseClient';

interface GroupRow {
  group_id: string;
  role: string;
  groups: { id: string; name: string; type: string; department: string | null } | null;
}

export default function GruppenPage() {
  const { kumpel } = useKumpel();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'team' | 'tipp_community'>('tipp_community');
  const [newClub, setNewClub] = useState('');
  const [newDept, setNewDept] = useState('junioren');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
    loadAdminStatus();
  }, []);

  async function loadAdminStatus() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('users')
      .select('is_platform_admin')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!error && data?.is_platform_admin) {
      setIsPlatformAdmin(true);
      setNewType('team'); // Admin startet sinnvollerweise bei "Mannschaft"
    }
  }

  async function loadGroups() {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('group_members')
      .select('group_id, role, groups ( id, name, type, department )')
      .eq('user_id', session.user.id)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Laden der Gruppen:', error.message);
    } else {
      setGroups((data as unknown as GroupRow[]) || []);
    }
    setLoading(false);
  }

  async function handleJoin() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setJoining(true);
    setJoinError(null);

    const { error } = await supabase.rpc('join_group_by_code', { p_invite_code: trimmed.toUpperCase() });

    if (error) {
      setJoinError('Code ungültig oder abgelaufen.');
    } else {
      setCode('');
      await loadGroups();
    }
    setJoining(false);
  }

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);

    const { data, error } = await supabase.rpc('create_group', {
      p_name: trimmed,
      p_type: newType,
      p_club_name: newType === 'team' && newClub.trim() ? newClub.trim() : null,
      p_department: newType === 'team' ? newDept : null,
    });

    if (error) {
      setCreateError('Konnte Gruppe nicht erstellen: ' + error.message);
      setCreating(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    setCreatedCode(row?.invite_code || null);
    setNewName('');
    setNewClub('');
    await loadGroups();
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-[#141412] text-white font-sans pb-12">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <AppHeader title="Gruppen" subtitle="Deine Mannschaft oder Freunde" backHref="/" />

        {/* Eigene Gruppen */}
        <div className="flex flex-col gap-3 mb-8">
          {loading && <p className="text-sm text-slate-500">Lade Gruppen...</p>}
          {!loading && groups.length === 0 && (
            <p className="text-sm text-slate-500">Du bist noch in keiner Gruppe.</p>
          )}
          {groups.map((g) => (
            <Link
              key={g.group_id}
              href={`/gruppen/${g.group_id}`}
              className="block rounded-xl p-5 bg-[#1c1c1a] hover:bg-[#232320] transition-colors"
            >
              <p className="text-base font-semibold text-white">{g.groups?.name}</p>
              <p className="text-xs text-slate-500 mt-1">
                {g.groups?.type === 'team' ? 'Mannschaft' : 'Tippgemeinschaft'}
                {g.groups?.department ? ` · ${g.groups.department}` : ''} · {g.role}
              </p>
            </Link>
          ))}
        </div>

        {/* Mit Code beitreten */}
        <div className="rounded-xl p-5 bg-[#1c1c1a] mb-4">
          <p className="text-sm font-semibold text-white mb-3">Einladungscode eingeben</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="z.B. A1B2C3"
              className="flex-1 bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleJoin}
              disabled={joining || !code.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {joining ? '...' : 'Beitreten'}
            </button>
          </div>
          {joinError && <p className="text-red-400 text-xs mt-2">{joinError}</p>}
        </div>

        {/* Neue Gruppe erstellen */}
        <div className="rounded-xl p-5 bg-[#1c1c1a]">
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="text-sm font-semibold text-white"
          >
            {showCreate ? '▾' : '▸'} Neue Gruppe erstellen
          </button>

          {showCreate && (
            <div className="mt-4 flex flex-col gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={newType === 'team' ? 'Name der Mannschaft, z.B. Junioren D' : 'Name der Tippgemeinschaft'}
                className="bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />

              {isPlatformAdmin ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewType('team')}
                    className={`flex-1 text-sm py-2 rounded-lg ${newType === 'team' ? 'bg-indigo-600 text-white' : 'bg-[#2a2a27] text-slate-400'}`}
                  >
                    Mannschaft
                  </button>
                  <button
                    onClick={() => setNewType('tipp_community')}
                    className={`flex-1 text-sm py-2 rounded-lg ${newType === 'tipp_community' ? 'bg-indigo-600 text-white' : 'bg-[#2a2a27] text-slate-400'}`}
                  >
                    Tippgemeinschaft
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Du erstellst eine Tippgemeinschaft mit Freunden. Mannschaften legt aktuell nur der Vereinsverantwortliche an.
                </p>
              )}

              {newType === 'team' && isPlatformAdmin && (
                <>
                  <input
                    value={newClub}
                    onChange={(e) => setNewClub(e.target.value)}
                    placeholder="Verein, z.B. FC Bülach"
                    className="bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="junioren">Junioren</option>
                    <option value="aktive">Aktive</option>
                    <option value="damen">Damen</option>
                    <option value="senioren">Senioren</option>
                  </select>
                </>
              )}

              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold py-2 rounded-lg"
              >
                {creating ? 'Erstelle...' : 'Gruppe erstellen'}
              </button>

              {createError && <p className="text-red-400 text-xs">{createError}</p>}

              {createdCode && (
                <div className="bg-black/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">Einladungscode für Mitglieder:</p>
                  <p className="text-xl font-mono font-black tracking-wider text-emerald-400">{createdCode}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}