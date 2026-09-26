'use client';

import { useEffect, useState } from 'react';
import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';
import { useKumpel } from '@/contexts/KumpelProvider';
import HyphenHeader, { MatchState, StatusFilter } from './HyphenHeader';
import MatchModal from './MatchModal';

function getMatchState(match: Match): MatchState {
  const isMatchPlayed = match.status === 'FT' || match.status === 'AET' || match.status === 'PEN';
  const diffMins = Math.floor((new Date(match.kickoff_time).getTime() - Date.now()) / (1000 * 60));

  if (isMatchPlayed || diffMins < -120) return 'finished';
  if (diffMins <= 2) return 'locked';
  return 'open';
}

const CARD_STYLES: Record<MatchState, string> = {
  open: 'bg-green-500/15',
  locked: 'bg-indigo-500/15',
  finished: 'bg-slate-900 border border-slate-800 opacity-80',
};

const LEAGUE_BADGE_STYLES: Record<string, string> = {
  'Swiss Super League': 'bg-green-600 text-white',
  'Premier League': 'bg-indigo-600 text-white',
  'Bundesliga': 'bg-orange-600/80 text-white',
  'Nations League': 'bg-blue-600 text-white',
};

function getLeagueBadgeClass(leagueName: string | null | undefined) {
  return LEAGUE_BADGE_STYLES[leagueName || ''] || 'bg-slate-700 text-slate-300';
}

export default function MatchList({ matches }: { matches: Match[] }) {
  const { kumpel } = useKumpel();

  const [selectedLeague, setSelectedLeague] = useState('Alle');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('Alle');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const leagues = ['Alle', ...Array.from(new Set(matches.map(m => m.league_name || 'Unbekannt')))];

  const filteredMatches = matches.filter(m => {
    const leagueOk = selectedLeague === 'Alle' || m.league_name === selectedLeague;
    const statusOk = selectedStatus === 'Alle' || getMatchState(m) === selectedStatus;
    return leagueOk && statusOk;
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {kumpel && (
        <div className="flex justify-end mb-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full pl-3 pr-4 py-1.5">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {kumpel.displayName?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="leading-tight">
              <p className="text-xs font-bold text-white">{kumpel.displayName}</p>
              <p className="text-[10px] text-slate-500 font-mono">{kumpel.hyphenKey}</p>
            </div>
          </div>
        </div>
      )}

      <HyphenHeader
        leagues={leagues}
        selectedLeague={selectedLeague}
        onSelectLeague={setSelectedLeague}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
      />

      <div className="space-y-3">
        {filteredMatches.map(match => {
          const state = getMatchState(match);

          return (
            <div
              key={match.api_fixture_id}
              onClick={() => setSelectedMatch(match)}
              className={`rounded-2xl p-4 cursor-pointer transition-all ${CARD_STYLES[state]}`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${getLeagueBadgeClass(match.league_name)}`}>
                  {getLeagueName(match.league_id, match.league_name)}
                </span>
                {state === 'finished' ? (
                  <span className="text-xs font-medium text-slate-500">Beendet</span>
                ) : state === 'locked' ? (
                  <span className="text-xs font-medium text-indigo-300">🔒 Läuft</span>
                ) : (
                  <span className="text-xs text-slate-400">
                    {new Date(match.kickoff_time).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} · {new Date(match.kickoff_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <h3 className={`text-lg font-bold text-right ${state === 'finished' ? 'text-slate-400' : 'text-white'}`}>
                  {match.home_team_name}
                </h3>

                {state === 'finished' && match.home_score !== null && match.away_score !== null ? (
                  <span className="min-w-[52px] h-9 rounded-full bg-red-500/90 flex items-center justify-center text-sm font-bold text-white px-3">
                    {match.home_score}:{match.away_score}
                  </span>
                ) : (
                  <span className="w-9 h-9 rounded-full bg-slate-950/40 flex items-center justify-center text-xs font-bold text-slate-300">
                    VS
                  </span>
                )}

                <h3 className={`text-lg font-bold ${state === 'finished' ? 'text-slate-400' : 'text-white'}`}>
                  {match.away_team_name}
                </h3>
              </div>

              {state === 'open' && (
                <p className="text-center text-xs font-bold text-green-400 mt-3">● Tipp offen – jetzt setzen</p>
              )}

              {state !== 'finished' && match.analysis && (
                <p className="text-center text-xs mt-2">
                  <span className={`px-2 py-0.5 rounded ${getConfidenceColor(match.analysis.confidence_score)}`}>
                    {match.analysis.confidence_score}% {getConfidenceLabel(match.analysis.confidence_score)}
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {selectedMatch && (
        <MatchModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </div>
  );
}