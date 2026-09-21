FROM python:3.11-slim

# Wir sagen Docker, dass wir direkt im backend-Ordner arbeiten wollen!
WORKDIR /app/backend

# Kopiere die requirements aus dem backend-Ordner
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopiere den gesamten Inhalt des Projekts in den Container
COPY . /app

EXPOSE 8080

# Jetzt startet uvicorn direkt im richtigen Ordner, wo main.py und die json liegen!
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
