from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
import httpx
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional

load_dotenv()

app = FastAPI(title="Football AI Kumpel-Tipp API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

api_headers = {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io"
}

class TipInput(BaseModel):
    username: str
    api_fixture_id: int
    predicted_winner: str
    tip_over_under: Optional[str] = None
    tip_btts: Optional[str] = None
    tip_double_chance: Optional[str] = None
    tip_exact_score_home: Optional[int] = None
    tip_exact_score_away: Optional[int] = None

@app.get("/fixtures/next")
def get_next_fixtures(league: int = 78, season: int = 2026, limit: int = 10):
    """
    Holt nächste Spiele von API-Football und speichert sie in Supabase
    """
    try:
        # 1. Von API-Football holen
        response = httpx.get(
            f"https://v3.football.api-sports.io/fixtures?league={league}&season={season}&next={limit}",
            headers=api_headers,
            timeout=10.0
        )
        
        if response.status_code != 200:
            print(f"❌ API-Football Fehler: {response.status_code}")
            return {"error": "API request failed", "status": response.status_code}
        
        data = response.json()
        fixtures = data.get('response', [])
        
        print(f"✅ {len(fixtures)} Spiele von API-Football geholt")
        
        # 2. In Supabase speichern
        for fixture in fixtures:
            match_data = {
                "api_fixture_id": fixture['fixture']['id'],
                "league_id": fixture['league']['id'],
                "season": fixture['league']['year'],
                "round": fixture['league']['round'],
                "home_team_id": fixture['teams']['home']['id'],
                "home_team_name": fixture['teams']['home']['name'],
                "away_team_id": fixture['teams']['away']['id'],
                "away_team_name": fixture['teams']['away']['name'],
                "kickoff_time": fixture['fixture']['date'],
                "status": fixture['fixture']['status']['short']
            }
            
            # Upsert = Einfügen oder aktualisieren wenn schon vorhanden
            supabase.table('matches').upsert(match_data, on_conflict='api_fixture_id').execute()
            print(f" Gespeichert: {match_data['home_team_name']} vs {match_data['away_team_name']}")
        
        # 3. Zurückgeben
        return fixtures
        
    except Exception as e:
        print(f"❌ Fehler beim Laden der Spiele: {e}")
        return {"error": str(e)}
    
@app.post("/analyze/{fixture_id}")
def analyze_match(fixture_id: int, team_home_id: int, team_away_id: int):
    print(f"🧠 Starte KI-Analyse für Fixture {fixture_id}...")
    
    form_home = httpx.get(f"https://v3.football.api-sports.io/fixtures?team={team_home_id}&last=5", headers=api_headers).json()
    form_away = httpx.get(f"https://v3.football.api-sports.io/fixtures?team={team_away_id}&last=5", headers=api_headers).json()
    injuries = httpx.get(f"https://v3.football.api-sports.io/injuries?fixture={fixture_id}", headers=api_headers).json()
    h2h = httpx.get(f"https://v3.football.api-sports.io/fixtures/headtohead?h2h={team_home_id}-{team_away_id}&last=5", headers=api_headers).json()
    odds = httpx.get(f"https://v3.football.api-sports.io/odds?fixture={fixture_id}", headers=api_headers).json()
    
    def count_wins(fixtures_data, team_id):
        wins = 0
        for match in fixtures_data.get('response', []):
            if match['teams']['home']['id'] == team_id and match['teams']['home']['winner']:
                wins += 1
            elif match['teams']['away']['id'] == team_id and match['teams']['away']['winner']:
                wins += 1
        return wins
    
    wins_home = count_wins(form_home, team_home_id)
    wins_away = count_wins(form_away, team_away_id)
    
    injuries_home = []
    injuries_away = []
    for team_data in injuries.get('response', []):
        if team_data['team']['id'] == team_home_id:
            injuries_home = [i['player']['name'] for i in team_data.get('injuries', [])]
        elif team_data['team']['id'] == team_away_id:
            injuries_away = [i['player']['name'] for i in team_data.get('injuries', [])]
    
    h2h_home_wins = 0
    h2h_away_wins = 0
    for match in h2h.get('response', []):
        if match['teams']['home']['id'] == team_home_id and match['teams']['home']['winner']:
            h2h_home_wins += 1
        elif match['teams']['away']['id'] == team_away_id and match['teams']['away']['winner']:
            h2h_away_wins += 1
    
    odds_home, odds_draw, odds_away = 0.0, 0.0, 0.0
    if odds.get('response'):
        bookmakers = odds['response'][0].get('bookmakers', [])
        if bookmakers:
            bets = bookmakers[0].get('bets', [])
            for bet in bets:
                if bet['name'] == 'Match Winner':
                    for val in bet['values']:
                        if val['value'] == 'Home': odds_home = float(val['odd'])
                        elif val['value'] == 'Draw': odds_draw = float(val['odd'])
                        elif val['value'] == 'Away': odds_away = float(val['odd'])
    
    score = 50
    score += (wins_away - wins_home) * 5
    score += (h2h_away_wins - h2h_home_wins) * 4
    score -= len(injuries_away) * 5
    score += len(injuries_home) * 3
    if odds_away > 0 and odds_home > 0 and odds_away < odds_home:
        score += 10
    score = max(0, min(100, score))
    
    prediction = "Away" if score > 55 else ("Home" if score < 45 else "Draw")
    
    analysis_data = {
        "api_fixture_id": fixture_id,
        "form_home": [f"{m['teams']['home']['name']} ({'W' if m['teams']['home']['winner'] else 'L'})" for m in form_home.get('response', [])],
        "form_away": [f"{m['teams']['away']['name']} ({'W' if m['teams']['away']['winner'] else 'L'})" for m in form_away.get('response', [])],
        "injuries_home": injuries_home,
        "injuries_away": injuries_away,
        "h2h_stats": {"home_wins": h2h_home_wins, "away_wins": h2h_away_wins},
        "odds_home": odds_home,
        "odds_draw": odds_draw,
        "odds_away": odds_away,
        "home_advantage_factor": 1.10,
        "context_notes": f"KI-Analyse: Form Home {wins_home}/5, Away {wins_away}/5",
        "ai_prediction": prediction,
        "confidence_score": score
    }
    
    supabase.table('match_analysis').upsert(analysis_data, on_conflict='api_fixture_id').execute()
    
    return {
        "fixture_id": fixture_id,
        "prediction": prediction,
        "confidence_score": score,
        "message": f"✅ Analyse gespeichert! KI tippt: {prediction} ({score}% Confidence)"
    }

@app.get("/matches")
async def get_matches():
    """
    Holt alle Spiele MIT ihren KI-Analysen
    """
    try:
        # 1. Alle Spiele holen
        matches_response = supabase.table("matches").select("*").execute()
        matches = matches_response.data
        
        # 2. Für jedes Spiel die Analyse holen und zusammenfügen
        matches_with_analysis = []
        for match in matches:
            # Analyse für dieses Spiel holen (über api_fixture_id)
            analysis_response = supabase.table("match_analysis").select("*").eq(
                "api_fixture_id", 
                match["api_fixture_id"]
            ).execute()
            
            analysis = analysis_response.data[0] if analysis_response.data else None
            
            # Spiel + Analyse kombinieren
            match_with_analysis = {
                **match,
                "analysis": analysis
            }
            matches_with_analysis.append(match_with_analysis)
        
        return matches_with_analysis
        
    except Exception as e:
        print(f"❌ Fehler beim Laden der Spiele: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analysis/{fixture_id}")
def get_analysis(fixture_id: int):
    result = supabase.table('match_analysis').select("*").eq('api_fixture_id', fixture_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Keine Analyse gefunden")
    return result.data[0]

@app.post("/tips")
def submit_tip(tip: TipInput):
    print(f"📝 Neuer Tipp von {tip.username} für Spiel {tip.api_fixture_id}: {tip.predicted_winner}")
    
    user_check = supabase.table('users').select('id').eq('username', tip.username).execute()
    if not user_check.data:
        supabase.table('users').insert({"username": tip.username}).execute()
        user_id = supabase.table('users').select('id').eq('username', tip.username).execute().data[0]['id']
    else:
        user_id = user_check.data[0]['id']

    tip_data = {
        "user_id": user_id,
        "api_fixture_id": tip.api_fixture_id,
        "predicted_winner": tip.predicted_winner,
        "predicted_score_home": 0,
        "predicted_score_away": 0,
        "tip_over_under": tip.tip_over_under,
        "tip_btts": tip.tip_btts,
        "tip_double_chance": tip.tip_double_chance,
        "tip_exact_score_home": tip.tip_exact_score_home,
        "tip_exact_score_away": tip.tip_exact_score_away
    }
    
    supabase.table('user_tips').upsert(tip_data, on_conflict='user_id,api_fixture_id').execute()
    
    return {"message": f"✅ Tipp von {tip.username} gespeichert!", "tip": tip_data}