'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Kumpel {
  id: string;
  username: string;
}

interface KumpelContextValue {
  kumpel: Kumpel | null;
  loading: boolean;
}

const KumpelContext = createContext<KumpelContextValue>({ kumpel: null, loading: true });

export function useKumpel() {
  return useContext(KumpelContext);
}

export function KumpelProvider({ children }: { children: ReactNode }) {
  const [kumpel, setKumpel] = useState<Kumpel | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsName, setNeedsName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      .select('id, username')
      .eq('id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Fehler beim Laden des Kumpel-Profils:', fetchError.message);
    }

    if (existing?.username) {
      setKumpel({ id: existing.id, username: existing.username });
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

    const { error } = await supabase
      .from('users')
      .upsert({ id: session.user.id, username: trimmed }, { onConflict: 'id' });

    if (error) {
      setSaveError('Konnte den Namen nicht speichern: ' + error.message);
      setSaving(false);
      return;
    }

    setKumpel({ id: session.user.id, username: trimmed });
    setNeedsName(false);
    setSaving(false);
  }

  // Erst-Setup läuft noch (anonyme Session wird erstellt / Profil geladen)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Lade...
      </div>
    );
  }

  // Einmalige Namensabfrage beim allerersten Besuch
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

  return (
    <KumpelContext.Provider value={{ kumpel, loading }}>
      {children}
    </KumpelContext.Provider>
  );
}
