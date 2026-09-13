export default async function Home() {
  const BACKEND_URL = "https://football-ai-backend-production-0f95.up.railway.app";

  let spiele = [];
  
  try {
    const res = await fetch(`${BACKEND_URL}/api/test`, { cache: 'no-store' });
    const data = await res.json();
    
    if (data.data && data.data.response) {
      spiele = data.data.response;
    }
  } catch (error) {
    console.error("Fehler beim Laden:", error);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-8 text-green-400">⚽ Football AI Kumpel-Tipp</h1>
      
      <div className="w-full max-w-2xl bg-gray-800 p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">
          Aktuelles Spiel (API-Test)
        </h2>
        
        {spiele.length > 0 ? (
          spiele.map((match: any, index: number) => (
            <div key={index} className="mb-4 p-4 bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center text-xl font-bold">
                <span>{match.teams.home.name}</span>
                <span className="text-green-400 text-2xl">
                  {match.goals.home} : {match.goals.away}
                </span>
                <span>{match.teams.away.name}</span>
              </div>
              <p className="text-gray-400 text-sm mt-2 text-center">
                {match.fixture.date} • {match.fixture.venue.name}
              </p>
            </div>
          ))
        ) : (
          <p className="text-gray-400">Keine Spiele gefunden oder Backend noch nicht erreichbar.</p>
        )}
      </div>

      <p className="mt-8 text-gray-500">
        Backend läuft auf Railway • Frontend läuft auf Vercel
      </p>
    </main>
  );
}