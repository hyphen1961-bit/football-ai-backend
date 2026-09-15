'use client';

import { useState, useEffect } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://football-ai-backend-production.up.railway.app';

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const response = await fetch(`${BACKEND_URL}/api/matches?limit=10`);
        if (!response.ok) {
          throw new Error('Failed to fetch matches');
        }
        const data = await response.json();
        setMatches(data.matches || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMatches();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Lade Spiele...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-red-500">Fehler: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold text-center mb-8">
        ⚽ Football AI Kumpel-Tipp
      </h1>
      
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Aktuelle Spiele</h2>
        
        {matches.length === 0 ? (
          <p className="text-gray-400">Keine Spiele gefunden oder Backend noch nicht erreichbar.</p>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <div key={match.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{match.home_team}</span>
                  <span className="text-gray-400">vs</span>
                  <span className="font-semibold">{match.away_team}</span>
                </div>
                <div className="text-sm text-gray-400 mt-2">
                  {new Date(match.kickoff_time).toLocaleString('de-DE')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <footer className="text-center text-gray-500 mt-12">
        Backend läuft auf Railway • Frontend läuft auf Vercel
      </footer>
    </div>
  );
}