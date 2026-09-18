'use client';

import { useState } from 'react';
import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';
import MatchModal from './MatchModal';

export default function MatchList({ matches }: { matches: Match[] }) {
  const [selectedLeague, setSelectedLeague] = useState('Alle');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const leagues = ['Alle', ...Array.from(new Set(matches.map(m => m.league_name || 'Unbekannt')))];
  
  const filteredMatches = selectedLeague === 'Alle' 
    ? matches 
    : matches.filter(m => m.league_name === selectedLeague);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Liga Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {leagues.map(league => (
          <button
            key={league}
            onClick={() => setSelectedLeague(league)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              selectedLeague === league 
                ? 'bg-indigo-600 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {league}
          </button>
        ))}
      </div>

      {/* Spiele Liste */}
      <div className="space-y-4">
        {filteredMatches.map(match => (
          <div 
            key={match.api_fixture_id} 
            onClick={() => setSelectedMatch(match)} // <-- NUR State ändern, KEIN Link!
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-indigo-500/50 transition-all"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">
                {getLeagueName(match.league_id, match.league_name)}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(match.kickoff_time).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} - {new Date(match.kickoff_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">{match.home_team_name}</h3>
                <h3 className="text-lg font-bold text-slate-400">{match.away_team_name}</h3>
              </div>
              {match.analysis && (
                <div className={`px-4 py-2 rounded-lg text-center min-w-[80px] ${getConfidenceColor(match.analysis.confidence_score)}`}>
                  <div className="text-2xl font-black">{match.analysis.confidence_score}%</div>
                  <div className="text-xs font-bold uppercase">{getConfidenceLabel(match.analysis.confidence_score)}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal wird nur angezeigt, wenn selectedMatch gesetzt ist */}
      {selectedMatch && (
        <MatchModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </div>
  );
}