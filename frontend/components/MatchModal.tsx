// frontend/components/MatchModal.tsx
'use client';

import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';

interface MatchModalProps {
  match: Match | null;  // null = Modal geschlossen
  onClose: () => void;
}

export default function MatchModal({ match, onClose }: MatchModalProps) {
  // Wenn kein Match übergeben wurde, nichts rendern
  if (!match) return null;

  const confidence = match.analysis?.confidence_score || 0;
  const colorClass = getConfidenceColor(confidence);
  const leagueName = getLeagueName(match.league_id, match.league_name);
  const time = new Date(match.kickoff_time).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = new Date(match.kickoff_time).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    // Overlay (dunkler Hintergrund)
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}  // Klick auf Hintergrund schließt Modal
    >
      {/* Modal-Box */}
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}  // Klick inside schließt NICHT
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">
                {leagueName}
              </span>
              <span className="text-xs text-slate-500">{date} • {time} Uhr</span>
            </div>
            <h2 className="text-2xl font-bold text-white">
              {match.home_team_name} <span className="text-slate-500 text-lg">vs</span> {match.away_team_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none p-2"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* KI Confidence Badge */}
          <div className="flex justify-center">
            <div className={`px-6 py-3 rounded-full text-lg font-bold border ${colorClass}`}>
              {confidence}% – {getConfidenceLabel(confidence)}
            </div>
          </div>

          {/* KI-Vorhersage */}
          {match.analysis?.ai_prediction && (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">🤖 KI-Vorhersage</h3>
              <p className="text-xl font-bold text-white">{match.analysis.ai_prediction}</p>
            </div>
          )}

          {/* 3 KI-Indizien */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Form */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">📊 Form</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500">Heim</p>
                  <p className="text-white font-mono">
                    {match.analysis?.form_home && match.analysis.form_home.length > 0
                      ? match.analysis.form_home.join(' ')
                      : 'Keine Daten'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Auswärts</p>
                  <p className="text-white font-mono">
                    {match.analysis?.form_away && match.analysis.form_away.length > 0
                      ? match.analysis.form_away.join(' ')
                      : 'Keine Daten'}
                  </p>
                </div>
              </div>
            </div>

            {/* Verletzte */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">🏥 Verletzte</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500">Heim</p>
                  <p className="text-white text-sm">
                    {match.analysis?.injuries_home && match.analysis.injuries_home.length > 0
                      ? match.analysis.injuries_home.join(', ')
                      : 'Keine Verletzten'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Auswärts</p>
                  <p className="text-white text-sm">
                    {match.analysis?.injuries_away && match.analysis.injuries