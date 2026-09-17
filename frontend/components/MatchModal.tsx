'use client';

import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';

interface MatchModalProps {
  match: Match | null;
  onClose: () => void;
}

export default function MatchModal({ match, onClose }: MatchModalProps) {
  if (!match) return null;

  const confidence = match.analysis?.confidence_score || 0;
  const colorClass = getConfidenceColor(confidence);
  const leagueName = getLeagueName(match.league_id, match.league_name);
  const time = new Date(match.kickoff_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const date = new Date(match.kickoff_time).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const renderList = (data: any) => {
    if (Array.isArray(data) && data.length > 0) return data.join(' ');
    if (typeof data === 'string' && data.length > 0) return data;
    return 'Keine Daten';
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">{leagueName}</span>
              <span className="text-xs text-slate-500">{date} - {time} Uhr</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{match.home_team_name} vs {match.away_team_name}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none p-2">X</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex justify-center">
            <div className={`px-6 py-3 rounded-full text-lg font-bold border ${colorClass}`}>
              {confidence}% - {getConfidenceLabel(confidence)}
            </div>
          </div>

          {match.analysis?.ai_prediction && (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">KI-Vorhersage</h3>
              <p className="text-xl font-bold text-white">{match.analysis.ai_prediction}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">Form</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500">Heim</p>
                  <p className="text-white font-mono text-sm">{renderList(match.analysis?.form_home)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Auswaerts</p>
                  <p className="text-white font-mono text-sm">{renderList(match.analysis?.form_away)}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">Verletzte</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500">Heim</p>
                  <p className="text-white text-sm">{renderList(match.analysis?.injuries_home)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Auswaerts</p>
                  <p className="text-white text-sm">{renderList(match.analysis?.injuries_away)}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">H2H</h3>
              {match.analysis?.h2h_stats && typeof match.analysis.h2h_stats === 'object' ? (
                <div className="space-y-1">
                  <p className="text-white text-sm">Heimsiege: <span className="font-bold">{(match.analysis.h2h_stats as any).home_wins || 0}</span></p>
                  <p className="text-white text-sm">Auswaertssiege: <span className="font-bold">{(match.analysis.h2h_stats as any).away_wins || 0}</span></p>
                </div>
              ) : (
                <p className="text-white text-sm">Keine Daten</p>
              )}
            </div>
          </div>

          {match.analysis?.context_notes && (
            <div className="bg-indigo-900/30 rounded-lg p-4 border border-indigo-500/30">
              <h3 className="text-sm font-semibold text-indigo-300 uppercase mb-2">KI-Kommentar</h3>
              <p className="text-white text-sm">{match.analysis.context_notes}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-4 text-center">
          <p className="text-xs text-slate-500">Wettmaerkte kommen im naechsten Schritt</p>
        </div>
      </div>
    </div>
  );
}