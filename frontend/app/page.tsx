// frontend/app/page.tsx
import MatchList from '@/components/MatchList';
import { Match } from '@/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://football-ai-backend-production-0f95.up.railway.app';

async function getMatches(): Promise<Match[]> {
  try {
    console.log('🔄 Hole Spiele von:', `${BACKEND_URL}/matches`);
    
    const res = await fetch(`${BACKEND_URL}/matches`, {
      cache: 'no-store', // Immer frische Daten beim Build
    });
    
    if (!res.ok) {
      console.error('❌ Backend Fehler:', res.status, res.statusText);
      return []; 
    }
    
    const data = await res.json();
    console.log('📦 Backend Antwort:', JSON.stringify(data).substring(0, 200));
    
    // Fall 1: Backend gibt direkt ein Array zurück
    if (Array.isArray(data)) {
      return data;
    }
    
    // Fall 2: Backend gibt ein Objekt mit "data" oder "matches" Feld zurück
    if (data && typeof data === 'object') {
      if (Array.isArray(data.data)) return data.data;
      if (Array.isArray(data.matches)) return data.matches;
    }
    
    console.warn('️ Unerwartetes Datenformat:', typeof data);
    return [];
    
  } catch (error) {
    console.error('💥 Fetch Fehler:', error);
    return []; 
  }
}

export default async function HomePage() {
  const matches = await getMatches();
  
  console.log('✅ Matches geladen:', matches.length, 'Spiele');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              FOOTBALL AI KUMPEL-TIPP
            </h1>
            <p className="text-xs text-slate-400">KI-gestützte Wett-Community</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-white">Willkommen, Urs</p>
            <p className="text-xs text-green-400">● {matches.length} Spiele geladen</p>
          </div>
        </div>
      </header>

      <div className="py-8">
        {matches.length > 0 ? (
          <MatchList matches={matches} />
        ) : (
          <div className="max-w-4xl mx-auto p-8 text-center">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-8">
              <h2 className="text-xl font-bold text-white mb-4">Noch keine Spiele verfügbar</h2>
              <p className="text-slate-400 mb-6">
                Das Backend läuft, aber es wurden noch keine Spiele geladen.
              </p>
              <div className="text-sm text-slate-500 space-y-2">
                <p>📡 Backend URL: {BACKEND_URL}</p>
                <p>🔍 Prüfe: {BACKEND_URL}/matches</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}