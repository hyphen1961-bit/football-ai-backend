'use client';

// Ablegen unter: app/gruppen/[id]/tippspiel/page.tsx

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { useKumpel } from '@/contexts/KumpelProvider';
import { supabase } from '@/lib/supabaseClient';

type Pick = 'S' | 'U' | 'N';

interface Competition {
  id: string;
  name: string;
  comp_type: 'cup' | 'meisterschaft' | 'turnier';
  team_name: string;
}

interface Game {
  id: string;
  competition_id: string;
  kickoff_at: string;
  opponent: string;
  is_home: boolean;
  round_label: string | null;
  location: string | null;
  goals_for: number | null;
  goals_against: number | null;
}

interface Tip {
  game_id: string;
  user_id: string;
  pick: Pick;
  exact_for: number | null;
  exact_against: number | null;
}

interface Draft {
  pick: Pick | '';
  l: string; // Tore links (wie in der Karte angezeigt)
  r: string; // Tore rechts
}

interface RankRow {
  r_rank: number;
  r_user_id: string;
  r_name: string | null;
  r_points: number;
  r_scored: number;
  r_tendency: number;
  r_exact: number;
}

const PICK_LABEL: Record<Pick, string> = { S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' };

function isPlayed(g: Game) {
  return g.goals_for !== null && g.goals_against !== null;
}

function outcome(g: Game): Pick | null {
  if (!isPlayed(g)) return null;
  const gf = g.goals_for as number;
  const ga = g.goals_against as number;
  return gf > ga ? 'S' : gf < ga ? 'N' : 'U';
}

function fits(pick: Pick, gf: number, ga: number) {
  return pick === 'S' ? gf > ga : pick === 'N' ? gf < ga : gf === ga;
}

// 2 Punkte für die Tendenz, +1 fürs exakte Resultat
function tipPoints(t: Tip, g: Game) {
  if (!isPlayed(g) || t.pick !== outcome(g)) return 0;
  return 2 + (t.exact_for === g.goals_for && t.exact_against === g.goals_against ? 1 : 0);
}

function isOpen(g: Game) {
  return !isPlayed(g) && new Date(g.kickoff_at).getTime() > Date.now();
}

function formatKickoff(ts: string) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
  );
}

