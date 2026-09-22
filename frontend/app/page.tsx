'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- HARTE VERBINDUNGSDATEN (Von Meister Tianzi & Max final autorisiert!) ---
const SUPABASE_URL = 'https://knjgiaphysdgxenritzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamdpYXBoeXNkZ3hlbnJpdHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjY2NzIsImV4cCI6MjEwNDg0MjY3Mn0.iwZnNtcga1XPd1cyb2OJwjhvRIIrDxzbrmRed2LuShs';
const API_URL = 'https://football-ai-backend-production.up.railway.app';
// ----------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 

interface Match {
  api_fixture_id: number;
  home_team: string;
  away_team: string;
  date: string;
  analysis?: {
    ai_prediction: string;
    confidence_score: number;
  };
}

export default function Home() {
  // --- Auth & User States ---
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [supportKey, setSupportKey] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // --- Data States ---
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Tipp-Fenster (Modal) States ---
  const [showTipModal, setShowTipModal] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [tipPrediction, setTipPrediction] = useState<string>('');
  const [tipOverUnder, setTipOverUnder] = useState<string>('');
  const [tipBtts, setTipBtts] = useState<string>('');
  const [tipDoubleChance, setTipDoubleChance] = useState<string>('');
  const [exactHome, setExactHome] = useState<string>('');
  const [exactAway, setExactAway] = useState<string>('');

  useEffect(() => {
    const storedUserId = localStorage.getItem('hyphen_user_id');
    const storedKey = localStorage.getItem('hyphen_support_key');
    
    if (storedUserId && storedKey) {
      setUserId(storedUserId);
      setSupportKey(storedKey);
    } else {
      setShowRegisterModal(true);
    }
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const res = await fetch(`${API_URL}/matches`);
      if (!res.ok) throw new Error('Netzwerkfehler');
      const data = await res.json();
      setMatches(data);
    } catch (error) {
      console.error('Fehler beim Laden der Spiele:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username.trim()) return;
    
    try {
      // Plan B: Wir generieren die eindeutige ID direkt im Browser!
      const anonymousUserId = crypto.randomUUID();
      
      const res = await fetch(`${API_URL}/register-anonymous-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: anonymousUserId,
          username: username.trim()
        })
      });
      
      if (!res.ok) throw new Error('Server-Antwort war nicht ok');
      const data = await res.json();
      
      if (data.support_key) {
        setUserId(anonymousUserId);
        setSupportKey(data.support_key);
        localStorage.setItem('hyphen_user_id', anonymousUserId);
        localStorage.setItem('hyphen_support_key', data.support_key);
        setShowRegisterModal(false);
      }
    } catch (error) {
      console.error('Registrierungsfehler im Frontend:', error);
      alert('Hoppla! Der Server ist gerade ausgelastet. Bitte versuche es noch einmal.');
    }
  };

  const openTipModal = (match: Match) => {
    setCurrentMatch(match);
    setTipPrediction('');
    setTipOverUnder('');
    setTipBtts('');
    setTipDoubleChance('');
    setExactHome('');
    setExactAway('');
    setShowTipModal(true);
  };

  const submitTip = async () => {
    if (!userId || !currentMatch) {
      alert('Bitte wähle zuerst ein Spiel aus.');
      return;
    }
    if (!tipPrediction) {
      alert('Bitte wähle mindestens den Haupt-Tipp (1X2) aus.');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/tips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          api_fixture_id: currentMatch.api_fixture_id,
          predicted_winner: tipPrediction,
          tip_over_under: tipOverUnder || null,
          tip_btts: tipBtts || null,
          tip_double_chance: tipDoubleChance || null,
          tip_exact_score_home: exactHome ? parseInt(exactHome, 10) : null,
          tip_exact_score_away: exactAway ? parseInt(exactAway, 10) : null
        })
      });
      
      if (res.ok) {
        alert('✅ Sämtliche Kumpel-Tipps erfolgreich im System eingeloggt!');
        setShowTipModal(false);
      } else {
        const errorData = await res.json();
        alert(`❌ Fehler: ${errorData.detail || 'Unbekannter Fehler'}`);
      }
    } catch (error) {
      console.error('Tipp-Fehler:', error);
      alert('💥 Verbindungsfehler zum Server!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-2xl font-bold animate-pulse">Meister Tianzi ordnet die Fussball-Kette...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white font-sans pb-12">
      
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-800 border border-purple-500 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-3xl font-extrabold mb-4 text-center bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Hyphen Kumpel-Tipp
            </h2>
            <p className="text-xs text-slate-400 mb-6 text-center">Keine E-Mail, kein Passwort. Absolut anonym mitmachen!</p>
            <input
              type="text"
              placeholder="Dein Anzeigename"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 rounded-xl bg-gray-900 text-white mb-6 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700"
            />
            <button
              onClick={handleRegister}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg"
            >
              Jetzt starten 🚀
            </button>
          </div>
        </div>
      )}

      {supportKey && (
        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 p-6 text-center shadow-2xl border-b border-purple-400/30">
          <div className="text-xs opacity-80 mb-1 uppercase tracking-widest">Dein Support-Schlüssel:</div>
          <div className="text-3xl font-mono font-black tracking-wider mb-2">{supportKey}</div>
          <div className="text-base font-bold bg-black/20 max-w-xl mx-auto py-2 px-4 rounded-xl">
            Gib Hyphen diesen Schlüssel – der Geist im Hintergrund hilft. 👻
          </div>
        </div>
      )}
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <h1 className="text-4xl font-black text-center mb-12 uppercase tracking-wide bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">🏟️ Spielplan & Vorhersagen 🏟️</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <div key={match.api_fixture_id} className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl hover:border-purple-500/50 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono text-slate-400 mb-2">{new Date(match.date).toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                <div className="text-lg font-bold mb-4">{match.home_team} <span className="text-purple-400">vs</span> {match.away_team}</div>
                {match.analysis ? (
                  <div className="mb-6 p-3 bg-slate-900 border border-purple-900/40 rounded-lg">
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">KI-Prognose:</span>
                    <div className="text-base font-black text-purple-400 mt-0.5">{match.analysis.ai_prediction} ({match.analysis.confidence_score}%)</div>
                  </div>
                ) : (
                  <div className="mb-6 p-3 bg-slate-900/50 text-xs text-slate-500 rounded-lg italic">Keine KI-Analyse für diese Partie hinterlegt.</div>
                )}
              </div>
              <button onClick={() => openTipModal(match)} className="w-full bg-slate-700 hover:bg-purple-600 text-white font-bold py-2.5 rounded-xl transition-all shadow-md">Tippschein ausfüllen 📋</button>
            </div>
          ))}
        </div>
      </div>

      {showTipModal && currentMatch && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-gray-700 pb-3">
              <h3 className="text-xl font-bold">{currentMatch.home_team} vs {currentMatch.away_team}</h3>
              <button onClick={() => setShowTipModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">✕</button>
            </div>
            <div>
              <label className="block text-sm font-bold text-purple-300 mb-2">1. Spielausgang (1X2) *</label>
              <div className="grid grid-cols-3 gap-2">
                {['Home', 'Draw', 'Away'].map((opt) => (
                  <button key={opt} onClick={() => setTipPrediction(tipPrediction === opt ? '' : opt)} className={`py-3 rounded-lg font-bold transition-all duration-200 ${tipPrediction === opt ? 'bg-purple-600 text-white ring-2 ring-purple-400 shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{opt === 'Home' ? 'Heim (1)' : opt === 'Draw' ? 'Unent. (X)' : 'Ausw. (2)'}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-blue-300 mb-2">2. Over/Under (2.5 Tore)</label>
              <div className="grid grid-cols-2 gap-2">
                {['Over', 'Under'].map((opt) => (
                  <button key={opt} onClick={() => setTipOverUnder(tipOverUnder === opt ? '' : opt)} className={`py-3 rounded-lg font-bold transition-all duration-200 ${tipOverUnder === opt ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{opt} 2.5</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-yellow-300 mb-2">3. Beide Teams treffen (BTTS)</label>
              <div className="grid grid-cols-2 gap-2">
                {['Yes', 'No'].map((opt) => (
                  <button key={opt} onClick={() => setTipBtts(tipBtts === opt ? '' : opt)} className={`py-3 rounded-lg font-bold transition-all duration-200 ${tipBtts === opt ? 'bg-yellow-600 text-white ring-2 ring-yellow-400 shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{opt === 'Yes' ? 'Ja' : 'Nein'}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-green-300 mb-2">4. Doppelte Chance</label>
              <div className="grid grid-cols-3 gap-2">
                {['1X', 'X2', '12'].map((opt) => (
                  <button key={opt} onClick={() => setTipDoubleChance(tipDoubleChance === opt ? '' : opt)} className={`py-3 rounded-lg font-bold transition-all duration-200 ${tipDoubleChance === opt ? 'bg-green-600 text-white ring-2 ring-green-400 shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{opt === '1X' ? '1X' : opt === 'X2' ? 'X2' : '12'}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-pink-300 mb-2">5. Exaktes Ergebnis</label>
              <div className="flex items-center gap-4">
                <input type="number" min="0" placeholder="Heim" value={exactHome} onChange={(e) => setExactHome(e.target.value)} className="w-full p-3 rounded-lg bg-gray-700 text-white text-center border border-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                <span className="text-2xl font-bold text-gray-400">:</span>
                <input type="number" min="0" placeholder="Auswärts" value={exactAway} onChange={(e) => setExactAway(e.target.value)} className="w-full p-3 rounded-lg bg-gray-700 text-white text-center border border-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowTipModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg">Abbrechen</button>
              <button onClick={submitTip} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl shadow-lg transform hover:scale-105">Tipp speichern 🚀</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
