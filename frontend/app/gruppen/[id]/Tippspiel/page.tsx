'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { useKumpel } from '@/contexts/KumpelProvider';
import { supabase } from '@/lib/supabaseClient';

interface MemberRow {
  user_id: string;
  role: string;
}

interface Competition {
  id: string;
  group_id: string;
  name: string;
  comp_type: 'cup' | 'meisterschaft' | 'turnier';
  team_name: string;
  note: string | null;
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
  penalty_win: boolean | null;
}

interface ResultDraft {
  gf: string;
  ga: string;
  pen: '' | 'win' | 'loss';
}

const TYPE_LABELS: Record<string, string> = {
  cup: 'Cup',
  meisterschaft: 'Meisterschaft',
  turnier: 'Turnier',
};

const CUP_ROUNDS = ['1. Runde', '2. Runde', '3. Runde', '1/8-Final', '1/4-Final', 'Halbfinal', 'Final'];

function isPlayed(g: Game) {
  return g.goals_for !== null && g.goals_against !== null;
}

function outcome(g: Game): 'S' | 'U' | 'N' | null {
  if (!isPlayed(g)) return null;
  if ((g.goals_for as number) > (g.goals_against as number)) return 'S';
  if ((g.goals_for as number) < (g.goals_against as number)) return 'N';
  return 'U';
}

// Cup: gewonnen/verloren inkl. Penaltyschiessen bei Unentschieden
function cupWon(g: Game) {
  const o = outcome(g);
  return o === 'S' || (o === 'U' && g.penalty_win === true);
}
function cupLost(g: Game) {
  const o = outcome(g);
  return o === 'N' || (o === 'U' && g.penalty_win === false);
}

