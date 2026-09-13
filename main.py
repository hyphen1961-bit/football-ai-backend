from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = FastAPI()

# CORS erlauben
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST")

@app.get("/")
def root():
    return {"message": "Football AI Backend läuft!"}

@app.get("/api/test")
async def test_api():
    """Test-Endpoint um API-Football zu prüfen"""
    url = "https://v3.football.api-sports.io/fixtures"
    
    headers = {
        "x-apisports-key": RAPIDAPI_KEY
    }
    
    # Heutiges Datum (JETZT RICHTIG EINGERÜCKT!)
    today = datetime.now().strftime("%Y-%m-%d")

    params = {
        "league": "78",  # Bundesliga
        "season": "2026",  # Aktuelle Saison
        "from": today,
        "to": today
    }
    
    # AUCH DIESER TEIL MUSS EINGERÜCKT SEIN!
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        data = response.json()
        
        return {
            "status": "success",
            "count": len(data.get("response", [])),
            "data": data
        }