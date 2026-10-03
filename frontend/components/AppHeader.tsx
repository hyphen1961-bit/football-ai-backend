'use client';

// Ablegen unter: components/AppHeader.tsx (ersetzt die bisherige Datei)

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { useKumpel } from '@/contexts/KumpelProvider';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  brand?: boolean; // true = Markenauftritt "Hyphen" (nur Startseite)
}

// Wechselnde Zeilen unter dem Markennamen: der Bindestrich verbindet
const BRAND_LINES: string[][] = [
  ['Verein', 'Familie', 'Spiel'],
  ['Kind', 'Eltern', 'Trainer'],
  ['Tipp', 'Mensch', 'KI'],
  ['Heim', 'Gast', 'Gemeinschaft'],
];

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

export default function AppHeader({ title, subtitle, backHref, brand = false }: AppHeaderProps) {
  const { kumpel } = useKumpel();
  const [path, setPath] = useState<{ x1: number; y1: number; x2: number; y2: number; x3: number; y3: number; dur: number } | null>(null);
  const [lineIdx, setLineIdx] = useState(0);

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

  // Wechselnde Zeile nur im Markenauftritt
  useEffect(() => {
    if (!brand) return;
    const t = setInterval(() => setLineIdx((i) => (i + 1) % BRAND_LINES.length), 3600);
    return () => clearInterval(t);
  }, [brand]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#1c1c1a] pt-5 pb-8 px-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        {backHref ? (
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white bg-[#2a2a27] rounded-full pl-2.5 pr-3.5 py-1.5 flex-shrink-0"
          >
            <span aria-hidden="true">&larr;</span> Start
          </Link>
        ) : (
          <span />
        )}
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

        {brand ? (
          <>
            <h1 className="hyphen-wordmark" aria-label={title}>
              <span aria-hidden="true">{title.slice(0, 2)}</span>
              <span aria-hidden="true" className="hyphen-glowdash" />
              <span aria-hidden="true">{title.slice(2)}</span>
            </h1>
            <p key={lineIdx} className="hyphen-tagline text-sm text-slate-300 mt-3">
              {BRAND_LINES[lineIdx].map((word, i) => (
                <span key={word}>
                  {i > 0 && <span className="hyphen-dash">–</span>}
                  {word}
                </span>
              ))}
            </p>
            {subtitle && <p className="text-xs text-slate-500 mt-3">{subtitle}</p>}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-wide text-white">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
          </>
        )}
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

        .hyphen-wordmark {
          font-size: clamp(2.4rem, 11vw, 3.4rem);
          font-weight: 900;
          font-style: italic;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          line-height: 1.05;
          padding-right: 0.08em;
          background: linear-gradient(180deg, #ffe7ae 0%, #fac775 42%, #e8a33d 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          filter: drop-shadow(0 0 14px rgba(250, 199, 117, 0.3));
        }
        .hyphen-glowdash {
          display: inline-block;
          width: 0.42em;
          height: 0.11em;
          margin: 0 0 0 0.22em;
          vertical-align: 0.37em;
          border-radius: 9999px;
          background: #ffe7ae;
          transform: skewX(-14deg);
          box-shadow: 0 0 10px 2px rgba(250, 199, 117, 0.9), 0 0 24px 6px rgba(250, 199, 117, 0.45);
          animation: dash-glow 2.8s ease-in-out infinite;
        }
        @keyframes dash-glow {
          0%, 100% { box-shadow: 0 0 8px 1px rgba(250, 199, 117, 0.7), 0 0 18px 4px rgba(250, 199, 117, 0.3); }
          50% { box-shadow: 0 0 14px 3px rgba(255, 220, 140, 1), 0 0 32px 9px rgba(250, 199, 117, 0.55); }
        }
        .hyphen-tagline {
          animation: tagline-in 0.7s ease both;
        }
        .hyphen-dash {
          color: #fac775;
          font-weight: 700;
          margin: 0 0.55em;
        }
        @keyframes tagline-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hyphen-tagline { animation: none; }
          .hyphen-glowdash { animation: none; }
        }
      `}</style>
    </div>
  );
}