export default function TippspielPage() {
  const params = useParams();
  const groupId = params?.id as string;
  const { kumpel } = useKumpel();

  const [groupName, setGroupName] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [view, setView] = useState<'tippen' | 'rangliste'>('tippen');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selected = competitions.find((c) => c.id === selectedId) || null;
  const myId = kumpel?.id;

  useEffect(() => {
    if (groupId && myId) loadBase();
  }, [groupId, myId]);

  useEffect(() => {
    if (selectedId) {
      loadGamesAndTips(selectedId);
      loadRanking(selectedId);
    }
  }, [selectedId]);

  async function loadBase() {
    setLoading(true);
    const { data: groupData } = await supabase.from('groups').select('name').eq('id', groupId).maybeSingle();
    setGroupName(groupData?.name || '');

    const { data: members } = await supabase.rpc('get_group_members', { p_group_id: groupId });
    setIsMember(((members as { user_id: string }[]) || []).some((m) => m.user_id === myId));

    const { data, error: err } = await supabase
      .from('group_competitions')
      .select('id, name, comp_type, team_name')
      .eq('group_id', groupId)
      .neq('comp_type', 'turnier')
      .order('created_at', { ascending: true });
    if (err) setError('Wettbewerbe konnten nicht geladen werden: ' + err.message);
    const list = (data as Competition[]) || [];
    setCompetitions(list);
    if (list.length > 0) setSelectedId(list[list.length - 1].id);
    setLoading(false);
  }

  async function loadGamesAndTips(compId: string) {
    const { data, error: err } = await supabase
      .from('group_games')
      .select('id, competition_id, kickoff_at, opponent, is_home, round_label, location, goals_for, goals_against')
      .eq('competition_id', compId)
      .order('kickoff_at', { ascending: true });
    if (err) {
      setError('Spiele konnten nicht geladen werden: ' + err.message);
      return;
    }
    const list = (data as Game[]) || [];
    setGames(list);
    if (list.length === 0) {
      setTips([]);
      return;
    }
    const { data: tData, error: tErr } = await supabase
      .from('group_game_tips')
      .select('game_id, user_id, pick, exact_for, exact_against')
      .in('game_id', list.map((g) => g.id));
    if (tErr) {
      setError('Tipps konnten nicht geladen werden: ' + tErr.message);
      return;
    }
    setTips((tData as Tip[]) || []);
  }

  async function loadRanking(compId: string) {
    const { data, error: err } = await supabase.rpc('get_competition_ranking', { p_competition_id: compId });
    if (err) {
      setError('Rangliste konnte nicht geladen werden: ' + err.message);
      return;
    }
    setRanking((data as RankRow[]) || []);
  }

  function myTip(g: Game) {
    return tips.find((t) => t.game_id === g.id && t.user_id === myId) || null;
  }

  function getDraft(g: Game): Draft {
    if (drafts[g.id]) return drafts[g.id];
    const t = myTip(g);
    if (!t) return { pick: '', l: '', r: '' };
    const l = g.is_home ? t.exact_for : t.exact_against;
    const r = g.is_home ? t.exact_against : t.exact_for;
    return { pick: t.pick, l: l !== null ? String(l) : '', r: r !== null ? String(r) : '' };
  }

  function patchDraft(g: Game, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [g.id]: { ...getDraft(g), ...patch } }));
  }

  async function saveTip(g: Game) {
    const d = getDraft(g);
    if (!d.pick || !myId) return;
    const hasL = d.l.trim() !== '';
    const hasR = d.r.trim() !== '';
    if (hasL !== hasR) {
      setError('Für das Resultat bitte beide Felder ausfüllen oder beide leer lassen.');
      return;
    }
    let exactFor: number | null = null;
    let exactAgainst: number | null = null;
    if (hasL && hasR) {
      const l = parseInt(d.l, 10);
      const r = parseInt(d.r, 10);
      if (Number.isNaN(l) || Number.isNaN(r) || l < 0 || r < 0) {
        setError('Das Resultat muss aus Zahlen ab 0 bestehen.');
        return;
      }
      exactFor = g.is_home ? l : r;
      exactAgainst = g.is_home ? r : l;
      if (!fits(d.pick, exactFor, exactAgainst)) {
        setError('Das Resultat passt nicht zu deinem Tipp.');
        return;
      }
    }
    setError(null);
    setSavingId(g.id);
    const { error: err } = await supabase.from('group_game_tips').upsert(
      { group_id: groupId, game_id: g.id, user_id: myId, pick: d.pick, exact_for: exactFor, exact_against: exactAgainst },
      { onConflict: 'game_id,user_id' }
    );
    if (err) {
      setError('Tipp konnte nicht gespeichert werden: ' + err.message);
    } else {
      setDrafts((prev) => {
        const { [g.id]: _drop, ...rest } = prev;
        return rest;
      });
      await loadGamesAndTips(g.competition_id);
    }
    setSavingId(null);
  }

  async function removeTip(g: Game) {
    if (!myId) return;
    const { error: err } = await supabase.from('group_game_tips').delete().eq('game_id', g.id).eq('user_id', myId);
    if (err) {
      setError('Tipp konnte nicht entfernt werden: ' + err.message);
      return;
    }
    setDrafts((prev) => {
      const { [g.id]: _drop, ...rest } = prev;
      return rest;
    });
    await loadGamesAndTips(g.competition_id);
  }

  function renderGame(g: Game) {
    const team = selected?.team_name || '';
    const left = g.is_home ? team : g.opponent;
    const right = g.is_home ? g.opponent : team;
    const open = isOpen(g);
    const played = isPlayed(g);
    const mine = myTip(g);
    const d = getDraft(g);
    const dirty = !mine || mine.pick !== d.pick;
    const mineL = mine ? (g.is_home ? mine.exact_for : mine.exact_against) : null;
    const mineR = mine ? (g.is_home ? mine.exact_against : mine.exact_for) : null;
    const gameTips = tips.filter((t) => t.game_id === g.id);
    const count = (p: Pick) => gameTips.filter((t) => t.pick === p).length;

    return (
      <div key={g.id} className="rounded-xl p-4 bg-[#1c1c1a]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400">{formatKickoff(g.kickoff_at)}</p>
          {g.round_label && (
            <span className="text-[11px] font-semibold text-amber-300 bg-amber-900/30 rounded-full px-2 py-0.5">
              {g.round_label}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-sm truncate ${g.is_home ? 'font-semibold text-white' : 'text-slate-300'}`}>{left}</p>
            <p className={`text-sm truncate ${g.is_home ? 'text-slate-300' : 'font-semibold text-white'}`}>{right}</p>
          </div>
          {played && (
            <div className="text-right">
              <p className="text-sm font-bold text-white">{g.is_home ? g.goals_for : g.goals_against}</p>
              <p className="text-sm font-bold text-white">{g.is_home ? g.goals_against : g.goals_for}</p>
            </div>
          )}
        </div>

        {open && (
          <div className="mt-3 pt-3 border-t border-[#2a2a27]">
            <p className="text-xs text-slate-500 mb-2">Dein Tipp für {team}</p>
            <div className="flex gap-2 mb-3">
              {(['S', 'U', 'N'] as Pick[]).map((p) => (
                <button
                  key={p}
                  onClick={() => patchDraft(g, { pick: p })}
                  className={`flex-1 text-xs sm:text-sm font-semibold py-2 rounded-lg ${
                    d.pick === p ? 'bg-[#FAC775] text-black' : 'bg-[#2a2a27] text-slate-300'
                  }`}
                >
                  {PICK_LABEL[p]}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-2">Resultat (optional, +1 Punkt wenn es genau stimmt)</p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min={0}
                value={d.l}
                onChange={(e) => patchDraft(g, { l: e.target.value })}
                className="w-16 bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-[#FAC775]"
              />
              <span className="text-slate-500">:</span>
              <input
                type="number"
                min={0}
                value={d.r}
                onChange={(e) => patchDraft(g, { r: e.target.value })}
                className="w-16 bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-[#FAC775]"
              />
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => saveTip(g)}
                disabled={!d.pick || savingId === g.id}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg"
              >
                {savingId === g.id ? 'Speichere...' : mine ? 'Tipp ändern' : 'Tipp speichern'}
              </button>
              {mine && (
                <button onClick={() => removeTip(g)} className="text-xs text-red-400 hover:text-red-300">
                  Tipp entfernen
                </button>
              )}
              {mine && !dirty && <span className="text-xs text-emerald-400 ml-auto">Gespeichert</span>}
            </div>
          </div>
        )}

        {!open && (
          <div className="mt-3 pt-3 border-t border-[#2a2a27]">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-300">
                {mine ? (
                  <>
                    Dein Tipp: <span className="font-semibold text-white">{PICK_LABEL[mine.pick]}</span>
                    {mineL !== null && mineR !== null && ` · ${mineL}:${mineR}`}
                  </>
                ) : (
                  'Kein Tipp abgegeben'
                )}
              </p>
              {played && mine && (
                <span
                  className={`text-xs font-bold rounded-full px-2 py-1 ${
                    tipPoints(mine, g) > 0 ? 'bg-[#FAC775] text-black' : 'bg-[#2a2a27] text-slate-400'
                  }`}
                >
                  +{tipPoints(mine, g)}
                </span>
              )}
            </div>
            {!played && <p className="text-xs text-slate-500 mt-1">Angepfiffen, der Tipp ist gesperrt.</p>}
            {gameTips.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Tipps der Gruppe: {count('S')}× Sieg · {count('U')}× Unentschieden · {count('N')}× Niederlage
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  const upcoming = games.filter(isOpen);
  const locked = games.filter((g) => !isOpen(g)).reverse();

  return (
    <div className="min-h-screen bg-[#141412] text-white font-sans pb-12">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <AppHeader title="Tippspiel" subtitle={groupName} backHref={`/gruppen/${groupId}`} />

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Lade...</p>}

        {!loading && !isMember && (
          <div className="rounded-xl p-5 bg-[#1c1c1a]">
            <p className="text-sm text-slate-400">Diese Seite ist nur für Mitglieder der Gruppe sichtbar.</p>
          </div>
        )}

        {!loading && isMember && competitions.length === 0 && (
          <p className="text-sm text-slate-500">Der Trainer hat noch keinen Wettbewerb mit Spielen angelegt.</p>
        )}

        {!loading && isMember && competitions.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {competitions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setGames([]);
                    setTips([]);
                    setRanking([]);
                    setSelectedId(c.id);
                  }}
                  className={`text-sm font-semibold px-3 py-2 rounded-lg ${
                    selectedId === c.id ? 'bg-indigo-600 text-white' : 'bg-[#1c1c1a] text-slate-400'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              {(['tippen', 'rangliste'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setView(v);
                    if (v === 'rangliste' && selectedId) loadRanking(selectedId);
                  }}
                  className={`flex-1 text-sm font-semibold py-2 rounded-lg ${
                    view === v ? 'bg-[#FAC775] text-black' : 'bg-[#1c1c1a] text-slate-400'
                  }`}
                >
                  {v === 'tippen' ? 'Tippen' : 'Rangliste'}
                </button>
              ))}
            </div>

            {selected && view === 'tippen' && (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  2 Punkte für die richtige Tendenz, +1 fürs genaue Resultat.
                  {selected.comp_type === 'cup' && ' Im Cup zählt das Resultat nach der Spielzeit, ohne Penaltyschiessen.'}{' '}
                  Die Tipps der anderen siehst du ab Anpfiff.
                </p>
                {games.length === 0 && <p className="text-sm text-slate-500">Noch keine Spiele eingetragen.</p>}
                {upcoming.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-slate-400 mb-2">Anstehend</p>
                    <div className="flex flex-col gap-3 mb-4">{upcoming.map(renderGame)}</div>
                  </>
                )}
                {locked.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-slate-400 mb-2">Angepfiffen und gespielt</p>
                    <div className="flex flex-col gap-3">{locked.map(renderGame)}</div>
                  </>
                )}
              </>
            )}

            {selected && view === 'rangliste' && (
              <div className="rounded-xl p-5 bg-[#1c1c1a]">
                <p className="text-base font-semibold text-white mb-1">{selected.name}</p>
                <p className="text-xs text-slate-500 mb-4">Es zählen nur Spiele mit eingetragenem Resultat.</p>
                {ranking.length === 0 && <p className="text-sm text-slate-500">Noch keine Tipps abgegeben.</p>}
                <div className="flex flex-col gap-2">
                  {ranking.map((row) => (
                    <div
                      key={row.r_user_id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                        row.r_user_id === myId ? 'bg-[#2a2a27]' : ''
                      }`}
                    >
                      <span className="w-8 text-sm font-bold text-slate-300">
                        {row.r_rank === 1 ? '🥇' : row.r_rank === 2 ? '🥈' : row.r_rank === 3 ? '🥉' : `${row.r_rank}.`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{row.r_name || 'Unbekannt'}</p>
                        <p className="text-xs text-slate-500">
                          {row.r_tendency} von {row.r_scored} Tendenzen · {row.r_exact}× genaues Resultat
                        </p>
                      </div>
                      <span className="text-sm font-bold text-[#FAC775]">{row.r_points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
