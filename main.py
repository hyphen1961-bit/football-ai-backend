# ============================================================
# Football AI Kumpel-Tipp – Backend (FastAPI)
# ============================================================

import os
import httpx
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from supabase import create_client, Client


# ============================================================
# 1) APP INITIALISIERUNG
# ============================================================

app = FastAPI(
    title="Football AI Kumpel-Tipp",
    description="Backend für Tippspiel mit API-Football Daten",
    version="1.0.0"
)

# CORS: Erlaubt deinem Next.js Frontend (Vercel) Zugriffe
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",  # Ersetze durch deine echte Vercel-Domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# ============================================================
# 2) SUPABASE CLIENT
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")  # Service Role Key!

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("❌ SUPABASE_URL und SUPABASE_KEY müssen als Environment Variables gesetzt sein!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ============================================================
# 3) HELPER FUNKTIONEN
# ============================================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """JWT-Token validieren und User zurückgeben"""
    try:
        user = supabase.auth.get_user(credentials.credentials)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth failed: {str(e)}")


async def require_admin(current_user = Depends(get_current_user)):
    """Prüft, ob der User Admin ist"""
    result = supabase.table("users").select("role").eq("id", current_user.id).execute()
    
    if not result.data or result.data[0].get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return current_user


# ============================================================
# 4) HEALTH CHECK
# ============================================================

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Football AI Kumpel-Tipp API"}


@app.get("/health")
def health_detailed():
    return {
        "status": "ok",
        "supabase": "connected" if SUPABASE_URL else "missing",
        "rapidapi": "configured" if os.getenv("RAPIDAPI_KEY") else "missing"
    }


# ============================================================
# 5) MATCH-SYNC ENDPOINT (Admin only)
# ============================================================

@app.post("/api/sync/matches")
async def sync_matches(
    league: int = Query(78, description="Liga-ID (78=Bundesliga, 39=Premier League, 2=Champions League)"),
    season: int = Query(2026, description="Saison (z.B. 2026)"),
    current_user = Depends(require_admin)
):
    """
    Synct Matches von API-Football in die Supabase-Datenbank.
    Nur Admins dürfen das.
    """
    RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
    API_HOST = "v3.football.api-sports.io"
    
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="RAPIDAPI_KEY nicht konfiguriert")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://{API_HOST}/fixtures",
                params={"league": league, "season": season},
                headers={
                    "X-RapidAPI-Key": RAPIDAPI_KEY,
                    "X-RapidAPI-Host": API_HOST
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"API-Football Fehler: {response.status_code}"
                )
            
            data = response.json()
            
            if data.get("errors"):
                raise HTTPException(status_code=502, detail=f"API-Fehler: {data['errors']}")
            
            fixtures = data.get("response", [])
            
            if not fixtures:
                return {"message": "Keine Spiele gefunden", "count": 0}
            
            # Matches für Supabase vorbereiten
            matches_to_upsert = []
            for fixture in fixtures:
                # Matchday sauber extrahieren
                round_str = fixture["league"].get("round", "")
                matchday = None
                if "Regular Season - " in round_str:
                    try:
                        matchday = int(round_str.replace("Regular Season - ", ""))
                    except ValueError:
                        matchday = None
                
                match = {
                    "api_match_id": fixture["fixture"]["id"],
                    "league": fixture["league"]["name"],
                    "season": fixture["league"]["season"],
                    "matchday": matchday,
                    "home_team": fixture["teams"]["home"]["name"],
                    "away_team": fixture["teams"]["away"]["name"],
                    "home_score": fixture["goals"]["home"],
                    "away_score": fixture["goals"]["away"],
                    "kickoff_time": fixture["fixture"]["date"],
                    "status": fixture["fixture"]["status"]["short"]
                }
                matches_to_upsert.append(match)
            
            # Upsert in Supabase
            result = supabase.table("matches").upsert(
                matches_to_upsert,
                on_conflict="api_match_id"
            ).execute()
            
            return {
                "success": True,
                "count": len(matches_to_upsert),
                "league": league,
                "season": season
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="API-Football Timeout")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync fehlgeschlagen: {str(e)}")


# ============================================================
# 6) MATCHES LESEN
# ============================================================

