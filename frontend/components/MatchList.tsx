'use client';

import { useState, useEffect } from 'react';
import MatchList from '@/components/MatchList';
import { Match } from '@/types';

const API_URL = 'https://football-ai-backend-production-a405.up.railway.app';

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMatches() {
      try {
        const res = await fetch(`${API_URL}/matches`);
        const data = await res.json();
        setMatches(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-2xl font-bold animate-pulse">Meister Tianzi ordnet die Fussball-Kette...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white font-sans pb-12">
      {matches.length === 0 ? (
        <div className="text-center text-slate-400 py-12">Keine aktiven Spiele geladen.</div>
      ) : (
        <MatchList matches={matches} />
      )}
    </div>
  );
}