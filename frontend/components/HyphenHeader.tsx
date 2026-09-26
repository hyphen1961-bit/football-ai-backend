'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useKumpel } from '@/contexts/KumpelProvider';

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

export default function HyphenHeader() {
  const { kumpel } = useKumpel();
  const [path, setPath] = useState<{ x1: number; y1: number; x2: number; y2: number; x3: number; y3: number; dur: number } | null>(null);

  useEffect(() => {
    setPath({
      x1: rand(-5, 15),
      y1: rand(-30, 30),
      x2: rand(35, 65),
      y2: rand(-45, 45),
      x3: rand(85, 105),
      y3: rand(-30, 30),
      dur: rand(5, 9),
    });
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#1c1c1a] pt-5 pb-8 px-6 mb-6">
      <div className="flex items-center justify-end mb-4">
        {kumpel && (
          <div className="flex items-center gap-2 bg-[#2a2a27] rounded-full pl-1 pr-3 py-1 flex-shrink-0">
            <span className="w-5 h-5 rounded-full bg-[#F09595] text-[#501313] text-[10px] font-medium flex items-center justify-center">
              {kumpel.displayName?.[0]?.toUpperCase() || '?'}
            </span>
            <span className="text-xs text-white">{kumpel.displayName}</span>
            <span className="text-[11px] text-slate-500">{kumpel.hyphenKey}</span>
          </div>
        )}
      </div>

      <div className="text-center">
        {path && (
          <div
            className="relative h-4 mb-4"
            style={{
              '--x1': `${path.x1}%`, '--y1': `${path.y1}px`,
              '--x2': `${path.x2}%`, '--y2': `${path.y2}px`,
              '--x3': `${path.x3}%`, '--y3': `${path.y3}px`,
            } as CSSProperties}
          >
            <span className="hyphen-dot" style={{ width: 6, height: 6, animationDuration: `${path.dur}s` }} />
            <span className="hyphen-dot" style={{ width: 4, height: 4, opacity: 0.5, animationDuration: `${path.dur}s`, animationDelay: '-0.15s' }} />
            <span className="hyphen-dot" style={{ width: 3, height: 3, opacity: 0.3, animationDuration: `${path.dur}s`, animationDelay: '-0.3s' }} />
            <span className="hyphen-dot" style={{ width: 2, height: 2, opacity: 0.15, animationDuration: `${path.dur}s`, animationDelay: '-0.45s' }} />
          </div>
        )}

        <h1 className="text-2xl font-bold tracking-wide text-white">
          Spielplan <span className="text-amber-400">&ndash;</span> Vorhersagen
        </h1>
        <p className="text-xs text-slate-500 mt-2">Hyphen findet seinen Weg</p>
      </div>

      <style jsx>{`
        .hyphen-dot {
          position: absolute;
          border-radius: 9999px;
          background: #fbbf24;
          left: 0;
          top: 0;
          animation-name: fly;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes fly {
          0% { left: var(--x1); transform: translateY(var(--y1)); }
          50% { left: var(--x2); transform: translateY(var(--y2)); }
          100% { left: var(--x3); transform: translateY(var(--y3)); }
        }
      `}</style>
    </div>
  );
}
