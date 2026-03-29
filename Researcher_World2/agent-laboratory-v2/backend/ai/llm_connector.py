"""
LLM Connector per Agent Laboratory.
Gestisce la comunicazione con Ollama per fornire capacità di ragionamento agli agenti.
Implementa il framework cognitivo descritto nella sezione 6 del documento di analisi.
"""

import json
import logging
import time
import os
from typing import Dict, List, Optional, Any, Tuple

import httpx

# Configurazione del logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("llm_connector")

class AgentMemory:
    """
    Sistema di memoria per agenti autonomi come descritto nella sezione 6.3.
    Implementa memoria a breve termine, a lungo termine, episodica e semantica.
    """
    
    def __init__(self, agent_id: str, capacity: Dict[str, int] = None):
        """
        Inizializza il sistema di memoria dell'agente.
        
        Args:
            agent_id: Identificativo unico dell'agente
            capacity: Capacità delle diverse memorie
        """
        self.agent_id = agent_id
        
        # Imposta le capacità delle diverse memorie
        self.capacity = capacity or {
            "short_term": 10,  # Ultime 10 interazioni
            "episodic": 20,    # 20 eventi significativi
            "semantic": 50     # 50 concetti FL e relazioni
        }
        
        # Inizializza le memorie
        self.short_term_memory = []    # Interazioni recenti
        self.long_term_memory = {}     # Conoscenze accumulate per categoria
        self.episodic_memory = []      # Eventi significativi
        self.semantic_memory = {}      # Concetti FL e relazioni
    
    def add_short_term_memory(self, interaction: Dict[str, Any]):
        """
        Aggiunge un'interazione alla memoria a breve termine.
        
        Args:
            interaction: Dati dell'interazione
        """
        # Aggiungi timestamp se non presente
        if "timestamp" not in interaction:
            interaction["timestamp"] = time.time()
            
        # Aggiungi alla memoria a breve termine
        self.short_term_memory.append(interaction)
        
        # Mantieni la dimensione entro i limiti
        if len(self.short_term_memory) > self.capacity["short_term"]:
            self.short_term_memory.pop(0)
    
    def add_episodic_memory(self, event: Dict[str, Any], importance: float = 0.5):
        """
        Aggiunge un evento significativo alla memoria episodica.
        
        Args:
            event: Dati dell'evento
            importance: Importanza dell'evento (0-1)
        """
        # Aggiungi timestamp e importanza
        if "timestamp" not in event:
            event["timestamp"] = time.time()
        event["importance"] = importance
        
        # Aggiungi alla memoria episodica
        self.episodic_memory.append(event)
        
        # Ordina per importanza
        self.episodic_memory.sort(key=lambda x: x["importance"], reverse=True)
        
        # Mantieni la dimensione entro i limiti
        if len(self.episodic_memory) > self.capacity["episodic"]:
            self.episodic_memory.pop()
    
    def add_semantic_memory(self, concept: str, data: Dict[str, Any]):
        """
        Aggiunge o aggiorna un concetto nella memoria semantica.
        
        Args:
            concept: Concetto FL
            data: Dati associati al concetto
        """
        # Aggiorna il timestamp
        data["last_updated"] = time.time()
        
        # Aggiorna o aggiungi il concetto
        self.semantic_memory[concept] = data
        
        # Mantieni la dimensione entro i limiti
        if len(self.semantic_memory) > self.capacity["semantic"]:
            # Rimuovi il concetto meno recentemente aggiornato
            oldest_concept = min(self.semantic_memory.keys(), 
                                key=lambda k: self.semantic_memory[k].get("last_updated", 0))
            del self.semantic_memory[oldest_concept]
    
    def update_long_term_memory(self, category: str, key: str, value: Any):
        """
        Aggiorna la memoria a lungo termine.
        
        Args:
            category: Categoria di conoscenza
            key: Chiave della conoscenza
            value: Valore della conoscenza
        """
        # Crea la categoria se non esiste
        if category not in self.long_term_memory:
            self.long_term_memory[category] = {}
        
        # Aggiorna la conoscenza
        self.long_term_memory[category][key] = {
            "value": value,
            "last_updated": time.time()
        }
    
    def get_memory_context(self, context_type: str = "full") -> Dict[str, Any]:
        """
        Recupera il contesto di memoria in base al tipo richiesto.
        
        Args:
            context_type: Tipo di contesto (full, short_term, episodic, semantic, long_term)
            
        Returns:
            Contesto di memoria
        """
        if context_type == "short_term":
            return {"short_term_memory": self.short_term_memory}
        elif context_type == "episodic":
            return {"episodic_memory": self.episodic_memory}
        elif context_type == "semantic":
            return {"semantic_memory": self.semantic_memory}
        elif context_type == "long_term":
            return {"long_term_memory": self.long_term_memory}
        else:  # full
            return {
                "short_term_memory": self.short_term_memory[-3:],  # Solo le ultime 3 interazioni
                "long_term_memory": self.long_term_memory,
                "episodic_memory": sorted(self.episodic_memory, 
                                         key=lambda x: x.get("importance", 0), 
                                         reverse=True)[:5],  # 5 eventi più importanti
                "semantic_memory": {k: v for i, (k, v) in enumerate(self.semantic_memory.items()) if i < 10}  # 10 concetti
            }
    
    def serialize(self) -> Dict[str, Any]:
        """
        Serializza la memoria per lo storage.
        
        Returns:
            Memoria serializzata
        """
        return {
            "agent_id": self.agent_id,
            "capacity": self.capacity,
            "short_term_memory": self.short_term_memory,
            "long_term_memory": self.long_term_memory,
            "episodic_memory": self.episodic_memory,
            "semantic_memory": self.semantic_memory
        }
    
    @classmethod
    def deserialize(cls, data: Dict[str, Any]) -> 'AgentMemory':
        """
        Deserializza la memoria dallo storage.
        
        Args:
            data: Memoria serializzata
            
        Returns:
            Istanza AgentMemory
        """
        memory = cls(data["agent_id"], data["capacity"])
        memory.short_term_memory = data["short_term_memory"]
        memory.long_term_memory = data["long_term_memory"]
        memory.episodic_memory = data["episodic_memory"]
        memory.semantic_memory = data["semantic_memory"]
        return memory


