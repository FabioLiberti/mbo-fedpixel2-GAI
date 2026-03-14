# Path: backend/models/agents/researcher.py

from mesa import Agent, Model
from mesa.time import RandomActivation
from mesa.space import MultiGrid
from enum import Enum
from typing import List, Dict, Any, Optional
import random
import logging
import asyncio

# Configurazione logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Enumerazione stati agente
class AgentState(Enum):
    WORKING = "working"
    MEETING = "meeting"
    RESTING = "resting"
    MOVING = "moving"
    DISCUSSING = "discussing"
    PRESENTING = "presenting"
    
    # Stati per Federated Learning
    TRAINING_MODEL = "training_model"         # L'agente sta addestrando il modello locale
    SENDING_MODEL = "sending_model"           # L'agente sta inviando il modello
    AGGREGATING_MODELS = "aggregating_models" # L'agente sta aggregando modelli (solo per professori)
    RECEIVING_MODEL = "receiving_model"       # L'agente sta ricevendo il modello globale

# Enumerazione specializzazioni
class Specialization(Enum):
    # PhD Student
    DATA_SCIENCE = "data_science"
    PRIVACY_ENGINEERING = "privacy_engineering"
    OPTIMIZATION_THEORY = "optimization_theory"
    
    # Researcher
    SECURE_AGGREGATION = "secure_aggregation"
    NON_IID_DATA = "non_iid_data"
    COMMUNICATION_EFFICIENCY = "communication_efficiency"
    
    # Professor
    FL_ARCHITECTURE = "fl_architecture"
    THEORETICAL_GUARANTEES = "theoretical_guarantees"
    PRIVACY_ECONOMICS = "privacy_economics"

# Enumerazione ruoli FL
class FLRole(Enum):
    DATA_PREPARER = "data_preparer"       # Prepara i dati per il training
    MODEL_TRAINER = "model_trainer"       # Addestra modelli locali
    MODEL_AGGREGATOR = "model_aggregator" # Aggrega modelli tra laboratori
    PRIVACY_GUARDIAN = "privacy_guardian" # Gestisce aspetti di privacy
    OBSERVER = "observer"                 # Osserva soltanto il processo

# Classe base per i bisogni dell'agente
class NeedsMap:
    def __init__(self):
        self.energy = 1.0
        self.social = 0.5
        self.knowledge = 0.0
        self.focus = 1.0
    
    def update(self, delta_time: float):
        # Riduzione dei bisogni nel tempo
        self.energy -= 0.01 * delta_time
        self.social -= 0.005 * delta_time
        self.focus -= 0.02 * delta_time
        
        # Clamp values
        self.energy = max(0.0, min(1.0, self.energy))
        self.social = max(0.0, min(1.0, self.social))
        self.focus = max(0.0, min(1.0, self.focus))
        
    def __str__(self) -> str:
        return f"Energy: {self.energy:.2f}, Social: {self.social:.2f}, Focus: {self.focus:.2f}, Knowledge: {self.knowledge:.2f}"

