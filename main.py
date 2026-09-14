from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import httpx
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.get("/")
def root():
    return {"message": "Football AI Backend läuft!"}

@app.get("/api/test")
async def test_api():
    url = "https://v3.football.api-sports.io/fixtures"
    headers = {"x-apisports-key": RAPIDAPI_KEY}
    today = datetime.now().strftime("%Y-%m-%d")
    params = {"league": "78", "season": "2026", "from": today, "to": today}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        data = response.json()
        return {"status": "success", "count": len(data.get("response", [])), "data": data}