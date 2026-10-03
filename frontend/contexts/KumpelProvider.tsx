'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Kumpel {
  id: string;
  username: string;
  displayName: string;
  hyphenKey: string; // sichtbare Support-ID, KEIN Login-Geheimnis
}

interface KumpelContextValue {
  kumpel: Kumpel | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const KumpelContext = createContext<KumpelContextValue>({
  kumpel: null,
  loading: true,
  logout: async () => {},
});

export function useKumpel() {
  return useContext(KumpelContext);
}

// Support-ID (kurz, sichtbar), wie bisher
function generateHyphenKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `Hyphen-${code}`;
}

// Login-Schlüssel (geheim): 12 Zeichen ohne verwechselbare 0/O/1/I/L, Darstellung K7M4-Q9TD-X2PA
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateLoginKey(): string {
  const out: string[] = [];
  while (out.length < 12) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    for (const b of Array.from(bytes)) {
      if (b < 248 && out.length < 12) out.push(KEY_ALPHABET[b % KEY_ALPHABET.length]);
    }
  }
  const s = out.join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

function normalizeKey(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Aus dem Schlüssel wird eine technische Pseudo-E-Mail (Hash). Es wird nie eine Mail verschickt.
async function emailForKey(normalized: string): Promise<string> {
  const data = new TextEncoder().encode('kumpel-login:' + normalized);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 32)}@kumpel-tipp.app`;
}

type Phase = 'loading' | 'welcome' | 'enterKey' | 'needsName' | 'secureKey' | 'ready';

export function KumpelProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [kumpel, setKumpel] = useState<Kumpel | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [loginKey, setLoginKey] = useState('');
  const [checkInput, setCheckInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const securing = useRef(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setPhase('loading');
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Kein Konto auf diesem Gerät: erst fragen, ob neu oder bestehend (keine stille Neuanlage mehr)
    if (!session) {
      setPhase('welcome');
      return;
    }

    const { data: existing, error: fetchError } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle();

    if (fetchError) console.error('Fehler beim Laden des Kumpel-Profils:', fetchError.message);

    if (!existing?.username) {
      setPhase('needsName');
      return;
    }

    const k: Kumpel = {
      id: existing.id,
      username: existing.username,
      displayName: existing.display_name || existing.username,
      hyphenKey: existing.avatar_url || '',
    };
    setKumpel(k);

    // Bestehendes anonymes Konto: einmalig Schlüssel erstellen (gleiche Benutzer-ID, Daten bleiben)
    const isAnonymous = (session.user as { is_anonymous?: boolean }).is_anonymous;
    if (isAnonymous) {
      await startSecure();
    } else {
      setPhase('ready');
    }
  }

  async function startNew() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInAnonymously();
    setBusy(false);
    if (err) {
      setError('Anmeldung fehlgeschlagen: ' + err.message);
      return;
    }
    setPhase('needsName');
  }

  async function handleLoginWithKey() {
    const norm = normalizeKey(keyInput);
    if (norm.length !== 12) {
      setError('Der Schlüssel hat 12 Zeichen, zum Beispiel K7M4-Q9TD-X2PA.');
      return;
    }
    setBusy(true);
    setError(null);
    const email = await emailForKey(norm);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: norm });
    setBusy(false);
    if (err) {
      setError('Dieser Schlüssel wurde nicht gefunden. Bitte nochmals prüfen.');
      return;
    }
    setKeyInput('');
    await init();
  }

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError('Keine Session gefunden. Bitte Seite neu laden.');
      setBusy(false);
      return;
    }

    const hyphenKey = generateHyphenKey();
    const { error: err } = await supabase
      .from('users')
      .upsert(
        { id: session.user.id, username: trimmed, display_name: trimmed, avatar_url: hyphenKey },
        { onConflict: 'id' }
      );

    if (err) {
      setError('Konnte den Namen nicht speichern: ' + err.message);
      setBusy(false);
      return;
    }

    setKumpel({ id: session.user.id, username: trimmed, displayName: trimmed, hyphenKey });
    setBusy(false);
    await startSecure();
  }

  // Wandelt das anonyme Konto in ein Konto mit Schlüssel um
  async function startSecure() {
    if (securing.current) return;
    securing.current = true;
    setError(null);

    const key = generateLoginKey();
    const norm = normalizeKey(key);
    const email = await emailForKey(norm);

    const { error: err } = await supabase.auth.updateUser({ email, password: norm });
    if (err) {
      securing.current = false;
      setError('Schlüssel konnte nicht erstellt werden: ' + err.message);
      setPhase('secureKey');
      setLoginKey('');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if ((user as { is_anonymous?: boolean } | null)?.is_anonymous) {
      securing.current = false;
      setError(
        'Der Schlüssel ist noch nicht aktiv. Supabase: Authentication > Providers > Email > "Confirm email" ausschalten.'
      );
      setPhase('secureKey');
      setLoginKey('');
      return;
    }

    setLoginKey(key);
    setCheckInput('');
    setCopied(false);
    setPhase('secureKey');
    securing.current = false;
  }

  async function logout() {
    await supabase.auth.signOut();
    setKumpel(null);
    setLoginKey('');
    setPhase('welcome');
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(loginKey);
      setCopied(true);
    } catch {
      setError('Kopieren nicht möglich. Bitte den Schlüssel abschreiben oder einen Screenshot machen.');
    }
  }

  const shell = (content: ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full">{content}</div>
    </div>
  );

  const inputClass =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white mb-3 focus:outline-none focus:border-indigo-500';
  const primaryBtn =
    'w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-3 rounded-lg transition-all';
  const secondaryBtn = 'w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-lg transition-all';

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">Lade...</div>
    );
  }

  if (phase === 'welcome') {
    return shell(
      <>
        <h2 className="text-lg font-bold text-white mb-2">Willkommen!</h2>
        <p className="text-sm text-slate-400 mb-4">Bist du zum ersten Mal hier?</p>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button onClick={startNew} disabled={busy} className={primaryBtn + ' mb-3'}>
          Ich bin neu
        </button>
        <button
          onClick={() => {
            setError(null);
            setPhase('enterKey');
          }}
          className={secondaryBtn}
        >
          Ich habe schon einen Schlüssel
        </button>
      </>
    );
  }

  if (phase === 'enterKey') {
    return shell(
      <>
        <h2 className="text-lg font-bold text-white mb-2">Mit Schlüssel anmelden</h2>
        <p className="text-sm text-slate-400 mb-4">Gib deinen Schlüssel ein, zum Beispiel K7M4-Q9TD-X2PA.</p>
        <input
          autoFocus
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoginWithKey()}
          placeholder="XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          className={inputClass + ' font-mono tracking-wider'}
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button onClick={handleLoginWithKey} disabled={busy || !keyInput.trim()} className={primaryBtn + ' mb-3'}>
          {busy ? 'Prüfe...' : 'Anmelden'}
        </button>
        <button
          onClick={() => {
            setError(null);
            setPhase('welcome');
          }}
          className="w-full text-sm text-slate-400 hover:text-slate-300"
        >
          Zurück
        </button>
      </>
    );
  }

  if (phase === 'needsName') {
    return shell(
      <>
        <h2 className="text-lg font-bold text-white mb-2">Wie heisst du?</h2>
        <p className="text-sm text-slate-400 mb-4">
          Dein Kumpel-Name erscheint auf der Rangliste. Bitte Vorname und Nachname, damit der Trainer dich erkennt.
        </p>
        <input
          autoFocus
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
          placeholder="z.B. Urs, Klaus, Michael"
          className={inputClass}
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button onClick={handleSaveName} disabled={busy || !nameInput.trim()} className={primaryBtn}>
          {busy ? 'Speichern...' : "Los geht's"}
        </button>
      </>
    );
  }

  if (phase === 'secureKey') {
    const lastFour = normalizeKey(loginKey).slice(-4);
    const checkOk = loginKey !== '' && normalizeKey(checkInput) === lastFour;
    const mailBody = encodeURIComponent(`Mein Schlüssel für die Fussball-App: ${loginKey}`);

    return shell(
      <>
        <h2 className="text-lg font-bold text-white mb-2">Dein Schlüssel</h2>
        {loginKey === '' ? (
          <>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button onClick={() => startSecure()} className={primaryBtn}>
              Nochmals versuchen
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-3">
              Damit meldest du dich auf jedem anderen Handy oder Computer an. Ohne ihn bist du dort wieder bei null.
              Bitte jetzt sichern.
            </p>
            <div className="bg-slate-800 border border-slate-700 rounded-lg py-4 text-center mb-3">
              <p className="text-2xl font-mono font-black tracking-wider text-emerald-400">{loginKey}</p>
            </div>
            <div className="flex gap-2 mb-3">
              <button onClick={copyKey} className={secondaryBtn}>
                {copied ? 'Kopiert' : 'Kopieren'}
              </button>
              <a href={`mailto:?subject=Mein%20Schl%C3%BCssel&body=${mailBody}`} className={secondaryBtn + ' text-center'}>
                Per E-Mail
              </a>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Du kannst auch einen Screenshot machen. Dein Support-Schlüssel (nur für Hilfe): {kumpel?.hyphenKey}
            </p>
            <p className="text-xs text-slate-400 mb-1">Zur Kontrolle: Tippe die letzten 4 Zeichen ein.</p>
            <input
              value={checkInput}
              onChange={(e) => setCheckInput(e.target.value)}
              placeholder="XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              className={inputClass + ' font-mono tracking-wider text-center'}
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              onClick={() => {
                setLoginKey('');
                setPhase('ready');
              }}
              disabled={!checkOk}
              className={primaryBtn}
            >
              Weiter zur App
            </button>
          </>
        )}
      </>
    );
  }

  return (
    <KumpelContext.Provider value={{ kumpel, loading: false, logout }}>{children}</KumpelContext.Provider>
  );
}
