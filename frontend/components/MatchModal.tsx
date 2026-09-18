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
  const [isFinished, setIsFinished] = useState<boolean>(false);
  
  // NEU: States für geladene Daten (bei vergangenen Spielen)
  const [userTip, setUserTip] = useState<any>(null);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  
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

  // Timer-Logik
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = kickoffTime.getTime() - now.getTime();
      const mins = Math.floor(diff / (1000 * 60));

      if (mins < -120) {
        setIsFinished(true);
        setIsLocked(true);
        setTimeLeft('Beendet');
      } else if (mins <= 2) {
        setIsLocked(true);
        setIsFinished(false);
        setTimeLeft('Gesperrt');
      } else {
        setIsLocked(false);
        setIsFinished(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`Noch ${hours}h ${minutes}min`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [kickoffTime]);

  // NEU: Daten laden wenn Spiel beendet ist
  useEffect(() => {
    if (isFinished && match.api_fixture_id) {
      loadFinishedGameData();
    }
  }, [isFinished, match.api_fixture_id]);

  // NEU: Funktion zum Laden der Daten
  const loadFinishedGameData = async () => {
    setIsLoadingData(true);
    try {
      // 1. Ergebnis laden
      const resultRes = await fetch(`https://football-ai-backend-production-0f95.up.railway.app/match-results/${match.api_fixture_id}`);
      if (resultRes.ok) {
        const resultData = await resultRes.json();
        setMatchResult(resultData);
      }

      // 2. User-Tipp laden
      const tipRes = await fetch(`https://football-ai-backend-production-0f95.up.railway.app/tips/Urs/${match.api_fixture_id}`);
      if (tipRes.ok) {
        const tipData = await tipRes.json();
        setUserTip(tipData);
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

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
      alert('Bitte wähle zuerst einen 1X2-Tipp (Heimsieg, Unentschieden oder Auswärtssieg)');
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
        deviation_reason: deviationReason || null,
      };

      console.log('Sende Tipp:', tipData); // DEBUG

      const res = await fetch('https://football-ai-backend-production-0f95.up.railway.app/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipData),
      });

      if (res.ok) {
        alert('Tipp erfolgreich gespeichert!');
        onClose();
      } else {
        const err = await res.text();
        console.error('Backend Fehler:', err);
        alert('Fehler beim Speichern: ' + err);
      }
    } catch (error) {
      console.error('Network Error:', error);
      alert('Netzwerkfehler - bitte prüfe die Konsole');
    } finally {
      setIsSubmitting(false);
    }
  };

  // NEU: Punkte berechnen für Anzeige
  const calculatePoints = () => {
    if (!userTip || !matchResult) return 0;
    
    let points = 0;
    const actualHome = matchResult.home_score;
    const actualAway = matchResult.away_score;
    
    // 1X2 korrekt?
    if (
      (actualHome > actualAway && userTip.predicted_winner === '1') ||
      (actualHome === actualAway && userTip.predicted_winner === '0') ||
      (actualHome < actualAway && userTip.predicted_winner === '2')
    ) {
      points += 3;
    }
    
    // Over/Under korrekt?
    const totalGoals = actualHome + actualAway;
    if (userTip.tip_over_under === 'Over' && totalGoals > 2.5) points += 1;
    if (userTip.tip_over_under === 'Under' && totalGoals <= 2.5) points += 1;
    
    // BTTS korrekt?
    if (userTip.tip_btts === 'Yes' && actualHome > 0 && actualAway > 0) points += 1;
    if (userTip.tip_btts === 'No' && (actualHome === 0 || actualAway === 0)) points += 1;
    
    return points;
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
                  <p className="text-gray-400 text-sm mb-6">Dieses Spiel ist bereits beendet</p>
                  
                  {isLoadingData ? (
                    <div className="space-y-4">
                      <div className="bg-slate-900 rounded-lg p-4">
                        <p className="text-white font-bold text-lg mb-2">Ergebnis</p>
                        <p className="text-gray-400 text-sm animate-pulse">Wird geladen...</p>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-4">
                        <p className="text-white font-bold text-lg mb-2">Dein Tipp</p>
                        <p className="text-gray-400 text-sm animate-pulse">Wird geladen...</p>
                      </div>
                    </div>
                  ) : matchResult && userTip ? (
                    <div className="space-y-4">
                      {/* Ergebnis */}
                      <div className="bg-slate-900 rounded-lg p-6">
                        <p className="text-gray-400 text-sm mb-3">Endergebnis</p>
                        <div className="flex justify-center items-center gap-4 text-3xl font-bold text-white">
                          <span>{match.home_team_name}</span>
                          <span className="text-indigo-400">{matchResult.home_score} : {matchResult.away_score}</span>
                          <span>{match.away_team_name}</span>
                        </div>
                      </div>

                      {/* User Tipp */}
                      <div className="bg-slate-900 rounded-lg p-6">
                        <p className="text-gray-400 text-sm mb-3">Dein Tipp</p>
                        <div className="grid grid-cols-2 gap-4 text-left">
                          <div>
                            <p className="text-white font-bold mb-1">1X2: {
                              userTip.predicted_winner === '1' ? 'Heimsieg' :
                              userTip.predicted_winner === '0' ? 'Unentschieden' : 'Auswärtssieg'
                            }</p>
                            {userTip.tip_over_under && <p className="text-slate-400 text-sm">Over/Under: {userTip.tip_over_under} 2.5</p>}
                            {userTip.tip_btts && <p className="text-slate-400 text-sm">BTTS: {userTip.tip_btts === 'Yes' ? 'Ja' : 'Nein'}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-indigo-400 font-bold text-2xl">+{calculatePoints()} Punkte</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-6">
                      <p className="text-yellow-400 font-bold mb-2">Kein Tipp gefunden</p>
                      <p className="text-gray-400 text-sm">Du hast für dieses Spiel keinen Tipp abgegeben.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FALL 2: Spiel ist gesperrt (< 2 Min) */}
            {!isFinished && isLocked && (
              <div className="text-center py-8 bg-red-900/20 border border-red-500/50 rounded-lg">
                <p className="text-red-400 font-bold text-lg"> Gesperrt</p>
                <p className="text-red-300 text-sm mt-2">Spiel beginnt in weniger als 2 Minuten</p>
              </div>
            )}

            {/* FALL 3: Spiel ist aktiv → Tipp-Formular */}
            {!isFinished && !isLocked && (
              <div className="space-y-6">
                {/* 1X2 */}
                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">1X2 - Wer gewinnt?</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      type="button" 
                      onClick={() => setTip1X2('1')} 
                      className={`py-4 rounded-lg border font-bold text-lg transition-all ${
                        tip1X2 === '1' 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/50' 
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      1
                      <span className="block text-xs font-normal mt-1">{match.home_team_name}</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setTip1X2('0')} 
                      className={`py-4 rounded-lg border font-bold text-lg transition-all ${
                        tip1X2 === '0' 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/50' 
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      0
                      <span className="block text-xs font-normal mt-1">Unentschieden</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setTip1X2('2')} 
                      className={`py-4 rounded-lg border font-bold text-lg transition-all ${
                        tip1X2 === '2' 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/50' 
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      2
                      <span className="block text-xs font-normal mt-1">{match.away_team_name}</span>
                    </button>
                  </div>
                </div>

                {/* Over/Under */}
                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Over/Under 2.5</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => setTipOverUnder(tipOverUnder === 'Over' ? '' : 'Over')} 
                      className={`py-3 rounded-lg border font-bold ${
                        tipOverUnder === 'Over' 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      Over 2.5
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setTipOverUnder(tipOverUnder === 'Under' ? '' : 'Under')} 
                      className={`py-3 rounded-lg border font-bold ${
                        tipOverUnder === 'Under' 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      Under 2.5
                    </button>
                  </div>
                </div>

                {/* BTTS */}
                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">BTTS - Beide treffen?</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => setTipBTTS(tipBTTS === 'Yes' ? '' : 'Yes')} 
                      className={`py-3 rounded-lg border font-bold ${
                        tipBTTS === 'Yes' 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      Ja
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setTipBTTS(tipBTTS === 'No' ? '' : 'No')} 
                      className={`py-3 rounded-lg border font-bold ${
                        tipBTTS === 'No' 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      Nein
                    </button>
                  </div>
                </div>

                {/* Doppelte Chance */}
                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Doppelte Chance</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['1X', '12', 'X2'].map((opt) => (
                      <button 
                        key={opt} 
                        type="button" 
                        onClick={() => setTipDoubleChance(tipDoubleChance === opt ? '' : opt)} 
                        className={`py-3 rounded-lg border font-bold ${
                          tipDoubleChance === opt 
                            ? 'bg-indigo-600 border-indigo-500 text-white' 
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exaktes Ergebnis */}
                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Exaktes Ergebnis (Optional)</label>
                  <div className="flex gap-3 items-center">
                    <input 
                      type="number" 
                      min="0" 
                      max="10" 
                      value={tipExactHome} 
                      onChange={(e) => setTipExactHome(e.target.value)} 
                      placeholder="Heim" 
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-center focus:outline-none focus:border-indigo-500" 
                    />
                    <span className="text-slate-400 text-2xl">:</span>
                    <input 
                      type="number" 
                      min="0" 
                      max="10" 
                      value={tipExactAway} 
                      onChange={(e) => setTipExactAway(e.target.value)} 
                      placeholder="Auswärts" 
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-center focus:outline-none focus:border-indigo-500" 
                    />
                  </div>
                </div>

                {/* Warum gegen KI? */}
                {isDeviating && (
                  <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 animate-pulse">
                    <label className="text-sm font-semibold text-yellow-300 uppercase block mb-2">
                      🤔 Warum gegen die KI?
                    </label>
                    <textarea 
                      value={deviationReason} 
                      onChange={(e) => setDeviationReason(e.target.value.slice(0, 100))} 
                      placeholder="Max 100 Zeichen - z.B. 'Neymar ist verletzt'" 
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500" 
                      rows={3} 
                    />
                    <p className="text-xs text-yellow-400 mt-2">{deviationReason.length}/100 Zeichen</p>
                  </div>
                )}

                {/* Speichern-Button */}
                <button 
                  type="button" 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || !tip1X2} 
                  className={`w-full font-bold py-4 rounded-lg text-lg transition-all ${
                    isSubmitting || !tip1X2
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/50'
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Speichern...
                    </span>
                  ) : (
                    'Tipp speichern'
                  )}
                </button>
                
                {!tip1X2 && (
                  <p className="text-center text-sm text-slate-400">
                    💡 Wähle zuerst einen 1X2-Tipp (1, 0 oder 2)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}