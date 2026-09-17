// app/page.tsx
import MatchList from '@/components/MatchList';
import { Match } from '@/types/match';

// Backend-URL aus deinen Umgebungsvariablen oder hartkodiert für den Test
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://football-ai-backend-production-0f95.up.railway.app';

async function getMatches(): Promise<Match[]> {
  try {
    // HINWEIS: Idealerweise hast du einen Endpoint, der Matches + Analysis joined.
    // Falls nicht, holen wir hier erst die Matches und dann die Analysen (oder du passt den Endpoint an).
    // Für diesen Prototyp gehen wir von einem hypothetischen, sauberen Endpoint aus:
    const res = await fetch(`${BACKEND_URL}/matches/with-analysis`, {
      next: { revalidate: 60 }, // Cache für 60 Sekunden
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch matches');
    }
    
    return await res.json();
  } catch (error) {
    console.error('Fehler beim Laden der Spiele:', error);
    return []; // Fallback: Leeres Array, damit die UI nicht crasht
  }
}

export default async function HomePage() {
  const matches = await getMatches();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
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
            <p className="text-xs text-green-400">● Backend verbunden</p>
          </div>
        </div>
      </header>

      {/* Hauptinhalt */}
      <div className="py-8">
        {matches.length > 0 ? (
          <MatchList matches={matches} />
        ) : (
          <div className="max-w-4xl mx-auto p-8 text-center">
            <div className="animate-pulse text-slate-500">
              Lade Spiele und KI-Analysen...
            </div>
          </div>
        )}
      </div>
    </main>
  );
}