class LLMConnector:
    """
    Classe per gestire la comunicazione con Ollama LLM.
    Fornisce metodi per generare testo e decisioni per gli agenti.
    Implementa il framework cognitivo descritto nella sezione 6 del documento di analisi.
    """
    
    def __init__(
        self, 
        config_path: str = None
    ):
        """
        Inizializza il connector.
        
        Args:
            config_path: Percorso al file di configurazione LLM
        """
        # Carica la configurazione
        self.config = self._load_config(config_path)
        
        # Estrai parametri di configurazione
        llm_config = self.config.get("llm", {})
        self.base_url = llm_config.get("base_url", "http://localhost:11434")
        self.model = llm_config.get("model", "qwen3:0.6b")
        self.timeout = llm_config.get("timeout", 30)
        self.parameters = llm_config.get("parameters", {
            "temperature": 0.7,
            "top_p": 0.9,
            "max_tokens": 200
        })
        
        # Inizializza il client HTTP
        self.client = httpx.AsyncClient(timeout=self.timeout)
        
        # Cache per le diverse generazioni
        self.cache = {
            "dialogs": {},
            "decisions": {},
            "actions": {},
            "reactions": {},
            "collaborations": {}
        }
        self.enable_caching = self.config.get("dialog_generation", {}).get("enable_caching", True)
        self.cache_expiry = self.config.get("dialog_generation", {}).get("cache_expiry_seconds", 60)
        
        # Sistema di memoria degli agenti
        self.agent_memories = {}
        
        logger.info(f"LLM Connector inizializzato con modello: {self.model}")
    
    def _load_config(self, config_path: str = None) -> Dict[str, Any]:
        """
        Carica la configurazione LLM.
        
        Args:
            config_path: Percorso al file di configurazione
            
        Returns:
            Configurazione LLM
        """
        # Se non è specificato un percorso, usa quello di default
        if config_path is None:
            # Ottieni il percorso del file corrente
            current_file = os.path.abspath(__file__)
            ai_dir = os.path.dirname(current_file)
            backend_dir = os.path.dirname(ai_dir)
            config_path = os.path.join(backend_dir, "config", "llm_config.json")
        
        # Verifica se il file esiste
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    
                    # Aggiungi i template mancanti se non presenti
                    if "prompt_templates" not in config:
                        config["prompt_templates"] = {}
                    
                    prompt_templates = config["prompt_templates"]
                    
                    # Aggiungi template di base se non presenti
                    if "fl_decision" not in prompt_templates:
                        prompt_templates["fl_decision"] = self._get_default_fl_decision_template()
                    
                    if "action_plan" not in prompt_templates:
                        prompt_templates["action_plan"] = self._get_default_action_plan_template()
                    
                    if "event_reaction" not in prompt_templates:
                        prompt_templates["event_reaction"] = self._get_default_event_reaction_template()
                    
                    if "collaboration_proposal" not in prompt_templates:
                        prompt_templates["collaboration_proposal"] = self._get_default_collaboration_proposal_template()
                    
                    return config
            except Exception as e:
                logger.error(f"Error loading LLM config: {e}")
        
        # Configurazione di default
        logger.warning(f"LLM config file not found at {config_path}, using defaults")
        return {
            "llm": {
                "enabled": True,
                "model": "qwen3:0.6b",
                "base_url": "http://localhost:11434",
                "timeout": 30,
                "parameters": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "max_tokens": 200
                }
            },
            "dialog_generation": {
                "enable_caching": True,
                "cache_expiry_seconds": 3600,
                "fallback_dialogs": {
                    "student": "Sto lavorando sull'ottimizzazione del nostro algoritmo di federated learning per una migliore privacy.",
                    "student_postdoc": "Sto analizzando i dati clinici per migliorare il modello federato con tecniche di data science.",
                    "researcher": "Sto analizzando le proprietà di convergenza del nostro modello con dati non-IID.",
                    "professor": "Vi mostro le garanzie teoriche del nostro approccio al federated learning.",
                    "default": "Sono concentrato sulla mia ricerca in federated learning."
                }
            },
            "prompt_templates": {
                "researcher_dialog": "Sei un {researcher_type} specializzato in {specialization}.\nIl tuo obiettivo è fare ricerca su federated learning.\n\nContesto attuale:\n- Stato laboratorio: {lab_state}\n- Agenti vicini: {nearby_agents}\n- Progresso ricerca FL: {fl_progress}\n- Conoscenze attuali: {knowledge_base}\n\nSituazione: {current_situation}\n\nRispondi con un breve dialogo realistico (1-2 frasi) che questo ricercatore potrebbe dire in questa situazione.\nIl dialogo deve essere chiaro, conciso e in prima persona.",
                "fl_decision": self._get_default_fl_decision_template(),
                "action_plan": self._get_default_action_plan_template(),
                "event_reaction": self._get_default_event_reaction_template(),
                "collaboration_proposal": self._get_default_collaboration_proposal_template()
            }
        }
    
    def _get_default_fl_decision_template(self) -> str:
        """
        Restituisce il template predefinito per decisioni FL.
        
        Returns:
            Template per decisioni FL
        """
        return """Sei un {researcher_type} specializzato in {specialization} che lavora su algoritmi di federated learning.

Contesto attuale:
- Stato attuale algoritmo FL: {fl_state}
- Sfide correnti: {fl_challenges}
- Requisiti: {requirements}
- Vincoli: {constraints}
- Metriche da ottimizzare: {optimization_metrics}

Devi prendere una decisione su {decision_type} per il sistema di federated learning.
Opzioni disponibili: {available_options}

Rispondi con una decisione concisa che includa:
1. La scelta specifica
2. Una breve motivazione (1 frase)
3. Parametri suggeriti (se applicabile)

Mantieni la risposta breve e tecnica."""
    
    def _get_default_action_plan_template(self) -> str:
        """
        Restituisce il template predefinito per piani d'azione.
        
        Returns:
            Template per piani d'azione
        """
        return """Sei un {researcher_type} specializzato in {specialization}.

Contesto attuale:
- Stato laboratorio: {lab_state}
- Stato FL: {fl_state}
- Compiti in sospeso: {pending_tasks}
- Priorità: {priorities}
- Risorse disponibili: {available_resources}

Obiettivo: {goal}

Pianifica le prossime azioni che intraprenderai per raggiungere questo obiettivo.
Rispondi con un piano d'azione conciso che includa:
1. Azione immediata (cosa farai ora)
2. Prossimi passi (2-3 azioni successive in ordine)
3. Risorse necessarie

Mantieni il piano breve e pratico."""
    
    def _get_default_event_reaction_template(self) -> str:
        """
        Restituisce il template predefinito per reazioni a eventi.
        
        Returns:
            Template per reazioni a eventi
        """
        return """Sei un {researcher_type} specializzato in {specialization}.

Contesto attuale:
- Stato laboratorio: {lab_state}
- Attività corrente: {current_activity}
- Interazioni recenti: {recent_interactions}

Un evento è appena accaduto: {event_description}

Come reagisci a questo evento? Considera:
- Il tuo ruolo e specializzazione
- L'impatto potenziale sul tuo lavoro di ricerca
- Le opportunità o minacce che presenta

Rispondi con:
1. La tua reazione immediata (1 frase)
2. Cosa farai di conseguenza (1-2 frasi)

Mantieni la risposta breve e realistica."""
    
    def _get_default_collaboration_proposal_template(self) -> str:
        """
        Restituisce il template predefinito per proposte di collaborazione.
        
        Returns:
            Template per proposte di collaborazione
        """
        return """Sei un {researcher_type} specializzato in {specialization}.

Contesto attuale:
- Tuo progetto di ricerca: {research_project}
- Tuoi punti di forza: {strengths}
- Tue esigenze: {needs}

Potenziale collaboratore: {collaborator_type} specializzato in {collaborator_specialization}
- Loro progetto: {collaborator_project}
- Loro punti di forza: {collaborator_strengths}
- Potenziale sinergia: {potential_synergy}

Formula una proposta di collaborazione che:
1. Evidenzi il beneficio reciproco
2. Definisca un obiettivo comune concreto
3. Suggerisca un primo passo pratico

La proposta deve essere concisa, specifica e convincente."""
    
    async def close(self):
        """Chiude il client HTTP."""
        await self.client.aclose()
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        """
        Genera testo utilizzando il LLM.
        
        Args:
            prompt: Testo di input per il LLM
            **kwargs: Parametri aggiuntivi per la richiesta
            
        Returns:
            Testo generato dal LLM
        """
        start_time = time.time()
        
        # Prepara i parametri della richiesta
        model = kwargs.get("model", self.model)
        options = kwargs.get("options", {})
        
        # Unisci i parametri di default con quelli specificati
        for key, value in self.parameters.items():
            if key not in options:
                options[key] = value
        
        # Prepara la richiesta
        request_data = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": options
        }
        
        try:
            # Invia la richiesta a Ollama
            response = await self.client.post(
                f"{self.base_url}/api/generate",
                json=request_data,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            # Processa la risposta
            result = response.json()
            
            # Log delle performance
            elapsed = time.time() - start_time
            logger.debug(f"LLM request completed in {elapsed:.2f}s")
            
            return result.get("response", "")
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error: {e.response.status_code} - {e.response.text}")
            return f"Error generating text: HTTP {e.response.status_code}"
        except httpx.RequestError as e:
            logger.error(f"Request error: {str(e)}")
            return "Error connecting to LLM service"
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return "Unexpected error occurred"
    
    def _get_cache_key(self, cache_type: str, **kwargs) -> str:
        """
        Genera una chiave per la cache.
        
        Args:
            cache_type: Tipo di cache
            **kwargs: Parametri per la generazione della chiave
            
        Returns:
            Chiave cache
        """
        # Crea una stringa con i parametri ordinati
        key_parts = []
        for k in sorted(kwargs.keys()):
            if isinstance(kwargs[k], (str, int, float, bool)):
                key_parts.append(f"{k}={kwargs[k]}")
            elif isinstance(kwargs[k], list):
                key_parts.append(f"{k}={','.join(str(i) for i in kwargs[k])}")
            elif isinstance(kwargs[k], dict):
                key_parts.append(f"{k}={json.dumps(kwargs[k], sort_keys=True)}")
        
        return f"{cache_type}:{':'.join(key_parts)}"
    
    def _check_cache(self, cache_type: str, **kwargs) -> Optional[str]:
        """
        Verifica se esiste una risposta in cache.
        
        Args:
            cache_type: Tipo di cache
            **kwargs: Parametri per la generazione della chiave
            
        Returns:
            Risposta in cache o None
        """
        if not self.enable_caching:
            return None
        
        cache_key = self._get_cache_key(cache_type, **kwargs)
        cached_result = self.cache[cache_type].get(cache_key)
        
        if cached_result:
            cache_time, response = cached_result
            # Verifica se la cache è ancora valida
            if time.time() - cache_time < self.cache_expiry:
                logger.debug(f"Using cached {cache_type} response")
                return response
        
        return None
    
    def _update_cache(self, cache_type: str, response: str, **kwargs):
        """
        Aggiorna la cache con la nuova risposta.
        
        Args:
            cache_type: Tipo di cache
            response: Risposta da salvare
            **kwargs: Parametri per la generazione della chiave
        """
        if not self.enable_caching:
            return
        
        cache_key = self._get_cache_key(cache_type, **kwargs)
        self.cache[cache_type][cache_key] = (time.time(), response)
    
    def _get_fallback_response(self, response_type: str, agent_type: str) -> str:
        """
        Ottiene una risposta di fallback.
        
        Args:
            response_type: Tipo di risposta
            agent_type: Tipo di agente
            
        Returns:
            Risposta di fallback
        """
        if response_type == "dialog":
            # Normalize agent type: strip suffixes like _portrait
            normalized = agent_type.lower().replace("_portrait", "")
            fallback_pools = {
                "professor": [
                    "Vi mostro le garanzie teoriche del nostro approccio al federated learning.",
                    "Analizziamo le proprietà di convergenza del modello.",
                    "Dobbiamo confrontare FedAvg con FedProx sui nostri dati.",
                    "Ho rivisto i risultati: il modello converge dopo 15 round.",
                    "La distribuzione non-IID è il vero problema qui.",
                ],
                "researcher": [
                    "Sto analizzando le proprietà di convergenza del nostro modello con dati non-IID.",
                    "Ho trovato un modo per ridurre il budget di privacy.",
                    "L'efficienza della comunicazione è la sfida principale.",
                    "Sto testando diverse strategie di partizionamento dati.",
                    "Il gradient clipping migliora la stabilità del training.",
                ],
                "student": [
                    "Sto implementando un nuovo metodo di aggregazione.",
                    "Il dataset che uso ha una distribuzione molto sbilanciata.",
                    "La loss non scende dopo il round 20, possibile overfitting.",
                    "Sto scrivendo la sezione metodologica del paper.",
                    "Posso occuparmi dell'implementazione del client sampling.",
                ],
                "privacy_specialist": [
                    "Il nostro approccio fornisce forti garanzie di privacy con perdita minima di accuratezza.",
                    "Il budget epsilon è quasi esaurito per questo round.",
                    "Ho verificato la conformità con il framework NIST.",
                    "La differential privacy locale offre garanzie più forti.",
                    "Ho simulato un attacco di model inversion: siamo protetti.",
                ],
                "doctor": [
                    "La privacy dei pazienti deve essere la nostra priorità.",
                    "Il modello federato rispetta le normative GDPR.",
                    "Servono più ospedali nel consorzio per migliorare l'accuracy.",
                    "Il comitato etico ha approvato il protocollo federato.",
                    "La sensibilità del modello diagnostico è al 94%.",
                ],
            }
            import random
            pool = fallback_pools.get(normalized)
            if pool:
                return random.choice(pool)
            # Try config fallbacks
            fallbacks = self.config.get("dialog_generation", {}).get("fallback_dialogs", {})
            return fallbacks.get(normalized, fallbacks.get("default", "Proseguo con la mia ricerca."))
        elif response_type == "fl_decision":
            return "Uso l'algoritmo FedAvg con parametri predefiniti."
        elif response_type == "action_plan":
            return "Proseguo con il task di ricerca corrente. Prossimi passi: analisi risultati, discussione con il team, documentazione."
        elif response_type == "event_reaction":
            return "Analizzo come questo influisce sulla nostra ricerca e adatto il nostro approccio di conseguenza."
        elif response_type == "collaboration_proposal":
            return "Collaboriamo sull'ottimizzazione dei modelli. Condivido le mie tecniche di privacy se puoi aiutare con l'analisi di convergenza."
        else:
            return "Proseguo con il task corrente."
    
    def get_agent_memory(self, agent_id: str) -> AgentMemory:
        """
        Ottiene la memoria di un agente, creandola se non esiste.
        
        Args:
            agent_id: Identificativo dell'agente
            
        Returns:
            Memoria dell'agente
        """
        if agent_id not in self.agent_memories:
            self.agent_memories[agent_id] = AgentMemory(agent_id)
        
        return self.agent_memories[agent_id]
    
    def update_agent_memory(self, agent_id: str, memory_type: str, data: Any, **kwargs):
        """
        Aggiorna la memoria di un agente.
        
        Args:
            agent_id: Identificativo dell'agente
            memory_type: Tipo di memoria (short_term, episodic, semantic, long_term)
            data: Dati da memorizzare
            **kwargs: Parametri aggiuntivi
        """
        memory = self.get_agent_memory(agent_id)
        
        if memory_type == "short_term":
            memory.add_short_term_memory(data)
        elif memory_type == "episodic":
            importance = kwargs.get("importance", 0.5)
            memory.add_episodic_memory(data, importance)
        elif memory_type == "semantic":
            concept = kwargs.get("concept")
            if concept:
                memory.add_semantic_memory(concept, data)
        elif memory_type == "long_term":
            category = kwargs.get("category")
            key = kwargs.get("key")
            if category and key:
                memory.update_long_term_memory(category, key, data)
    
    async def generate_researcher_dialog(
        self,
        agent_id: str,
        researcher_type: str,
        specialization: str,
        context: Dict[str, Any],
        current_situation: str
    ) -> str:
        """
        Genera un dialogo per un ricercatore in base al contesto.
        
        Args:
            agent_id: Identificativo dell'agente
            researcher_type: Tipo di ricercatore (PhD, Professor, ecc.)
            specialization: Specializzazione del ricercatore
            context: Contesto attuale (ambiente, altri agenti, ecc.)
            current_situation: Situazione specifica a cui reagire
            
        Returns:
            Dialogo generato per il ricercatore
        """
        # Verifica se c'è una risposta in cache
        cached_response = self._check_cache(
            "dialogs", 
            researcher_type=researcher_type,
            specialization=specialization,
            situation=current_situation
        )
        
        if cached_response:
            return cached_response
        
        # Ottieni il template del prompt
        prompt_template = self.config.get("prompt_templates", {}).get(
            "researcher_dialog", 
            "Sei un {researcher_type} specializzato in {specialization}. Situazione: {current_situation}"
        )
        
        # Ottieni memoria dell'agente se disponibile
        memory_context = {}
        if agent_id:
            memory = self.get_agent_memory(agent_id)
            memory_context = memory.get_memory_context("short_term")
        
        # Integra il contesto con la memoria
        full_context = {**context, **memory_context}
        
        # Formatta il prompt
        nearby_agents_str = ", ".join(full_context.get("nearby_agents", ["Nessuno"]))
        prompt = prompt_template.format(
            researcher_type=researcher_type,
            specialization=specialization,
            lab_state=full_context.get("lab_state", "normale"),
            nearby_agents=nearby_agents_str,
            fl_progress=full_context.get("fl_progress", "iniziale"),
            knowledge_base=full_context.get("knowledge_base", f"Expertise in {specialization}"),
            current_situation=current_situation
        )
        
        # Genera la risposta
        response = await self.generate_text(
            prompt=prompt, 
            options={
                "temperature": self.parameters.get("temperature", 0.7),
                "top_p": self.parameters.get("top_p", 0.9),
                "max_tokens": self.parameters.get("max_tokens", 200)
            }
        )
        
        # Verifica se la risposta è valida
        if not response or response.startswith("Error"):
            logger.warning(f"Failed to generate dialog for {researcher_type}, using fallback")
            return self._get_fallback_response("dialog", researcher_type)
        
        # Ripulisci la risposta
        dialog = response.strip()
        
        # Aggiorna la memoria dell'agente
        if agent_id:
            self.update_agent_memory(agent_id, "short_term", {
                "type": "dialog",
                "content": dialog,
                "situation": current_situation,
                "timestamp": time.time()
            })
        
        # Salva in cache
        self._update_cache(
            "dialogs", 
            dialog, 
            researcher_type=researcher_type,
            specialization=specialization,
            situation=current_situation
        )
        
        return dialog
    
    async def generate_fl_decision(
        self,
        agent_id: str,
        researcher_type: str,
        specialization: str,
        fl_state: Dict[str, Any],
        decision_type: str,
        available_options: List[str]
    ) -> Dict[str, Any]:
        """
        Genera una decisione relativa al federated learning.
        
        Args:
            agent_id: Identificativo dell'agente
            researcher_type: Tipo di ricercatore
            specialization: Specializzazione
            fl_state: Stato attuale del sistema FL
            decision_type: Tipo di decisione da prendere
            available_options: Opzioni disponibili
            
        Returns:
            Decisione generata con motivazione e parametri
        """
        # Verifica se c'è una risposta in cache
        cache_key = f"{researcher_type}:{specialization}:{decision_type}"
        cached_response = self._check_cache(
            "decisions", 
            cache_key=cache_key,
            fl_state=json.dumps(fl_state, sort_keys=True)
        )
        
        if cached_response:
            return json.loads(cached_response)
        
        # Ottieni il template del prompt
        prompt_template = self.config.get("prompt_templates", {}).get(
            "fl_decision", 
            self._get_default_fl_decision_template()
        )
        
        # Ottieni memoria dell'agente se disponibile
        memory_context = {}
        if agent_id:
            memory = self.get_agent_memory(agent_id)
            memory_context = memory.get_memory_context("semantic")
        
        # Formato le sfide FL
        fl_challenges = fl_state.get("challenges", ["convergenza lenta", "dati eterogenei"])
        fl_challenges_str = ", ".join(fl_challenges)
        
        # Formato le opzioni disponibili
        available_options_str = ", ".join(available_options)
        
        # Formatta il prompt
        prompt = prompt_template.format(
            researcher_type=researcher_type,
            specialization=specialization,
            fl_state=fl_state.get("status", "in training"),
            fl_challenges=fl_challenges_str,
            requirements=fl_state.get("requirements", "alta accuratezza, bassa latenza"),
            constraints=fl_state.get("constraints", "privacy, comunicazione limitata"),
            optimization_metrics=fl_state.get("metrics", "accuratezza, efficienza comunicazione"),
            decision_type=decision_type,
            available_options=available_options_str
        )
        
        # Genera la risposta
        response = await self.generate_text(
            prompt=prompt, 
            options={
                "temperature": self.parameters.get("temperature", 0.7),
                "top_p": self.parameters.get("top_p", 0.9),
                "max_tokens": 300
            }
        )
        
        # Verifica se la risposta è valida
        if not response or response.startswith("Error"):
            logger.warning(f"Failed to generate FL decision for {researcher_type}, using fallback")
            fallback = self._get_fallback_response("fl_decision", researcher_type)
            decision_result = {
                "decision": fallback,
                "reasoning": "Default approach based on expertise",
                "parameters": {}
            }
        else:
            # Analizza la risposta per estrarre la decisione, il ragionamento e i parametri
            lines = response.strip().split('\n')
            
            # Estrai la decisione (prima riga)
            decision = lines[0].strip() if lines else ""
            
            # Estrai il ragionamento (seconda riga)
            reasoning = lines[1].strip() if len(lines) > 1 else "Based on expertise"
            
            # Estrai i parametri (eventuali righe successive)
            params_text = '\n'.join(lines[2:]) if len(lines) > 2 else ""
            parameters = {}
            
            # Prova a estrarre parametri in formato chiave-valore
            param_lines = params_text.split('\n')
            for line in param_lines:
                if ':' in line:
                    key, value = line.split(':', 1)
                    parameters[key.strip()] = value.strip()
            
            decision_result = {
                "decision": decision,
                "reasoning": reasoning,
                "parameters": parameters
            }
        
        # Aggiorna la memoria dell'agente
        if agent_id:
            # Memorizza la decisione nella memoria semantica
            self.update_agent_memory(
                agent_id, 
                "semantic", 
                {
                    "decision": decision_result["decision"],
                    "reasoning": decision_result["reasoning"],
                    "timestamp": time.time()
                },
                concept=f"fl_decision:{decision_type}"
            )
            
            # Memorizza anche come evento episodico se è una decisione importante
            self.update_agent_memory(
                agent_id,
                "episodic",
                {
                    "type": "fl_decision",
                    "decision_type": decision_type,
                    "decision": decision_result["decision"],
                    "timestamp": time.time()
                },
                importance=0.7  # Decisioni FL sono relativamente importanti
            )
        
        # Salva in cache
        self._update_cache(
            "decisions", 
            json.dumps(decision_result), 
            cache_key=cache_key,
            fl_state=json.dumps(fl_state, sort_keys=True)
        )
        
        return decision_result
    
    async def generate_action_plan(
        self,
        agent_id: str,
        researcher_type: str,
        specialization: str,
        context: Dict[str, Any],
        goal: str
    ) -> Dict[str, Any]:
        """
        Genera un piano d'azione per raggiungere un obiettivo.
        
        Args:
            agent_id: Identificativo dell'agente
            researcher_type: Tipo di ricercatore
            specialization: Specializzazione
            context: Contesto attuale
            goal: Obiettivo da raggiungere
            
        Returns:
            Piano d'azione generato
        """
        # Verifica se c'è una risposta in cache
        cached_response = self._check_cache(
            "actions", 
            researcher_type=researcher_type,
            specialization=specialization,
            goal=goal
        )
        
        if cached_response:
            return json.loads(cached_response)
        
        # Ottieni il template del prompt
        prompt_template = self.config.get("prompt_templates", {}).get(
            "action_plan", 
            self._get_default_action_plan_template()
        )
        
        # Ottieni memoria dell'agente se disponibile
        memory_context = {}
        if agent_id:
            memory = self.get_agent_memory(agent_id)
            memory_context = memory.get_memory_context("short_term")
        
        # Integra il contesto con la memoria
        full_context = {**context, **memory_context}
        
        # Formatta le task in sospeso
        pending_tasks = full_context.get("pending_tasks", ["analisi dati", "ottimizzazione modello"])
        pending_tasks_str = ", ".join(pending_tasks)
        
        # Formatta le priorità
        priorities = full_context.get("priorities", ["precisione", "efficienza"])
        priorities_str = ", ".join(priorities)
        
        # Formatta le risorse disponibili
        available_resources = full_context.get("available_resources", ["dati di addestramento", "framework FL"])
        available_resources_str = ", ".join(available_resources)
        
        # Formatta il prompt
        prompt = prompt_template.format(
            researcher_type=researcher_type,
            specialization=specialization,
            lab_state=full_context.get("lab_state", "normale"),
            fl_state=full_context.get("fl_state", "in progress"),
            pending_tasks=pending_tasks_str,
            priorities=priorities_str,
            available_resources=available_resources_str,
            goal=goal
        )
        
        # Genera la risposta
        response = await self.generate_text(
            prompt=prompt, 
            options={
                "temperature": self.parameters.get("temperature", 0.7),
                "top_p": self.parameters.get("top_p", 0.9),
                "max_tokens": 350
            }
        )
        
        # Verifica se la risposta è valida
        if not response or response.startswith("Error"):
            logger.warning(f"Failed to generate action plan for {researcher_type}, using fallback")
            fallback = self._get_fallback_response("action_plan", researcher_type)
            action_plan = {
                "immediate_action": fallback.split(".")[0] if "." in fallback else fallback,
                "next_steps": ["Review literature", "Test hypothesis", "Document findings"],
                "resources_needed": ["Computational resources", "Access to data"]
            }
        else:
            # Analizza la risposta per estrarre il piano d'azione
            lines = response.strip().split('\n')
            
            # Estrai l'azione immediata (prima riga o dopo "Azione immediata:")
            immediate_action = ""
            next_steps = []
            resources_needed = []
            
            current_section = "immediate"
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Identifica la sezione
                if "prossimi passi" in line.lower() or "next steps" in line.lower():
                    current_section = "next"
                    continue
                elif "risorse" in line.lower() or "resources" in line.lower():
                    current_section = "resources"
                    continue
                
                # Rimuovi numeri o punti all'inizio
                if line.startswith(("1.", "2.", "3.", "•", "-", "*")):
                    line = line[line.find(" ")+1:].strip()
                
                # Aggiungi alla sezione corrente
                if current_section == "immediate" and not immediate_action:
                    immediate_action = line
                elif current_section == "next":
                    next_steps.append(line)
                elif current_section == "resources":
                    resources_needed.append(line)
            
            # Se non sono stati trovati passi successivi, usa l'approccio semplice
            if not next_steps and len(lines) >= 3:
                immediate_action = lines[0].strip()
                next_steps = [line.strip() for line in lines[1:3]]
                if len(lines) > 3:
                    resources_needed = [lines[3].strip()]
            
            action_plan = {
                "immediate_action": immediate_action,
                "next_steps": next_steps or ["Review current progress", "Analyze results", "Update approach"],
                "resources_needed": resources_needed or ["Computational resources", "Team collaboration"]
            }
        
        # Aggiorna la memoria dell'agente
        if agent_id:
            # Memorizza il piano nella memoria a breve termine
            self.update_agent_memory(agent_id, "short_term", {
                "type": "action_plan",
                "goal": goal,
                "plan": action_plan,
                "timestamp": time.time()
            })
            
            # Memorizza anche nella memoria a lungo termine
            self.update_agent_memory(
                agent_id,
                "long_term",
                action_plan,
                category="plans",
                key=f"goal:{goal}"
            )
        
        # Salva in cache
        self._update_cache(
            "actions", 
            json.dumps(action_plan), 
            researcher_type=researcher_type,
            specialization=specialization,
            goal=goal
        )
        
        return action_plan
    
    async def generate_event_reaction(
        self,
        agent_id: str,
        researcher_type: str,
        specialization: str,
        context: Dict[str, Any],
        event_description: str
    ) -> Dict[str, str]:
        """
        Genera una reazione a un evento specifico.
        
        Args:
            agent_id: Identificativo dell'agente
            researcher_type: Tipo di ricercatore
            specialization: Specializzazione
            context: Contesto attuale
            event_description: Descrizione dell'evento
            
        Returns:
            Reazione generata (reazione immediata e azioni conseguenti)
        """
        # Verifica se c'è una risposta in cache
        cached_response = self._check_cache(
            "reactions", 
            researcher_type=researcher_type,
            specialization=specialization,
            event=event_description
        )
        
        if cached_response:
            return json.loads(cached_response)
        
        # Ottieni il template del prompt
        prompt_template = self.config.get("prompt_templates", {}).get(
            "event_reaction", 
            self._get_default_event_reaction_template()
        )
        
        # Ottieni memoria dell'agente se disponibile
        memory_context = {}
        if agent_id:
            memory = self.get_agent_memory(agent_id)
            memory_context = memory.get_memory_context("short_term")
        
        # Integra il contesto con la memoria
        full_context = {**context, **memory_context}
        
        # Formatta le interazioni recenti
        recent_interactions = full_context.get("recent_interactions", ["discussione algoritmi", "analisi risultati"])
        if isinstance(recent_interactions, list):
            recent_interactions_str = ", ".join(recent_interactions)
        else:
            recent_interactions_str = str(recent_interactions)
        
        # Formatta il prompt
        prompt = prompt_template.format(
            researcher_type=researcher_type,
            specialization=specialization,
            lab_state=full_context.get("lab_state", "normale"),
            current_activity=full_context.get("current_activity", "ricerca"),
            recent_interactions=recent_interactions_str,
            event_description=event_description
        )
        
        # Genera la risposta
        response = await self.generate_text(
            prompt=prompt, 
            options={
                "temperature": self.parameters.get("temperature", 0.7),
                "top_p": self.parameters.get("top_p", 0.9),
                "max_tokens": 250
            }
        )
        
        # Verifica se la risposta è valida
        if not response or response.startswith("Error"):
            logger.warning(f"Failed to generate event reaction for {researcher_type}, using fallback")
            fallback = self._get_fallback_response("event_reaction", researcher_type)
            reaction = {
                "immediate_reaction": "This is interesting.",
                "consequent_action": fallback
            }
        else:
            # Analizza la risposta per estrarre la reazione
            lines = response.strip().split('\n')
            
            # Estrai la reazione immediata (prima riga o parte)
            immediate_reaction = lines[0].strip() if lines else ""
            
            # Estrai l'azione conseguente (seconda riga o parte)
            consequent_action = ' '.join(lines[1:]).strip() if len(lines) > 1 else ""
            
            # Se non c'è una chiara divisione, dividi la risposta in due parti
            if not consequent_action and len(immediate_reaction.split('.')) > 1:
                parts = immediate_reaction.split('.')
                immediate_reaction = parts[0].strip() + '.'
                consequent_action = ' '.join(parts[1:]).strip()
            
            reaction = {
                "immediate_reaction": immediate_reaction or "Questo è interessante.",
                "consequent_action": consequent_action or "Analizzerò come questo influisce sulla nostra ricerca."
            }
        
        # Aggiorna la memoria dell'agente
        if agent_id:
            # Memorizza la reazione nella memoria episodica
            self.update_agent_memory(
                agent_id,
                "episodic",
                {
                    "type": "event_reaction",
                    "event": event_description,
                    "reaction": reaction,
                    "timestamp": time.time()
                },
                importance=0.6  # Le reazioni agli eventi sono mediamente importanti
            )
        
        # Salva in cache
        self._update_cache(
            "reactions", 
            json.dumps(reaction), 
            researcher_type=researcher_type,
            specialization=specialization,
            event=event_description
        )
        
        return reaction
    
    async def generate_collaboration_proposal(
        self,
        agent_id: str,
        researcher_type: str,
        specialization: str,
        research_context: Dict[str, Any],
        collaborator_type: str,
        collaborator_specialization: str,
        collaborator_context: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Genera una proposta di collaborazione tra ricercatori.
        
        Args:
            agent_id: Identificativo dell'agente
            researcher_type: Tipo di ricercatore proponente
            specialization: Specializzazione del proponente
            research_context: Contesto di ricerca del proponente
            collaborator_type: Tipo di ricercatore collaboratore
            collaborator_specialization: Specializzazione del collaboratore
            collaborator_context: Contesto di ricerca del collaboratore
            
        Returns:
            Proposta di collaborazione generata
        """
        # Verifica se c'è una risposta in cache
        cache_key = f"{researcher_type}:{specialization}:{collaborator_type}:{collaborator_specialization}"
        cached_response = self._check_cache("collaborations", cache_key=cache_key)
        
        if cached_response:
            return json.loads(cached_response)
        
        # Ottieni il template del prompt
        prompt_template = self.config.get("prompt_templates", {}).get(
            "collaboration_proposal", 
            self._get_default_collaboration_proposal_template()
        )
        
        # Formatta i punti di forza
        strengths = research_context.get("strengths", [f"expertise in {specialization}"])
        strengths_str = ", ".join(strengths) if isinstance(strengths, list) else str(strengths)
        
        # Formatta le esigenze
        needs = research_context.get("needs", ["migliorare efficienza", "validare approccio"])
        needs_str = ", ".join(needs) if isinstance(needs, list) else str(needs)
        
        # Formatta i punti di forza del collaboratore
        collaborator_strengths = collaborator_context.get("strengths", [f"expertise in {collaborator_specialization}"])
        collaborator_strengths_str = ", ".join(collaborator_strengths) if isinstance(collaborator_strengths, list) else str(collaborator_strengths)
        
        # Calcola la potenziale sinergia
        potential_synergy = f"Combinare la tua expertise in {specialization} con la loro in {collaborator_specialization}"
        if "potential_synergy" in research_context:
            potential_synergy = research_context["potential_synergy"]
        
        # Formatta il prompt
        prompt = prompt_template.format(
            researcher_type=researcher_type,
            specialization=specialization,
            research_project=research_context.get("project", f"Ricerca su {specialization} per FL"),
            strengths=strengths_str,
            needs=needs_str,
            collaborator_type=collaborator_type,
            collaborator_specialization=collaborator_specialization,
            collaborator_project=collaborator_context.get("project", f"Ricerca su {collaborator_specialization} per FL"),
            collaborator_strengths=collaborator_strengths_str,
            potential_synergy=potential_synergy
        )
        
        # Genera la risposta
        response = await self.generate_text(
            prompt=prompt, 
            options={
                "temperature": self.parameters.get("temperature", 0.75),  # Leggermente più creativo per le proposte
                "top_p": self.parameters.get("top_p", 0.9),
                "max_tokens": 300
            }
        )
        
        # Verifica se la risposta è valida
        if not response or response.startswith("Error"):
            logger.warning(f"Failed to generate collaboration proposal for {researcher_type}, using fallback")
            fallback = self._get_fallback_response("collaboration_proposal", researcher_type)
            proposal = {
                "proposal": fallback,
                "benefit": "Combinare expertise complementari",
                "goal": "Migliorare l'algoritmo FL",
                "first_step": "Condividere risultati preliminari"
            }
        else:
            # Analizza la risposta per estrarre la proposta
            lines = response.strip().split('\n')
            
            # La proposta completa è l'intera risposta
            full_proposal = response.strip()
            
            # Estrai le componenti se possibile
            benefit = ""
            goal = ""
            first_step = ""
            
            for line in lines:
                line = line.strip().lower()
                if "benefit" in line or "vantaggio" in line or "beneficio" in line:
                    benefit = line
                elif "goal" in line or "obiettivo" in line:
                    goal = line
                elif "step" in line or "passo" in line:
                    first_step = line
            
            # Se non sono state trovate componenti specifiche, crea una struttura di default
            if not benefit and not goal and not first_step:
                # Divide la proposta in parti
                parts = full_proposal.split('.')
                if len(parts) >= 3:
                    benefit = parts[0].strip() + '.'
                    goal = parts[1].strip() + '.'
                    first_step = ' '.join(parts[2:]).strip()
                else:
                    benefit = "Possiamo combinare le nostre expertise per risultati migliori."
                    goal = "Migliorare l'algoritmo FL ottimizzando privacy e convergenza."
                    first_step = "Organizziamo un incontro per discutere i dettagli."
            
            proposal = {
                "proposal": full_proposal,
                "benefit": benefit or "Migliorare risultati combinando expertise",
                "goal": goal or "Ottimizzare algoritmo FL",
                "first_step": first_step or "Discutere approccio in un meeting"
            }
        
        # Aggiorna la memoria dell'agente
        if agent_id:
            # Memorizza la proposta nella memoria a breve termine
            self.update_agent_memory(agent_id, "short_term", {
                "type": "collaboration_proposal",
                "proposal": proposal["proposal"],
                "collaborator": f"{collaborator_type} in {collaborator_specialization}",
                "timestamp": time.time()
            })
            
            # Memorizza anche nella memoria a lungo termine
            self.update_agent_memory(
                agent_id,
                "long_term",
                {
                    "proposal": proposal["proposal"],
                    "goal": proposal["goal"],
                    "timestamp": time.time()
                },
                category="collaborations",
                key=f"{collaborator_type}:{collaborator_specialization}"
            )
        
        # Salva in cache
        self._update_cache("collaborations", json.dumps(proposal), cache_key=cache_key)
        
        return proposal
    
    def serialize_agent_memories(self) -> Dict[str, Dict[str, Any]]:
        """
        Serializza tutte le memorie degli agenti per il salvataggio.
        
        Returns:
            Dizionario delle memorie serializzate
        """
        return {
            agent_id: memory.serialize() 
            for agent_id, memory in self.agent_memories.items()
        }
    
    def load_agent_memories(self, serialized_memories: Dict[str, Dict[str, Any]]):
        """
        Carica le memorie degli agenti da dati serializzati.
        
        Args:
            serialized_memories: Dizionario delle memorie serializzate
        """
        self.agent_memories = {
            agent_id: AgentMemory.deserialize(memory_data)
            for agent_id, memory_data in serialized_memories.items()
        }


# Esempio di utilizzo (per debugging)
async def test_connector():
    """Funzione di test per verificare il connector."""
    connector = LLMConnector()
    
    try:
        # Test generazione dialogo
        dialog = await connector.generate_researcher_dialog(
            agent_id="researcher1",
            researcher_type="PhD Student",
            specialization="Privacy Engineering",
            context={
                "lab_state": "attivo",
                "nearby_agents": ["Professor di FL Systems Architecture", "ML Engineer"],
                "fl_progress": "fase intermedia",
                "knowledge_base": "Differential Privacy, Secure Aggregation"
            },
            current_situation="Hai appena scoperto un miglioramento nell'algoritmo di secure aggregation"
        )
        
        print("\n=== Dialogo Ricercatore ===")
        print(dialog)
        
        # Test generazione decisione FL
        decision = await connector.generate_fl_decision(
            agent_id="researcher1",
            researcher_type="PhD Student",
            specialization="Privacy Engineering",
            fl_state={
                "status": "training",
                "challenges": ["convergenza lenta", "privacy preservation"],
                "requirements": "alta accuratezza, bassa latenza",
                "constraints": "privacy, comunicazione limitata",
                "metrics": "accuratezza, efficienza comunicazione"
            },
            decision_type="algoritmo di aggregazione",
            available_options=["FedAvg", "FedProx", "Secure Aggregation", "DP-FedAvg"]
        )
        
        print("\n=== Decisione FL ===")
        print(f"Decisione: {decision['decision']}")
        print(f"Motivazione: {decision['reasoning']}")
        print(f"Parametri: {decision['parameters']}")
        
        # Test generazione piano d'azione
        action_plan = await connector.generate_action_plan(
            agent_id="researcher1",
            researcher_type="PhD Student",
            specialization="Privacy Engineering",
            context={
                "lab_state": "attivo",
                "fl_state": "training",
                "pending_tasks": ["analisi privacy", "ottimizzazione comunicazione"],
                "priorities": ["privacy", "efficienza"],
                "available_resources": ["dataset sanitario", "framework FL"]
            },
            goal="Migliorare la privacy preservation mantenendo alta accuratezza"
        )
        
        print("\n=== Piano d'Azione ===")
        print(f"Azione immediata: {action_plan['immediate_action']}")
        print(f"Prossimi passi: {action_plan['next_steps']}")
        print(f"Risorse necessarie: {action_plan['resources_needed']}")
        
        # Test generazione reazione a evento
        reaction = await connector.generate_event_reaction(
            agent_id="researcher1",
            researcher_type="PhD Student",
            specialization="Privacy Engineering",
            context={
                "lab_state": "attivo",
                "current_activity": "analisi dati",
                "recent_interactions": ["discussione privacy", "test algoritmo"]
            },
            event_description="Un bug nell'algoritmo di DP sta causando eccessive perdite di accuratezza"
        )
        
        print("\n=== Reazione a Evento ===")
        print(f"Reazione immediata: {reaction['immediate_reaction']}")
        print(f"Azione conseguente: {reaction['consequent_action']}")
        
        # Test generazione proposta di collaborazione
        proposal = await connector.generate_collaboration_proposal(
            agent_id="researcher1",
            researcher_type="PhD Student",
            specialization="Privacy Engineering",
            research_context={
                "project": "Ottimizzazione privacy in FL",
                "strengths": ["differential privacy", "secure aggregation"],
                "needs": ["migliorare convergenza", "ridurre overhead"]
            },
            collaborator_type="Professor",
            collaborator_specialization="FL Systems Architecture",
            collaborator_context={
                "project": "Architettura FL efficiente",
                "strengths": ["system design", "optimization theory"]
            }
        )
        
        print("\n=== Proposta di Collaborazione ===")
        print(f"Proposta: {proposal['proposal']}")
        print(f"Beneficio: {proposal['benefit']}")
        print(f"Obiettivo: {proposal['goal']}")
        print(f"Primo passo: {proposal['first_step']}")
        
        # Test memoria agente
        memory = connector.get_agent_memory("researcher1")
        memory_context = memory.get_memory_context()
        
        print("\n=== Memoria Agente ===")
        print(f"Memoria a breve termine: {len(memory_context['short_term_memory'])} elementi")
        print(f"Memoria episodica: {len(memory_context['episodic_memory'])} elementi")
        
    finally:
        await connector.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_connector())