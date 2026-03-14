import mesa
from mesa import Model
from mesa.time import RandomActivation
from mesa.space import MultiGrid
from mesa.datacollection import DataCollector
import random
import json
import logging
from typing import Dict, List, Any, Optional
from .agents.researcher import ResearcherAgent, Specialization, AgentState

# Configurazione logger
logger = logging.getLogger(__name__)

class LabEnvironment(Model):
    """Modello dell'ambiente di laboratorio con agenti ricercatori"""
    
    def __init__(self, config_path: str = None):
        super().__init__()
        
        # Carica configurazione
        self.config = self.load_config(config_path)
        
        # Imposta seed per riproducibilità
        self.random = random.Random(self.config.get("simulation", {}).get("random_seed", 42))
        
        # Imposta parametri di simulazione
        self.tick_rate = self.config.get("simulation", {}).get("tick_rate", 30)
        self.simulation_speed = self.config.get("simulation", {}).get("speed", 1.0)
        
        # Crea la griglia dell'ambiente
        # Per semplicità, usiamo una griglia fissa - in futuro potrebbe essere basata sulla configurazione
        grid_width, grid_height = 20, 20
        self.grid = MultiGrid(grid_width, grid_height, True)
        
        # Scheduler per l'attivazione degli agenti
        self.schedule = RandomActivation(self)
        
        # Crea agenti in base alla configurazione
        self.create_agents()
        
        # Collector per raccogliere dati sulla simulazione
        self.datacollector = DataCollector(
            agent_reporters={"State": lambda a: a.state.value if hasattr(a, "state") else None},
            model_reporters={"AgentCount": lambda m: m.schedule.get_agent_count()}
        )
    
    def load_config(self, config_path: str) -> Dict:
        """Carica la configurazione da file JSON"""
        if not config_path:
            logger.warning("No config path provided, using default configuration")
            return {}
            
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config from {config_path}: {e}")
            return {}
    
    def create_agents(self):
        """Crea gli agenti ricercatori in base alla configurazione"""
        # Ottieni configurazione ricercatori
        researchers_config = self.config.get("researchers", {})
        
        # Dizionario per mappare stringhe di specializzazione all'enum
        spec_map = {s.value: s for s in Specialization}
        
        # Contatore ID
        next_id = 0
        
        # Crea agenti per ogni tipo di ricercatore
        for role, role_config in researchers_config.items():
            count = role_config.get("count", 1)
            
            for _ in range(count):
                # Converti stringhe di specializzazione in enum
                specializations = [
                    spec_map.get(spec, Specialization.DATA_SCIENCE) 
                    for spec in role_config.get("specializations", [])
                    if spec in spec_map
                ]
                
                # Crea agente
                agent = ResearcherAgent(
                    next_id,
                    self,
                    role=role,
                    specializations=specializations,
                    social_tendency=role_config.get("social_tendency", 0.5),
                    research_efficiency=role_config.get("research_efficiency", 0.5),
                    movement_speed=role_config.get("speed", 1.0)
                )
                
                # Piazza agente in una posizione casuale
                x = self.random.randrange(self.grid.width)
                y = self.random.randrange(self.grid.height)
                self.grid.place_agent(agent, (x, y))
                
                # Aggiungi agente allo scheduler
                self.schedule.add(agent)
                
                next_id += 1
                
        logger.info(f"Created {self.schedule.get_agent_count()} agents")
    
    def step(self):
        """Esegue uno step della simulazione"""
        # Raccoglie dati prima dello step
        self.datacollector.collect(self)
        
        # Esegue lo step per tutti gli agenti
        self.schedule.step()
        
        # Esegue logica di simulazione aggiuntiva
        # ...
    
    def get_agent_states(self) -> List[Dict[str, Any]]:
        """Restituisce stati di tutti gli agenti per visualizzazione/API"""
        agent_states = []

        for agent in self.schedule.agents:
            if hasattr(agent, 'get_state_data'):
                agent_states.append(agent.get_state_data())

        return agent_states

    def get_lab_ids(self) -> List[str]:
        """Restituisce la lista degli ID dei laboratori dalla configurazione"""
        labs = self.config.get("labs", {})
        return [lab_id for lab_id, lab_cfg in labs.items() if lab_cfg.get("active", True)]

    def get_lab_agents(self, lab_id: str) -> List:
        """Restituisce gli agenti che appartengono a un laboratorio specifico"""
        return [
            agent for agent in self.schedule.agents
            if hasattr(agent, 'lab_id') and agent.lab_id == lab_id
        ]

    def get_agent_by_id(self, agent_id: int) -> Optional:
        """Restituisce un agente dato il suo unique_id, o None se non trovato"""
        for agent in self.schedule.agents:
            if agent.unique_id == agent_id:
                return agent
        return None

    def get_nearby_agents(self, agent, radius: int = 3) -> List:
        """Restituisce gli agenti entro un dato raggio nella griglia"""
        if not hasattr(agent, 'pos') or agent.pos is None:
            return []
        neighbors = self.grid.get_neighbors(agent.pos, moore=True, include_center=False, radius=radius)
        return [n for n in neighbors if n.unique_id != agent.unique_id]