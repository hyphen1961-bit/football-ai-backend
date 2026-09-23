import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client

app = FastAPI(title="Football AI Backend")

# --- CORS REPARATUR (Erlaubt Vercel den uneingeschränkten Datenabruf) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://football-ai-backend.vercel.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DEINE UNUMSTÖSSLICHEN VERBINDUNGSDATEN ---
SUPABASE_URL = "https://knjgiaphysdgxenritzh.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamdpYXBoeXNkZ3hlbnJpdHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjY2NzIsImV4cCI6MjEwNDg0MjY3Mn0.iwZnNtcga1XPd1cyb2OJwjhvRIIrDxzbrmRed2LuShs"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

@app.get("/")
def read_root():
    return {"message": "Football AI API is running!", "status": "healthy"}

@app.get("/matches")
def get_matches():
    try:
        # Holt die Live-Spieldaten direkt aus deiner echten Tabelle
        response = supabase.from_("matches").select("*").execute()
        return response.data if response.data else []
    except Exception as e:
        return {"error": str(e)}
