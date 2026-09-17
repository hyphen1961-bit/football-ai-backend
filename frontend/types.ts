// types.ts (kommt direkt in: football-ai-frontend/types.ts)

export interface MatchAnalysis {
  form_home: string;
  form_away: string;
  injuries_home: string;
  injuries_away: string;
  h2h_stats: string;
  odds: Record<string, number>;
  ai_prediction: string;
  confidence_score: number; // 0 - 100
  context_notes: string;
}

export interface Match {
  id: string;
  api_fixture_id: number;
  home_team_name: string;
  away_team_name: string;
  league_name: string;
  kickoff_time: string;
  status: string;
  is_tipped_by_user?: boolean;
  analysis?: MatchAnalysis;
}

// Helper für die Farb-Codierung
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