export default function TippspielPage() {
  const params = useParams();
  const groupId = params?.id as string;
  const { kumpel } = useKumpel();

  const [groupName, setGroupName] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formular neuer Wettbewerb
  const [showNewComp, setShowNewComp] = useState(false);
  const [compName, setCompName] = useState('');
  const [compType, setCompType] = useState<'cup' | 'meisterschaft'>('meisterschaft');
  const [compTeam, setCompTeam] = useState('');
  const [compNote, setCompNote] = useState('');
  const [savingComp, setSavingComp] = useState(false);

  // Formular neues Spiel
  const [showNewGame, setShowNewGame] = useState(false);
  const [gameKickoff, setGameKickoff] = useState('');
  const [gameOpponent, setGameOpponent] = useState('');
  const [gameIsHome, setGameIsHome] = useState(true);
  const [gameRound, setGameRound] = useState('');
  const [gameLocation, setGameLocation] = useState('');
  const [savingGame, setSavingGame] = useState(false);

  // Resultat bearbeiten
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ResultDraft>({ gf: '', ga: '', pen: '' });

  const isAdmin = myRole === 'admin';
  const selected = competitions.find((c) => c.id === selectedId) || null;

  useEffect(() => {
    if (groupId) loadBase();
  }, [groupId, kumpel?.id]);

  useEffect(() => {
    if (selectedId) loadGames(selectedId);
  }, [selectedId]);

  async function loadBase() {
    setLoading(true);

    const { data: groupData } = await supabase
      .from('groups')
      .select('name')
      .eq('id', groupId)
      .maybeSingle();
    const gName = groupData?.name || '';
    setGroupName(gName);
    setCompTeam((prev) => prev || gName);

    const { data: memberData } = await supabase.rpc('get_group_members', { p_group_id: groupId });
    const mine = ((memberData as MemberRow[]) || []).find((m) => m.user_id === kumpel?.id);
    setMyRole(mine?.role || null);

    await loadCompetitions(true);
    setLoading(false);
  }

  async function loadCompetitions(selectLast: boolean) {
    const { data, error: err } = await supabase
      .from('group_competitions')
      .select('id, group_id, name, comp_type, team_name, note')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (err) {
      setError('Wettbewerbe konnten nicht geladen werden: ' + err.message);
      return;
    }
    const list = (data as Competition[]) || [];
    setCompetitions(list);
    if (selectLast && list.length > 0) {
      setSelectedId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[list.length - 1].id));
    }
    if (list.length === 0) {
      setSelectedId(null);
      setGames([]);
    }
  }

  async function loadGames(compId: string) {
    const { data, error: err } = await supabase
      .from('group_games')
      .select('id, competition_id, kickoff_at, opponent, is_home, round_label, location, goals_for, goals_against, penalty_win')
      .eq('competition_id', compId)
      .order('kickoff_at', { ascending: true });

    if (err) {
      setError('Spiele konnten nicht geladen werden: ' + err.message);
      return;
    }
    setGames((data as Game[]) || []);
  }

  async function handleCreateComp() {
    const name = compName.trim();
    const team = compTeam.trim();
    if (!name || !team) return;
    setSavingComp(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('group_competitions')
      .insert({
        group_id: groupId,
        name,
        comp_type: compType,
        team_name: team,
        note: compNote.trim() || null,
      })
      .select('id')
      .single();

    if (err) {
      setError('Wettbewerb konnte nicht angelegt werden: ' + err.message);
    } else {
      setCompName('');
      setCompNote('');
      setShowNewComp(false);
      await loadCompetitions(false);
      if (data?.id) setSelectedId(data.id);
    }
    setSavingComp(false);
  }

  async function handleDeleteComp() {
    if (!selected) return;
    if (!confirm(`Wettbewerb «${selected.name}» mit allen Spielen löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    setError(null);
    const { error: err } = await supabase.from('group_competitions').delete().eq('id', selected.id);
    if (err) {
      setError('Wettbewerb konnte nicht gelöscht werden: ' + err.message);
    } else {
      setSelectedId(null);
      await loadCompetitions(true);
    }
  }

  async function handleCreateGame() {
    if (!selected || !gameKickoff || !gameOpponent.trim()) return;
    setSavingGame(true);
    setError(null);

    const { error: err } = await supabase.from('group_games').insert({
      group_id: groupId,
      competition_id: selected.id,
      kickoff_at: new Date(gameKickoff).toISOString(),
      opponent: gameOpponent.trim(),
      is_home: gameIsHome,
      round_label: selected.comp_type === 'cup' && gameRound.trim() ? gameRound.trim() : null,
      location: gameLocation.trim() || null,
    });

    if (err) {
      setError('Spiel konnte nicht gespeichert werden: ' + err.message);
    } else {
      setGameKickoff('');
      setGameOpponent('');
      setGameRound('');
      setGameLocation('');
      setShowNewGame(false);
      await loadGames(selected.id);
    }
    setSavingGame(false);
  }

  function startEdit(g: Game) {
    setEditingId(g.id);
    setDraft({
      gf: g.goals_for !== null ? String(g.goals_for) : '',
      ga: g.goals_against !== null ? String(g.goals_against) : '',
      pen: g.penalty_win === true ? 'win' : g.penalty_win === false ? 'loss' : '',
    });
  }

  async function handleSaveResult(g: Game) {
    const gf = parseInt(draft.gf, 10);
    const ga = parseInt(draft.ga, 10);
    if (Number.isNaN(gf) || Number.isNaN(ga) || gf < 0 || ga < 0) {
      setError('Bitte beide Tore als Zahl eintragen.');
      return;
    }
    setError(null);

    const isCup = selected?.comp_type === 'cup';
    const penalty = isCup && gf === ga ? (draft.pen === 'win' ? true : draft.pen === 'loss' ? false : null) : null;

    const { error: err } = await supabase
      .from('group_games')
      .update({ goals_for: gf, goals_against: ga, penalty_win: penalty })
      .eq('id', g.id);

    if (err) {
      setError('Resultat konnte nicht gespeichert werden: ' + err.message);
    } else {
      setEditingId(null);
      if (selected) await loadGames(selected.id);
    }
  }

  async function handleClearResult(g: Game) {
    if (!confirm('Resultat dieses Spiels entfernen?')) return;
    const { error: err } = await supabase
      .from('group_games')
      .update({ goals_for: null, goals_against: null, penalty_win: null })
      .eq('id', g.id);
    if (err) {
      setError('Resultat konnte nicht entfernt werden: ' + err.message);
    } else {
      setEditingId(null);
      if (selected) await loadGames(selected.id);
    }
  }

  async function handleDeleteGame(g: Game) {
    if (!confirm(`Spiel gegen ${g.opponent} löschen?`)) return;
    const { error: err } = await supabase.from('group_games').delete().eq('id', g.id);
    if (err) {
      setError('Spiel konnte nicht gelöscht werden: ' + err.message);
    } else if (selected) {
      await loadGames(selected.id);
    }
  }

  function formatKickoff(ts: string) {
    const d = new Date(ts);
    return (
      d.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
    );
  }

  // Bilanz und Cup-Stand
  const played = games.filter(isPlayed);
  const wins = played.filter((g) => outcome(g) === 'S').length;
  const draws = played.filter((g) => outcome(g) === 'U').length;
  const losses = played.filter((g) => outcome(g) === 'N').length;
  const goalsFor = played.reduce((s, g) => s + (g.goals_for || 0), 0);
  const goalsAgainst = played.reduce((s, g) => s + (g.goals_against || 0), 0);

  let cupStatus: string | null = null;
  if (selected?.comp_type === 'cup' && played.length > 0) {
    const last = played[played.length - 1];
    const round = last.round_label?.trim() || '';
    if (cupLost(last)) {
      cupStatus = `Ausgeschieden${round ? ' in der Runde «' + round + '»' : ''}`;
    } else if (cupWon(last)) {
      cupStatus = round.toLowerCase() === 'final' ? '🏆 Cupsieger' : `Weiter${round ? ' nach «' + round + '»' : ''}`;
    }
  }

  const upcoming = games.filter((g) => !isPlayed(g));
  const finished = games.filter(isPlayed).reverse();

  function renderGame(g: Game) {
    const team = selected?.team_name || '';
    const left = g.is_home ? team : g.opponent;
    const right = g.is_home ? g.opponent : team;
    const leftGoals = g.is_home ? g.goals_for : g.goals_against;
    const rightGoals = g.is_home ? g.goals_against : g.goals_for;
    const o = outcome(g);
    const editing = editingId === g.id;
    const isCup = selected?.comp_type === 'cup';

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
          {isPlayed(g) && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-white">{leftGoals}</p>
                <p className="text-sm font-bold text-white">{rightGoals}</p>
              </div>
              <span
                className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                  o === 'S' ? 'bg-green-600' : o === 'N' ? 'bg-red-600' : 'bg-amber-600'
                }`}
              >
                {o}
              </span>
            </div>
          )}
        </div>

        {isCup && isPlayed(g) && o === 'U' && (
          <p className="text-xs text-slate-400 mt-2">
            Penaltyschiessen: {g.penalty_win === true ? 'gewonnen' : g.penalty_win === false ? 'verloren' : 'offen'}
          </p>
        )}
        {g.location && <p className="text-xs text-slate-500 mt-2">📍 {g.location}</p>}

        {isAdmin && !editing && (
          <div className="flex gap-4 mt-3">
            <button onClick={() => startEdit(g)} className="text-xs font-semibold text-indigo-300 hover:text-indigo-200">
              {isPlayed(g) ? 'Resultat ändern' : 'Resultat eintragen'}
            </button>
            <button onClick={() => handleDeleteGame(g)} className="text-xs text-red-400 hover:text-red-300">
              Löschen
            </button>
          </div>
        )}

        {isAdmin && editing && (
          <div className="mt-3 pt-3 border-t border-[#2a2a27]">
            <p className="text-xs text-slate-500 mb-2">Tore aus Sicht von {team}</p>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                min={0}
                value={draft.gf}
                onChange={(e) => setDraft({ ...draft, gf: e.target.value })}
                placeholder="Wir"
                className="w-20 bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-500">:</span>
              <input
                type="number"
                min={0}
                value={draft.ga}
                onChange={(e) => setDraft({ ...draft, ga: e.target.value })}
                placeholder="Gegner"
                className="w-20 bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            {isCup && draft.gf !== '' && draft.gf === draft.ga && (
              <select
                value={draft.pen}
                onChange={(e) => setDraft({ ...draft, pen: e.target.value as ResultDraft['pen'] })}
                className="w-full bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm mb-2"
              >
                <option value="">Penaltyschiessen: noch offen</option>
                <option value="win">Penaltyschiessen gewonnen (weiter)</option>
                <option value="loss">Penaltyschiessen verloren (ausgeschieden)</option>
              </select>
            )}
            <div className="flex gap-3 items-center">
              <button
                onClick={() => handleSaveResult(g)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
              >
                Speichern
              </button>
              <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:text-slate-200">
                Abbrechen
              </button>
              {isPlayed(g) && (
                <button onClick={() => handleClearResult(g)} className="text-xs text-red-400 hover:text-red-300 ml-auto">
                  Resultat entfernen
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const inputClass =
    'w-full bg-[#2a2a27] border border-[#3a3a36] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500';

  return (
    <div className="min-h-screen bg-[#141412] text-white font-sans pb-12">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <AppHeader title="Tippspiel" subtitle={groupName} backHref={`/gruppen/${groupId}`} />

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Lade...</p>}

        {!loading && !myRole && (
          <div className="rounded-xl p-5 bg-[#1c1c1a]">
            <p className="text-sm text-slate-400">Diese Seite ist nur für Mitglieder der Gruppe sichtbar.</p>
          </div>
        )}

        {!loading && myRole && (
          <>
            {/* Wettbewerbe wählen */}
            {competitions.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {competitions.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedId(c.id);
                      setEditingId(null);
                      setShowNewGame(false);
                    }}
                    className={`text-sm font-semibold px-3 py-2 rounded-lg ${
                      selectedId === c.id ? 'bg-indigo-600 text-white' : 'bg-[#1c1c1a] text-slate-400'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {competitions.length === 0 && (
              <p className="text-sm text-slate-500 mb-4">
                {isAdmin
                  ? 'Noch kein Wettbewerb. Lege unten den ersten an, zum Beispiel «Meisterschaft Herbst 2026».'
                  : 'Der Trainer hat noch keinen Wettbewerb angelegt.'}
              </p>
            )}

            {/* Neuer Wettbewerb (Trainer) */}
            {isAdmin && (
              <div className="rounded-xl p-5 bg-[#1c1c1a] mb-4">
                <button onClick={() => setShowNewComp((v) => !v)} className="text-sm font-semibold text-white">
                  {showNewComp ? '▾' : '▸'} Neuer Wettbewerb
                </button>
                {showNewComp && (
                  <div className="mt-4 flex flex-col gap-3">
                    <input
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      placeholder={compType === 'cup' ? 'z.B. Cup 2026' : 'z.B. Meisterschaft Herbst 2026'}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      {(['meisterschaft', 'cup'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setCompType(t)}
                          className={`flex-1 text-sm py-2 rounded-lg ${
                            compType === t ? 'bg-indigo-600 text-white' : 'bg-[#2a2a27] text-slate-400'
                          }`}
                        >
                          {TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                    <input
                      value={compTeam}
                      onChange={(e) => setCompTeam(e.target.value)}
                      placeholder="Name der Mannschaft in diesem Wettbewerb, z.B. Bülach D9A"
                      className={inputClass}
                    />
                    <input
                      value={compNote}
                      onChange={(e) => setCompNote(e.target.value)}
                      placeholder="Info (optional), z.B. Stärkeklasse 1 Promotion"
                      className={inputClass}
                    />
                    <button
                      onClick={handleCreateComp}
                      disabled={savingComp || !compName.trim() || !compTeam.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold py-2 rounded-lg"
                    >
                      {savingComp ? 'Speichere...' : 'Wettbewerb anlegen'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {selected && (
              <>
                {/* Kopf des Wettbewerbs */}
                <div className="rounded-xl p-5 bg-[#1c1c1a] mb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{selected.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {TYPE_LABELS[selected.comp_type]} · {selected.team_name}
                        {selected.note ? ` · ${selected.note}` : ''}
                      </p>
                    </div>
                    {isAdmin && (
                      <button onClick={handleDeleteComp} className="text-xs text-red-400 hover:text-red-300 shrink-0">
                        Wettbewerb löschen
                      </button>
                    )}
                  </div>

                  {cupStatus && <p className="text-sm font-semibold text-amber-300 mt-3">{cupStatus}</p>}

                  {played.length > 0 && (
                    <p className="text-xs text-slate-300 mt-3">
                      <span className="text-green-400">{wins} S</span>
                      {' · '}
                      <span className="text-amber-400">{draws} U</span>
                      {' · '}
                      <span className="text-red-400">{losses} N</span>
                      {' · '}Tore {goalsFor}:{goalsAgainst}
                    </p>
                  )}
                </div>

                {/* Neues Spiel (Trainer) */}
                {isAdmin && (
                  <div className="rounded-xl p-5 bg-[#1c1c1a] mb-4">
                    <button onClick={() => setShowNewGame((v) => !v)} className="text-sm font-semibold text-white">
                      {showNewGame ? '▾' : '▸'} Spiel hinzufügen
                    </button>
                    {showNewGame && (
                      <div className="mt-4 flex flex-col gap-3">
                        <input
                          type="datetime-local"
                          value={gameKickoff}
                          onChange={(e) => setGameKickoff(e.target.value)}
                          className={inputClass}
                        />
                        <input
                          value={gameOpponent}
                          onChange={(e) => setGameOpponent(e.target.value)}
                          placeholder="Gegner, z.B. Kloten D1A"
                          className={inputClass}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setGameIsHome(true)}
                            className={`flex-1 text-sm py-2 rounded-lg ${
                              gameIsHome ? 'bg-indigo-600 text-white' : 'bg-[#2a2a27] text-slate-400'
                            }`}
                          >
                            Heimspiel
                          </button>
                          <button
                            onClick={() => setGameIsHome(false)}
                            className={`flex-1 text-sm py-2 rounded-lg ${
                              !gameIsHome ? 'bg-indigo-600 text-white' : 'bg-[#2a2a27] text-slate-400'
                            }`}
                          >
                            Auswärtsspiel
                          </button>
                        </div>
                        {selected.comp_type === 'cup' && (
                          <>
                            <input
                              list="cup-rounds"
                              value={gameRound}
                              onChange={(e) => setGameRound(e.target.value)}
                              placeholder="Runde, z.B. 1. Runde oder 1/4-Final"
                              className={inputClass}
                            />
                            <datalist id="cup-rounds">
                              {CUP_ROUNDS.map((r) => (
                                <option key={r} value={r} />
                              ))}
                            </datalist>
                          </>
                        )}
                        <input
                          value={gameLocation}
                          onChange={(e) => setGameLocation(e.target.value)}
                          placeholder="Ort (optional)"
                          className={inputClass}
                        />
                        <button
                          onClick={handleCreateGame}
                          disabled={savingGame || !gameKickoff || !gameOpponent.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold py-2 rounded-lg"
                        >
                          {savingGame ? 'Speichere...' : 'Spiel speichern'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Spiele */}
                {games.length === 0 && <p className="text-sm text-slate-500">Noch keine Spiele eingetragen.</p>}

                {upcoming.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-slate-400 mb-2 mt-2">Anstehend</p>
                    <div className="flex flex-col gap-3 mb-4">{upcoming.map(renderGame)}</div>
                  </>
                )}

                {finished.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-slate-400 mb-2 mt-2">Gespielt</p>
                    <div className="flex flex-col gap-3">{finished.map(renderGame)}</div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
