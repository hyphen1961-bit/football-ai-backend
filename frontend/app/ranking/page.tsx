'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useKumpel } from '@/contexts/KumpelProvider';
import AppHeader from '@/components/AppHeader';

interface ScoreRow {
  user_id: string;
  username: string;
  total_points: number;
  correct_1x2: number;
  correct_exact_score: number;
  correct_with_deviation: number;
  tips_count: number;
}

type View = 'alle' | 'einzel';

export default function RankingPage() {
  const { kumpel } = useKumpel();
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('alle');

  useEffect(() => {
    async function loadScores() {
      const { data, error } = await supabase
        .from('user_scores')
        .select('user_id, username, total_points, correct_1x2, correct_exact_score, correct_with_deviation, tips_count')
        .order('total_points', { ascending: false });

      if (error) {
        console.error('Fehler beim Laden der Rangliste:', error.message);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    }
    loadScores();
  }, []);

  const ownIndex = kumpel ? rows.findIndex((r) => r.user_id === kumpel.id) : -1;
  const ownRow = ownIndex >= 0 ? rows[ownIndex] : null;

  return (
    <div className="min-h-screen bg-[#141412] text-white font-sans pb-12">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <AppHeader title="Rangliste" subtitle="Wer tippt am besten?" backHref="/" />

        <div className="bg-[#1c1c1a] rounded-xl p-5">
          <div className="flex justify-center mb-5">
            <div className="flex items-center gap-1 bg-[#2a2a27] border border-[#444441] rounded-full h-[38px] p-1">
              <button
                type="button"
                onClick={() => setView('einzel')}
                className="h-full px-5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: view === 'einzel' ? '#FAC775' : 'transparent',
                  color: view === 'einzel' ? '#412402' : '#94a3b8',
                }}
              >
                Einzel
              </button>
              <button
                type="button"
                onClick={() => setView('alle')}
                className="h-full px-5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: view === 'alle' ? '#FAC775' : 'transparent',
                  color: view === 'alle' ? '#412402' : '#94a3b8',
                }}
              >
                Alle
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-slate-500 text-sm py-8">Lade Rangliste...</p>
          ) : view === 'einzel' ? (
            ownRow ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="text-sm text-slate-400">Dein Platz</div>
                <div className="text-4xl font-bold text-white">
                  {ownIndex === 0 ? '🥇' : ownIndex === 1 ? '🥈' : ownIndex === 2 ? '🥉' : `#${ownIndex + 1}`}
                </div>
                <div className="bg-amber-300 text-[#412402] rounded-full w-16 h-16 flex flex-col items-center justify-center leading-tight">
                  <span className="text-xl font-bold">{ownRow.total_points}</span>
                  <span className="text-[9px]">Pkt.</span>
                </div>
                <div className="text-white font-medium">{ownRow.username}</div>

                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                  <div className="bg-[#2a2a27] rounded-xl p-4 text-center">
                    <p className="text-2xl font-semibold text-white">{ownRow.correct_1x2}</p>
                    <p className="text-xs text-slate-500 mt-1">1X2 richtig</p>
                  </div>
                  <div className="bg-[#2a2a27] rounded-xl p-4 text-center">
                    <p className="text-2xl font-semibold text-white">{ownRow.correct_exact_score}</p>
                    <p className="text-xs text-slate-500 mt-1">Exakt richtig</p>
                  </div>
                  <div className="bg-[#2a2a27] rounded-xl p-4 text-center">
                    <p className="text-2xl font-semibold text-white">{ownRow.correct_with_deviation}</p>
                    <p className="text-xs text-slate-500 mt-1">Kontra-KI-Bonus</p>
                  </div>
                  <div className="bg-[#2a2a27] rounded-xl p-4 text-center">
                    <p className="text-2xl font-semibold text-white">{ownRow.tips_count}</p>
                    <p className="text-xs text-slate-500 mt-1">Tipps abgegeben</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-slate-500 text-sm py-8">
                Noch keine ausgewerteten Tipps &mdash; sobald ein Spiel beendet ist, erscheint deine Statistik hier.
              </p>
            )
          ) : rows.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">Noch keine ausgewerteten Tipps.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((r, i) => (
                <div
                  key={r.user_id}
                  className="flex items-center justify-between bg-[#2a2a27] rounded-xl px-4 py-3"
                  style={kumpel && r.user_id === kumpel.id ? { border: '1px solid #FAC775' } : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg w-7 text-center flex-shrink-0">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <span className="text-white font-medium truncate">{r.username}</span>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="hidden md:inline text-xs text-slate-500">{r.tips_count} Tipps</span>
                    <span className="bg-amber-300 text-[#412402] rounded-full px-3 py-1 text-sm font-semibold">
                      {r.total_points} Pkt.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
