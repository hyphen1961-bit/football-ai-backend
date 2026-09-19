'use client';
import { useState, useEffect, useMemo } from 'react';
import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';

interface MatchModalProps {
  match: Match | null;
  onClose: () => void;
}

const BACKEND_URL = 'https://football-ai-backend-production-0f95.up.railway.app';

export default function MatchModal({ match, onClose }: MatchModalProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  
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

  // Prüfen ob Spiel bereits gespielt wurde
  const isMatchPlayed = match.status === 'FT' || match.status === 'AET' || match.status === 'PEN';

  // 1. Timer Logik
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = kickoffTime.getTime() - now.getTime();
      const mins = Math.floor(diff / (1000 * 60));

      if (isMatchPlayed || mins < -120) {
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
  }, [kickoffTime, isMatchPlayed]);

  // 2. NEU: Vorhandenen Tipp laden, wenn Modal für ein zukünftiges Spiel geöffnet wird
  useEffect(() => {
    // Felder erst mal resetten
    setTip1X2(''); setTipOverUnder(''); setTipBTTS(''); setTipDoubleChance('');
    setTipExactHome(''); setTipExactAway(''); setDeviationReason('');

    if (!isFinished && match.api_fixture_id) {
      fetch(`${BACKEND_URL}/tips/Urs/${match.api_fixture_id}`)
        .then(res => {
          if (res.ok) return res.json();
          return null;
        })
        .then(data => {
          if (data) {
            setTip1X2(data.predicted_winner || '');
            setTipOverUnder(data.tip_over_under || '');
            setTipBTTS(data.tip_btts || '');
            setTipDoubleChance(data.tip_double_chance || '');
            setTipExactHome(data.tip_exact_score_home?.toString() || '');
            setTipExactAway(data.tip_exact_score_away?.toString() || '');
            setDeviationReason(data.deviation_reason || '');
          }
        })
        .catch(err => console.error("Fehler beim Laden des Tipps:", err));
    }
  }, [match, isFinished]);

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

   = async () => {
    if (!tip1X2) {
      alert('Bitte wähle zuerst einen 1X2-Tipp (1, 0 oder 2)');
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

      const res = await fetch(`${BACKEND_URL}/tips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipData),
      });

      if (res.ok) {
        alert('Tipp aktualisiert/gespeichert!');
        onClose();
      } else {
        const err = await res.text();
        alert('Fehler beim Speichern: ' + err);
      }
    } catch (error) {
      alert('Netzwerkfehler');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-start z-10">
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

          {/* ============================================ */}
          {/* FALL 1: SPIEL BEENDET → READ-ONLY           */}
          {/* ============================================ */}
          {isFinished && (
            <div className="border-t border-slate-800 pt-6">
              <h3 className="text-lg font-bold text-white mb-4">Endergebnis</h3>
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 text-center">
                <div className="flex justify-center items-center gap-6">
                  <div className="text-center">
                    <p className="text-slate-400 text-sm mb-1">{match.home_team_name}</p>
                    <p className="text-4xl font-black text-white">{match.home_score ?? '-'}</p>
                  </div>
                  <span className="text-slate-500 text-3xl font-bold">:</span>
                  <div className="text-center">
                    <p className="text-slate-400 text-sm mb-1">{match.away_team_name}</p>
                    <p className="text-4xl font-black text-white">{match.away_score ?? '-'}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-4">Dieses Spiel ist bereits beendet.</p>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* FALL 2: SPIEL GESPERRT (< 2 MIN)            */}
          {/* ============================================ */}
          {!isFinished && isLocked && (
            <div className="border-t border-slate-800 pt-6">
              <div className="text-center py-8 bg-red-900/20 border border-red-500/50 rounded-lg">
                <p className="text-red-400 font-bold text-lg">Gesperrt</p>
                <p className="text-red-300 text-sm mt-2">Spiel beginnt in weniger als 2 Minuten</p>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* FALL 3: SPIEL AKTIV → TIPP-FORMULAR (EDITIERBAR) */}
          {/* ============================================ */}
          {!isFinished && !isLocked && (
            <div className="border-t border-slate-800 pt-6">
              <h3 className="text-lg font-bold text-white mb-4">Dein Tipp (Bearbeitbar bis 2 Min vor Anpfiff)</h3>
              <div className="space-y-6">
                
                {/* 1X2 */}
                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">1X2 - Wer gewinnt?</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button type="button" onClick={() => setTip1X2('1')} className={`py-4 rounded-lg border font-bold text-lg transition-all ${tip1X2 === '1' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                      1 <span className="block text-xs font-normal mt-1">{match.home_team_name}</span>
                    </button>
                    <button type="button" onClick={() => setTip1X2('0')} className={`py-4 rounded-lg border font-bold text-lg transition-all ${tip1X2 === '0' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                      0 <span className="block text-xs font-normal mt-1">Unentschieden</span>
                    </button>
                    <button type="button" onClick={() => setTip1X2('2')} className={`py-4 rounded-lg border font-bold text-lg transition-all ${tip1X2 === '2' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                      2 <span className="block text-xs font-normal mt-1">{match.away_team_name}</span>
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
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">BTTS - Beide treffen?</label>
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
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Exaktes Ergebnis (Optional)</label>
                  <div className="flex gap-3 items-center">
                    <input type="number" min="0" max="10" value={tipExactHome} onChange={(e) => setTipExactHome(e.target.value)} placeholder="Heim" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-center focus:outline-none focus:border-indigo-500" />
                    <span className="text-slate-400 text-2xl">:</span>
                    <input type="number" min="0" max="10" value={tipExactAway} onChange={(e) => setTipExactAway(e.target.value)} placeholder="Auswärts" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-center focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>

                {/* Warum gegen KI? */}
                {isDeviating && (
                  <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                    <label className="text-sm font-semibold text-yellow-300 uppercase block mb-2">🤔 Warum gegen die KI?</label>
                    <textarea value={deviationReason} onChange={(e) => setDeviationReason(e.target.value.slice(0, 100))} placeholder="Max 100 Zeichen" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500" rows={3} />
                    <p className="text-xs text-yellow-400 mt-2">{deviationReason.length}/100</p>
                  </div>
                )}

                {/* Speichern-Button */}
                <button type="button" onClick={handleSubmit} disabled={isSubmitting || !tip1X2} className={`w-full font-bold py-4 rounded-lg text-lg transition-all ${isSubmitting || !tip1X2 ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/50'}`}>
                  {isSubmitting ? 'Speichern...' : 'Tipp speichern / aktualisieren'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}