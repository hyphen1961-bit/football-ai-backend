// frontend/app/ranking/page.tsx
import Link from 'next/link';

// Next.js anweisen, diese Seite immer dynamisch zu rendern (löst den Build-Fehler)
export const dynamic = 'force-dynamic';

const BACKEND_URL = 'https://football-ai-backend-production-0f95.up.railway.app';

interface UserScore {
  username: string;
  total_points: number;
  correct_1x2: number;
  correct_exact_score: number;
  correct_with_deviation: number;
  current_streak: number;
  best_streak: number;
  tips_count: number;
}

async function getRanking(): Promise<UserScore[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/ranking`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error('Fehler beim Laden des Rankings:', error);
    return [];
  }
}

export default async function RankingPage() {
  const ranking = await getRanking();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              🏆 Kumpel-Ranking
            </h1>
            <p className="text-sm text-slate-400 mt-1">Wer tippt am besten?</p>
          </div>
          <Link 
            href="/" 
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
          >
            ← Zurück zu Spielen
          </Link>
        </div>

        {/* Leaderboard Tabelle */}
        {ranking.length > 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-6 py-4">Platz</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4 text-center">Punkte</th>
                  <th className="px-6 py-4 text-center hidden md:table-cell">1X2 Richtig</th>
                  <th className="px-6 py-4 text-center hidden md:table-cell">Exakt</th>
                  <th className="px-6 py-4 text-center hidden md:table-cell">KI-Gegner Bonus</th>
                  <th className="px-6 py-4 text-center">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ranking.map((user, index) => (
                  <tr key={user.username} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-lg">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">{user.username}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 px-3 py-1 rounded-full font-bold">
                        {user.total_points}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-300 hidden md:table-cell">{user.correct_1x2}</td>
                    <td className="px-6 py-4 text-center text-slate-300 hidden md:table-cell">{user.correct_exact_score}</td>
                    <td className="px-6 py-4 text-center text-slate-300 hidden md:table-cell">{user.correct_with_deviation}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-mono ${user.current_streak > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                        {user.current_streak}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">(Best: {user.best_streak})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-xl font-bold text-white mb-2">Noch keine Tipps abgegeben</h2>
            <p className="text-slate-400">
              Sobald deine Kumpels ihre ersten Tipps abgeben und Spiele ausgewertet werden, erscheint hier das Leaderboard.
            </p>
            <Link 
              href="/" 
              className="inline-block mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold transition-all"
            >
              Jetzt Tipps abgeben
            </Link>
          </div>
        )}

        {/* Punkte-Regeln Erklärung */}
        <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">📜 So werden Punkte vergeben:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="flex items-center gap-3">
              <span className="bg-slate-800 px-3 py-1 rounded font-mono text-yellow-400">+3</span>
              <span>Richtiger 1X2-Tipp (Sieger/Unentschieden)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-slate-800 px-3 py-1 rounded font-mono text-yellow-400">+10</span>
              <span>Exaktes Ergebnis richtig (z.B. 2:1)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-slate-800 px-3 py-1 rounded font-mono text-yellow-400">+5</span>
              <span>Bonus: Gegen die KI getippt & trotzdem richtig!</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-slate-800 px-3 py-1 rounded font-mono text-orange-400">🔥</span>
              <span>Streak: Zählt richtige Tipps in Folge</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}