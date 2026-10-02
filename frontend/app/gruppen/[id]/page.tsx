'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { useKumpel } from '@/contexts/KumpelProvider';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface GroupInfo {
  id: string;
  name: string;
  type: string;
  department: string | null;
  invite_code: string;
}

interface MemberRow {
  user_id: string;
  username: string;
  display_name: string | null;
  role: string;
  joined_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  parent: 'Elternteil',
  child: 'Kind',
  member: 'Mitglied',
};

export default function GruppenDetailPage() {
  const params = useParams();
  const groupId = params?.id as string;
  const { kumpel } = useKumpel();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (groupId) loadAll();
  }, [groupId]);

  async function loadAll() {
    setLoading(true);
    setActionError(null);

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('id, name, type, department, invite_code')
      .eq('id', groupId)
      .maybeSingle();

    if (groupError || !groupData) {
      console.error('Fehler beim Laden der Gruppe:', groupError?.message);
      setLoading(false);
      return;
    }
    setGroup(groupData as GroupInfo);

    const { data: memberData, error: memberError } = await supabase.rpc('get_group_members', {
      p_group_id: groupId,
    });

    if (memberError) {
      console.error('Fehler beim Laden der Mitglieder:', memberError.message);
    } else {
      setMembers((memberData as MemberRow[]) || []);
      const mine = (memberData as MemberRow[])?.find((m) => m.user_id === kumpel?.id);
      setMyRole(mine?.role || null);
    }

    // Ungelesene Nachrichten dieser Gruppe
    const { data: unreadData } = await supabase.rpc('get_unread_counts');
    const row = ((unreadData as { group_id: string; unread_count: number }[]) || []).find(
      (r) => r.group_id === groupId
    );
    setUnreadCount(row ? Number(row.unread_count) : 0);

    setLoading(false);
  }

  async function changeRole(userId: string, newRole: string) {
    setActionError(null);
    const { error } = await supabase
      .from('group_members')
      .update({ role: newRole })
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      setActionError('Rolle konnte nicht geändert werden: ' + error.message);
    } else {
      await loadAll();
    }
  }

  async function removeMember(userId: string) {
    if (!confirm('Dieses Mitglied wirklich aus der Gruppe entfernen?')) return;
    setActionError(null);

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      setActionError('Mitglied konnte nicht entfernt werden: ' + error.message);
    } else {
      await loadAll();
    }
  }

  const isAdmin = myRole === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141412] text-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Lade Gruppe...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#141412] text-white font-sans pb-12">
        <div className="max-w-4xl mx-auto pt-6 px-4">
          <AppHeader title="Gruppe nicht gefunden" backHref="/gruppen" />
          <p className="text-sm text-slate-500">Diese Gruppe existiert nicht oder du bist kein Mitglied.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141412] text-white font-sans pb-12">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <AppHeader
          title={group.name}
          subtitle={group.type === 'team' ? 'Mannschaft' : 'Tippgemeinschaft'}
          backHref="/gruppen"
        />

        {/* Einladungscode */}
        <div className="rounded-xl p-5 bg-[#1c1c1a] mb-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Einladungscode für neue Mitglieder:</p>
          <p className="text-xl font-mono font-black tracking-wider text-emerald-400">{group.invite_code}</p>
        </div>

        <Link
          href={`/gruppen/${groupId}/nachrichten`}
          className="relative block rounded-xl p-5 bg-[#1c1c1a] mb-4 hover:bg-[#232320] transition-colors"
        >
          {unreadCount > 0 && (
            <span className="absolute top-4 right-4 min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <p className="text-sm font-semibold text-white">📋 Nachrichten</p>
          <p className="text-xs text-slate-500 mt-1">Infos vom Trainer</p>
        </Link>

        {group.type === 'team' && (
          <Link
            href={`/gruppen/${groupId}/chat`}
            className="block rounded-xl p-5 bg-[#1c1c1a] mb-4 hover:bg-[#232320] transition-colors"
          >
            <p className="text-sm font-semibold text-white">💬 Chat</p>
            <p className="text-xs text-slate-500 mt-1">Mit Trainer oder nur Kinder</p>
          </Link>
        )}

        {group.type === 'team' && (
          <Link
            href={`/gruppen/${groupId}/tippspiel`}
            className="block rounded-xl p-5 bg-[#1c1c1a] mb-4 hover:bg-[#232320] transition-colors"
          >
            <p className="text-sm font-semibold text-white">🎯 Tippspiel</p>
            <p className="text-xs text-slate-500 mt-1">Spiele und Resultate der Mannschaft</p>
          </Link>
        )}

        {/* Mitgliederliste */}
        <div className="rounded-xl p-5 bg-[#1c1c1a]">
          <p className="text-sm font-semibold text-white mb-4">
            Mitglieder ({members.length})
          </p>

          {actionError && <p className="text-red-400 text-xs mb-3">{actionError}</p>}

          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between bg-[#2a2a27] rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {m.display_name || m.username}
                  </p>
                  <p className="text-xs text-slate-500">{ROLE_LABELS[m.role] || m.role}</p>
                </div>

                {isAdmin && m.user_id !== kumpel?.id && (
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.user_id, e.target.value)}
                      className="bg-[#1c1c1a] border border-[#3a3a36] rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value="member">Mitglied</option>
                      <option value="parent">Elternteil</option>
                      <option value="child">Kind</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => removeMember(m.user_id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Entfernen
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}