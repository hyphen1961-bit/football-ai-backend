// app/page.tsx
export const dynamic = 'force-dynamic';

interface Match {
  id: string;
  api_fixture_id: number;
  home_team_name: string;
  away_team_name: string;
  kickoff_time: string;
}

interface Analysis {
  api_fixture_id: number;
  ai_prediction: string;
  confidence_score: number;
}

// Server Action, um den Tip p an unser Railway Backend zu senden
async function submitTip(formData: FormData) {
  'use server';
  const kumpelName = formData.get('kumpel_name') as string;
  const fixtureId = formData.get('fixtureId') as string;
  const winner = formData.get('winner') as string;
  const overUnder = formData.get('over_under') as string;
  const btts = formData.get('btts') as string;
  const doubleChance = formData.get('double_chance') as string;
  const exactHome = formData.get('exact_home') as string;
  const exactAway = formData.get('exact_away') as string;

  await fetch('https://football-ai-backend-production-0f95.up.railway.app/tips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: kumpelName || 'Anonym',
      api_fixture_id: parseInt(fixtureId),
      predicted_winner: winner,
      tip_over_under: overUnder || null,
      tip_btts: btts || null,
      tip_double_chance: doubleChance || null,
      tip_exact_score_home: exactHome ? parseInt(exactHome) : null,
      tip_exact_score_away: exactAway ? parseInt(exactAway) : null
    })
  });
}

export default async function Home() {
  const matchesRes = await fetch('https://football-ai-backend-production-0f95.up.railway.app/matches', { cache: 'no-store' });
  const matches: Match[] = await matchesRes.json();

  const matchesWithAnalysis = await Promise.all(
    matches.map(async (match) => {
      try {
        const analysisRes = await fetch(`https://football-ai-backend-production-0f95.up.railway.app/analysis/${match.api_fixture_id}`, { cache: 'no-store' });
        const analysis: Analysis = await analysisRes.json();
        return { ...match, analysis };
      } catch (error) {
        return { ...match, analysis: null };
      }
    })
  );

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 Football AI Kumpel-Tipp</h1>
        <p className="text-gray-600 mb-8">Deine persönliche KI für den perfekten Sporttipp.</p>

        <div className="space-y-6">
          {matchesWithAnalysis.map((item) => {
            const score = item.analysis?.confidence_score || 0;
            const prediction = item.analysis?.ai_prediction || 'Unbekannt';
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
                      {new Date(item.kickoff_time).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {item.analysis && (
                    <div className={`px-4 py-2 rounded-full border text-center ${scoreColor}`}>
                      <div className="text-xs font-bold uppercase tracking-wide">KI Tipp</div>
                      <div className="text-2xl font-black">{prediction}</div>
                      <div className="text-sm font-semibold">{score}% Confidence</div>
                    </div>
                  )}
                </div>

                {/* NEU: Das Tipp-Formular für die Kumpels */}
                <form action={submitTip} className="mt-6 pt-4 border-t border-gray-100">
                  <input type="hidden" name="fixtureId" value={item.api_fixture_id} />
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <input 
                      name="kumpel_name" 
		      autoComplete="off"
                      placeholder="Dein Name (z.B. Urs)" 
                      className="border border-gray-300 rounded px-3 py-2 w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button type="submit" name="winner" value="Home" className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition">
                        {item.home_team_name}
                      </button>
                      <button type="submit" name="winner" value="Draw" className="flex-1 sm:flex-none bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition">
                        Unentschieden
                      </button>
                      <button type="submit" name="winner" value="Away" className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition">
                        {item.away_team_name}
                      </button>
                    </div>
                  </div>
{/* Exaktes Ergebnis */}
<div className="mb-4">
  <label className="block text-sm font-semibold text-gray-700 mb-2">Exaktes Ergebnis:</label>
  <div className="flex gap-2 items-center">
    <select name="exact_home" className="border border-gray-300 rounded px-3 py-2 w-20 focus:outline-none focus:ring-2 focus:ring-blue-500">
      <option value="">-</option>
      <option value="0">0</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
      <option value="4">4</option>
      <option value="5">5+</option>
    </select>
    <span className="text-gray-500 font-bold">:</span>
    <select name="exact_away" className="border border-gray-300 rounded px-3 py-2 w-20 focus:outline-none focus:ring-2 focus:ring-blue-500">
      <option value="">-</option>
      <option value="0">0</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
      <option value="4">4</option>
      <option value="5">5+</option>
    </select>
  </div>
</div>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}