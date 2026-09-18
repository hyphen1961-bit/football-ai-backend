from fastapi import FastAPI, HTTPException, JSONResponse  # <-- JSONResponse importieren!
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
import httpx
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional

load_dotenv()

# ... [Rest des bestehenden Codes] ...

@app.get("/tips/{username}/{fixture_id}")
async def get_user_tip(username: str, fixture_id: int):
    """
    Holt den Tipp eines Users für ein spezifisches Spiel
    """
    try:
        # Tipp aus Supabase laden
        tip = supabase.table("user_tips") \
            .select("*") \
            .eq("username", username) \
            .eq("api_fixture_id", fixture_id) \
            .execute()
        
        if not tip.data or len(tip.data) == 0:
            return JSONResponse(
                status_code=404, 
                content={"detail": "Kein Tipp gefunden"}
            )
        return tip.data[0]
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@app.get("/match-results/{fixture_id}")
async def get_match_result(fixture_id: int):
    """
    Holt das Ergebnis eines Spiels aus der Datenbank
    """
    try:
        # Ergebnis aus Supabase laden
        result = supabase.table("match_results") \
            .select("*") \
            .eq("api_fixture_id", fixture_id) \
            .execute()
        
        if not result.data or len(result.data) == 0:
            return JSONResponse(
                status_code=404, 
                content={"detail": "Kein Ergebnis gefunden"}
            )
        return result.data[0]
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})