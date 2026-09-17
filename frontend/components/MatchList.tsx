// frontend/components/MatchList.tsx
'use client';

import { useState, useMemo } from 'react';
import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';

interface MatchListProps {
  matches: Match[];
}

export default function MatchList({ matches }: MatchListProps) {
  const [selectedLeague, setSelectedLeague] = useState<string>('Alle');

  const leagues = useMemo(() => {
    const uniqueLeagues = Array.from(
      new Set(matches.map((m) => getLeagueName(m.league_id, m.league_name)))
    );
    return ['Alle', ...uniqueLeagues.sort()];
  }, [matches]);

  const hotMatches = useMemo(() => {
    return matches
      .filter((m) => (m.analysis?.confidence_score || 0) >= 80)
      .sort((a, b) => (b.analysis?.confidence_score || 0) - (a.analysis?.confidence_score || 0))
      .slice(0, 6);
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (selectedLeague === 'Alle') return matches;
    return matches.filter((m) => getLeagueName(m.league_id, m.league_name) === selectedLeague);
  }, [matches, selectedLeague]);

  const groupedMatches = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    filteredMatches.forEach((match) => {
      const date = new Date(match.kickoff_time).toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(match);
    });
    return groups;
  }, [filteredMatches]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      {hotMatches.length > 0 && (
        <section className="bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-indigo-500/30 rounded-xl p-6">
          <h2 className="text-xl font-bold text-indigo-300 mb-4 flex items-center gap-2">
            🔥 Most Hot of the Day
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotMatches.map((match) => (
              <MatchCard key={match.id} match={match} isHot />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-white">Alle Spiele</h2>
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2"
          >
            {leagues.map((league) => (
              <option key={league} value={league}>{league}</option>
            ))}
          </select>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedMatches).map(([date, dayMatches]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                {date}
              </h3>
              <div className="space-y-3">
                {dayMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MatchCard({ match, isHot = false }: { match: Match; isHot?: boolean }) {
  const confidence = match.analysis?.confidence_score || 0;
  const colorClass = getConfidenceColor(confidence);
  const time = new Date(match.kickoff_time).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const leagueDisplayName = getLeagueName(match.league_id, match.league_name);

  return (
    <div 
      className={`relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-lg p-4 transition-all cursor-pointer ${
        isHot ? 'ring-1 ring-indigo-500/30' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-medium text-slate-400 bg-slate-900 px-2 py-1 rounded">
          {leagueDisplayName}
        </span>
        <span className="text-xs font-mono text-slate-500">{time} Uhr</span>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex-1 text-right pr-4">
          <p className="font-bold text-lg text-white">{match.home_team_name}</p>
        </div>
        <div className="text-slate-500 font-mono text-sm">vs</div>
        <div className="flex-1 pl-4">
          <p className="font-bold text-lg text-white">{match.away_team_name}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
          {confidence}% – {getConfidenceLabel(confidence)}
        </div>
      </div>
    </div>
  );
}