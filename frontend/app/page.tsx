'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js'; // WICHTIG: Supabase Client importieren

// Initialisiere den Supabase-Client direkt im Frontend
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://DEINE_SUPABASE_URL.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'DEIN_SUPABASE_ANON_KEY';
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
  const [matches, setMatches] = useState<Match[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [supportKey, setSupportKey] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://football-ai-backend-production.up.railway.app';

  useEffect(() => {
    // Prüfe ob User bereits lokal registriert ist
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
      // HIER DIE RETTUNG: Wir erstellen die echte anonyme Session in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) throw authError;
      if (!authData.user) throw new Error('Keine User-Daten von Supabase erhalten');

      const anonymousUserId = authData.user.id;
      
      // Jetzt schicken wir die echte ID an dein FastAPI Backend auf Railway
      const res = await fetch(`${API_URL}/register-anonymous-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: anonymousUserId,
          username: username.trim()
        })
      });
      
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
      alert('Hoppla! Da ist beim Erstellen der Kumpel-Session etwas schiefgelaufen.');
    }
  };

  const submitTip = async (fixtureId: number, prediction: string) => {
    if (!userId) return;
    
    try {
      await fetch(`${API_URL}/tips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          api_fixture_id: fixtureId,
          predicted_winner: prediction
        })
      });
      alert('Tipp im System eingeloggt! ⚽');
    } catch (error) {
      console.error('Tipp-Fehler:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Lade Spiele für die Kumpels...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Registrierungs-Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-purple-500">
            <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Willkommen beim Hyphen-Tipp!
            </h2>
            <p className="text-gray-400 text-sm mb-4 text-center">
              Gib einfach einen Wunschnamen ein. Keine E-Mail, kein Passwort. Absolut anonym!
            </p>
            <input
              type="text"
              placeholder="Dein Kumpel-Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 rounded-lg bg-gray-700 text-white mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
            />
            <button
              onClick={handleRegister}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-105"
            >
              Als Kumpel beitreten 🚀
            </button>
          </div>
        </div>
      )}

      {/* Hyphen-Schlüssel Anzeige */}
      {supportKey && (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-center shadow-lg animate-slideDown">
          <div className="text-sm opacity-80 mb-1">Dein persönlicher Support-Schlüssel:</div>
          <div className="text-3xl font-mono font-bold tracking-wider mb-2">{supportKey}</div>
          <div className="text-lg font-bold">
            Gib Hyphen diesen Schlüssel – der Geist im Hintergrund hilft. 👻
          </div>
        </div>
      )}

      {/* Hauptinhalt */}
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-5xl font-bold text-center mb-12 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          ⚽ Hyphen Football AI ⚽
        </h1>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <div key={match.api_fixture_id} className="bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-700 hover:border-purple-500 transition-all duration-300">
              <div className="text-sm text-gray-400 mb-2">
                {new Date(match.date).toLocaleDateString('de-CH')}
              </div>
              <div className="text-xl font-bold mb-4">
                {match.home_team} vs {match.away_team}
              </div>
              
              {match.analysis && (
                <div className="mb-4 p-3 bg-gray-900 rounded-lg border border-purple-900/50">
                  <div className="text-sm text-gray-400">KI-Tipp-Tendenz:</div>
                  <div className="text-lg font-bold text-purple-400">
                    {match.analysis.ai_prediction} ({match.analysis.confidence_score}%)
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mt-4">
                <button
                  onClick={() => submitTip(match.api_fixture_id, 'Home')}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-all active:scale-95"
                >
                  1 (Heim)
                </button>
                <button
                  onClick={() => submitTip(match.api_fixture_id, 'Draw')}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 rounded-lg transition-all active:scale-95"
                >
                  X (Remis)
                </button>
                <button
                  onClick={() => submitTip(match.api_fixture_id, 'Away')}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-all active:scale-95"
                >
                  2 (Auswärts)
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
