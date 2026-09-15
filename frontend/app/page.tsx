'use client';

import { useState, useEffect } from 'react';

// Typ-Definition für ein Match (sagt TypeScript, wie die Daten aussehen)
interface Match {
  id: number;
  api_match_id: number;
  league: string;
  season: number;
  matchday: number | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
  status: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://football-ai-backend-production.up.railway.app';

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const response = await fetch(`${BACKEND_URL}/api/matches?limit=20`);
        if (!response.ok) {
          throw new Error('Failed to fetch matches');
        }
        const data = await response.json();
        setMatches(data.matches || []);
      } catch (err: any) {
        setError(err.message || 'Unbekannter Fehler');
      } finally {
        setLoading(false);
      }
    }

    fetchMatches();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-xl">⚽ Lade Spiele...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">❌ Fehler: {error}</p>
          <p className="text-gray-400">Backend URL: {BACKEND_URL}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold text-center mb-8">
        ⚽ Football AI Kumpel-Tipp
      </h1>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">
          Bundesliga Spiele ({matches.length})
        </h2>

        {matches.length === 0 ? (
          <p className="text-gray-400">Keine Spiele gefunden.</p>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">{match.home_team}</span>
                  <span className="text-gray-400 mx-4">vs</span>
                  <span className="font-semibold text-lg">{match.away_team}</span>
                </div>
                <div className="text-sm text-gray-400 mt-2">
                  📅 {new Date(match.kickoff_time).toLocaleString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  <span className="ml-4 px-2 py-1 bg-gray-700 rounded text-xs">
                    {match.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="text-center text-gray-500 mt-12 text-sm">
        Backend läuft auf Railway • Frontend läuft auf Vercel
      </footer>
    </div>
  );
}