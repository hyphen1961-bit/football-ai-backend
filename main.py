from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import httpx
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = FastAPI()

# CORS für das Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- KONFIGURATION ---
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Supabase Client initialisieren
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Die Ligen, die wir tracken wollen (IDs von API-Football)
LEAGUES = [
    {"id": 78, "name": "Bundesliga"},
    {"id": 39, "name": "Premier League"},
    {"id": 207, "name": "Swiss Super League"},
    {"id": 2, "name": "Champions League"},
    {"id": 3, "name": "Europa League"},
    {"id": 848, "name": "Conference League"}
]

@app.get("/")
def root():
    return {"message": "Football AI Backend läuft und ist mit Supabase verbunden!"}

@app.get("/api/test")
async def test_api():
    """Einfacher Test-Endpunkt wie zuvor"""
    return {"status": "Backend ist online"}

@app.get("/api/sync-matches")
async def sync_matches():
    """
    Holt die kommenden Spiele, berechnet Scores und speichert sie in Supabase.
    WICHTIG: API-Football Free Tier hat 100 Requests/Tag. 
    Wir holen pro Liga nur die nächsten 5 Spiele, um das Limit nicht zu sprengen.
    """
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="RAPIDAPI_KEY nicht gesetzt")

    headers = {"x-apisports-key": RAPIDAPI_KEY}
    synced_count = 0

    async with httpx.AsyncClient() as client:
        for league in LEAGUES:
            league_id = league["id"]
            league_name = league["name"]
            
            # 1. Kommende Spiele holen
            fixtures_url = "https://v3.football.api-sports.io/fixtures"
            params = {"league": league_id, "season": "2026", "next": 5}
            
            try:
                res = await client.get(fixtures_url, headers=headers, params=params)
                data = res.json()
                fixtures = data.get("response", [])
                
                for fixture in fixtures:
                    fixture_id = fixture["fixture"]["id"]
                    home_team = fixture["teams"]["home"]["name"]
                    away_team = fixture["teams"]["away"]["name"]
                    match_date = fixture["fixture"]["date"]
                    
                    # 2. Vorhersagen (Predictions) holen
                    pred_url = "https://v3.football.api-sports.io/predictions"
                    pred_params = {"fixture": fixture_id}
                    pred_res = await client.get(pred_url, headers=headers, params=pred_params)
                    pred_data = pred_res.json()
                    
                    # 3. Confidence Score berechnen (Vereinfacht für MVP)
                    # Wir nutzen die API-Wahrscheinlichkeiten als Basis
                    top_pick = "Unentschieden"
                    conf = 0
                    ki_insight = "Daten werden analysiert..."
                    
                    if pred_data.get("response"):
                        pred = pred_data["response"][0]
                        # Die API gibt Prozentzahlen für Home/Draw/Away
                        # Wir nehmen den höchsten Wert als Top Pick
                        home_pct = pred.get("percent", {}).get("home", 0)
                        draw_pct = pred.get("percent", {}).get("draw", 0)
                        away_pct = pred.get("percent", {}).get("away", 0)
                        
                        max_pct = max(home_pct, draw_pct, away_pct)
                        conf = int(max_pct)
                        
                        if home_pct == max_pct:
                            top_pick = f"{home_team} Sieg"
                        elif away_pct == max_pct:
                            top_pick = f"{away_team} Sieg"
                            
                        ki_insight = f"Statistik favorisiert {top_pick} mit {conf}% Wahrscheinlichkeit basierend auf Form und H2H."

                    # 4. In Supabase speichern (Upsert: aktualisieren wenn ID existiert)
                    match_data = {
                        "api_fixture_id": fixture_id,
                        "home_team": home_team,
                        "away_team": away_team,
                        "league": league_name,
                        "match_date": match_date,
                        "top_pick_1": top_pick,
                        "confidence_1": conf,
                        "ki_insight": ki_insight,
                        "status": "SCHEDULED"
                    }
                    
                    # Wir nutzen upsert, um Duplikate zu vermeiden
                    supabase.table("matches").upsert(match_data, on_conflict="api_fixture_id").execute()
                    synced_count += 1
                    
            except Exception as e:
                print(f"Fehler bei Liga {league_name}: {e}")

    return {"message": "Sync abgeschlossen", "matches_synced": synced_count}

@app.get("/api/get-matches")
async def get_matches(league: str = "Alle"):
    """Endpunkt für das Frontend, um die gespeicherten Spiele zu laden"""
    query = supabase.table("matches").select("*").order("match_date", desc=False)
    
    if league != "Alle":
        query = query.eq("league", league)
        
    response = query.execute()
    return {"matches": response.data}