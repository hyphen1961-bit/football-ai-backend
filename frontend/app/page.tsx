// Ablegen unter: app/page.tsx (ersetzt die bisherige Startseite)

import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import UnreadBadge from '@/components/UnreadBadge';

export default function StartPage() {
  return (
    <div className="min-h-screen bg-[#141412] text-white font-sans pb-12">
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <AppHeader brand title="Hyphen" subtitle="Was möchtest du tun?" />

        <div className="flex flex-col gap-3">
          <Link
            href="/spiele-wetten"
            className="block rounded-xl p-6 transition-transform active:scale-[0.99]"
            style={{ background: 'linear-gradient(90deg, #633806, #412402)' }}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">⚽</span>
              <div>
                <p className="text-lg font-semibold text-white">Spiele &amp; Wetten</p>
                <p className="text-sm" style={{ color: '#EF9F27' }}>Spielplan ansehen und tippen</p>
              </div>
            </div>
          </Link>

          <Link
            href="/ranking"
            className="block rounded-xl p-6 transition-transform active:scale-[0.99]"
            style={{ background: 'linear-gradient(90deg, #712B13, #4A1B0C)' }}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🏆</span>
              <div>
                <p className="text-lg font-semibold text-white">Rangliste</p>
                <p className="text-sm" style={{ color: '#F0997B' }}>Wer tippt am besten?</p>
              </div>
            </div>
          </Link>

          <Link
            href="/gruppen"
            className="relative block rounded-xl p-6 transition-transform active:scale-[0.99]"
            style={{ background: 'linear-gradient(90deg, #0B4A3F, #082E27)' }}
          >
            <UnreadBadge />
            <div className="flex items-center gap-4">
              <span className="text-3xl">👥</span>
              <div>
                <p className="text-lg font-semibold text-white">Gruppen</p>
                <p className="text-sm" style={{ color: '#5FCDB0' }}>Deine Mannschaft oder Freunde</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
