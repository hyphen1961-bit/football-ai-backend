'use client';

import { useState, useEffect, useMemo } from 'react';
import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';

interface MatchModalProps {
  match: Match | null;
  onClose: () => void;
}

export default function MatchModal({ match, onClose }: MatchModalProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isLocked, setIsLocked] = useState(false);
  const [tip1X2, setTip1X2] = useState<string>('');
  const [tipOverUnder, setTipOverUnder] = useState<string>('');
  const [tipBTTS, setTipBTTS] = useState<string>('');
  const [tipDoubleChance, setTipDoubleChance] = useState<string>('');
  const [tipExactScoreHome, setTipExactScoreHome] = useState<string>('');
  const [tipExactScoreAway, setTipExactScoreAway] = useState<string>('');
  const [deviationReason, setDeviationReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!match) return null;

  const confidence = match.analysis?.confidence_score || 0;
  const colorClass = getConfidenceColor(confidence);
  const leagueName = getLeagueName(match.league_id, match.league_name);
  
  const kickoffTime = useMemo(() => {
    return new Date(match.kickoff_time);
  }, [match.kickoff_time]);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const kickoff = new Date(match.kickoff_time);
      const diff = kickoff.getTime() - now.getTime();
      const minutesUntilKickoff = Math.floor(diff / (1000 * 60));
      
      if (minutesUntilKickoff <= 2) {
        setIsLocked(true);
        setTimeLeft('Gesperrt');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`Noch ${hours}h ${mins}min`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [match.kickoff_time]);

  const time = kickoffTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const date = kickoffTime.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const aiPrediction = (match.analysis?.ai_prediction || '').toLowerCase();
  const isDeviatingFromAI = tip1X2 !== '' && (
    (aiPrediction.includes('home') && tip1X2 !== '1') ||
    (aiPrediction.includes('draw') && tip1X2 !== '0') ||
    (aiPrediction.includes('away') && tip1X2 !== '2')
  );

  const renderList = (data: any) => {
    if (Array.isArray(data) && data.length > 0) return data.join(' ');
    if (typeof data === 'string' && data.length > 0) return data;
    return 'Keine Daten';
  };

  const handleSubmit = async () => {
    if (!tip1X2) {
      alert('Bitte waehle einen 1X2-Tipp');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const tipData = {
        username: 'Urs',
        api_fixture_id: match.api_fixture_id,
        predicted_winner: tip1X2,
        tip_over_under: tipOverUnder || null,
        tip_btts: tipBTTS || null,
        tip_double_chance: tipDoubleChance || null,
        tip_exact_score_home: tipExactScoreHome ? parseInt(tipExactScoreHome) : null,
        tip_exact_score_away: tipExactScoreAway ? parseInt(tipExactScoreAway) : null,
      };

      const response = await fetch('https://football-ai-backend-production-0f95.up.railway.app/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipData),
      });

      if (response.ok) {
        alert('Tipp gespeichert!');
        onClose();
      } else {
        const errorText = await response.text();
        alert('Fehler: ' + errorText);
      }
    } catch (error) {
      alert('Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">{leagueName}</span>
              <span className="text-xs text-slate-500">{date} - {time} Uhr</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{match.home_team_name} vs {match.away_team_name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-2xl p-2">X</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div className={`px-6 py-3 rounded-full text-lg font-bold border ${colorClass}`}>
              {confidence}% - {getConfidenceLabel(confidence)}
            </div>
            <div className={`text-sm font-mono ${isLocked ? 'text-red-400' : 'text-green-400'}`}>
              {timeLeft}
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
              <p className="text-xs text-slate-500 mb-1">Heim</p>
              <p className="text-white font-mono text-sm mb-2">{renderList(match.analysis?.form_home)}</p>
              <p className="text-xs text-slate-500 mb-1">Auswaerts</p>
              <p className="text-white font-mono text-sm">{renderList(match.analysis?.form_away)}</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">Verletzte</h3>
              <p className="text-xs text-slate-500 mb-1">Heim</p>
              <p className="text-white text-sm mb-2">{renderList(match.analysis?.injuries_home)}</p>
              <p className="text-xs text-slate-500 mb-1">Auswaerts</p>
              <p className="text-white text-sm">{renderList(match.analysis?.injuries_away)}</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">H2H</h3>
              {match.analysis?.h2h_stats && typeof match.analysis.h2h_stats === 'object' ? (
                <>
                  <p className="text-white text-sm">Heimsiege: {(match.analysis.h2h_stats as any).home_wins || 0}</p>
                  <p className="text-white text-sm">Auswaertssiege: {(match.analysis.h2h_stats as any).away_wins || 0}</p>
                </>
              ) : (
                <p className="text-white text-sm">Keine Daten</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-lg font-bold text-white mb-4">Dein Tipp</h3>

            {!isLocked ? (
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">1X2</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button type="button" onClick={() => setTip1X2('1')} className={`py-3 rounded-lg border font-bold ${tip1X2 === '1' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      1 - {match.home_team_name}
                    </button>
                    <button type="button" onClick={() => setTip1X2('0')} className={`py-3 rounded-lg border font-bold ${tip1X2 === '0' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      0 - Unentschieden
                    </button>
                    <button type="button" onClick={() => setTip1X2('2')} className={`py-3 rounded-lg border font-bold ${tip1X2 === '2' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      2 - {match.away_team_name}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Over/Under 2.5</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setTipOverUnder(tipOverUnder === 'Over' ? '' : 'Over')} className={`py-3 rounded-lg border font-bold ${tipOverUnder === 'Over' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      Over 2.5
                    </button>
                    <button type="button" onClick={() => setTipOverUnder(tipOverUnder === 'Under' ? '' : 'Under')} className={`py-3 rounded-lg border font-bold ${tipOverUnder === 'Under' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      Under 2.5
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">BTTS</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setTipBTTS(tipBTTS === 'Yes' ? '' : 'Yes')} className={`py-3 rounded-lg border font-bold ${tipBTTS === 'Yes' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      Ja
                    </button>
                    <button type="button" onClick={() => setTipBTTS(tipBTTS === 'No' ? '' : 'No')} className={`py-3 rounded-lg border font-bold ${tipBTTS === 'No' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      Nein
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Doppelte Chance</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['1X', '12', 'X2'].map((option) => (
                      <button key={option} type="button" onClick={() => setTipDoubleChance(tipDoubleChance === option ? '' : option)} className={`py-3 rounded-lg border font-bold ${tipDoubleChance === option ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Exaktes Ergebnis</label>
                  <div className="flex gap-3 items-center">
                    <input type="number" min="0" max="10" value={tipExactScoreHome} onChange={(e) => setTipExactScoreHome(e.target.value)} placeholder="Heim" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-center" />
                    <span className="text-slate-400">:</span>
                    <input type="number" min="0" max="10" value={tipExactScoreAway} onChange={(e) => setTipExactScoreAway(e.target.value)} placeholder="Auswaerts" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-center" />
                  </div>
                </div>

                {isDeviatingFromAI && (
                  <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                    <label className="text-sm font-semibold text-yellow-300 uppercase block mb-2">Warum gegen die KI?</label>
                    <textarea value={deviationReason} onChange={(e) => setDeviationReason(e.target.value.slice(0, 100))} placeholder="Max 100 Zeichen" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm" rows={3} />
                    <p className="text-xs text-yellow-400 mt-2">{deviationReason.length}/100</p>
                  </div>
                )}

                <button type="button" onClick={handleSubmit} disabled={isSubmitting || !tip1X2} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-bold py-4 rounded-lg text-lg">
                  {isSubmitting ? 'Speichern...' : 'Tipp speichern'}
                </button>
              </div>
            ) : (
              <div className="text-center py-8 bg-red-900/20 border border-red-500/50 rounded-lg">
                <p className="text-red-400 font-bold">Gesperrt - Spiel beginnt bald</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}