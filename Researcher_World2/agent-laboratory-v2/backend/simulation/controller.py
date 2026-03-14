# Path: backend/simulation/controller.py

import os
import asyncio
import logging
import json
import re
from typing import Dict, List, Any, Optional, Callable
from threading import Thread, Event
import time
import numpy as np

# Importazioni assolute invece di relative
from models.environment import LabEnvironment
from backend.fl.federated import FederatedLearningSystem
from backend.ai.llm_connector import LLMConnector

# Configurazione logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimulationController:
    """Controller per la simulazione del laboratorio con supporto Federated Learning e LLM"""
    
    def __init__(
        self, 
        config_path: str = None, 
        on_step_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        """
        Inizializza il controller della simulazione
        
        Args:
            config_path: Percorso al file di configurazione
            on_step_callback: Callback chiamato dopo ogni step con i dati della simulazione
        """
        # Percorso configurazione di default
        if config_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            config_path = os.path.join(base_dir, "config", "simulation_config.json")
        
        self.config_path = config_path
        self.on_step_callback = on_step_callback
        
        # Stato della simulazione
        self.running = False
        self.paused = False
        self.speed = 1.0
        
        # Istanza del modello
        self.model = None
        
        # Sistema Federated Learning
        self.fl_system = None
        self.fl_enabled = False
        self.fl_round_in_progress = False
        self.fl_step_counter = 0
        self.fl_steps_per_round = 50  # Numero di step per completare un round
        self.fl_current_phase = None  # training, sending, aggregating, receiving
        
        # Thread e evento di controllo
        self.simulation_thread = None
        self.stop_event = Event()
        
        # Inizializzazione LLM Connector
        self.llm_connector = None
        self.llm_enabled = False
        
        # Memoria a breve termine per gli agenti (come descritto nella sezione 6.3 del documento)
        self.agent_short_term_memory = {}
        self.agent_long_term_memory = {}
        
        logger.info(f"Simulation controller initialized with config: {config_path}")
    
    def initialize_model(self):
        """Inizializza il modello di simulazione e il sistema FL"""
        try:
            self.model = LabEnvironment(self.config_path)
            logger.info("Simulation model initialized")
            
            # Inizializza il sistema FL
            self.fl_system = FederatedLearningSystem(
                algorithm="fedavg",
                aggregation_rounds=5,
                client_fraction=0.8,
                model_type="simple_nn"
            )
            
            # Registra laboratori come client
            self._register_labs_as_clients()
            
            logger.info("Federated Learning system initialized")
            
            # Inizializza LLM connector
            self.llm_connector = LLMConnector()
            self.llm_enabled = True
            logger.info("LLM connector initialized")
            
            return True
        except Exception as e:
            logger.error(f"Failed to initialize simulation model: {e}")
            return False
    
    def _register_labs_as_clients(self):
        """Registra i laboratori come client nel sistema FL"""
        if not self.model or not self.fl_system:
            logger.warning("Cannot register labs: model or FL system not initialized")
            return
            
        # Registra ogni laboratorio come client
        for lab_id in self.model.get_lab_ids():
            self.fl_system.register_client(lab_id)
            logger.info(f"Registered lab {lab_id} as FL client")
    
    def _filter_llm_response(self, response: str) -> str:
        """
        Filtra la risposta del LLM rimuovendo tag e parti non necessarie.
        
        Args:
            response: Risposta originale dal LLM
            
        Returns:
            Risposta filtrata
        """
        # Rimuovi i tag <think>...</think> e il loro contenuto
        filtered = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL)
        
        # Rimuovi altri tag potenzialmente problematici
        filtered = re.sub(r'<[^>]*>', '', filtered)
        
        # Rimuovi spazi multipli e righe vuote
        filtered = re.sub(r'\n\s*\n', '\n', filtered)
        filtered = re.sub(r'\s{2,}', ' ', filtered)
        
        return filtered.strip()
    
    async def generate_agent_dialog(self, agent_id, situation, interaction_type="dialog"):
        """
        Genera un dialogo o un'altra interazione per un agente utilizzando il LLM.
        
        Args:
            agent_id: ID dell'agente
            situation: Situazione attuale
            interaction_type: Tipo di interazione (dialog, decision, planning, reaction, collaboration)
            
        Returns:
            Contenuto generato
        """
        # Verifica che LLM sia abilitato
        if not self.llm_enabled or not self.llm_connector:
            logger.warning("Cannot generate dialog: LLM not enabled")
            return "No comment."
        
        # Ottieni informazioni sull'agente
        agent = self.get_agent(agent_id)
        if not agent:
            logger.warning(f"Agent {agent_id} not found")
            return "No comment."
        
        # Ottieni il contesto attuale
        context = self._get_agent_context(agent)
        
        # Aggiungi memoria a breve termine se disponibile
        if agent_id in self.agent_short_term_memory:
            context["recent_interactions"] = self.agent_short_term_memory[agent_id]
        
        # Aggiungi memoria a lungo termine se disponibile
        if agent_id in self.agent_long_term_memory:
            context["knowledge_base"] = f"{context.get('knowledge_base', '')} {self.agent_long_term_memory[agent_id]}"
        
        try:
            # Genera contenuto basato sul tipo di interazione
            if interaction_type == "dialog":
                content = await self.llm_connector.generate_researcher_dialog(
                    researcher_type=agent.type,
                    specialization=agent.specialization,
                    context=context,
                    current_situation=situation
                )
            elif interaction_type == "decision":
                content = await self.llm_connector.generate_fl_decision(
                    researcher_type=agent.type,
                    specialization=agent.specialization,
                    context=context,
                    current_situation=situation
                )
            elif interaction_type == "planning":
                content = await self.llm_connector.generate_action_plan(
                    researcher_type=agent.type,
                    specialization=agent.specialization,
                    context=context,
                    current_situation=situation
                )
            elif interaction_type == "reaction":
                content = await self.llm_connector.generate_event_reaction(
                    researcher_type=agent.type,
                    specialization=agent.specialization,
                    context=context,
                    current_situation=situation
                )
            elif interaction_type == "collaboration":
                content = await self.llm_connector.generate_collaboration_proposal(
                    researcher_type=agent.type,
                    specialization=agent.specialization,
                    context=context,
                    current_situation=situation
                )
            else:
                logger.warning(f"Unknown interaction type: {interaction_type}")
                content = await self.llm_connector.generate_researcher_dialog(
                    researcher_type=agent.type,
                    specialization=agent.specialization,
                    context=context,
                    current_situation=situation
                )
            
            # Filtra la risposta
            filtered_content = self._filter_llm_response(content)
            
            # Aggiorna la memoria a breve termine
            if agent_id not in self.agent_short_term_memory:
                self.agent_short_term_memory[agent_id] = []
            
            # Aggiungi alla memoria limitando a 5 interazioni recenti
            self.agent_short_term_memory[agent_id].append({
                "situation": situation,
                "response": filtered_content
            })
            if len(self.agent_short_term_memory[agent_id]) > 5:
                self.agent_short_term_memory[agent_id].pop(0)
            
            return filtered_content
        except Exception as e:
            logger.error(f"Error generating content: {e}")
            return "I need to focus on my research now."
    
    def update_agent_memory(self, agent_id: str, knowledge: str, memory_type: str = "long_term"):
        """
        Aggiorna la memoria di un agente con nuova conoscenza.
        
        Args:
            agent_id: ID dell'agente
            knowledge: Nuova conoscenza da memorizzare
            memory_type: Tipo di memoria (long_term, episodic, semantic)
        """
        if memory_type == "long_term":
            # Inizializza memoria a lungo termine se non esiste
            if agent_id not in self.agent_long_term_memory:
                self.agent_long_term_memory[agent_id] = ""
            
            # Aggiungi conoscenza
            self.agent_long_term_memory[agent_id] += f" {knowledge}"
            
            # Limita dimensione memoria (esempio: 2000 caratteri)
            if len(self.agent_long_term_memory[agent_id]) > 2000:
                self.agent_long_term_memory[agent_id] = self.agent_long_term_memory[agent_id][-2000:]
    
    def get_agent(self, agent_id):
        """
        Recupera un agente dal modello.
        
        Args:
            agent_id: ID dell'agente
            
        Returns:
            Agente richiesto o None se non trovato
        """
        if not self.model:
            return None
            
        return self.model.get_agent_by_id(agent_id)
    
    def get_nearby_agents(self, agent):
        """
        Recupera gli agenti vicini a un dato agente.
        
        Args:
            agent: Agente di riferimento
            
        Returns:
            Lista di agenti vicini
        """
        if not self.model:
            return []
            
        return self.model.get_nearby_agents(agent)
    
    def _get_agent_context(self, agent):
        """
        Costruisce il contesto attuale per un agente.
        
        Args:
            agent: Oggetto agente
            
        Returns:
            Dizionario con il contesto
        """
        # Ottieni lo stato del laboratorio
        lab_id = agent.lab_id if hasattr(agent, 'lab_id') else "unknown"
        lab_state = "attivo"  # Questo può essere personalizzato in base allo stato attuale
        
        # Ottieni gli agenti vicini
        nearby_agents = []
        for other_agent in self.get_nearby_agents(agent):
            nearby_agents.append(f"{other_agent.type} di {other_agent.specialization}")
        
        # Ottieni lo stato del progresso FL
        fl_progress = "iniziale"
        if self.fl_enabled and self.fl_system:
            fl_state = self.fl_system.get_state()
            fl_round = fl_state.get("round", 0)
            if fl_round > 10:
                fl_progress = "avanzato"
            elif fl_round > 5:
                fl_progress = "intermedio"
        
        # Costruisci il contesto
        context = {
            "lab_state": lab_state,
            "nearby_agents": nearby_agents,
            "fl_progress": fl_progress,
            "knowledge_base": agent.specialization if hasattr(agent, 'specialization') else "General Research",
            "current_phase": self.fl_current_phase
        }
        
        return context
    
    def start_simulation(self):
        """Avvia la simulazione in un thread separato"""
        if self.running:
            logger.warning("Simulation is already running")
            return False
            
        if not self.model and not self.initialize_model():
            logger.error("Could not initialize simulation model")
            return False
            
        self.running = True
        self.paused = False
        self.stop_event.clear()
        
        # Avvia thread di simulazione
        self.simulation_thread = Thread(target=self._simulation_loop)
        self.simulation_thread.daemon = True
        self.simulation_thread.start()
        
        logger.info("Simulation started")
        return True
    
    def stop_simulation(self):
        """Ferma la simulazione"""
        if not self.running:
            logger.warning("Simulation is not running")
            return False
            
        self.running = False
        self.stop_event.set()
        
        if self.simulation_thread:
            self.simulation_thread.join(timeout=2.0)
            if self.simulation_thread.is_alive():
                logger.warning("Simulation thread did not terminate gracefully")
                
        self.simulation_thread = None
        logger.info("Simulation stopped")
        
        # Chiudi LLM connector
        if self.llm_connector:
            asyncio.run(self.llm_connector.close())
            
        return True
    
    def pause_simulation(self):
        """Mette in pausa la simulazione"""
        if not self.running:
            logger.warning("Simulation is not running")
            return False
            
        self.paused = True
        logger.info("Simulation paused")
        return True
    
    def resume_simulation(self):
        """Riprende la simulazione da pausa"""
        if not self.running:
            logger.warning("Simulation is not running")
            return False
            
        self.paused = False
        logger.info("Simulation resumed")
        return True
    
    def set_speed(self, speed: float):
        """Imposta la velocità della simulazione"""
        if speed <= 0:
            logger.warning(f"Invalid speed value: {speed}")
            return False
            
        self.speed = speed
        logger.info(f"Simulation speed set to {speed}")
        return True
    
    def enable_federated_learning(self, enabled: bool = True):
        """Abilita o disabilita il Federated Learning"""
        if not self.fl_system:
            logger.warning("FL system not initialized")
            return False
            
        self.fl_enabled = enabled
        if enabled:
            logger.info("Federated Learning enabled")
        else:
            # Reset FL state
            self.fl_round_in_progress = False
            self.fl_step_counter = 0
            self.fl_current_phase = None
            logger.info("Federated Learning disabled")
            
        return True
    
    def enable_llm(self, enabled: bool = True):
        """Abilita o disabilita l'uso del LLM per i dialoghi"""
        if enabled and not self.llm_connector:
            try:
                self.llm_connector = LLMConnector()
                self.llm_enabled = True
                logger.info("LLM enabled")
                return True
            except Exception as e:
                logger.error(f"Failed to initialize LLM connector: {e}")
                return False
        elif not enabled and self.llm_connector:
            # Chiudi il connector se disabilitato
            asyncio.run(self.llm_connector.close())
            self.llm_connector = None
            self.llm_enabled = False
            logger.info("LLM disabled")
            return True
        
        # Se già nello stato richiesto
        return True
    
    def _start_fl_round(self):
        """Avvia un nuovo round FL"""
        if not self.fl_system:
            logger.warning("Cannot start FL round: FL system not initialized")
            return
            
        # Seleziona i client (laboratori) per questo round
        selected_labs = self.fl_system.select_clients()
        if not selected_labs:
            logger.warning("No labs selected for FL round")
            return
            
        # Avvia la fase di training
        self.fl_round_in_progress = True
        self.fl_step_counter = 0
        self.fl_current_phase = "training"
        
        # Assegna task agli agenti nei laboratori selezionati
        for lab_id in selected_labs:
            self._assign_fl_task_to_lab_agents(lab_id, "train")
        
        logger.info(f"FL round started with labs: {selected_labs}")
    
    def _assign_fl_task_to_lab_agents(self, lab_id: str, task_type: str):
        """Assegna un task FL agli agenti in un laboratorio"""
        if not self.model:
            return
            
        # Ottieni agenti del laboratorio
        lab_agents = self.model.get_lab_agents(lab_id)
        for agent in lab_agents:
            # Assegna task in base al ruolo dell'agente
            if hasattr(agent, 'assign_fl_task'):
                agent.assign_fl_task(task_type)
    
    def _check_fl_phase_completion(self):
        """Verifica se la fase FL corrente è completa"""
        if not self.fl_round_in_progress or not self.model:
            return False
            
        # Controlla lo stato degli agenti con compiti FL
        all_agents_done = True
        
        for lab_id in self.model.get_lab_ids():
            lab_agents = self.model.get_lab_agents(lab_id)
            for agent in lab_agents:
                if hasattr(agent, 'fl_task') and agent.fl_task and agent.fl_progress < 1.0:
                    all_agents_done = False
                    break
        
        return all_agents_done
    
    def _advance_fl_phase(self):
        """Avanza alla fase successiva del round FL"""
        if not self.fl_round_in_progress:
            return
            
        current_phase = self.fl_current_phase
        
        if current_phase == "training":
            # Passa alla fase di invio modelli
            self.fl_current_phase = "sending"
            for lab_id in self.model.get_lab_ids():
                self._assign_fl_task_to_lab_agents(lab_id, "send_model")
            logger.info("FL phase advanced: training -> sending")
                
        elif current_phase == "sending":
            # Passa alla fase di aggregazione
            self.fl_current_phase = "aggregating"
            # Trova agenti con ruolo aggregatore
            for lab_id in self.model.get_lab_ids():
                lab_agents = self.model.get_lab_agents(lab_id)
                for agent in lab_agents:
                    if hasattr(agent, 'fl_role') and agent.fl_role and getattr(agent.fl_role, 'value', '') == "model_aggregator":
                        agent.assign_fl_task("aggregate")
            logger.info("FL phase advanced: sending -> aggregating")
                
        elif current_phase == "aggregating":
            # Completa l'aggregazione
            client_updates = self._collect_client_updates()
            self.fl_system.aggregate_models(client_updates)
            
            # Passa alla fase di ricezione
            self.fl_current_phase = "receiving"
            for lab_id in self.model.get_lab_ids():
                self._assign_fl_task_to_lab_agents(lab_id, "receive_model")
            logger.info("FL phase advanced: aggregating -> receiving")
                
        elif current_phase == "receiving":
            # Aggiorna i modelli dei client
            self.fl_system.update_client_models()
            
            # Completa il round
            self.fl_round_in_progress = False
            self.fl_step_counter = 0
            self.fl_current_phase = None
            logger.info("FL round completed")
    
    def _collect_client_updates(self) -> Dict[str, Any]:
        """Raccoglie gli aggiornamenti dai client per l'aggregazione"""
        client_updates = {}
        
        # In un sistema reale, qui si raccoglierebbero i pesi dai modelli
        # Per ora, creiamo dati simulati
        for lab_id in self.model.get_lab_ids():
            # Crea dati sintetici per la demo
            data_x = np.random.randn(100, 10)  # 100 samples, 10 features
            data_y = np.random.randint(0, 2, size=(100, 1))  # Binary labels
            
            metrics, weights = self.fl_system.train_client(lab_id, data_x, data_y)
            client_updates[lab_id] = weights
            
        return client_updates
    
    def _process_fl_logic(self):
        """Processa la logica FL durante la simulazione"""
        if not self.fl_enabled:
            return
            
        if not self.fl_round_in_progress:
            # Avvia un nuovo round
            self._start_fl_round()
        else:
            # Incrementa contatore
            self.fl_step_counter += 1
            
            # Verifica se la fase corrente è completa
            if self._check_fl_phase_completion():
                self._advance_fl_phase()
    
    def _simulation_loop(self):
        """Loop principale della simulazione"""
        step_count = 0
        
        try:
            while self.running and not self.stop_event.is_set():
                if not self.paused:
                    # Calcola il tempo per uno step in base alla velocità
                    step_time = 1.0 / (self.model.tick_rate * self.speed)
                    
                    # Esegue uno step del modello
                    start_time = time.time()
                    self.model.step()
                    step_count += 1
                    
                    # Processa logica FL
                    self._process_fl_logic()
                    
                    # Raccoglie dati dal modello
                    sim_data = self._collect_simulation_data()
                    
                    # Callback con i dati della simulazione
                    if self.on_step_callback:
                        self.on_step_callback(sim_data)
                    
                    # Calcola tempo rimanente per lo step
                    elapsed = time.time() - start_time
                    remaining = step_time - elapsed
                    
                    if remaining > 0:
                        # Attende il tempo rimanente
                        time.sleep(remaining)
                        
                    if step_count % 100 == 0:
                        logger.info(f"Simulation step {step_count} completed")
                else:
                    # In pausa, attende un breve periodo
                    time.sleep(0.1)
                    
        except Exception as e:
            logger.error(f"Error in simulation loop: {e}")
            self.running = False
        finally:
            logger.info(f"Simulation loop terminated after {step_count} steps")
    
    def _collect_simulation_data(self) -> Dict[str, Any]:
        """Raccoglie dati dalla simulazione per il frontend"""
        base_data = {
            "step": self.model.schedule.steps if self.model else 0,
            "agent_count": self.model.schedule.get_agent_count() if self.model else 0,
            "agent_states": self.model.get_agent_states() if self.model else {},
            "simulation": {
                "running": self.running,
                "paused": self.paused,
                "speed": self.speed
            }
        }
        
        # Aggiungi dati FL se abilitato
        if self.fl_enabled and self.fl_system:
            fl_state = self.fl_system.get_state()
            fl_data = {
                "enabled": self.fl_enabled,
                "round_in_progress": self.fl_round_in_progress,
                "current_phase": self.fl_current_phase,
                "step_counter": self.fl_step_counter,
                "steps_per_round": self.fl_steps_per_round,
                "round": fl_state["round"],
                "metrics": fl_state["metrics"]
            }
            base_data["fl"] = fl_data
        
        # Aggiungi dati LLM
        base_data["llm"] = {
            "enabled": self.llm_enabled
        }
            
        return base_data
    
    def get_simulation_state(self) -> Dict[str, Any]:
        """Restituisce lo stato attuale della simulazione"""
        state = {
            "initialized": self.model is not None,
            "running": self.running,
            "paused": self.paused,
            "speed": self.speed,
            "step": self.model.schedule.steps if self.model else 0,
            "agent_count": self.model.schedule.get_agent_count() if self.model else 0
        }
        
        # Aggiungi stato FL
        if self.fl_system:
            fl_state = self.fl_system.get_state()
            state["fl"] = {
                "enabled": self.fl_enabled,
                "round": fl_state["round"],
                "algorithm": fl_state["algorithm"],
                "round_in_progress": self.fl_round_in_progress,
                "current_phase": self.fl_current_phase
            }
        
        # Aggiungi stato LLM
        state["llm"] = {
            "enabled": self.llm_enabled
        }
            
        return state
        
    def reset_simulation(self):
        """Resetta la simulazione"""
        was_running = self.running
        
        if was_running:
            self.stop_simulation()
            
        self.model = None
        self.fl_system = None
        self.fl_enabled = False
        self.fl_round_in_progress = False
        self.fl_step_counter = 0
        
        # Reset memoria agenti
        self.agent_short_term_memory = {}
        self.agent_long_term_memory = {}
        
        # Reset LLM
        if self.llm_connector:
            asyncio.run(self.llm_connector.close())
        self.llm_connector = None
        self.llm_enabled = False
        
        success = self.initialize_model()
        if success and was_running:
            self.start_simulation()
            
        logger.info("Simulation reset")
        return success