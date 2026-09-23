'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- HARTE VERBINDUNGSDATEN (Final versiegelt) ---
const SUPABASE_URL = 'https://knjgiaphysdgxenritzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamdpYXBoeXNkZ3hlbnJpdHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjY2NzIsImV4cCI6MjEwNDg0MjY3Mn0.iwZnNtcga1XPd1cyb2OJwjhvRIIrDxzbrmRed2LuShs';
const API_URL = 'https://football-ai-backend-production-a405.up.railway.app';
// -------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function Home() {
  // --- States für den isolierten Test ---
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [supportKey, setSupportKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!username.trim()) {
      setError('Bitte gib einen Namen ein.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Anonymer Login bei Supabase
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;
      
      const anonymousUserId = authData.user!.id;
      setUserId(anonymousUserId);

      // 2. Hyphen-Support-Key generieren
      const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      const signatureSupportKey = `Hyphen-${randomCode}`;
      setSupportKey(signatureSupportKey);

      // 3. Zeile in der Tabelle anlegen oder aktualisieren
      const { error: updateError } = await supabase.from('users').upsert({ 
        id: anonymousUserId,
        username: username.trim(), 
        display_name: username.trim(), 
        avatar_url: signatureSupportKey 
      });
      
      if (updateError) throw updateError;

      // 4. Erfolgreich -> Weiter zu Maske 2
      setStep(2);
      
    } catch (err: any) { 
      console.error("Registrierungsfehler:", err);
      setError(`Fehler: ${err.message || 'Unbekannter Fehler'}`); 
    } finally { 
      setLoading(false); 
    }
  };

  // --- MASKE 1: Eingabe ---
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-purple-500 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <h2 className="text-3xl font-extrabold mb-4 text-center bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Hyphen Test-Tool
          </h2>
          <p className="text-gray-400 text-center mb-6 text-sm">
            Schritt 1: Gib deinen Namen ein, um die Supabase-Verbindung und die Key-Generierung zu testen.
          </p>
          
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <input 
            type="text" 
            placeholder="Dein Anzeigename" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            className="w-full p-4 rounded-xl bg-gray-900 text-white mb-6 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700" 
          />
          
          <button 
            onClick={handleRegister} 
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-400 font-bold py-4 rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" 
          >
            {loading ? 'Verarbeite...' : 'Jetzt testen 🚀'}
          </button>
        </div>
      </div>
    );
  }

  // --- MASKE 2: Erfolg & Key-Anzeige ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white font-sans flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-green-500 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2 text-green-400">Registrierung erfolgreich!</h2>
        <p className="text-gray-400 mb-6 text-sm">
          Die Verbindung zu Supabase steht. Der Name wurde gespeichert und der Key generiert.
        </p>

        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 p-6 rounded-xl shadow-2xl border border-purple-400/30 mb-6">
          <div className="text-xs opacity-80 mb-1 uppercase tracking-widest">Dein Support-Schlüssel:</div>
          <div className="text-3xl font-mono font-black tracking-wider mb-2">{supportKey}</div>
          <div className="text-base font-bold bg-black/20 py-2 px-4 rounded-xl">
            Gib Hyphen diesen Schlüssel – der Geist im Hintergrund hilft. 👻
          </div>
        </div>

        <div className="text-left bg-gray-900 p-4 rounded-lg text-xs font-mono text-gray-400 break-all mb-6">
          <p><span className="text-purple-400">User ID:</span> {userId}</p>
          <p><span className="text-purple-400">Name:</span> {username}</p>
        </div>

        <button 
          onClick={() => {
            setStep(1);
            setUsername('');
            setUserId(null);
            setSupportKey(null);
          }}
          className="w-full bg-gray-700 hover:bg-gray-600 font-bold py-3 rounded-xl transition-all" 
        >
          Test wiederholen
        </button>
      </div>
    </div>
  );
}