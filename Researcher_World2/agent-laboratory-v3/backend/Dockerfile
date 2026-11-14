FROM python:3.9-slim

WORKDIR /app

# Copia i requisiti e installa le dipendenze
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia il codice del backend
COPY . .

# Espone la porta per FastAPI
EXPOSE 8091

# Comando per avviare l'applicazione
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8091"]