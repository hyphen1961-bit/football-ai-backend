from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
import httpx
import os
import json
from pathlib import Path
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

# --- KONFIGURATION FÜR DEN STREICH ---
USE_MOCK_DATA = True


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

    form_home = {}
    form_away = {}
    injuries = {}
    h2h = {}
    odds = {}

    if USE_MOCK_DATA:
        print("🕵️‍♂️ Moritz-Modus aktiv: Lade lokale Mock-Daten...")
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
                odds = {
                    "response": [{
                        "bookmakers": [{
                            "bets": [{
                                "name": "Match Winner",
                                "values": [
                                    {"value": "Home", "odd": "1.80"},
                                    {"value": "Draw", "odd": "3.50"},
                                    {"value": "Away", "odd": "4.20"}
                                ]
                            }]
                        }]
                    }]
                }

        except FileNotFoundError:
            raise HTTPException(
                status_code=500,
                detail="Mock-Datei nicht gefunden! Stell sicher, dass mock_football_data.json im Backend-Ordner liegt."
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Fehler beim Laden der Mock-Daten: {str(e)}")

    else:
        try:
            form_home = httpx.get(
                f"https://v3.football.api-sports.io/fixtures?team={team_home_id}&last=5",
                headers=api_headers,
                timeout=10.0
            ).json()
            form_away = httpx.get(
                f"https://v3.football.api-sports.io/fixtures?team={team_away_id}&last=5",
                headers=api_headers,
                timeout=10.0
            ).json()
            injuries = httpx.get(
                f"https://v3.football.api-sports.io/injuries?fixture={fixture_id}",
                headers=api_headers,
                timeout=10.0
            ).json()
            h2h = httpx.get(
                f"https://v3.football.api-sports.io/fixtures/headtohead?h2h={team_home_id}-{team_away_id}&last=5",
                headers=api_headers,
                timeout=10.0
            ).json()
            odds = httpx.get(
                f"https://v3.football.api-sports.io/odds?fixture={fixture_id}",
                headers=api_headers,
                timeout=10.0
            ).json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"API-Fehler: {str(e)}")

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

    injuries_home, injuries_away = [], []
    for team_data in injuries.get('response', []):
        if team_data['team']['id'] == team_home_id:
            injuries_home = [i['player']['name'] for i in team_data.get('injuries', [])]
        elif team_data['team']['id'] == team_away_id:
            injuries_away = [i['player']['name'] for i in team_data.get('injuries', [])]

    h2h_home_wins, h2h_away_wins = 0, 0
    for match in h2h.get('response', []):
        if match['teams']['home']['id'] == team_home_id and match['teams']['home']['winner']:
            h2h_home_wins += 1
        elif match['teams']['away']['id'] == team_away_id and match['teams']['away']['winner']:
            h2h_away_wins += 1

    odds_home, odds_draw, odds_away = 0.0, 0.0, 0.0
    if odds.get('response'):
        bookmakers = odds['response'][0].get('bookmakers', [])
        if bookmakers:
            for bet in bookmakers[0].get('bets', []):
                if bet['name'] == 'Match Winner':
                    for val in bet['values']:
                        if val['value'] == 'Home':
                            odds_home = float(val['odd'])
                        elif val['value'] == 'Draw':
                            odds_draw = float(val['odd'])
                        elif val['value'] == 'Away':
                            odds_away = float(val['odd'])

    score = (
        50
        + (wins_away - wins_home) * 5
        + (h2h_away_wins - h2h_home_wins) * 4
        - len(injuries_away) * 5
        + len(injuries_home) * 3
    )

    if odds_away > 0 and odds_home > 0 and odds_away < odds_home:
        score += 10

    score = max(0, min(100, score))
    prediction = "Away" if score > 55 else ("Home" if score < 45 else "Draw")

    analysis_data = {
        "api_fixture_id": fixture_id,
        "form_home": [
            f"{m['teams']['home']['name']} ({'W' if m['teams']['home']['winner'] else 'L'})"
            for m in form_home.get('response', [])
        ],
        "form_away": [
            f"{m['teams']['away']['name']} ({'W' if m['teams']['away']['winner'] else 'L'})"
            for m in form_away.get('response', [])
        ],
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

    supabase.table('match_analysis').upsert(
        analysis_data, on_conflict='api_fixture_id'
    ).execute()

    return {
        "fixture_id": fixture_id,
        "prediction": prediction,
        "confidence_score": score,
        "message": f"Analyse gespeichert! KI tippt: {prediction} ({score}%)"
    }


# ============ MATCHES ============
@app.get("/matches")
async def get_matches():
    try:
        matches_response = supabase.table("matches").select("*").execute()
        matches = matches_response.data or []
        matches_with_analysis = []
        for match in matches:
            analysis_response = supabase.table("match_analysis").select("*").eq(
                "api_fixture_id", match["api_fixture_id"]
            ).execute()
            analysis = analysis_response.data[0] if analysis_response.data else None
            matches_with_analysis.append({**match, "analysis": analysis})
        return matches_with_analysis
    except Exception as e:
        print(f"Fehler beim Laden der Spiele: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ TIPS ============
@app.get("/tips/{username}")
def get_user_tips(username: str):
    try:
        user_check = supabase.table('users').select('id').eq('username', username).execute()
        if not user_check.data:
            return []
        user_id = user_check.data[0]['id']
        result = supabase.table('user_tips').select("*").eq('user_id', user_id).execute()
        return result.data if result.data else []
    except Exception as e:
        print(f"Fehler beim Laden der Tipps: {e}")
        return []


@app.get("/tips/{username}/{fixture_id}")
def get_user_tip_for_fixture(username: str, fixture_id: int):
    try:
        user_check = supabase.table('users').select('id').eq('username', username).execute()
        if not user_check.data:
            raise HTTPException(status_code=404, detail="User nicht gefunden")
        user_id = user_check.data[0]['id']
        result = supabase.table('user_tips').select("*").eq(
            'user_id', user_id
        ).eq('api_fixture_id', fixture_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Kein Tipp gefunden")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tips")
def submit_tip(tip: TipInput):
    print(f"Neuer Tipp von {tip.username} für Spiel {tip.api_fixture_id}: {tip.predicted_winner}")
    user_check = supabase.table('users').select('id').eq('username', tip.username).execute()
    if not user_check.data:
        supabase.table('users').insert({"username": tip.username}).execute()
        user_id = supabase.table('users').select('id').eq(
            'username', tip.username
        ).execute().data[0]['id']
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

    supabase.table('user_tips').upsert(
        tip_data, on_conflict='user_id,api_fixture_id'
    ).execute()

    return {"message": f"Tipp von {tip.username} gespeichert!", "tip": tip_data}


# ============ RANKING & SCORES ============
@app.post("/match-results")
def save_match_result(result: MatchResultInput):
    try:
        result_data = {
            "api_fixture_id": result.api_fixture_id,
            "home_score": result.home_score,
            "away_score": result.away_score,
            "status": result.status
        }
        supabase.table('match_results').upsert(
            result_data, on_conflict='api_fixture_id'
        ).execute()
        return {"message": f"Ergebnis gespeichert: {result.home_score}:{result.away_score}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ranking")
def get_ranking():
    try:
        return {"message": "Ranking wird geladen", "data": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ SPIONAGE-TOOL ============
@app.get("/test-dir")
def test_directory():
    import os as _os
    current_path = Path(__file__).parent.resolve()
    root_path = current_path.parent.resolve()
    return {
        "current_file_location": str(__file__),
        "backend_folder_resolved": str(current_path),
        "files_in_backend": _os.listdir(current_path) if current_path.exists() else "not found",
        "files_in_root": _os.listdir(root_path) if root_path.exists() else "not found",
        "current_working_dir": _os.getcwd()
    }