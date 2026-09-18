// frontend/app/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import MatchList from '@/components/MatchList';

const BACKEND_URL = 'https://football-ai-backend-production-0f95.up.railway.app';

interface Match {
  api_fixture_id: number;
  league_id: number;
  league_name: string;
  home_team_name: string;
  away_team_name: string;
  kickoff_time: string;
  status: string;
  home_score?: number;
  away_score?: number;
  analysis?: {
    confidence_score: number;
    ai_prediction: string;
  };
}

interface UserTip {
  api_fixture_id: number;
  predicted_winner: string;
  tip_over_under?: string;
  tip_btts?: string;
}

export default function HomePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [userTips, setUserTips] = useState<UserTip[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'finished'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Spiele laden
      const matchesRes = await fetch(`${BACKEND_URL}/matches`);
      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        setMatches(matchesData);
      }

      // User-Tipps laden (für Urs)
      const tipsRes = await fetch(`${BACKEND_URL}/tips/Urs`);
      if (tipsRes.ok) {
        const tipsData = await tipsRes.json();
        setUserTips(tipsData);
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gefilterte Spiele für jeden Tab
  const getFilteredMatches = () => {
    const now = new Date();

    switch (activeTab) {
      case 'active':
        // Nur zukünftige Spiele, bei denen der User einen Tipp hat
        return matches.filter(match => {
          const kickoff = new Date(match.kickoff_time);
          const hasTip = userTips.some(tip => tip.api_fixture_id === match.api_fixture_id);
          return kickoff > now && hasTip;
        });

      case 'finished':
        // Nur vergangene Spiele, bei denen der User einen Tipp hat
        return matches.filter(match => {
          const kickoff = new Date(match.kickoff_time);
          const hasTip = userTips.some(tip => tip.api_fixture_id === match.api_fixture_id);
          return kickoff < now && hasTip;
        });

      default:
        // Alle Spiele
        return matches;
    }
  };

  const filteredMatches = getFilteredMatches();

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚽</div>
          <p className="text-xl font-bold">Lade Spiele...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
              FOOTBALL AI KUMPEL-TIPP
            </h1>
            <p className="text-sm text-slate-400">KI-gestützte Wett-Community</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-white">Willkommen, Urs</p>
              <p className="text-xs text-slate-400">{matches.length} Spiele geladen</p>
            </div>
            <Link 
              href="/ranking" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
            >
              🏆 Ranking
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex gap-2 mb-6 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 font-bold transition-all ${
              activeTab === 'all'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Alle Spiele ({matches.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 font-bold transition-all ${
              activeTab === 'active'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Meine aktiven Tipps ({getFilteredMatches().length})
          </button>
          <button
            onClick={() => setActiveTab('finished')}
            className={`px-6 py-3 font-bold transition-all ${
              activeTab === 'finished'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Abgeschlossene Tipps ({getFilteredMatches().length})
          </button>
        </div>

        {/* Content */}
        {filteredMatches.length > 0 ? (
          <MatchList matches={filteredMatches} />
        ) : (
          <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-6xl mb-4">
              {activeTab === 'active' ? '⏳' : activeTab === 'finished' ? '✅' : '🔍'}
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {activeTab === 'active' && 'Keine aktiven Tipps'}
              {activeTab === 'finished' && 'Keine abgeschlossenen Tipps'}
              {activeTab === 'all' && 'Keine Spiele gefunden'}
            </h2>
            <p className="text-slate-400">
              {activeTab === 'active' && 'Du hast noch keine Tipps für zukünftige Spiele abgegeben.'}
              {activeTab === 'finished' && 'Du hast noch keine Tipps für vergangene Spiele abgegeben.'}
              {activeTab === 'all' && 'Es sind keine Spiele in der Datenbank.'}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}