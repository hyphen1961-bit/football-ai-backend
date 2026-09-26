'use client';
import { useState, useEffect, useMemo } from 'react';
import { Match, getConfidenceColor, getConfidenceLabel, getLeagueName } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { useKumpel } from '@/contexts/KumpelProvider';

interface MatchModalProps {
  match: Match | null;
  onClose: () => void;
}

// Gleiche Farbpalette wie in MatchList.tsx, damit ein Spiel beim Anklicken
// in der gleichen Farbe weitergeht (bewusst dupliziert statt geteilt, um
// MatchList.tsx nicht anzufassen).
const LEAGUE_PALETTE = [
  { from: '#712B13', to: '#4A1B0C', text: '#F0997B' },
  { from: '#0C447C', to: '#042C53', text: '#85B7EB' },
  { from: '#633806', to: '#412402', text: '#EF9F27' },
  { from: '#3C3489', to: '#26215C', text: '#AFA9EC' },
  { from: '#085041', to: '#04342C', text: '#5DCAA5' },
  { from: '#72243E', to: '#4B1528', text: '#ED93B1' },
  { from: '#27500A', to: '#173404', text: '#97C459' },
  { from: '#791F1F', to: '#501313', text: '#F09595' },
];

function leagueColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return LEAGUE_PALETTE[hash % LEAGUE_PALETTE.length];
}

