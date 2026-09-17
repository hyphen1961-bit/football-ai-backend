// frontend/types.ts

export interface MatchAnalysis {
  form_home: string[] | string;
  form_away: string[] | string;
  injuries_home: string[] | string;
  injuries_away: string[] | string;
  h2h_stats: any; // Flexibel halten, da Backend mal Objekt, mal String liefern kann
  odds: Record<string, number>;
  ai_prediction: string;
  confidence_score: number;
  context_notes: string;
}

export interface Match {
  id: string;
  api_fixture_id: number;
  league_id?: number | string;
  league_name?: string;
  home_team_name: string;
  away_team_name: string;
  kickoff_time: string;
  status: string;
  is_tipped_by_user?: boolean;
  analysis?: MatchAnalysis;
}

export function getLeagueName(id?: number | string, name?: string): string {
  if (name && name !== 'Liga') return name;
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  const leagueMap: Record<number, string> = {
    78: "Bundesliga",
    79: "2. Bundesliga",
    2: "Champions League",
    3: "Europa League",
    207: "Super League",
    39: "Premier League",
    135: "Serie A",
    140: "La Liga",
    61: "Ligue 1"
  };
  return numericId && leagueMap[numericId] ? leagueMap[numericId] : "Andere Liga";
}

export function getConfidenceColor(score: number): string {
  if (score >= 70) return "bg-green-500/20 text-green-400 border-green-500/50";
  if (score >= 50) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
  return "bg-red-500/20 text-red-400 border-red-500/50";
}

export function getConfidenceLabel(score: number): string {
  if (score >= 70) return "KI sehr sicher";
  if (score >= 50) return "KI unsicher";
  return "Keine klare Tendenz";
}