"""
Endpoints API per il servizio LLM di Agent Laboratory.
Gestisce le richieste per generare dialoghi e verificare lo stato del servizio.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Optional, Any, List
import asyncio
import logging
import sys
import os
import httpx

# Modifica dell'import per usare percorsi assoluti
# Ottieni il percorso assoluto delle directory del progetto
current_file = os.path.abspath(__file__)
routes_dir = os.path.dirname(current_file)
api_dir = os.path.dirname(routes_dir)
backend_dir = os.path.dirname(api_dir)

# Aggiungi il percorso backend al sys.path se non è già presente
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import assoluto invece di relativo
from ai.llm_connector import LLMConnector

# Configurazione del logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_routes")

# Crea il router FastAPI
router = APIRouter(prefix="/ai", tags=["AI"])

# Singleton per il connector LLM
_llm_connector = None

async def get_llm_connector():
    """
    Ottiene un'istanza del LLM connector.
    Utilizza un singleton per evitare di creare molteplici connessioni.
    """
    global _llm_connector
    if _llm_connector is None:
        _llm_connector = LLMConnector()
    return _llm_connector


# Modelli Pydantic per validazione richieste/risposte

class LLMStatusResponse(BaseModel):
    """Modello di risposta per lo stato del servizio LLM."""
    available: bool
    model: Optional[str] = None
    message: Optional[str] = None


class DialogGenerationRequest(BaseModel):
    """Modello per la richiesta di generazione dialogo."""
    agentId: str
    agentName: str
    agentRole: str
    agentSpecialization: str
    targetAgentId: Optional[str] = None
    targetAgentName: Optional[str] = None
    targetAgentRole: Optional[str] = None
    interactionType: str
    labType: str


class DialogGenerationResponse(BaseModel):
    """Modello per la risposta di generazione dialogo."""
    dialog: str
    isLLMGenerated: bool
    source: Optional[str] = None
    model: Optional[str] = None


@router.get("/status", response_model=LLMStatusResponse)
async def check_llm_availability():
    """
    Verifica se il servizio LLM è disponibile.
    Lightweight check: pinga Ollama /api/tags senza generare testo.
    """
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            if resp.status_code == 200:
                return {
                    "available": True,
                    "model": "qwen3.5:4b",
                    "message": "Ollama is reachable"
                }
            return {"available": False, "message": f"Ollama returned {resp.status_code}"}
    except Exception as e:
        return {"available": False, "message": f"Ollama unreachable: {str(e)}"}


@router.post("/generate-dialog", response_model=DialogGenerationResponse)
async def generate_dialog(request: DialogGenerationRequest, connector: LLMConnector = Depends(get_llm_connector)):
    """
    Genera un dialogo per un agente utilizzando il LLM.
    
    Args:
        request: Dati dell'agente e del contesto
        connector: Istanza LLM connector (iniettata automaticamente)
    
    Returns:
        Dialogo generato e flag che indica se è stato generato da LLM
    """
    try:
        # Costruisce il contesto per la generazione
        context = {
            "lab_state": request.labType,
            "nearby_agents": [
                f"{request.targetAgentRole or 'Researcher'}" if request.targetAgentId else "Nessuno"
            ],
            "fl_progress": "in corso",  # Questo potrebbe essere ottenuto dallo stato della simulazione
            "knowledge_base": f"Expertise in {request.agentSpecialization}"
        }
        
        # Determina la situazione in base al tipo di interazione
        situation = get_situation_from_interaction(
            request.interactionType, 
            request.targetAgentName, 
            request.targetAgentRole
        )
        
        # Genera il dialogo
        dialog = await connector.generate_researcher_dialog(
            agent_id=request.agentId,  # Aggiunto agent_id
            researcher_type=request.agentRole,
            specialization=request.agentSpecialization,
            context=context,
            current_situation=situation
        )
        
        # Log per debugging
        logger.info(f"Generated LLM dialog for agent {request.agentId}: {dialog[:30]}...")
        
        return {
            "dialog": dialog,
            "isLLMGenerated": True,
            "source": "llm",  # Aggiunto campo per identificare chiaramente la fonte
            "model": connector.model  # Aggiunto nome del modello
        }
    
    except Exception as e:
        logger.error(f"Error generating dialog: {str(e)}")
        # Restituisci un dialogo di fallback
        return {
            "dialog": f"I'm researching {request.agentSpecialization} in federated learning.",
            "isLLMGenerated": False,
            "source": "fallback",
            "model": None
        }


def get_situation_from_interaction(interaction_type: str, target_name: Optional[str], target_role: Optional[str]) -> str:
    """
    Determina la situazione di dialogo in base al tipo di interazione.
    
    Args:
        interaction_type: Tipo di interazione
        target_name: Nome dell'agente target (opzionale)
        target_role: Ruolo dell'agente target (opzionale)
        
    Returns:
        Descrizione della situazione per il prompt
    """
    target = f"{target_name} ({target_role})" if target_name and target_role else "un altro ricercatore"
    
    situations = {
        "meeting": f"Hai appena iniziato una riunione con {target}.",
        "discussion": f"Stai discutendo di federated learning con {target}.",
        "collaboration": f"Stai collaborando a un progetto di ricerca con {target}.",
        "presentation": f"Stai presentando i tuoi risultati di ricerca a {target}.",
        "working": "Stai lavorando autonomamente sui tuoi progetti di ricerca.",
        "breakthrough": "Hai appena fatto una scoperta interessante nel tuo lavoro.",
        "problem": "Hai incontrato un problema difficile nella tua ricerca.",
        "greeting": f"Incontri {target} nel laboratorio.",
    }
    
    return situations.get(interaction_type, f"Interagisci con {target}.")