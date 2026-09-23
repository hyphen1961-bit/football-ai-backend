'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- DEINE UNUMSTÖSSLICHEN VERBINDUNGSDATEN ---
const SUPABASE_URL = 'https://knjgiaphysdgxenritzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamdpYXBoeXNkZ3hlbnJpdHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjY2NzIsImV4cCI6MjEwNDg0MjY3Mn0.iwZnNtcga1XPd1cyb2OJwjhvRIIrDxzbrmRed2LuShs';
const API_URL = 'https://railway.app';
// ----------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Match {
  api_fixture_id: number;
  home_team_name: string;
  away_team_name: string;
  kickoff_time: string;
  league_name: string | null;
  analysis?: { ai_prediction: string; confidence_score: number; };
}

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [supportKey, setSupportKey] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserId(session.user.id);
          const { data } = await supabase.from('users').select('username, display_name, avatar_url').eq('id', session.user.id).single();
          if (data) {
            setUsername(data.display_name || data.username || 'Kumpel');
            setSupportKey(data.avatar_url || 'Hyphen-KEY');
          } else { setShowRegisterModal(true); }
        } else { setShowRegisterModal(true); }
      } catch (err) { console.error(err); } finally { loadMatches(); }
    }
    checkSession();
  }, []);

  const loadMatches = async () => {
    try {
      const res = await fetch(`${API_URL}/matches`);
      const data = await res.json();
      setMatches(Array.isArray(data) ? data : []);
    } catch (error) { 
      console.error(error); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleRegister = async () => {
    if (!username.trim()) return;
    setLoading(true);
    try {
      // 1. Anonymer Login bei Supabase (Erfolgreich!)
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;
      const anonymousUserId = authData.user!.id;
      
      // 2. Hyphen-Support-Key generieren
      const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      const signatureSupportKey = `Hyphen-${randomCode}`;
      
      // 3. Zeile in der Tabelle aktualisieren (Email weggelassen, um 400er Validierungsfehler zu umgehen)
      const { error: updateError } = await supabase.from('users').upsert({ 
        id: anonymousUserId,
        username: username.trim(), 
        display_name: username.trim(), 
        avatar_url: signatureSupportKey
      });
      
      if (updateError) throw updateError;
      setUserId(anonymousUserId);
      setSupportKey(signatureSupportKey);
      localStorage.setItem('hyphen_user_id', anonymousUserId);
      localStorage.setItem('hyphen_support_key', signatureSupportKey);
      setShowRegisterModal(false);
    } catch (error: any) { 
      alert(`Fehler bei der Registrierung: ${error.message}`); 
    } finally { 
      setLoading(false); 
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
            <h2 className="text-3xl font-extrabold mb-4 text-center bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Hyphen Kumpel-Tipp</h2>
            <input type="text" placeholder="Dein Anzeigename" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-4 rounded-xl bg-gray-900 text-white mb-6 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700" />
            <button onClick={handleRegister} className="w-full bg-gradient-to-r from-purple-600 to-pink-400 font-bold py-4 rounded-xl transition-all shadow-lg">Jetzt starten 🚀</button>
          </div>
        </div>
      )}
      {supportKey && (
        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 p-6 text-center shadow-2xl border-b border-purple-400/30">
          <div className="text-xs opacity-80 mb-1 uppercase tracking-widest">Dein Support-Schlüssel:</div>
          <div className="text-3xl font-mono font-black tracking-wider mb-2">{supportKey}</div>
          <div className="text-base font-bold bg-black/20 max-w-xl mx-auto py-2 px-4 rounded-xl">Gib Hyphen diesen Schlüssel – der Geist im Hintergrund hilft. 👻</div>
        </div>
      )}

      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <h1 className="text-4xl font-black text-center mb-12 uppercase tracking-wide bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">🏟️ Spielplan & Vorhersagen 🏟️</h1>
        {matches.length === 0 ? (
          <div className="text-center text-slate-400 py-12 bg-gray-800/50 rounded-xl border border-gray-700">
            Keine aktiven Spiele geladen. Der Railway-Server läuft, liefert aber noch keine Spieldaten.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <div key={match.api_fixture_id} className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl hover:border-purple-500/50 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-slate-400 mb-2">
                    {match.league_name || 'Liga'} • {new Date(match.kickoff_time).toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-lg font-bold mb-4">{match.home_team_name} <span className="text-purple-400">vs</span> {match.away_team_name}</div>
                  {match.analysis ? (
                    <div className="mb-6 p-3 bg-slate-900 border border-purple-900/40 rounded-lg">
                      <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">KI-Prognose:</span>
                      <div className="text-base font-black text-purple-400 mt-0.5">{match.analysis.ai_prediction} ({match.analysis.confidence_score}%)</div>
                    </div>
                  ) : (
                    <div className="mb-6 p-3 bg-slate-900/50 text-xs text-slate-500 rounded-lg italic">Keine KI-Analyse für diese Partie hinterlegt.</div>
                  )}
                </div>
                <button className="w-full bg-slate-700 hover:bg-purple-600 text-white font-bold py-2.5 rounded-xl transition-all shadow-md">Spiel aktiv ⚽</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
