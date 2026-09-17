'use client';

import { useState, useMemo } from 'react';
import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';
import MatchModal from './MatchModal';

export default function MatchList({ matches }: { matches: Match[] }) {
  const [selectedLeague, setSelectedLeague] = useState('Alle');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const leagues = ['Alle', ...Array.from(new Set(matches.map(m => getLeagueName(m.league_id, m.league_name)))).sort()];

  const hotMatches = matches.filter(m => (m.analysis?.confidence_score || 0) >= 80).slice(0, 6);

  const filtered = selectedLeague === 'Alle' ? matches : matches.filter(m => getLeagueName(m.league_id, m.league_name) === selectedLeague);

  const grouped = filtered.reduce((acc, match) => {
    const date = new Date(match.kickoff_time).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      {hotMatches.length > 0 && (
        <section className="bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-indigo-500/30 rounded-xl p-6">
          <h2 className="text-xl font-bold text-indigo-300 mb-4">🔥 Most Hot of the Day</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotMatches.map(match => (
              <div key={match.id} onClick={() => setSelectedMatch(match)} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 cursor-pointer hover:bg-slate-800">
                <p className="text-xs text-slate-400 mb-2">{getLeagueName(match.league_id, match.league_name)}</p>
                <p className="font-bold text-white text-center">{match.home_team_name} vs {match.away_team_name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Alle Spiele</h2>
          <select value={selectedLeague} onChange={e => setSelectedLeague(e.target.value)} className="bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2">
            {leagues.map(league => <option key={league} value={league}>{league}</option>)}
          </select>
        </div>

        {Object.entries(grouped).map(([date, dayMatches]) => (
          <div key={date} className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">{date}</h3>
            <div className="space-y-3">
              {dayMatches.map(match => (
                <div key={match.id} onClick={() => setSelectedMatch(match)} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg p-4 cursor-pointer">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">{getLeagueName(match.league_id, match.league_name)}</span>
                    <span className="text-xs text-slate-500">{new Date(match.kickoff_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="font-bold text-lg text-white flex-1 text-right pr-4">{match.home_team_name}</p>
                    <span className="text-slate-500 text-sm">vs</span>
                    <p className="font-bold text-lg text-white flex-1 pl-4">{match.away_team_name}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border inline-block ${getConfidenceColor(match.analysis?.confidence_score || 0)}`}>
                    {match.analysis?.confidence_score || 0}% – {getConfidenceLabel(match.analysis?.confidence_score || 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <MatchModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  );
}