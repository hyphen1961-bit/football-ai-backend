import os
import random
import string
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Football AI Kumpel-Tipp API")

# CORS erlauben, damit Vercel mit Railway sprechen darf
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
class RegisterUserInput(BaseModel):
    user_id: str
    username: str

class TipInput(BaseModel):
    user_id: str
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

# ============ REGISTRIERUNG (EINZIGARTIG & SAUBER) ============
@app.post("/register-anonymous-user")
def register_anonymous_user(user: RegisterUserInput):
    try:
        # 1. Hyphen-Key generieren
        random_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        signature_support_key = f"Hyphen-{random_code}"
        
        # 2. Daten für die Datenbank vorbereiten
        user_data = {
            "id": user.user_id,
            "username": user.username.strip(),
            "display_name": user.username.strip(),
            "avatar_url": signature_support_key
        }
        
        # 3. In Supabase speichern (RLS ist aus, daher kein Block)
        supabase.table('users').upsert(user_data, on_conflict='id').execute()
        
        print(f"✅ Kumpel {user.username} erfolgreich registriert mit Key: {signature_support_key}")
        
        return {
            "message": "User erfolgreich registriert!",
            "username": user.username,
            "support_key": signature_support_key
        }
    except Exception as e:
        print(f" Registrierungs-Fehler: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registrierungs-Fehler: {str(e)}")

# ============ MATCHES MIT ANALYSE ============
@app.get("/matches")
async def get_matches():
    try:
        matches_response = supabase.table("matches").select("*").execute()
        matches = matches_response.data or []
        
        matches_with_analysis = []
        for match in matches:
            fixture_id = match["api_fixture_id"]
            analysis_response = supabase.table("match_analysis").select("*").eq("api_fixture_id", fixture_id).execute()
            analysis = analysis_response.data[0] if analysis_response.data else None
            
            matches_with_analysis.append({
                **match,
                "analysis": analysis
            })
            
        return matches_with_analysis
    except Exception as e:
        print(f"Fehler beim Laden der Spiele: {e}")
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