@app.get("/api/matches")
async def get_matches(
    league: Optional[str] = None,
    season: Optional[int] = None,
    status: Optional[str] = None,
    upcoming: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    current_user = Depends(get_current_user)
):
    """Liest Matches aus der Datenbank"""
    try:
        query = supabase.table("matches").select("*")
        
        if league:
            query = query.eq("league", league)
        if season:
            query = query.eq("season", season)
        if status:
            query = query.eq("status", status)
        if upcoming:
            query = query.gte("kickoff_time", datetime.utcnow().isoformat() + "Z")
        
        query = query.order("kickoff_time", desc=False).limit(limit)
        
        result = query.execute()
        
        return {
            "matches": result.data,
            "count": len(result.data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Matches laden fehlgeschlagen: {str(e)}")


# ============================================================
# 7) TIPP-ENDPOINTS
# ============================================================

class TipCreate(BaseModel):
    match_id: int
    home_tip: int
    away_tip: int


class TipUpdate(BaseModel):
    home_tip: int
    away_tip: int


@app.post("/api/tips")
async def create_tip(tip: TipCreate, current_user = Depends(get_current_user)):
    """Tipp abgeben – nur vor Anpfiff, nur eigene"""
    try:
        result = supabase.table("user_tips").insert({
            "user_id": current_user.id,
            "match_id": tip.match_id,
            "home_tip": tip.home_tip,
            "away_tip": tip.away_tip
        }).execute()
        
        if not result.data:
            raise HTTPException(status_code=400, detail="Tipp konnte nicht angelegt werden")
        
        return {"success": True, "tip": result.data[0]}
        
    except Exception as e:
        error_str = str(e).lower()
        if "row-level security" in error_str or "new row violates" in error_str:
            raise HTTPException(
                status_code=403,
                detail="Tipp nicht erlaubt (Spiel bereits angepfiffen oder läuft)"
            )
        if "unique" in error_str or "duplicate" in error_str:
            raise HTTPException(
                status_code=409,
                detail="Du hast für dieses Spiel bereits einen Tipp abgegeben"
            )
        raise HTTPException(status_code=500, detail=f"Tipp fehlgeschlagen: {str(e)}")


@app.get("/api/tips")
async def get_my_tips(current_user = Depends(get_current_user)):
    """Eigene Tipps lesen"""
    try:
        result = supabase.table("user_tips").select("*, matches(*)").eq(
            "user_id", current_user.id
        ).order("created_at", desc=True).execute()
        
        return {"tips": result.data, "count": len(result.data)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tipps laden fehlgeschlagen: {str(e)}")


@app.put("/api/tips/{tip_id}")
async def update_tip(tip_id: int, tip: TipUpdate, current_user = Depends(get_current_user)):
    """Eigenen Tipp ändern – nur vor Anpfiff"""
    try:
        # Prüfen ob Tipp dem User gehört
        existing = supabase.table("user_tips").select("*").eq("id", tip_id).execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Tipp nicht gefunden")
        
        if existing.data[0]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Das ist nicht dein Tipp")
        
        result = supabase.table("user_tips").update({
            "home_tip": tip.home_tip,
            "away_tip": tip.away_tip
        }).eq("id", tip_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=400, detail="Update fehlgeschlagen")
        
        return {"success": True, "tip": result.data[0]}
        
    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e).lower()
        if "row-level security" in error_str or "new row violates" in error_str:
            raise HTTPException(
                status_code=403,
                detail="Änderung nicht erlaubt (Spiel bereits angepfiffen)"
            )
        raise HTTPException(status_code=500, detail=f"Update fehlgeschlagen: {str(e)}")


@app.delete("/api/tips/{tip_id}")
async def delete_tip(tip_id: int, current_user = Depends(get_current_user)):
    """Eigenen Tipp löschen – nur vor Anpfiff"""
    try:
        existing = supabase.table("user_tips").select("*").eq("id", tip_id).execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Tipp nicht gefunden")
        
        if existing.data[0]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Das ist nicht dein Tipp")
        
        supabase.table("user_tips").delete().eq("id", tip_id).execute()
        
        return {"success": True, "message": "Tipp gelöscht"}
        
    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e).lower()
        if "row-level security" in error_str:
            raise HTTPException(
                status_code=403,
                detail="Löschen nicht erlaubt (Spiel bereits angepfiffen)"
            )
        raise HTTPException(status_code=500, detail=f"Löschen fehlgeschlagen: {str(e)}")


@app.get("/api/tips/match/{match_id}")
async def get_tips_for_match(match_id: int, current_user = Depends(get_current_user)):
    """
    Alle Tipps für ein Match.
    RLS sorgt dafür: andere Tipps sieht man erst nach Anpfiff.
    """
    try:
        result = supabase.table("user_tips").select(
            "*, users(username, display_name)"
        ).eq("match_id", match_id).execute()
        
        return {"tips": result.data, "count": len(result.data)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tipps laden fehlgeschlagen: {str(e)}")


# ============================================================
# 8) USER-ENDPOINTS
# ============================================================

@app.get("/api/users/me")
async def get_my_profile(current_user = Depends(get_current_user)):
    """Eigenes Profil lesen"""
    try:
        result = supabase.table("users").select("*").eq("id", current_user.id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Profil nicht gefunden")
        
        return result.data[0]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profil laden fehlgeschlagen: {str(e)}")


@app.get("/api/users")
async def get_all_users(current_user = Depends(get_current_user)):
    """Alle User lesen (für Rangliste/Kumpel-Übersicht)"""
    try:
        result = supabase.table("users").select("id, username, display_name, avatar_url").execute()
        return {"users": result.data, "count": len(result.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"User laden fehlgeschlagen: {str(e)}")


# ============================================================
# 9) START
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))