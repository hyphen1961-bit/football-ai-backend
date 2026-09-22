import os
import json
import httpx
import random
import string
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

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

USE_MOCK_DATA = True

# ============ MODELS ============
class TipInput(BaseModel):
    user_id: str  # Die anonyme UUID von Supabase Auth
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

class RegisterUserInput(BaseModel):
    user_id: str
    username: str

# ============ HEALTH CHECK ============
@app.get("/")
def read_root():
    return {"message": "Football AI API is running!", "status": "healthy"}

# ============ FIXTURES ============
@app.get("/fixtures/next")
def get_next_fixtures():
    results = {}
    try:
        r1 = httpx.get("https://v3.football.api-sports.io/fixtures?league=78&season=2024&next=5", headers=api_headers, timeout=10.0)
        results["bundesliga_2024"] = {"status": r1.status_code, "count": len(r1.json().get('response', [])), "data": r1.json().get('response', [])[:2]}
    except Exception as e:
        results["bundesliga_2024"] = {"error": str(e)}
        
    try:
        r2 = httpx.get("https://v3.football.api-sports.io/fixtures?league=78&season=2025&next=5", headers=api_headers, timeout=10.0)
        results["bundesliga_2025"] = {"status": r2.status_code, "count": len(r2.json().get('response', [])), "data": r2.json().get('response', [])[:2]}
    except Exception as e:
        results["bundesliga_2025"] = {"error": str(e)}
    return results

# ============ ANALYSIS ============
@app.post("/analyze/{fixture_id}")
def analyze_match(fixture_id: int, team_home_id: int, team_away_id: int):
    print(f"Starte KI-Analyse für Fixture {fixture_id}...")
    form_home, form_away, injuries, h2h, odds = {}, {}, {}, {}, {}

    if USE_MOCK_DATA:
        try:
            mock_file_path = Path(__file__).parent / "mock_football_data.json"
            with open(mock_file_path, "r", encoding="utf-8") as f:
                mock_response = json.load(f)
            mock_data = mock_response['response'][0]
            form_home = {"response": [mock_data]} 
            form_away = {"response": [mock_data]}
            injuries = {"response": []} 
            h2h = {"response": [mock_data]} 
            if 'odds' in mock_data and mock_data['odds']:
                odds = {"response": mock_data['odds']}
            else:
                odds = {"response": [{"bookmakers": [{"bets": [{"name": "Match Winner", "values": [{"value": "Home", "odd": "1.80"}, {"value": "Draw", "odd": "3.50"}, {"value": "Away", "odd": "4.20"}]}]}]}]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Fehler beim Laden der Mock-Daten: {str(e)}")
    else:
        try:
            form_home = httpx.get(f"https://v3.football.api-sports.io/fixtures?team={team_home_id}&last=5", headers=api_headers, timeout=10).json()
            form_away = httpx.get(f"https://v3.football.api-sports.io/fixtures?team={team_away_id}&last=5", headers=api_headers, timeout=10).json()
            injuries = httpx.get(f"https://v3.football.api-sports.io/injuries?fixture={fixture_id}", headers=api_headers, timeout=10).json()
            h2h = httpx.get(f"https://v3.football.api-sports.io/fixtures/headtohead?h2h={team_home_id}-{team_away_id}&last=5", headers=api_headers, timeout=10).json()
            odds = httpx.get(f"https://v3.football.api-sports.io/odds?fixture={fixture_id}", headers=api_headers, timeout=10).json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"API-Fehler: {str(e)}")

    def count_wins(fixtures_data, team_id):
        wins = 0
        for match in fixtures_data.get('response', []):
            if match['teams']['home']['id'] == team_id and match['teams']['home']['winner']: wins += 1
            elif match['teams']['away']['id'] == team_id and match['teams']['away']['winner']: wins += 1
        return wins

    wins_home = count_wins(form_home, team_home_id)
    wins_away = count_wins(form_away, team_away_id)
    
    score = 50 + (wins_away - wins_home) * 5
    score = max(0, min(100, score))
    prediction = "Away" if score > 55 else ("Home" if score < 45 else "Draw")
    
    return {"fixture_id": fixture_id, "prediction": prediction, "confidence_score": score}

# ============ MATCHES ============
@app.get("/matches")
async def get_matches():
    try:
        matches_response = supabase.table("matches").select("*").execute()
        return matches_response.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ TIPS ============
@app.post("/tips")
def submit_tip(tip: TipInput):
    try:
        tip_data = {
            "user_id": tip.user_id,
            "api_fixture_id": tip.api_fixture_id,
            "predicted_winner": tip.predicted_winner,
            "tip_over_under": tip.tip_over_under,
            "tip_btts": tip.tip_btts,
            "tip_double_chance": tip.tip_double_chance,
            "tip_exact_score_home": tip.tip_exact_score_home,
            "tip_exact_score_away": tip.tip_exact_score_away
        }
        supabase.table('user_tips').upsert(tip_data, on_conflict='user_id,api_fixture_id').execute()
        return {"message": "Tipp erfolgreich gespeichert!", "tip": tip_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ USER ANONYMOUS REGISTRATION & THE HYPHEN KEY ============
@app.post("/register-anonymous-user")
def register_anonymous_user(user: RegisterUserInput):
    try:
        # Generiere einen zufälligen 4-stelligen Code aus Zahlen und Großbuchstaben
        random_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        
        # Max' offizielles Markenzeichen: Bindestrich-Verbindung!
        signature_support_key = f"Hyphen-{random_code}"
        
        user_data = {
            "id": user.user_id,
            "username": user.username,
            "deviation_reason": signature_support_key  # Wir nutzen diese Spalte temporär oder dauerhaft für den Key
        }
        
        supabase.table('users').upsert(user_data, on_conflict='id').execute()
        return {
            "message": "User erfolgreich im System registriert!",
            "username": user.username,
            "support_key": signature_support_key
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# ============ FIXTURE IMPORTER ============
@app.get("/fetch-fixtures-from-api")
def fetch_fixtures_from_api():
    print("🚀 Starte Import der nächsten Bundesliga-Spiele...")
    
    try:
        # Hole die nächsten 11 Spiele der Bundesliga (Liga 78) für Saison 2026
        response = httpx.get(
            "https://v3.football.api-sports.io/fixtures?league=78&season=2026&next=11",
            headers=api_headers,
            timeout=15.0
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"API-Fehler: Status {response.status_code}"
            )
        
        data = response.json()
        fixtures = data.get('response', [])
        
        if not fixtures:
            return {"message": "Keine Spiele gefunden!", "count": 0}
        
        imported_count = 0
        
        # Jedes Spiel in die Supabase-Tabelle 'matches' eintragen
        for fixture in fixtures:
            match_data = {
                "api_fixture_id": fixture['fixture']['id'],
                "home_team": fixture['teams']['home']['name'],
                "away_team": fixture['teams']['away']['name'],
                "date": fixture['fixture']['date']
            }
            
            supabase.table('matches').upsert(
                match_data, 
                on_conflict='api_fixture_id'
            ).execute()
            
            imported_count += 1
            print(f"   ✅ Importiert: {match_data['home_team']} vs {match_data['away_team']}")
        
        print(f"🎯 Import abgeschlossen! {imported_count} Spiele gespeichert.")
        
        return {
            "message": f"Erfolgreich {imported_count} Bundesliga-Spiele importiert!",
            "count": imported_count,
            "season": 2026,
            "league": "Bundesliga"
        }
        
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="API-Timeout beim Abrufen der Spiele")
    except Exception as e:
        print(f"💥 Fehler beim Import: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import-Fehler: {str(e)}")