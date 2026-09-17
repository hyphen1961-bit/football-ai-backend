// frontend/types.ts

export interface MatchAnalysis {
  form_home: string;
  form_away: string;
  injuries_home: string;
  injuries_away: string;
  h2h_stats: string;
  odds: Record<string, number>;
  ai_prediction: string;
  confidence_score: number;
  context_notes: string;
}

export interface Match {
  id: string;
  api_fixture_id: number;
  league_id?: number;       // NEU: Die ID vom Backend
  league_name?: string;     // Fallback, falls das Backend doch mal einen Namen schickt
  home_team_name: string;
  away_team_name: string;
  kickoff_time: string;
  status: string;
  is_tipped_by_user?: boolean;
  analysis?: MatchAnalysis;
}

// Übersetzer für Liga-IDs zu Namen
export function getLeagueName(id?: number, name?: string): string {
  if (name) return name; // Falls Backend mal einen Namen liefert
  
  const leagueMap: Record<number, string> = {
    78: "Bundesliga",
    79: "2. Bundesliga",
    2: "Champions League",
    3: "Europa League",
    207: "Super League", // Schweiz
    39: "Premier League",
    135: "Serie A",
    140: "La Liga",
    61: "Ligue 1"
  };
  
  return id && leagueMap[id] ? leagueMap[id] : "Andere Liga";
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