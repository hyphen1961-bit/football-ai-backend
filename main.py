# ============================================================
# MINIMAL VERSION – nur zum Testen
# ============================================================

import os
import httpx
from fastapi import FastAPI, HTTPException
from supabase import create_client, Client

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
            
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}