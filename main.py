# ============================================================
# MATCH-SYNC ENDPOINT
# ============================================================

import httpx
from datetime import datetime
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

# Security
security = HTTPBearer()

# Supabase Client (sollte schon initialisiert sein)
# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Verifiziert JWT und prüft Admin-Rolle"""
    try:
        # JWT verifizieren via Supabase
        user = supabase.auth.get_user(credentials.credentials)
        
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Admin-Rolle prüfen
        user_data = supabase.table("users").select("role").eq("id", user.user.id).execute()
        
        if not user_data.data or user_data.data[0].get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        return user.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth failed: {str(e)}")


@app.post("/api/sync/matches")
async def sync_matches(
    league: int = 78,  # Bundesliga default
    season: int = 2026,
    current_user: dict = Depends(get_current_admin)
):
    """
    Synct Matches von API-Football in die Datenbank.
    Admin-only. Upsert-Logik: Neue Matches werden angelegt, bestehende aktualisiert.
    """
    
    API_FOOTBALL_KEY = os.getenv("RAPIDAPI_KEY")
    API_FOOTBALL_HOST = "v3.football.api-sports.io"
    
    try:
        # API-Football aufrufen
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://{API_FOOTBALL_HOST}/fixtures",
                params={
                    "league": league,
                    "season": season
                },
                headers={
                    "X-RapidAPI-Key": API_FOOTBALL_KEY,
                    "X-RapidAPI-Host": API_FOOTBALL_HOST
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"API-Football error: {response.status_code}"
                )
            
            data = response.json()
            
            if data.get("errors"):
                raise HTTPException(
                    status_code=502,
                    detail=f"API-Football errors: {data['errors']}"
                )
            
            fixtures = data.get("response", [])
            
            if not fixtures:
                return {"message": "No fixtures found", "count": 0}
            
            # Matches für Supabase vorbereiten
            matches_to_upsert = []
            
            for fixture in fixtures:
                match = {
                    "api_match_id": fixture["fixture"]["id"],
                    "league": fixture["league"]["name"],
                    "season": fixture["league"]["season"],
                    "matchday": fixture["league"]["round"].replace("Regular Season - ", "") if "Regular Season" in fixture["league"]["round"] else None,
                    "home_team": fixture["teams"]["home"]["name"],
                    "away_team": fixture["teams"]["away"]["name"],
                    "home_score": fixture["goals"]["home"],
                    "away_score": fixture["goals"]["away"],
                    "kickoff_time": fixture["fixture"]["date"],
                    "status": fixture["fixture"]["status"]["short"]
                }
                matches_to_upsert.append(match)
            
            # Upsert in Supabase (via api_match_id als unique key)
            result = supabase.table("matches").upsert(
                matches_to_upsert,
                on_conflict="api_match_id"
            ).execute()
            
            return {
                "message": "Sync successful",
                "count": len(matches_to_upsert),
                "league": league,
                "season": season
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="API-Football timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@app.get("/api/matches")
async def get_matches(
    league: str = None,
    season: int = None,
    status: str = None,
    limit: int = 50
):
    """
    Holt Matches aus der Datenbank.
    Öffentlich für authentifizierte User (via RLS).
    """
    try:
        query = supabase.table("matches").select("*")
        
        if league:
            query = query.eq("league", league)
        if season:
            query = query.eq("season", season)
        if status:
            query = query.eq("status", status)
        
        query = query.order("kickoff_time", desc=False).limit(limit)
        
        result = query.execute()
        
        return {
            "matches": result.data,
            "count": len(result.data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch matches: {str(e)}")