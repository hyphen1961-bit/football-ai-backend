// frontend/app/page.tsx
import MatchList from '@/components/MatchList';
import { Match } from '@/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://football-ai-backend-production-0f95.up.railway.app';

async function getMatches(): Promise<Match[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/matches`, {
      cache: 'no-store',
    });
    
    if (!res.ok) {
      console.error('❌ Backend Fehler:', res.status);
      return []; 
    }
    
    const data = await res.json();
    
    // DEBUG: Zeig mir genau, was das Backend liefert!
    console.log('🔍 DEBUG - Rohdaten vom Backend:', JSON.stringify(data, null, 2));
    
    if (Array.isArray(data)) {
      // DEBUG: Zeig mir das erste Spiel im Detail
      if (data.length > 0) {
        console.log('🔍 DEBUG - Erstes Spiel:', data[0]);
        console.log('🔍 DEBUG - league_id Typ:', typeof data[0].league_id, 'Wert:', data[0].league_id);
      }
      return data;
    }
    
    return [];
  } catch (error) {
    console.error('💥 Fetch Fehler:', error);
    return []; 
  }
}

export default async function HomePage() {
  const matches = await getMatches();

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
            <p className="text-slate-400">Keine Spiele gefunden.</p>
          </div>
        )}
      </div>
    </main>
  );
}