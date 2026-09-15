// app/page.tsx (Next.js App Router)
export const dynamic = 'force-dynamic'; // Verhindert Caching, damit wir immer frische Daten sehen

interface Match {
  id: string;
  api_fixture_id: number;
  home_team_name: string;
  away_team_name: string;
  kickoff_time: string;
  status: string;
}

interface Analysis {
  api_fixture_id: number;
  ai_prediction: string;
  confidence_score: number;
  context_notes: string;
}

export default async function Home() {
  // 1. Spiele von deinem Railway Backend holen
  const matchesRes = await fetch('https://football-ai-backend-production-0f95.up.railway.app/matches', {
    cache: 'no-store'
  });
  const matches: Match[] = await matchesRes.json();

  // 2. Für jedes Spiel die KI-Analyse holen (parallel für Geschwindigkeit)
  const matchesWithAnalysis = await Promise.all(
    matches.map(async (match) => {
      try {
        const analysisRes = await fetch(`https://football-ai-backend-production-0f95.up.railway.app/analysis/${match.api_fixture_id}`, {
          cache: 'no-store'
        });
        const analysis: Analysis = await analysisRes.json();
        return { ...match, analysis };
      } catch (error) {
        return { ...match, analysis: null }; // Falls noch keine Analyse existiert
      }
    })
  );

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 Football AI Kumpel-Tipp</h1>
        <p className="text-gray-600 mb-8">Deine persönliche KI für den perfekten Sporttipp.</p>

        <div className="space-y-4">
          {matchesWithAnalysis.length === 0 ? (
            <p className="text-gray-500">Noch keine Spiele in der Datenbank. Lass uns welche analysieren!</p>
          ) : (
            matchesWithAnalysis.map((item) => {
              const hasAnalysis = item.analysis !== null;
              const score = item.analysis?.confidence_score || 0;
              const prediction = item.analysis?.ai_prediction || 'Unbekannt';
              
              // Farbe basierend auf Confidence Score
              const scoreColor = score >= 70 ? 'bg-green-100 text-green-800 border-green-200' : 
                                 score >= 50 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                                 'bg-red-100 text-red-800 border-red-200';

              return (
                <div key={item.id} className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {item.home_team_name} vs {item.away_team_name}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(item.kickoff_time).toLocaleDateString('de-DE', { 
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                        })}
                      </p>
                    </div>
                    
                    {hasAnalysis ? (
                      <div className={`px-4 py-2 rounded-full border text-center ${scoreColor}`}>
                        <div className="text-xs font-bold uppercase tracking-wide">KI Tipp</div>
                        <div className="text-2xl font-black">{prediction}</div>
                        <div className="text-sm font-semibold">{score}% Confidence</div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 italic">
                        Noch keine KI-Analyse
                      </div>
                    )}
                  </div>

                  {hasAnalysis && item.analysis?.context_notes && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-600">
                        💡 <span className="font-medium">KI-Notiz:</span> {item.analysis.context_notes}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}