export default function MatchModal({ match, onClose }: MatchModalProps) {
  const { kumpel } = useKumpel();

  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isLoadingTip, setIsLoadingTip] = useState<boolean>(false);

  const [tip1X2, setTip1X2] = useState<string>('');
  const [tipOverUnder, setTipOverUnder] = useState<string>('');
  const [tipBTTS, setTipBTTS] = useState<string>('');
  const [tipDoubleChance, setTipDoubleChance] = useState<string>('');
  const [tipExactHome, setTipExactHome] = useState<string>('');
  const [tipExactAway, setTipExactAway] = useState<string>('');
  const [deviationReason, setDeviationReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!match) return null;

  const confidence = match.analysis?.confidence_score || 0;
  const colorClass = getConfidenceColor(confidence);
  const leagueName = getLeagueName(match.league_id, match.league_name);
  const color = leagueColor(leagueName);

  const kickoffTime = useMemo(() => new Date(match.kickoff_time), [match.kickoff_time]);
  const time = kickoffTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const date = kickoffTime.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const isMatchPlayed = match.status === 'FT' || match.status === 'AET' || match.status === 'PEN';

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = kickoffTime.getTime() - now.getTime();
      const mins = Math.floor(diff / (1000 * 60));

      if (isMatchPlayed || mins < -120) {
        setIsFinished(true);
        setIsLocked(true);
        setTimeLeft('Beendet');
      } else if (mins <= 2) {
        setIsLocked(true);
        setIsFinished(false);
        setTimeLeft('Gesperrt');
      } else {
        setIsLocked(false);
        setIsFinished(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`Noch ${hours}h ${minutes}min`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [kickoffTime, isMatchPlayed]);

  useEffect(() => {
    setTip1X2('');
    setTipOverUnder('');
    setTipBTTS('');
    setTipDoubleChance('');
    setTipExactHome('');
    setTipExactAway('');
    setDeviationReason('');

    if (!isFinished && match.api_fixture_id && kumpel) {
      const loadExistingTip = async () => {
        setIsLoadingTip(true);
        try {
          const { data, error } = await supabase
            .from('user_tips')
            .select('predicted_winner, tip_over_under, tip_btts, tip_double_chance, tip_exact_score_home, tip_exact_score_away')
            .eq('user_id', kumpel.id)
            .eq('api_fixture_id', match.api_fixture_id)
            .maybeSingle();

          if (error) {
            console.error('Fehler beim Laden des Tipps:', error.message);
            return;
          }
          if (data) {
            setTip1X2(data.predicted_winner || '');
            setTipOverUnder(data.tip_over_under || '');
            setTipBTTS(data.tip_btts || '');
            setTipDoubleChance(data.tip_double_chance || '');
            setTipExactHome(data.tip_exact_score_home?.toString() || '');
            setTipExactAway(data.tip_exact_score_away?.toString() || '');
          }
        } finally {
          setIsLoadingTip(false);
        }
      };

      loadExistingTip();
    }
  }, [match, isFinished, kumpel]);

  const aiPrediction = (match.analysis?.ai_prediction || '').toLowerCase();
  const isDeviating = tip1X2 !== '' && (
    (aiPrediction === 'home' && tip1X2 !== '1') ||
    (aiPrediction === 'draw' && tip1X2 !== '0') ||
    (aiPrediction === 'away' && tip1X2 !== '2')
  );

  const renderList = (data: any) => {
    if (Array.isArray(data) && data.length > 0) return data.join(' ');
    if (typeof data === 'string' && data.length > 0) return data;
    return 'Keine Daten';
  };

  const handleSubmit = async () => {
    if (!tip1X2) {
      alert('Bitte wähle zuerst einen 1X2-Tipp (1, 0 oder 2)');
      return;
    }

    if (!kumpel) {
      alert('Dein Profil wird noch geladen, bitte kurz warten und erneut versuchen.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_tips')
        .upsert(
          {
            user_id: kumpel.id,
            api_fixture_id: match.api_fixture_id,
            predicted_winner: tip1X2,
            tip_over_under: tipOverUnder || null,
            tip_btts: tipBTTS || null,
            tip_double_chance: tipDoubleChance || null,
            tip_exact_score_home: tipExactHome ? parseInt(tipExactHome) : null,
            tip_exact_score_away: tipExactAway ? parseInt(tipExactAway) : null,
            deviation_reason: deviationReason || null,
          },
          { onConflict: 'user_id,api_fixture_id' }
        );

      if (!error) {
        alert('Tipp gespeichert/aktualisiert!');
        onClose();
      } else {
        alert('Fehler: ' + error.message);
      }
    } catch (error) {
      alert('Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tipButtonBase = 'py-4 rounded-xl border font-medium text-lg transition-all';
  const tipButtonActive = 'bg-[#FAC775] border-[#FAC775] text-[#412402]';
  const tipButtonInactive = 'bg-[#2a2a27] border-[#444441] text-slate-300 hover:bg-[#363630]';
  const smallButtonBase = 'py-3 rounded-xl border font-medium transition-all';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1c1c1a] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        <div
          className="sticky top-0 p-6 flex justify-between items-start z-10"
          style={{ background: `linear-gradient(90deg, ${color.from}, ${color.to})` }}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-black/20" style={{ color: color.text }}>
                {leagueName}
              </span>
              <span className="text-xs opacity-70" style={{ color: color.text }}>{date} &middot; {time}</span>
            </div>
            <h2 className="text-xl font-semibold text-white">{match.home_team_name} vs {match.away_team_name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white text-2xl px-2 leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-6">

          <div className="flex justify-between items-center">
            <div className={`px-6 py-3 rounded-full text-lg font-bold border ${colorClass}`}>
              {confidence}% - {getConfidenceLabel(confidence)}
            </div>
            <div className={`text-sm font-mono ${isFinished ? 'text-slate-500' : isLocked ? 'text-[#BA7517]' : 'text-[#639922]'}`}>
              {timeLeft}
            </div>
          </div>

          {match.analysis?.ai_prediction && (
            <div className="bg-[#2a2a27] rounded-xl p-4 border border-[#363630]">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">KI-Vorhersage</h3>
              <p className="text-xl font-medium text-white">{match.analysis.ai_prediction}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#2a2a27] rounded-xl p-4 border border-[#363630]">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">Form</h3>
              <p className="text-xs text-slate-500 mb-1">Heim</p>
              <p className="text-white font-mono text-sm mb-2">{renderList(match.analysis?.form_home)}</p>
              <p className="text-xs text-slate-500 mb-1">Auswärts</p>
              <p className="text-white font-mono text-sm">{renderList(match.analysis?.form_away)}</p>
            </div>
            <div className="bg-[#2a2a27] rounded-xl p-4 border border-[#363630]">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">Verletzte</h3>
              <p className="text-xs text-slate-500 mb-1">Heim</p>
              <p className="text-white text-sm mb-2">{renderList(match.analysis?.injuries_home)}</p>
              <p className="text-xs text-slate-500 mb-1">Auswärts</p>
              <p className="text-white text-sm">{renderList(match.analysis?.injuries_away)}</p>
            </div>
            <div className="bg-[#2a2a27] rounded-xl p-4 border border-[#363630]">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">H2H</h3>
              {match.analysis?.h2h_stats && typeof match.analysis.h2h_stats === 'object' ? (
                <>
                  <p className="text-white text-sm">Heimsiege: {(match.analysis.h2h_stats as any).home_wins || 0}</p>
                  <p className="text-white text-sm">Auswärtssiege: {(match.analysis.h2h_stats as any).away_wins || 0}</p>
                </>
              ) : (
                <p className="text-white text-sm">Keine Daten</p>
              )}
            </div>
          </div>

          {isFinished && (
            <div className="border-t border-[#2a2a27] pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">Endergebnis</h3>
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: `linear-gradient(90deg, ${color.from}, ${color.to})` }}
              >
                <div className="flex justify-center items-center gap-6">
                  <div className="text-center">
                    <p className="text-sm mb-1" style={{ color: color.text }}>{match.home_team_name}</p>
                    <p className="text-4xl font-semibold text-white">{match.home_score ?? '-'}</p>
                  </div>
                  <span className="text-3xl font-medium opacity-60 text-white">:</span>
                  <div className="text-center">
                    <p className="text-sm mb-1" style={{ color: color.text }}>{match.away_team_name}</p>
                    <p className="text-4xl font-semibold text-white">{match.away_score ?? '-'}</p>
                  </div>
                </div>
                <p className="text-xs mt-4 opacity-70" style={{ color: color.text }}>Dieses Spiel ist bereits beendet.</p>
              </div>
            </div>
          )}

          {!isFinished && isLocked && (
            <div className="border-t border-[#2a2a27] pt-6">
              <div className="text-center py-8 rounded-xl border" style={{ background: 'rgba(186,117,23,0.12)', borderColor: 'rgba(186,117,23,0.4)' }}>
                <p className="font-semibold text-lg" style={{ color: '#EF9F27' }}>Gesperrt</p>
                <p className="text-sm mt-2" style={{ color: '#EF9F27', opacity: 0.8 }}>Spiel beginnt in weniger als 2 Minuten</p>
              </div>
            </div>
          )}

          {!isFinished && !isLocked && (
            <div className="border-t border-[#2a2a27] pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Dein Tipp {kumpel && <span className="text-sm text-slate-400 font-normal">({kumpel.username})</span>}{' '}
                {isLoadingTip && <span className="text-sm text-slate-400 font-normal">(Lade bestehenden Tipp...)</span>}
              </h3>
              <div className="space-y-6">

                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">1X2 - Wer gewinnt?</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button type="button" onClick={() => setTip1X2('1')} className={`${tipButtonBase} ${tip1X2 === '1' ? tipButtonActive : tipButtonInactive}`}>
                      1 <span className="block text-xs font-normal mt-1">{match.home_team_name}</span>
                    </button>
                    <button type="button" onClick={() => setTip1X2('0')} className={`${tipButtonBase} ${tip1X2 === '0' ? tipButtonActive : tipButtonInactive}`}>
                      0 <span className="block text-xs font-normal mt-1">Unentschieden</span>
                    </button>
                    <button type="button" onClick={() => setTip1X2('2')} className={`${tipButtonBase} ${tip1X2 === '2' ? tipButtonActive : tipButtonInactive}`}>
                      2 <span className="block text-xs font-normal mt-1">{match.away_team_name}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Over/Under 2.5</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setTipOverUnder(tipOverUnder === 'Over' ? '' : 'Over')} className={`${smallButtonBase} ${tipOverUnder === 'Over' ? tipButtonActive : tipButtonInactive}`}>
                      Over 2.5
                    </button>
                    <button type="button" onClick={() => setTipOverUnder(tipOverUnder === 'Under' ? '' : 'Under')} className={`${smallButtonBase} ${tipOverUnder === 'Under' ? tipButtonActive : tipButtonInactive}`}>
                      Under 2.5
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">BTTS - Beide treffen?</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setTipBTTS(tipBTTS === 'Yes' ? '' : 'Yes')} className={`${smallButtonBase} ${tipBTTS === 'Yes' ? tipButtonActive : tipButtonInactive}`}>
                      Ja
                    </button>
                    <button type="button" onClick={() => setTipBTTS(tipBTTS === 'No' ? '' : 'No')} className={`${smallButtonBase} ${tipBTTS === 'No' ? tipButtonActive : tipButtonInactive}`}>
                      Nein
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Doppelte Chance</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['1X', '12', 'X2'].map((opt) => (
                      <button key={opt} type="button" onClick={() => setTipDoubleChance(tipDoubleChance === opt ? '' : opt)} className={`${smallButtonBase} ${tipDoubleChance === opt ? tipButtonActive : tipButtonInactive}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-400 uppercase block mb-3">Exaktes Ergebnis (Optional)</label>
                  <div className="flex gap-3 items-center">
                    <input type="number" min="0" max="10" value={tipExactHome} onChange={(e) => setTipExactHome(e.target.value)} placeholder="Heim" className="flex-1 bg-[#2a2a27] border border-[#444441] rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-[#FAC775]" />
                    <span className="text-slate-400 text-2xl">:</span>
                    <input type="number" min="0" max="10" value={tipExactAway} onChange={(e) => setTipExactAway(e.target.value)} placeholder="Auswärts" className="flex-1 bg-[#2a2a27] border border-[#444441] rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-[#FAC775]" />
                  </div>
                </div>

                {isDeviating && (
                  <div className="rounded-xl p-4 border" style={{ background: 'rgba(239,159,39,0.1)', borderColor: 'rgba(239,159,39,0.4)' }}>
                    <label className="text-sm font-semibold uppercase block mb-2" style={{ color: '#EF9F27' }}>Warum gegen die KI?</label>
                    <textarea value={deviationReason} onChange={(e) => setDeviationReason(e.target.value.slice(0, 100))} placeholder="Max 100 Zeichen" className="w-full bg-[#2a2a27] border border-[#444441] rounded-xl px-4 py-3 text-white text-sm focus:outline-none" style={{ borderColor: '#EF9F27' } as any} rows={3} />
                    <p className="text-xs mt-2" style={{ color: '#EF9F27' }}>{deviationReason.length}/100</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !tip1X2}
                  className={`w-full font-semibold py-4 rounded-xl text-lg transition-all ${
                    isSubmitting || !tip1X2
                      ? 'bg-[#2a2a27] text-slate-500 cursor-not-allowed'
                      : 'bg-[#FAC775] hover:brightness-95 text-[#412402]'
                  }`}
                >
                  {isSubmitting ? 'Speichern...' : 'Tipp speichern / aktualisieren'}
                </button>

                {!tip1X2 && (
                  <p className="text-center text-sm text-slate-500">Wähle zuerst einen 1X2-Tipp (1, 0 oder 2)</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
