import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from pydantic import BaseModel
from typing import Optional
import httpx

app = FastAPI()

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL und SUPABASE_KEY müssen gesetzt sein!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


@app.post("/api/sync/matches/test")
async def sync_matches_test():
    """Test-Sync ohne Auth-Check"""
    
    API_FOOTBALL_KEY = os.getenv("RAPIDAPI_KEY")
    
    if not API_FOOTBALL_KEY:
        raise HTTPException(status_code=500, detail="RAPIDAPI_KEY nicht gesetzt")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://v3.football.api-sports.io/fixtures",
                params={"league": 78, "season": 2026},
                headers={
                    "X-RapidAPI-Key": API_FOOTBALL_KEY,
                    "X-RapidAPI-Host": "v3.football.api-sports.io"
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                return {"error": f"API returned {response.status_code}", "body": response.text}
            
            data = response.json()
            
            # Nur erste 3 Matches zum Testen
            fixtures = data.get("response", [])[:3]
            
            matches_to_upsert = []
            for fixture in fixtures:
                match = {
                    "api_match_id": fixture["fixture"]["id"],
                    "league": fixture["league"]["name"],
                    "season": fixture["league"]["season"],
                    "matchday": None,
                    "home_team": fixture["teams"]["home"]["name"],
                    "away_team": fixture["teams"]["away"]["name"],
                    "home_score": fixture["goals"]["home"],
                    "away_score": fixture["goals"]["away"],
                    "kickoff_time": fixture["fixture"]["date"],
                    "status": fixture["fixture"]["status"]["short"]
                }
                matches_to_upsert.append(match)
            
            result = supabase.table("matches").upsert(
                matches_to_upsert,
                on_conflict="api_match_id"
            ).execute()
            
            return {
                "success": True,
                "count": len(matches_to_upsert),
                "sample": matches_to_upsert[0] if matches_to_upsert else None
            }
            
# ============================================================
# TIPP-ENDPOINTS
# ============================================================

from pydantic import BaseModel
from typing import Optional


class TipCreate(BaseModel):
    match_id: int
    home_tip: int
    away_tip: int


class TipUpdate(BaseModel):
    home_tip: int
    away_tip: int


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Verifiziert JWT und gibt User-Daten zurück"""
    try:
        user = supabase.auth.get_user(credentials.credentials)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth failed: {str(e)}")


@app.post("/api/tips")
async def create_tip(
    tip: TipCreate,
    current_user: dict = Depends(get_current_user)
):
    """Tipp abgeben - nur vor Anpfiff, nur eigene Tipps"""
    try:
        # Tipp in Supabase anlegen
        result = supabase.table("user_tips").insert({
            "user_id": current_user.id,
            "match_id": tip.match_id,
            "home_tip": tip.home_tip,
            "away_tip": tip.away_tip
        }).execute()
        
        if not result.data:
            raise HTTPException(status_code=400, detail="Failed to create tip")
        
        return {
            "success": True,
            "tip": result.data[0]
        }
        
    except Exception as e:
        # RLS-Policy verletzt (z.B. nach Anpfiff)
        if "row-level security" in str(e).lower() or "new row violates" in str(e).lower():
            raise HTTPException(
                status_code=403,
                detail="Tip not allowed (match already started or not in NS status)"
            )
        raise HTTPException(status_code=500, detail=f"Failed to create tip: {str(e)}")


@app.get("/api/tips")
async def get_tips(
    match_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Eigene Tipps lesen.
    Wenn match_id angegeben: auch Tipps anderer (aber nur nach Anpfiff via RLS).
    """
    try:
        query = supabase.table("user_tips").select("*, matches(*)")
        
        if match_id:
            query = query.eq("match_id", match_id)
        else:
            # Nur eigene Tipps
            query = query.eq("user_id", current_user.id)
        
        query = query.order("created_at", desc=True)
        
        result = query.execute()
        
        return {
            "tips": result.data,
            "count": len(result.data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tips: {str(e)}")


@app.put("/api/tips/{tip_id}")
async def update_tip(
    tip_id: int,
    tip: TipUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Tipp ändern - nur eigene, nur vor Anpfiff"""
    try:
        # Erst prüfen, ob der Tipp dem User gehört
        existing = supabase.table("user_tips").select("*").eq("id", tip_id).execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Tip not found")
        
        if existing.data[0]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Not your tip")
        
        # Update durchführen
        result = supabase.table("user_tips").update({
            "home_tip": tip.home_tip,
            "away_tip": tip.away_tip
        }).eq("id", tip_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=400, detail="Failed to update tip")
        
        return {
            "success": True,
            "tip": result.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if "row-level security" in str(e).lower() or "new row violates" in str(e).lower():
            raise HTTPException(
                status_code=403,
                detail="Update not allowed (match already started)"
            )
        raise HTTPException(status_code=500, detail=f"Failed to update tip: {str(e)}")


@app.delete("/api/tips/{tip_id}")
async def delete_tip(
    tip_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Tipp löschen - nur eigene, nur vor Anpfiff"""
    try:
        # Erst prüfen, ob der Tipp dem User gehört
        existing = supabase.table("user_tips").select("*").eq("id", tip_id).execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Tip not found")
        
        if existing.data[0]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Not your tip")
        
        # Delete durchführen
        result = supabase.table("user_tips").delete().eq("id", tip_id).execute()
        
        return {
            "success": True,
            "message": "Tip deleted"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if "row-level security" in str(e).lower():
            raise HTTPException(
                status_code=403,
                detail="Delete not allowed (match already started)"
            )
        raise HTTPException(status_code=500, detail=f"Failed to delete tip: {str(e)}")


@app.get("/api/tips/match/{match_id}")
async def get_tips_for_match(
    match_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Alle Tipps für ein bestimmtes Match.
    RLS sorgt dafür, dass andere Tipps erst nach Anpfiff sichtbar sind.
    """
    try:
        result = supabase.table("user_tips").select("*, users(username, display_name)").eq("match_id", match_id).execute()
        
        return {
            "tips": result.data,
            "count": len(result.data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tips: {str(e)}")

    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}