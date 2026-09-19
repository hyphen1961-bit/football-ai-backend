from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

# ============ MODELS ============

class TipInput(BaseModel):
    username: str
    api_fixture_id: int
    predicted_winner: str
    tip_over_under: Optional[str] = None
    tip_btts: Optional[str] = None
    tip_double_chance: Optional[str] = None
    tip_exact_score_home: Optional[int] = None
    tip_exact_score_away: Optional[int] = None

class MatchResultInput(BaseModel):
    api_fixture_id: int
    home_score: int
    away_score: int
    status: str = "FT"

# ============ HEALTH CHECK ============

@app.get("/")
def read_root():
    return {"message": "Football AI API is running!", "status": "healthy"}

# ============ FIXTURES ============

@app.get("/fixtures/next")
def get_next_fixtures():
    results = {}
    try:
        r1 = httpx.get(
            "https://v3.football.api-sports.io/fixtures?league=78&season=2024&next=5",
            headers=api_headers,
            timeout=10.0
        )
        results["bundesliga_2024"] = {
            "status": r1.status_code,
            "count": len(r1.json().get('response', [])),
            "data": r1.json().get('response', [])[:2]
        }
    except Exception as e:
        results["bundesliga_2024"] = {"error": str(e)}
    
    try:
        r2 = httpx.get(
            "https://v3.football.api-sports.io/fixtures?league=78&season=2025&next=5",
            headers=api_headers,
            timeout=10.0
        )
        results["bundesliga_2025"] = {
            "status": r2.status_code,
            "count": len(r2.json().get('response', [])),
            "data": r2.json().get('response', [])[:2]
        }
    except Exception as e:
        results["bundesliga_2025"] = {"error": str(e)}
    
    return results

# ============ ANALYSIS ============

@app.post("/analyze/{fixture_id}")
def analyze_match(fixture_id: int, team_home_id: int, team_away_id: int):
    print(f"Starte KI-Analyse für Fixture {fixture_id}...")
    
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
                        if val['value'] == 'Home':
                            odds_home =