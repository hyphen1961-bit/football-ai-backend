'use client';

import { useEffect, useState } from 'react';
import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';
import { useKumpel } from '@/contexts/KumpelProvider';
import MatchModal from './MatchModal';

type MatchState = 'open' | 'locked' | 'finished';

function getMatchState(match: Match): MatchState {
  const isMatchPlayed = match.status === 'FT' || match.status === 'AET' || match.status === 'PEN';
  const diffMins = Math.floor((new Date(match.kickoff_time).getTime() - Date.now()) / (1000 * 60));

  if (isMatchPlayed || diffMins < -120) return 'finished';
  if (diffMins <= 2) return 'locked';
  return 'open';
}

const STATE_STYLES: Record<MatchState, { border: string; dot: string; label: string }> = {
  open: { border: 'border-l-4 border-green-500', dot: 'bg-green-500', label: 'Offen' },
  locked: { border: 'border-l-4 border-yellow-500', dot: 'bg-yellow-500', label: 'Gesperrt' },
  finished: { border: 'border-l-4 border-red-500', dot: 'bg-red-500', label: 'Beendet' },
};

const LEAGUE_BADGE_STYLES: Record<string, string> = {
  'Swiss Super League': 'bg-red-500/15 text-red-300',
  'Premier League': 'bg-purple-500/15 text-purple-300',
  'Bundesliga': 'bg-amber-500/15 text-amber-300',
  'Nations League': 'bg-blue-500/15 text-blue-300',
};

function getLeagueBadgeClass(leagueName: string | null | undefined) {
  return LEAGUE_BADGE_STYLES[leagueName || ''] || 'bg-slate-800 text-slate-400';
}

const SearchIcon = () => (
  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5A6.5 6.5 0 1 1 4 10.5a6.5 6.5 0 0 1 13 0Z" />
  </svg>
);

export default function MatchList({ matches }: { matches: Match[] }) {
  const { kumpel } = useKumpel();

  const [selectedLeague, setSelectedLeague] = useState('Alle');
  const [selectedStatus, setSelectedStatus] = useState<'Alle' | MatchState>('Alle');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [, forceTick] = useState(0);

  // Ampel-Status alle 60s neu berechnen (gleiche Grundlage wie MatchModal.tsx)
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
      {/* Filter-Leiste + Kumpel-Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <SearchIcon />
            </span>
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="appearance-none bg-slate-900 border border-slate-800 rounded-full pl-9 pr-8 py-2 text-sm font-bold text-slate-300 hover:border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {leagues.map(league => (
                <option key={league} value={league}>{league}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <SearchIcon />
            </span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'Alle' | MatchState)}
              className="appearance-none bg-slate-900 border border-slate-800 rounded-full pl-9 pr-8 py-2 text-sm font-bold text-slate-300 hover:border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="Alle">Alle Status</option>
              <option value="open">🟢 Offen</option>
              <option value="locked">🟡 Gesperrt</option>
              <option value="finished">🔴 Beendet</option>
            </select>
          </div>
        </div>

        {kumpel && (
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full pl-3 pr-4 py-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {kumpel.displayName?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">{kumpel.displayName}</p>
              <p className="text-[11px] text-slate-500 font-mono">{kumpel.hyphenKey}</p>
            </div>
          </div>
        )}
      </div>

      {/* Spiele Liste */}
      <div className="space-y-4">
        {filteredMatches.map(match => {
          const state = getMatchState(match);
          const style = STATE_STYLES[state];

          return (
            <div
              key={match.api_fixture_id}
              onClick={() => setSelectedMatch(match)}
              className={`bg-slate-900 border border-slate-800 ${style.border} rounded-xl p-4 cursor-pointer hover:border-indigo-500/50 transition-all ${state === 'finished' ? 'opacity-80' : ''}`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-medium px-2 py-1 rounded ${getLeagueBadgeClass(match.league_name)}`}>
                  {getLeagueName(match.league_id, match.league_name)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    {style.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(match.kickoff_time).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} - {new Date(match.kickoff_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">{match.home_team_name}</h3>
                  <h3 className="text-lg font-bold text-slate-400">{match.away_team_name}</h3>
                </div>
                {state === 'finished' && match.home_score !== null && match.away_score !== null && (
                  <div className="px-4 py-2 rounded-lg text-center min-w-[64px] bg-slate-800">
                    <div className="text-xl font-black text-white">{match.home_score}</div>
                    <div className="text-xl font-black text-slate-400">{match.away_score}</div>
                  </div>
                )}
                {state !== 'finished' && match.analysis && (
                  <div className={`px-4 py-2 rounded-lg text-center min-w-[80px] ${getConfidenceColor(match.analysis.confidence_score)}`}>
                    <div className="text-2xl font-black">{match.analysis.confidence_score}%</div>
                    <div className="text-xs font-bold uppercase">{getConfidenceLabel(match.analysis.confidence_score)}</div>
                  </div>
                )}
              </div>
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