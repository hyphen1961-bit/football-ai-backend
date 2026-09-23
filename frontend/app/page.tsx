import os
import random
import string
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Football AI Kumpel-Tipp API")

# WICHTIG: Dies erlaubt deinem Vercel-Frontend den Zugriff!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ============ MODELS ============
class RegisterUserInput(BaseModel):
    user_id: str
    username: str

# ============ HEALTH CHECK ============
@app.get("/")
def read_root():
    return {"message": "Backend is running!", "status": "healthy"}

# ============ ISOLIERTER REGISTRIERUNGS-ENDPOINT ============
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
        
        # 3. In Supabase speichern (upsert verhindert Duplikate)
        supabase.table('users').upsert(user_data, on_conflict='id').execute()
        
        print(f"✅ Kumpel {user.username} erfolgreich registriert mit Key: {signature_support_key}")
        
        return {
            "message": "User erfolgreich registriert!",
            "username": user.username,
            "support_key": signature_support_key
        }
    except Exception as e:
        print(f"💥 Registrierungs-Fehler: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registrierungs-Fehler: {str(e)}")