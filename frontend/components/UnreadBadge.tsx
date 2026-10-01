'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Roter Zähler oben rechts in einer Kachel (Elternelement braucht "relative")
export default function UnreadBadge() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.rpc('get_unread_counts');
      if (error || !active) return;
      const rows = (data as { unread_count: number }[]) || [];
      setTotal(rows.reduce((sum, r) => sum + Number(r.unread_count), 0));
    }

    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (total <= 0) return null;

  return (
    <span className="absolute top-3 right-3 min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
      {total > 99 ? '99+' : total}
    </span>
  );
}
