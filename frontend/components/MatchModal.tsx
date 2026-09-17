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
  
  // FIX: kickoffTime mit useMemo memoisieren (verhindert Endlos-Loop)
  const kickoffTime = useMemo(() => new Date(match.kickoff_time), [match.kickoff_time]);
  const time = kickoffTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const date = kickoffTime.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  // FIX: String als Dependency verwenden (stabil!)
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const kickoff = new Date(match.kickoff_time);
      const diff = kickoff.getTime() - now.getTime();
      const minutesUntilKickoff = Math.floor(diff / (1000 * 60));
      
      if (minutesUntilKickoff <= 2) {
        setIsLocked(true);
        setTimeLeft('Gespeert - Spiel beginnt bald');
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

  // FIX: Sicherer Zugriff auf ai_prediction
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
      alert('Bitte wähle mindestens einen 1X2-Tipp');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const tipData = {
        user_id: '1',
        api_fixture_id: match.api_fixture_id,
        predicted_winner: tip1X2,
        tip_over_under: tipOverUnder || null,
        tip_btts: tipBTTS || null,
        tip_double_chance: tipDoubleChance || null,
        tip_exact_score_home: tipExactScoreHome ? parseInt(tipExactScoreHome) : null,
        tip_exact_score_away: tipExactScoreAway ? parseInt(tipExactScoreAway) : null,
        deviation_reason: deviationReason || null,
      };

      const backendUrl = 'https://football-ai-backend-production-0f95.up.railway.app';
      
      const response = await fetch(`${backendUrl}/tips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipData),
      });

      if (response.ok) {
        alert('Tipp erfolgreich gespeichert!');
        onClose();
      } else {
        const errorText = await response.text();
        alert('Fehler beim Speichern: ' + errorText);
      }
    } catch (error) {
      console.error('Fehler:', error);
      alert('Fehler beim Speichern des Tipps');
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
          <button onClick={onClose} className="text-s