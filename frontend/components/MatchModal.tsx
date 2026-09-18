'use client';
import { useState, useEffect, useMemo } from 'react';
import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';

interface MatchModalProps {
  match: Match | null;
  onClose: () => void;
}

export default function MatchModal({ match, onClose }: MatchModalProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false); // NEU: Prüft ob Spiel beendet
  
  // Tipp-States
  const [tip1X2, setTip1X2] = useState<string>('');
  const [tipOverUnder, setTipOverUnder] = useState<string>('');
  const [tipBTTS, setTipBTTS] = useState<string>('');
  const [tipDoubleChance, setTipDoubleChance] = useState<string>('');
  const [tipExactHome, setTipExactHome] = useState<string>('');
  const [tipExactAway, setTipExactAway] = useState<string>('');
  const [deviationReason, setDeviationReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!match) return null;

  const confidence = match.analysis?.confidence_score || 0;
  const colorClass = getConfidenceColor(confidence);
  const leagueName = getLeagueName(match.league_id, match.league_name);
  
  const kickoffTime = useMemo(() => new Date(match.kickoff_time), [match.kickoff_time]);
  const time = kickoffTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const date = kickoffTime.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  // Timer-Logik mit Prüfung auf "beendet"
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = kickoffTime.getTime() - now.getTime();
      const mins = Math.floor(diff / (1000 * 60));

      // NEU: Prüfen ob Spiel bereits beendet ist (vor mehr als 2 Stunden gestartet)
      // Annahme: Ein Spiel dauert max. 2 Stunden
      if (mins < -120) {
        setIsFinished(true);
        setIsLocked(true);
        setTimeLeft('Beendet');
      } 
      // Spiel startet in weniger als 2 Minuten
      else if (mins <= 2) {
        setIsLocked(true);
        setIsFinished(false);
        setTimeLeft('Gesperrt');
      } 
      // Spiel in der Zukunft
      else {
        setIsLocked(false);
        setIsFinished(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`Noch ${hours}h ${minutes}min`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Jede Minute aktualisieren
    return () => clearInterval(interval);
  }, [kickoffTime]);

  // KI-Abweichung prüfen
  const aiPrediction = (match.analysis?.ai_prediction || '').toLowerCase();
  const isDeviating = tip1X2 !== '' && (
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
      alert('Bitte wähle einen 1X2-Tipp');
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
        tip_exact_score_home: tipExactHome ? parseInt(tipExactHome) : null,
        tip_exact_score_away: tipExactAway ? parseInt(tipExactAway) : null,
      };

      const res = await fetch('https://football-ai-backend-production-0f95.up.railway.app/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipData),
      });

      if (res.ok) {
        alert('Tipp gespeichert!');
        onClose();
      } else {
        const err = await res.text();
        alert('Fehler: ' + err);
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
        
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">{leagueName}</span>
              <span className="text-xs text-slate-500">{date} - {time}</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{match.home_team_name} vs {match.away_team_name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-2xl p-2">X</button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Confidence & Timer */}
          <div className="flex justify-between items-center">
            <div className={`px-6 py-3 rounded-full text-lg font-bold border ${colorClass}`}>
              {confidence}% - {getConfidenceLabel(confidence)}
            </div>
            <div className={`text-sm font-mono ${isFinished ? 'text-gray-400' : isLocked ? 'text-red-400' : 'text-green-400'}`}>
              {timeLeft}
            </div>
          </div>

          {/* KI-Vorhersage */}
          {match.analysis?.ai_prediction && (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">KI-Vorhersage</h3>
              <p className="text-xl font-bold text-white">{match.analysis.ai_prediction}</p>
            </div>
          )}

          {/* Statistik-Boxen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">Form</h3>
              <p className="text-xs text-slate-500 mb-1">Heim</p>
              <p className="text-white font-mono text-sm mb-2">{renderList(match.analysis?.form_home)}</p>
              <p className="text-xs text-slate-500 mb-1">Auswärts</p>
              <p className="text-white font-mono text-sm">{renderList(match.analysis?.form_away)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">Verletzte</h3>
              <p className="text-xs text-slate-500 mb-1">Heim</p>
              <p className="text-white text-sm mb-2">{renderList(match.analysis?.injuries_home)}</p>
              <p className="text-xs text-slate-500 mb-1">Auswärts</p>
              <p className="text-white text-sm">{renderList(match.analysis?.injuries_away)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">H2H</h3>
              {match.analysis?.h2h_stats && typeof match.analysis.h2h_stats === 'object' ? (
                <>
                  <p className="text-white text-sm">Heimsiege: {(match.analysis.h2h_stats as any).home_wins || 0}</p>
                  <p className="text-white text-sm">Auswärtssiege: {(match.analysis.h2h_stats as any).away_wins || 0}</p>
                </>
              ) : (
                <p className="text-white text-sm">Keine Daten</p>
              )}
            </div>
          </div>

          {/* TIPP-BEREICH */}
          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-lg font-bold text-white mb-4">
              {isFinished ? 'Ergebnis & Dein Tipp' : 'Dein Tipp'}
            </h3>

            {/* FALL 1: Spiel ist beendet → Read-Only-Ansicht */}
            {isFinished && (
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-4">Dieses Spiel ist bereits beendet</p>
                  
                  {/* Hier können wir später das Ergebnis und den eigenen Tipp laden */}
                  <div className="bg-slate-900 rounded-lg p-4 mb-4">
                    <p className="text-white font-bold text-lg mb-2">Ergebnis</p>
                    <p className="text-gray-400 text-sm">Wird geladen...</p>
                  </div>

                  <div className="bg-slate-900 rounded-lg p-4">
                    <p className="text-white font-bold text-lg mb-2">Dein Tipp</p>
                    <p className="text-gray-400 text-sm">Wird geladen...</p>
                  </div>

                  <p className="text-xs text-gray-500 mt-4">
                    (Die Ergebnisse und Punkte werden in einem nächsten Schritt hier angezeigt)
                  </p>
                </div>
              </div>
            )}

            {/* FALL 2: Spiel ist gesperrt (< 2 Min) */}
            {!isFinished && isLocked && (
              <div className="text-center py-8 bg-red-900/20 border border-red-500/50 rounded-lg">
                <p className="text-red-400 font-bold">Gesperrt - Spiel beginnt bald</p>
              </div>
            )}

            {/* FALL 3: Spiel ist aktiv → Tipp-Formular */}
            {!isFinished && !isLocked && (
              <div className="space-y-6">
                {/* 1X2 */}
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

                {/* Over/Under */}
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

                {/* BTTS */}
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

                {/* Doppelte Chance */}
                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Doppelte Chance</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['1X', '12', 'X2'].map((opt) => (
                      <button key={opt} type="button" onClick={() => setTipDoubleChance(tipDoubleChance === opt ? '' : opt)} className={`py-3 rounded-lg border font-bold ${tipDoubleChance === opt ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exaktes Ergebnis */}
                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Exaktes Ergebnis</label>
                  <div className="flex gap-3 items-center">
                    <input type="number" min="0" max="10" value={tipExactHome} onChange={(e) => setTipExactHome(e.target.value)} placeholder="Heim" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-center" />
                    <span className="text-slate-400">:</span>
                    <input type="number" min="0" max="10" value={tipExactAway} onChange={(e) => setTipExactAway(e.target.value)} placeholder="Auswärts" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-center" />
                  </div>
                </div>

                {/* Warum gegen KI? */}
                {isDeviating && (
                  <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                    <label className="text-sm font-semibold text-yellow-300 uppercase block mb-2">Warum gegen die KI?</label>
                    <textarea value={deviationReason} onChange={(e) => setDeviationReason(e.target.value.slice(0, 100))} placeholder="Max 100 Zeichen" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm" rows={3} />
                    <p className="text-xs text-yellow-400 mt-2">{deviationReason.length}/100</p>
                  </div>
                )}

                {/* Speichern-Button */}
                <button type="button" onClick={handleSubmit} disabled={isSubmitting || !tip1X2} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-bold py-4 rounded-lg text-lg">
                  {isSubmitting ? 'Speichern...' : 'Tipp speichern'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}