# Classe base per i ricercatori
class ResearcherAgent(Agent):
    def __init__(
        self, 
        unique_id: int, 
        model: Model, 
        role: str,
        specializations: List[Specialization],
        social_tendency: float = 0.5,
        research_efficiency: float = 0.5,
        movement_speed: float = 1.0,
        lab_id: str = None
    ):
        super().__init__(unique_id, model)
        
        # Attributi base
        self.role = role
        self.specializations = specializations
        self.social_tendency = social_tendency
        self.research_efficiency = research_efficiency
        self.movement_speed = movement_speed
        self.lab_id = lab_id
        self.type = self.role  # Alias per compatibilità con il controller LLM
        self.specialization = specializations[0].value if specializations else None  # Prima specializzazione per LLM
        
        # Stato e bisogni
        self.state = AgentState.RESTING
        self.needs = NeedsMap()
        self.target_position = None
        
        # Conoscenza e collaborazione
        self.knowledge_vault = {}  # Conoscenza acquisita
        self.relationships = {}    # Relazioni con altri agenti
        
        # Tempo trascorso nello stato attuale
        self.state_time = 0.0
        
        # Attributi Federated Learning
        self.fl_role = self.assign_fl_role()
        self.fl_task = None
        self.fl_progress = 0.0  # Progresso del task FL attuale (0-1)
        self.fl_contributing = False  # Se l'agente sta partecipando al round FL corrente
        
        # Attributi dialogo
        self.dialog_cooldown = 0.0     # Tempo di cooldown per i dialoghi
        self.last_dialog = None        # Ultimo dialogo generato
        self.dialog_is_llm = False     # Flag per indicare se il dialogo è generato da LLM
        
        logger.info(f"Created {role} agent (ID: {unique_id}) with specializations: {specializations} and FL role: {self.fl_role}")
    
    def assign_fl_role(self) -> FLRole:
        """Assegna un ruolo FL in base alla specializzazione dell'agente"""
        # PhD Students
        if any(s in [Specialization.DATA_SCIENCE, Specialization.PRIVACY_ENGINEERING] 
               for s in self.specializations):
            return FLRole.DATA_PREPARER
        
        # Researchers
        elif any(s in [Specialization.SECURE_AGGREGATION, Specialization.NON_IID_DATA, 
                      Specialization.COMMUNICATION_EFFICIENCY] 
                for s in self.specializations):
            return FLRole.MODEL_TRAINER
        
        # Professors
        elif any(s in [Specialization.FL_ARCHITECTURE, Specialization.THEORETICAL_GUARANTEES] 
                for s in self.specializations):
            return FLRole.MODEL_AGGREGATOR
        
        # Privacy specialists
        elif Specialization.PRIVACY_ECONOMICS in self.specializations:
            return FLRole.PRIVACY_GUARDIAN
        
        # Default
        else:
            return FLRole.OBSERVER
    
    def update_needs(self, delta_time: float):
        """Aggiorna i bisogni dell'agente in base all'attività attuale"""
        self.needs.update(delta_time)
        
        # Modifiche specifiche in base allo stato
        if self.state == AgentState.WORKING:
            self.needs.energy -= 0.02 * delta_time
            self.needs.social -= 0.01 * delta_time
            self.needs.focus -= 0.03 * delta_time
            self.needs.knowledge += 0.05 * self.research_efficiency * delta_time
            
        elif self.state == AgentState.MEETING or self.state == AgentState.DISCUSSING:
            self.needs.energy -= 0.01 * delta_time
            self.needs.social += 0.03 * delta_time
            self.needs.focus -= 0.01 * delta_time
            self.needs.knowledge += 0.02 * delta_time
            
        elif self.state == AgentState.RESTING:
            self.needs.energy += 0.05 * delta_time
            self.needs.focus += 0.03 * delta_time
            
        # Stati Federated Learning
        elif self.state == AgentState.TRAINING_MODEL:
            self.needs.energy -= 0.03 * delta_time
            self.needs.focus -= 0.04 * delta_time
            self.needs.knowledge += 0.07 * self.research_efficiency * delta_time
            
        elif self.state == AgentState.AGGREGATING_MODELS:
            self.needs.energy -= 0.02 * delta_time
            self.needs.focus -= 0.05 * delta_time
            self.needs.knowledge += 0.08 * self.research_efficiency * delta_time
            
        # Aggiorna il cooldown del dialogo
        if self.dialog_cooldown > 0:
            self.dialog_cooldown -= delta_time
    
    def should_change_state(self) -> bool:
        """Determina se l'agente dovrebbe cambiare stato"""
        # Non cambiare stato se impegnato in un task FL
        if self.state in [AgentState.TRAINING_MODEL, AgentState.SENDING_MODEL, 
                         AgentState.AGGREGATING_MODELS, AgentState.RECEIVING_MODEL]:
            if self.fl_progress < 1.0:
                return False
        
        # Transizioni basate sui bisogni
        if self.needs.energy < 0.2:
            return True
        
        if self.needs.focus < 0.2 and self.state == AgentState.WORKING:
            return True
        
        if self.needs.social < 0.2 and self.social_tendency > 0.5:
            return True
            
        # Transizioni basate sul tempo trascorso nello stato
        if self.state_time > random.uniform(5.0, 15.0):
            return True
            
        return False
    
    def select_new_state(self):
        """Seleziona un nuovo stato in base ai bisogni attuali"""
        # Se ha un task FL attivo, priorità a quello
        if self.fl_task and self.fl_progress < 1.0:
            self.handle_fl_task(self.fl_task)
            return
        
        if self.needs.energy < 0.3:
            self.change_state(AgentState.RESTING)
        elif self.needs.social < 0.3 and self.social_tendency > 0.4:
            if random.random() < 0.7:
                self.change_state(AgentState.DISCUSSING)
            else:
                self.change_state(AgentState.MEETING)
        elif self.needs.focus < 0.3:
            self.change_state(AgentState.RESTING)
        else:
            # Scelta casuale pesata
            states = [
                (AgentState.WORKING, 0.6),
                (AgentState.DISCUSSING, 0.2 * self.social_tendency),
                (AgentState.MEETING, 0.1 * self.social_tendency),
                (AgentState.PRESENTING, 0.1 * self.needs.knowledge)
            ]
            
            total_weight = sum(w for _, w in states)
            r = random.uniform(0, total_weight)
            cumulative_weight = 0
            
            for state, weight in states:
                cumulative_weight += weight
                if r <= cumulative_weight:
                    self.change_state(state)
                    break
    
    def handle_fl_task(self, task_type: str):
        """Gestisce un compito FL assegnato all'agente"""
        if task_type == "train" and self.fl_role in [FLRole.MODEL_TRAINER, FLRole.DATA_PREPARER]:
            self.change_state(AgentState.TRAINING_MODEL)
            self.fl_contributing = True
            
        elif task_type == "send_model" and self.fl_role == FLRole.MODEL_TRAINER:
            self.change_state(AgentState.SENDING_MODEL)
            self.fl_contributing = True
            
        elif task_type == "aggregate" and self.fl_role == FLRole.MODEL_AGGREGATOR:
            self.change_state(AgentState.AGGREGATING_MODELS)
            self.fl_contributing = True
            
        elif task_type == "receive_model":
            self.change_state(AgentState.RECEIVING_MODEL)
            self.fl_contributing = True
    
    def process_fl_task(self, delta_time: float):
        """Processa il task FL corrente"""
        if not self.fl_task:
            return
            
        # Incrementa il progresso in base all'efficienza
        progress_rate = 0.1 * self.research_efficiency
        
        if self.state == AgentState.TRAINING_MODEL:
            self.fl_progress += progress_rate * delta_time
            
        elif self.state == AgentState.AGGREGATING_MODELS:
            self.fl_progress += progress_rate * 1.5 * delta_time  # Aggregazione più veloce
            
        elif self.state in [AgentState.SENDING_MODEL, AgentState.RECEIVING_MODEL]:
            self.fl_progress += progress_rate * 2.0 * delta_time  # Comunicazione più veloce
            
        # Limita il progresso a 1.0
        self.fl_progress = min(1.0, self.fl_progress)
        
        # Se il task è completo, resetta per il prossimo
        if self.fl_progress >= 1.0:
            logger.info(f"Agent {self.unique_id} completed FL task: {self.fl_task}")
            self.fl_task = None
            self.fl_progress = 0.0
            # Torna a uno stato normale
            self.select_new_state()
    
    def change_state(self, new_state: AgentState):
        """Cambia lo stato dell'agente e resetta il timer dello stato"""
        logger.info(f"Agent {self.unique_id} ({self.role}) changing state: {self.state} -> {new_state}")
        self.state = new_state
        self.state_time = 0.0
        
        # Cerca una nuova posizione target in base allo stato
        self.find_target_position()
        
        # Genera un dialogo basato sul nuovo stato
        self.trigger_dialog_generation()
    
    def find_target_position(self):
        """Trova una nuova posizione target in base allo stato attuale"""
        # Posizioni possibili dipendenti dallo stato
        # In un'implementazione completa, queste sarebbero posizioni significative nella mappa
        positions = {
            AgentState.WORKING: [(3, 3), (5, 5), (7, 7)],
            AgentState.RESTING: [(2, 8), (9, 9)],
            AgentState.MEETING: [(5, 10), (10, 5)],
            AgentState.DISCUSSING: [(4, 4), (6, 6)],
            AgentState.PRESENTING: [(10, 10)],
            # Posizioni per attività FL
            AgentState.TRAINING_MODEL: [(3, 3), (5, 5)],  # Postazioni computer
            AgentState.SENDING_MODEL: [(7, 7)],           # Vicino a router/server
            AgentState.AGGREGATING_MODELS: [(10, 10)],    # Server centrale
            AgentState.RECEIVING_MODEL: [(7, 7)]          # Vicino a router/server
        }
        
        if self.state in positions and positions[self.state]:
            self.target_position = random.choice(positions[self.state])
    
    def move_towards_target(self, delta_time: float):
        """Muove l'agente verso la posizione target, se presente"""
        if not self.target_position:
            return False
            
        # Implementazione semplificata del movimento
        # In una versione completa, qui ci sarebbe un algoritmo di pathfinding
        current_pos = self.pos
        target_pos = self.target_position
        
        if current_pos == target_pos:
            self.target_position = None
            return True
            
        # Movimento semplice verso il target
        self.change_state(AgentState.MOVING)
        
        return False
        
    def execute_current_behavior(self, delta_time: float):
        """Esegue il comportamento basato sullo stato attuale"""
        # Incrementa il tempo nello stato attuale
        self.state_time += delta_time
        
        # Comportamenti specifici per stato
        if self.state == AgentState.WORKING:
            # Simulazione lavoro di ricerca
            self.needs.knowledge += 0.01 * self.research_efficiency * delta_time
            
        elif self.state == AgentState.MEETING or self.state == AgentState.DISCUSSING:
            # Simulazione interazione sociale
            pass
            
        elif self.state == AgentState.MOVING:
            # Controllo se siamo arrivati a destinazione
            if self.move_towards_target(delta_time):
                # Torna allo stato precedente
                self.select_new_state()
                
        # Processa eventuali task FL
        if self.fl_task:
            self.process_fl_task(delta_time)
    
    def check_for_interactions(self):
        """Verifica possibili interazioni con altri agenti"""
        # In un'implementazione completa, qui si cercherebbero
        # agenti nelle vicinanze con cui interagire
        pass
    
    def assign_fl_task(self, task_type: str):
        """Assegna un nuovo task FL all'agente"""
        self.fl_task = task_type
        self.fl_progress = 0.0
        logger.info(f"Agent {self.unique_id} ({self.role}) assigned FL task: {task_type}")
        self.handle_fl_task(task_type)
    
    def trigger_dialog_generation(self):
        """Avvia la generazione di un dialogo in base allo stato attuale"""
        # Verifica se il cooldown è attivo
        if self.dialog_cooldown > 0:
            return
            
        # Reset del cooldown
        self.dialog_cooldown = random.uniform(5.0, 15.0)
        
        # Cerca di ottenere il controller della simulazione
        from ...simulation.controller import SimulationController
        controller = None
        
        # Prima cerca nell'istanza del modello
        if hasattr(self.model, 'simulation_controller'):
            controller = self.model.simulation_controller
        
        # Se non trovato, prova a importare direttamente
        if not controller:
            try:
                import sys
                module = sys.modules.get('backend.simulation.controller')
                if module and hasattr(module, 'simulation_controller'):
                    controller = module.simulation_controller
            except (ImportError, AttributeError) as e:
                logger.warning(f"Could not access simulation controller: {e}")
                return
        
        # Se il controller non è disponibile o LLM non è abilitato, usa un dialogo predefinito
        if not controller or not hasattr(controller, 'generate_agent_dialog') or not controller.llm_enabled:
            self.last_dialog = self._generate_fallback_dialog()
            self.dialog_is_llm = False
            return
        
        # Genera un dialogo basato sulla situazione corrente
        situation = self._generate_situation_from_state()
        
        # Crea un task asincrono per la generazione del dialogo
        async def generate_dialog():
            try:
                dialog = await controller.generate_agent_dialog(self.unique_id, situation)
                self.last_dialog = dialog
                self.dialog_is_llm = True  # Imposta il flag a True per i dialoghi LLM
            except Exception as e:
                logger.error(f"Error generating dialog: {e}")
                self.last_dialog = self._generate_fallback_dialog()
                self.dialog_is_llm = False  # Imposta il flag a False per i dialoghi fallback
        
        # Esegui il task in background
        asyncio.create_task(generate_dialog())
    
    def _generate_situation_from_state(self) -> str:
        """Genera una descrizione della situazione basata sullo stato attuale"""
        situations = {
            AgentState.WORKING: [
                "Stai analizzando un dataset complesso per federated learning",
                "Stai progettando un nuovo algoritmo di aggregazione",
                "Stai cercando di ottimizzare l'overhead di comunicazione nel sistema FL",
                "Stai leggendo un recente paper sui problemi di non-IID data"
            ],
            AgentState.MEETING: [
                "Sei in una riunione con colleghi per discutere progressi recenti",
                "Stai partecipando a un meeting di coordinamento tra laboratori",
                "Stai presentando i tuoi risultati preliminari al team"
            ],
            AgentState.DISCUSSING: [
                "Stai discutendo con un collega di problemi di privacy in FL",
                "Stai confrontando idee su come migliorare la convergenza dell'algoritmo",
                "Stai spiegando il tuo approccio a un ricercatore junior"
            ],
            AgentState.RESTING: [
                "Stai prendendo una pausa dopo ore intense di lavoro",
                "Stai riflettendo sui progressi fatti finora",
                "Stai organizzando mentalmente i prossimi passi della ricerca"
            ],
            AgentState.PRESENTING: [
                "Stai presentando i tuoi risultati al gruppo di ricerca",
                "Stai spiegando un nuovo concetto teorico ai colleghi",
                "Stai facendo una demo del sistema FL che hai sviluppato"
            ],
            AgentState.TRAINING_MODEL: [
                "Stai addestrando un modello locale su dati sensibili",
                "Stai eseguendo esperimenti di fine-tuning sul modello",
                "Stai valutando le prestazioni del modello su dataset eterogenei"
            ],
            AgentState.SENDING_MODEL: [
                "Stai preparando i parametri del modello per l'invio",
                "Stai applicando tecniche di compressione ai parametri",
                "Stai verificando la sicurezza del canale di trasmissione"
            ],
            AgentState.AGGREGATING_MODELS: [
                "Stai aggregando modelli da diversi client",
                "Stai applicando pesi diversi ai contributi dei vari laboratori",
                "Stai verificando la convergenza dell'algoritmo di aggregazione"
            ],
            AgentState.RECEIVING_MODEL: [
                "Stai ricevendo il modello globale aggiornato",
                "Stai integrando i parametri globali con quelli locali",
                "Stai valutando le performance del modello aggiornato"
            ],
            AgentState.MOVING: [
                "Ti stai spostando verso una nuova postazione di lavoro",
                "Stai cercando un collega per discutere un'idea",
                "Stai andando a prendere un caffè per ricaricare le energie"
            ]
        }
        
        # Scegli una situazione casuale in base allo stato
        if self.state in situations:
            return random.choice(situations[self.state])
        else:
            return "Stai lavorando sul federated learning"
    
    def _generate_fallback_dialog(self) -> str:
        """Genera un dialogo predefinito se il LLM non è disponibile"""
        fallback_dialogs = {
            AgentState.WORKING: [
                "Sto analizzando questo algoritmo di aggregazione...",
                "Interessante, questa tecnica potrebbe migliorare la privacy.",
                "Devo ottimizzare questa parte del codice.",
            ],
            AgentState.MEETING: [
                "Secondo me dovremmo concentrarci sulla comunicazione efficiente.",
                "I nostri risultati preliminari mostrano un miglioramento del 15%.",
                "Qual è la vostra opinione su questo approccio?",
            ],
            AgentState.DISCUSSING: [
                "Sì, il problema principale è la convergenza con dati non-IID.",
                "Hai considerato di usare un approccio federato personalizzato?",
                "Questo paper propone una soluzione interessante a quel problema.",
            ],
            AgentState.RESTING: [
                "Ho bisogno di una pausa, è stata una giornata intensa.",
                "Sto riflettendo su come migliorare il nostro approccio.",
                "Un caffè è quello che ci vuole ora.",
            ],
            AgentState.PRESENTING: [
                "Come potete vedere da questo grafico, l'accuratezza è migliorata.",
                "La nostra tecnica riduce l'overhead di comunicazione del 30%.",
                "Questi risultati confermano la nostra ipotesi iniziale.",
            ],
            AgentState.TRAINING_MODEL: [
                "Il training procede bene, la loss sta convergendo.",
                "Devo verificare se ci sono bias nei dati di training.",
                "Questa architettura sembra adattarsi bene al problema.",
            ],
            AgentState.SENDING_MODEL: [
                "Invio i parametri al server di aggregazione...",
                "Ho implementato la compressione per ridurre il traffico.",
                "Tutti i controlli di sicurezza sono passati.",
            ],
            AgentState.AGGREGATING_MODELS: [
                "Sto aggregando i contributi di 5 laboratori diversi.",
                "Questo client ha dati molto diversi dagli altri.",
                "L'algoritmo FedAvg sta funzionando meglio del previsto.",
            ],
            AgentState.RECEIVING_MODEL: [
                "Il modello globale è arrivato, vediamo le performance.",
                "Interessante, ci sono miglioramenti significativi.",
                "Devo integrare questi parametri con il nostro modello locale.",
            ],
            AgentState.MOVING: [
                "Vado a consultarmi con il team di privacy.",
                "Ho bisogno di discutere questi risultati con il professore.",
                "Mi sposto nella sala server per controllare l'aggregazione.",
            ],
        }
        
        # Default dialog
        default_dialogs = [
            "Interessante, devo approfondire questo aspetto.",
            "Il federated learning è un campo affascinante.",
            "Dobbiamo bilanciare privacy e accuratezza.",
        ]
        
        # Scegli un dialogo casuale
        if self.state in fallback_dialogs:
            result = random.choice(fallback_dialogs[self.state])
        else:
            result = random.choice(default_dialogs)
        
        # Imposta il flag a False per i dialoghi fallback
        self.dialog_is_llm = False
        
        return result
    
    def get_dialog(self) -> str:
        """Restituisce il dialogo corrente dell'agente"""
        # Se non c'è un dialogo o il cooldown è attivo, potrebbe generarne uno nuovo
        if not self.last_dialog or random.random() < 0.1:
            self.trigger_dialog_generation()
            
        return self.last_dialog if self.last_dialog else self._generate_fallback_dialog()
    
    def step(self):
        """Metodo chiamato ad ogni step della simulazione Mesa"""
        # Delta time fisso per la simulazione Mesa
        delta_time = 1.0
        
        # Aggiorna bisogni e stato
        self.update_needs(delta_time)
        
        # Decide se cambiare stato
        if self.should_change_state():
            self.select_new_state()
        
        # Esegue comportamento basato su stato
        self.execute_current_behavior(delta_time)
        
        # Cerca interazioni possibili
        self.check_for_interactions()
        
        # Possibilità casuale di generare un nuovo dialogo
        if random.random() < 0.02 and self.dialog_cooldown <= 0:
            self.trigger_dialog_generation()
    
    def get_state_data(self) -> Dict[str, Any]:
        """Restituisce i dati di stato per visualizzazione/debug"""
        return {
            "id": self.unique_id,
            "role": self.role,
            "state": self.state.value,
            "position": self.pos,
            "target": self.target_position,
            "needs": {
                "energy": round(self.needs.energy, 2),
                "social": round(self.needs.social, 2),
                "focus": round(self.needs.focus, 2),
                "knowledge": round(self.needs.knowledge, 2)
            },
            "specializations": [s.value for s in self.specializations],
            "fl_role": self.fl_role.value if self.fl_role else None,
            "fl_task": self.fl_task,
            "fl_progress": round(self.fl_progress, 2) if self.fl_progress else 0,
            "fl_contributing": self.fl_contributing,
            "dialog": self.get_dialog(),
            "dialog_is_llm": self.dialog_is_llm  # Flag per indicare se il dialogo è generato da LLM
        }