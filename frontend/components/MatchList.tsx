'use client';

import { useState, useEffect, useMemo } from 'react';
import { Match, getLeagueName } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { useKumpel } from '@/contexts/KumpelProvider';
import MatchModal from '@/components/MatchModal';

interface MatchListProps {
  matches: Match[];
}

type Phase = 'open' | 'live' | 'finished';
type StatusFilter = 'all' | Phase;

interface UserTip {
  api_fixture_id: number;
  predicted_winner: string | null;
  tip_over_under: string | null;
  tip_btts: string | null;
  tip_double_chance: string | null;
  tip_exact_score_home: number | null;
  tip_exact_score_away: number | null;
}

// Farbpaletten fuer die vollflaechigen Liga-Karten (Design B). Neue Ligen
// bekommen automatisch eine Farbe per Hash zugewiesen, ohne Codeaenderung.
const LEAGUE_PALETTE = [
  { from: '#712B13', to: '#4A1B0C', text: '#F0997B' }, // coral
  { from: '#0C447C', to: '#042C53', text: '#85B7EB' }, // blau
  { from: '#633806', to: '#412402', text: '#EF9F27' }, // amber
  { from: '#3C3489', to: '#26215C', text: '#AFA9EC' }, // lila
  { from: '#085041', to: '#04342C', text: '#5DCAA5' }, // teal
  { from: '#72243E', to: '#4B1528', text: '#ED93B1' }, // pink
  { from: '#27500A', to: '#173404', text: '#97C459' }, // gruen
  { from: '#791F1F', to: '#501313', text: '#F09595' }, // rot
];

function leagueColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return LEAGUE_PALETTE[hash % LEAGUE_PALETTE.length];
}

