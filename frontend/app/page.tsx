'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamdpYXBoeXNkZ3hlbnJpdHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjY2NzIsImV4cCI6MjEwNDg0MjY3Mn0.iwZnNtcga1XPd1cyb2OJwjhvRIIrDxzbrmRed2LuShs';
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
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [supportKey, setSupportKey] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTipModal, setShowTipModal] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [tipPrediction, setTipPrediction] = useState<string>('');
  const [tipOverUnder, setTipOverUnder] = useState<string>('');
  const [tipBtts, setTipBtts] = useState<string>('');
  const [tipDoubleChance, setTipDoubleChance] = useState<string>('');
  const [exactHome, setExactHome] = useState<string>('');
  const [exactAway, setExactAway] = useState<string>('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://railway.app';

  useEffect(() => {
    async function checkUserSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserId(session.user.id);
          const { data } = await supabase.table('users').select('username, display_name, avatar_url').eq('id', session.user.id).single();
          if (data) {
            setUsername(data.display_name || data.username || 'Kumpel');
            setSupportKey(data.avatar_url || 'Hyphen-KEY');
          } else {
            setShowRegisterModal(true);
          }
        } else {
          setShowRegisterModal(true);
        }
      } catch (err) {
        console.error("Fehler beim Session-Check:", err);
      } finally {
        loadMatches();
      }
    }
    checkUserSession();
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
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Keine ID erhalten');
      const anonymousUserId = authData.user.id;
      const randomCode = ''.concat(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)],
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)],
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)],
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
      );
      const signatureSupportKey = `Hyphen-${randomCode}`;
      const { error: updateError } = await supabase.table('users').update({ username: username.trim(), display_name: username.trim(), avatar_url: signatureSupportKey }).eq('id', anonymousUserId);
      if (updateError) throw updateError;
      setUserId(anonymousUserId);
      setSupportKey(signatureSupportKey);
      localStorage.setItem('hyphen_user_id', anonymousUserId);
      localStorage.setItem('hyphen_support_key', signatureSupportKey);
      setShowRegisterModal(false);
    } catch (error: any) {
      alert(`Fehler: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
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
              <button onClick={submitTip} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl shadow-lg transform hover:scale-105">Tippen 🚀</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
