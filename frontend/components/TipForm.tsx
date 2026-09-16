'use client'; // Das sagt Next.js: Diese Komponente darf auf Klicks reagieren

import { useState } from 'react';

interface Match {
  id: string;
  api_fixture_id: number;
  home_team_name: string;
  away_team_name: string;
  kickoff_time: string;
}

interface Analysis {
  api_fixture_id: number;
  ai_prediction: string; // "Home", "Draw", "Away"
  confidence_score: number;
}

interface TipFormProps {
  match: Match;
  analysis: Analysis | null;
}

export default function TipForm({ match, analysis }: TipFormProps) {
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reasonText, setReasonText] = useState('');

  // Funktion, die prüft, ob der Tipp gegen die KI ist
  const handleWinnerClick = (winner: string) => {
    setSelectedWinner(winner);
    
    // Wenn wir eine KI-Analyse haben und der Tipp abweicht -> Textfeld zeigen
    if (analysis && winner !== analysis.ai_prediction) {
      setShowReason(true);
    } else {
      setShowReason(false);
      setReasonText(''); // Reset, falls man doch wieder mit der KI tippt
    }
  };

  const submitTip = async (formData: FormData) => {
    const kumpelName = formData.get('kumpel_name') as string;
    const overUnder = formData.get('over_under') as string;
    const btts = formData.get('btts') as string;
    const doubleChance = formData.get('double_chance') as string;
    const exactHome = formData.get('exact_home') as string;
    const exactAway = formData.get('exact_away') as string;

    // Wir fügen den Grund manuell zum FormData hinzu, da er nicht in einem Input liegt
    if (showReason) {
      formData.append('deviation_reason', reasonText);
    }

    await fetch('https://football-ai-backend-production-0f95.up.railway.app/tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: kumpelName || 'Anonym',
        api_fixture_id: match.api_fixture_id,
        predicted_winner: selectedWinner || 'Draw',
        tip_over_under: overUnder || null,
        tip_btts: btts || null,
        tip_double_chance: doubleChance || null,
        tip_exact_score_home: exactHome ? parseInt(exactHome) : null,
        tip_exact_score_away: exactAway ? parseInt(exactAway) : null,
        deviation_reason: showReason ? reasonText : null
      })
    });
    
    // Optional: Formular zurücksetzen oder Erfolgsmeldung zeigen
    alert(`Tipp gespeichert! ${showReason ? 'Grund: ' + reasonText : ''}`);
  };

  const aiPrediction = analysis?.ai_prediction || null;

  return (
    <form action={submitTip} className="mt-6 pt-4 border-t border-gray-100 space-y-5">
      <input type="hidden" name="fixtureId" value={match.api_fixture_id} />
      
      {/* Name */}
      <div>
        <label className="block text-sm font-bold text-gray-800 mb-1">Dein Name:</label>
        <input 
          name="kumpel_name" 
          autoComplete="off"
          placeholder="z.B. Urs, Klaus, Michael" 
          className="border border-gray-300 rounded-md px-3 py-2.5 w-full sm:w-64 text-gray-900 placeholder-gray-500 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      {/* 1X2 - Sieger */}
      <div>
        <label className="block text-sm font-bold text-gray-800 mb-2">
          1. Wer gewinnt? (1X2) 
          {aiPrediction && <span className="text-xs text-gray-500 font-normal ml-2">(KI-Tipp: {aiPrediction})</span>}
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => handleWinnerClick('Home')} className={`py-2.5 px-4 rounded-md transition shadow-sm font-bold text-white ${selectedWinner === 'Home' ? 'bg-blue-800 ring-2 ring-blue-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {match.home_team_name}
          </button>
          <button type="button" onClick={() => handleWinnerClick('Draw')} className={`py-2.5 px-4 rounded-md transition shadow-sm font-bold text-white ${selectedWinner === 'Draw' ? 'bg-gray-800 ring-2 ring-gray-500' : 'bg-gray-600 hover:bg-gray-700'}`}>
            Unentschieden
          </button>
          <button type="button" onClick={() => handleWinnerClick('Away')} className={`py-2.5 px-4 rounded-md transition shadow-sm font-bold text-white ${selectedWinner === 'Away' ? 'bg-red-800 ring-2 ring-red-500' : 'bg-red-600 hover:bg-red-700'}`}>
            {match.away_team_name}
          </button>
        </div>
      </div>

      {/* DAS "WARUM"-FELD (Erscheint nur bei Abweichung) */}
      {showReason && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md animate-pulse">
          <label className="block text-sm font-bold text-yellow-800 mb-1">
            🤔 Du tippst gegen die KI! Warum? (Max 100 Zeichen)
          </label>
          <input 
            type="text"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value.slice(0, 100))}
            placeholder="z.B. Neymar ist verletzt, Mittelfeld spielt nicht..."
            className="w-full border border-yellow-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            required // Muss ausgefüllt werden, wenn man gegen die KI tippt!
          />
          <p className="text-xs text-yellow-600 mt-1">{reasonText.length}/100 Zeichen</p>
        </div>
      )}

      {/* Restliche Wetten (Over/Under, BTTS, etc.) - wie gehabt */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Over/Under 2.5</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="submit" name="over_under" value="Over" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded transition text-sm">Over 2.5</button>
            <button type="submit" name="over_under" value="Under" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-3 rounded transition text-sm">Under 2.5</button>
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Beide treffen? (BTTS)</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="submit" name="btts" value="Yes" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 rounded transition text-sm">Ja</button>
            <button type="submit" name="btts" value="No" className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-3 rounded transition text-sm">Nein</button>
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Doppelte Chance</label>
          <div className="grid grid-cols-3 gap-1">
            <button type="submit" name="double_chance" value="1X" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-1 rounded transition text-xs">1X</button>
            <button type="submit" name="double_chance" value="12" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-1 rounded transition text-xs">12</button>
            <button type="submit" name="double_chance" value="X2" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-1 rounded transition text-xs">X2</button>
          </div>
        </div>
      </div>

      {/* Exaktes Ergebnis */}
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Exaktes Ergebnis (Optional)</label>
        <div className="flex gap-3 items-center">
          <select name="exact_home" className="border border-gray-300 rounded-md px-3 py-2 w-20 text-gray-900 bg-white font-medium">
            <option value="">-</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4+</option>
          </select>
          <span className="text-gray-900 font-bold text-xl">:</span>
          <select name="exact_away" className="border border-gray-300 rounded-md px-3 py-2 w-20 text-gray-900 bg-white font-medium">
            <option value="">-</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4+</option>
          </select>
        </div>
      </div>

      {/* Unsichtbarer Submit-Button, der durch die anderen Buttons getriggert wird */}
      <button type="submit" className="hidden" id="submit-form"></button>
    </form>
  );
}