// 1:1 aus MatchModal.tsx uebernommene Ampel-Schwellenwerte.
// "Gelb" aus Punkt 4 (gesperrt + laufend) wird hier zu einer Phase "live" zusammengefasst.
function getPhase(match: Match): Phase {
  const isMatchPlayed = match.status === 'FT' || match.status === 'AET' || match.status === 'PEN';
  const diffMins = (new Date(match.kickoff_time).getTime() - Date.now()) / 60000;
  if (isMatchPlayed || diffMins < -120) return 'finished';
  if (diffMins <= 2) return 'live';
  return 'open';
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

// Bildet die Punkt-1-Wettmodul-Regeln nach (siehe Projektnotizen):
// 1X2 = 5, je Zusatzkategorie = 3, exaktes Ergebnis = +5 Bonus, Superbonus = +5.
// Falsches "Exaktes Ergebnis" -> 0 Punkte fuer den gesamten Tipp bei diesem Spiel.
// ACHTUNG: bildet die beschriebene Regel nach, wurde aber nicht gegen den
// echten SQL-Trigger (calculate_scores_for_match) verglichen.
function calcLivePoints(tip: UserTip, homeScore: number, awayScore: number): number {
  const actual1x2 = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : '0';
  const totalGoals = homeScore + awayScore;
  const actualOU = totalGoals >= 3 ? 'Over' : 'Under';
  const actualBTTS = homeScore > 0 && awayScore > 0 ? 'Yes' : 'No';

  const hasExact = tip.tip_exact_score_home !== null && tip.tip_exact_score_away !== null;
  const exactCorrect = hasExact && tip.tip_exact_score_home === homeScore && tip.tip_exact_score_away === awayScore;

  if (hasExact && !exactCorrect) return 0;

  let points = 0;
  const correct1x2 = tip.predicted_winner === actual1x2;
  if (correct1x2) points += 5;

  const correctOU = !!tip.tip_over_under && tip.tip_over_under === actualOU;
  if (correctOU) points += 3;

  const correctBTTS = !!tip.tip_btts && tip.tip_btts === actualBTTS;
  if (correctBTTS) points += 3;

  let correctDC = false;
  if (tip.tip_double_chance === '1X') correctDC = actual1x2 === '1' || actual1x2 === '0';
  else if (tip.tip_double_chance === '12') correctDC = actual1x2 === '1' || actual1x2 === '2';
  else if (tip.tip_double_chance === 'X2') correctDC = actual1x2 === '0' || actual1x2 === '2';
  if (correctDC) points += 3;

  if (exactCorrect) {
    points += 5;
    if (correct1x2 && correctOU && correctBTTS && correctDC) points += 5; // Superbonus
  }

  return points;
}

const STATUS_OPTIONS: { key: StatusFilter; label: string; color: string }[] = [
  { key: 'all', label: 'alle', color: '#888780' },
  { key: 'open', label: 'offen', color: '#639922' },
  { key: 'live', label: 'live', color: '#BA7517' },
  { key: 'finished', label: 'fertig', color: '#A32D2D' },
];

export default function MatchList({ matches }: MatchListProps) {
  const { kumpel } = useKumpel();
  const [selectedLeague, setSelectedLeague] = useState<string>('Alle Ligen');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [tipsByFixture, setTipsByFixture] = useState<Record<number, UserTip>>({});

  const leagues = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => set.add(getLeagueName(m.league_id, m.league_name)));
    return Array.from(set).sort();
  }, [matches]);

  const liveFixtureIds = useMemo(
    () => matches.filter((m) => getPhase(m) === 'live').map((m) => m.api_fixture_id),
    [matches]
  );

  useEffect(() => {
    if (!kumpel || liveFixtureIds.length === 0) return;
    let cancelled = false;

    async function loadTips() {
      const { data, error } = await supabase
        .from('user_tips')
        .select(
          'api_fixture_id, predicted_winner, tip_over_under, tip_btts, tip_double_chance, tip_exact_score_home, tip_exact_score_away'
        )
        .eq('user_id', kumpel!.id)
        .in('api_fixture_id', liveFixtureIds);

      if (error) {
        console.error('Fehler beim Laden der Live-Tipps:', error.message);
        return;
      }
      if (!cancelled && data) {
        const map: Record<number, UserTip> = {};
        data.forEach((t: UserTip) => {
          map[t.api_fixture_id] = t;
        });
        setTipsByFixture(map);
      }
    }

    loadTips();
    const interval = setInterval(loadTips, 60000); // Sports-API Update alle 5 Min., wir pruefen haeufiger lokal
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [kumpel, liveFixtureIds]);

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const league = getLeagueName(m.league_id, m.league_name);
      if (selectedLeague !== 'Alle Ligen' && league !== selectedLeague) return false;
      if (statusFilter !== 'all' && getPhase(m) !== statusFilter) return false;
      return true;
    });
  }, [matches, selectedLeague, statusFilter]);

  return (
    <div className="bg-[#1c1c1a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3">
        <select
          value={selectedLeague}
          onChange={(e) => setSelectedLeague(e.target.value)}
          className="bg-[#2a2a27] text-white border border-[#444441] rounded-full text-sm px-4 h-[38px] box-border focus:outline-none"
        >
          <option>Alle Ligen</option>
          {leagues.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>

        <div className="flex items-center gap-[2px] bg-[#2a2a27] border border-[#444441] rounded-full h-[38px] px-1.5 flex-shrink-0">
          {STATUS_OPTIONS.map((opt) => (
            <div key={opt.key} className="relative w-8 h-full flex items-center justify-center">
              <span
                className="absolute -top-px left-3.5 text-[8px] whitespace-nowrap"
                style={{ color: opt.color, transform: 'rotate(-22deg)' }}
              >
                {opt.label}
              </span>
              <button
                type="button"
                onClick={() => setStatusFilter(opt.key)}
                className="w-6 h-6 rounded-full text-[11px]"
                style={{
                  background: statusFilter === opt.key && opt.key === 'all' ? '#444441' : 'transparent',
                  border: statusFilter === opt.key && opt.key !== 'all' ? `1px solid ${opt.color}` : 'none',
                  color: opt.key === 'all' ? '#fff' : opt.color,
                }}
                aria-label={`Filter: ${opt.label}`}
              >
                &#9679;
              </button>
            </div>
          ))}
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-8">Keine Spiele fuer diese Auswahl.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredMatches.map((match) => {
            const phase = getPhase(match);
            const league = getLeagueName(match.league_id, match.league_name);
            const color = leagueColor(league);
            const tip = tipsByFixture[match.api_fixture_id];
            const livePoints =
              phase === 'live' && tip && tip.predicted_winner
                ? calcLivePoints(tip, match.home_score ?? 0, match.away_score ?? 0)
                : null;

            return (
              <button
                key={match.api_fixture_id}
                type="button"
                onClick={() => setSelectedMatch(match)}
                className="text-left rounded-xl p-[18px] transition-transform active:scale-[0.99]"
                style={{ background: `linear-gradient(90deg, ${color.from}, ${color.to})` }}
              >
                {phase === 'finished' && (
                  <>
                    <div className="flex items-center justify-between" style={{ color: color.text }}>
                      <span className="text-[15px] font-medium">{match.home_team_name}</span>
                      <span className="text-[22px] font-medium">
                        {match.home_score ?? '-'} : {match.away_score ?? '-'}
                      </span>
                      <span className="text-[15px] font-medium">{match.away_team_name}</span>
                    </div>
                    <p className="text-center text-[12px] mt-2" style={{ color: color.text }}>
                      {formatDate(match.kickoff_time)} &middot; Beendet &middot; {league}
                    </p>
                  </>
                )}

                {phase === 'live' && (
                  <>
                    <div className="flex items-center justify-between" style={{ color: color.text }}>
                      <span className="text-xl font-medium">{match.home_score ?? 0}</span>
                      <span className="text-[13px] font-medium tracking-wide">&bull; LIVE &bull;</span>
                      <span className="text-xl font-medium">{match.away_score ?? 0}</span>
                    </div>
                    <p className="text-center text-xs mt-1.5 mb-2.5" style={{ color: color.text }}>
                      {match.home_team_name} &ndash; {match.away_team_name} &middot; {league}
                    </p>
                    {livePoints !== null ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="bg-amber-300 text-[#412402] rounded-full w-[46px] h-[46px] flex flex-col items-center justify-center leading-tight">
                          <span className="text-sm font-medium">{livePoints}</span>
                          <span className="text-[8px]">Pkt.</span>
                        </div>
                        <p className="text-[10px] text-slate-500">dein aktueller Stand &middot; Update alle 5 Min.</p>
                      </div>
                    ) : (
                      <p className="text-center text-[11px] text-slate-500">kein Tipp abgegeben</p>
                    )}
                  </>
                )}

                {phase === 'open' && (
                  <>
                    <div className="flex items-center justify-between" style={{ color: color.text }}>
                      <span className="text-[15px] font-medium">{match.home_team_name}</span>
                      <span className="text-xl font-medium opacity-60">VS</span>
                      <span className="text-[15px] font-medium">{match.away_team_name}</span>
                    </div>
                    <p className="text-center text-[12px] mt-2" style={{ color: color.text }}>
                      {formatDate(match.kickoff_time)} &middot; {formatTime(match.kickoff_time)} &middot; {league}
                    </p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedMatch && <MatchModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />}
    </div>
  );
}
