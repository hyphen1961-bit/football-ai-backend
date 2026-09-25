'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Kumpel {
  id: string;
  username: string;
  displayName: string;
  hyphenKey: string;
}

interface KumpelContextValue {
  kumpel: Kumpel | null;
  loading: boolean;
}

const KumpelContext = createContext<KumpelContextValue>({ kumpel: null, loading: true });

export function useKumpel() {
  return useContext(KumpelContext);
}

function generateHyphenKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `Hyphen-${code}`;
}

export function KumpelProvider({ children }: { children: ReactNode }) {
  const [kumpel, setKumpel] = useState<Kumpel | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsName, setNeedsName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);

    let { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error('Anonyme Anmeldung fehlgeschlagen:', error.message);
        setLoading(false);
        return;
      }
      session = data.session;
    }

    if (!session) {
      setLoading(false);
      return;
    }

    const { data: existing, error: fetchError } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Fehler beim Laden des Kumpel-Profils:', fetchError.message);
    }

    if (existing?.username) {
      setKumpel({
        id: existing.id,
        username: existing.username,
        displayName: existing.display_name || existing.username,
        hyphenKey: existing.avatar_url || '',
      });
    } else {
      setNeedsName(true);
    }

    setLoading(false);
  }

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    setSaving(true);
    setSaveError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSaveError('Keine Session gefunden. Bitte Seite neu laden.');
      setSaving(false);
      return;
    }

    const hyphenKey = generateHyphenKey();

    const { error } = await supabase
      .from('users')
      .upsert(
        { id: session.user.id, username: trimmed, display_name: trimmed, avatar_url: hyphenKey },
        { onConflict: 'id' }
      );

    if (error) {
      setSaveError('Konnte den Namen nicht speichern: ' + error.message);
      setSaving(false);
      return;
    }

    setKumpel({ id: session.user.id, username: trimmed, displayName: trimmed, hyphenKey });
    setNeedsName(false);
    setSaving(false);
    setJustRegistered(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Lade...
      </div>
    );
  }

  if (needsName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full">
          <h2 className="text-lg font-bold text-white mb-2">Willkommen! Wie heisst du?</h2>
          <p className="text-sm text-slate-400 mb-4">
            Dein Kumpel-Name erscheint auf der Rangliste. Du wirst nicht mehr danach gefragt.
          </p>
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            placeholder="z.B. Urs, Klaus, Michael"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white mb-3 focus:outline-none focus:border-indigo-500"
          />
          {saveError && <p className="text-red-400 text-sm mb-3">{saveError}</p>}
          <button
            onClick={handleSaveName}
            disabled={saving || !nameInput.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-3 rounded-lg transition-all"
          >
            {saving ? 'Speichern...' : 'Los geht\'s'}
          </button>
        </div>
      </div>
    );
  }

  // Einmalige Erfolgs-Anzeige direkt nach der Registrierung
  if (justRegistered && kumpel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="text-xs opacity-80 mb-1 uppercase tracking-widest">Dein Support-Schlüssel:</div>
          <div className="text-3xl font-mono font-black tracking-wider mb-3">{kumpel.hyphenKey}</div>
          <div className="text-sm font-bold bg-black/20 py-2 px-4 rounded-xl mb-6">
            Gib Hyphen diesen Schlüssel – der Geist im Hintergrund hilft. 👻
          </div>
          <button
            onClick={() => setJustRegistered(false)}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-lg transition-all"
          >
            Weiter zur App
          </button>
        </div>
      </div>
    );
  }

  return (
    <KumpelContext.Provider value={{ kumpel, loading }}>
      {children}
    </KumpelContext.Provider>
  );
}