# Path: backend/models/environment.py
#
# LabEnvironment: Mesa Model with 9 persona-based agents and MazeAdapter.

import os
import datetime
import random
import json
import logging
from typing import Dict, List, Any, Optional

import mesa
from mesa import Model
from mesa.time import RandomActivation
from mesa.space import MultiGrid
from mesa.datacollection import DataCollector

from .agents.researcher import ResearcherAgent, Specialization, AgentState
from .maze_adapter import MazeAdapter

logger = logging.getLogger(__name__)

# Base path for persona bootstrap data
PERSONAS_BASE = os.path.join(os.path.dirname(__file__), "..", "config", "personas")

# Persona definitions: lab_id -> list of (persona_name, role, specialization_enum)
PERSONA_REGISTRY = {
    "mercatorum": [
        ("Elena_Conti",    "professor",           Specialization.PRIVACY_ECONOMICS),
        ("Luca_Bianchi",   "privacy_specialist",  Specialization.COMPLIANCE_VERIFICATION),
        ("Marco_Rossi",    "phd_student",          Specialization.DATA_SCIENCE),
        ("Sofia_Greco",    "researcher",           Specialization.PRIVACY_ENGINEERING),
    ],
    "blekinge": [
        ("Lars_Lindberg",   "professor_senior",  Specialization.FL_ARCHITECTURE),
        ("Erik_Johansson",  "phd_student",       Specialization.COMMUNICATION_EFFICIENCY),
        ("Sara_Nilsson",    "sw_engineer",       Specialization.PLATFORM_DEVELOPMENT),
        ("Nils_Eriksson",   "engineer",          Specialization.MODEL_OPTIMIZATION),
    ],
    "opbg": [
        ("Matteo_Ferri",     "doctor",           Specialization.CLINICAL_DATA),
        ("Marco_Romano",     "phd_student",      Specialization.DATA_SCIENCE),
        ("Lorenzo_Mancini",  "engineer",         Specialization.MODEL_OPTIMIZATION),
        ("Giulia_Conti",     "researcher",       Specialization.PRIVACY_ENGINEERING),
    ],
}

# Role-based default parameters
ROLE_DEFAULTS = {
    "phd_student":          {"speed": 1.2, "social_tendency": 0.7, "research_efficiency": 0.5},
    "researcher":           {"speed": 1.0, "social_tendency": 0.5, "research_efficiency": 0.8},
    "professor":            {"speed": 0.8, "social_tendency": 0.6, "research_efficiency": 1.0},
    "professor_senior":     {"speed": 0.7, "social_tendency": 0.6, "research_efficiency": 1.0},
    "doctor":               {"speed": 0.9, "social_tendency": 0.6, "research_efficiency": 0.8},
    "engineer":             {"speed": 1.0, "social_tendency": 0.4, "research_efficiency": 0.7},
    "sw_engineer":          {"speed": 1.0, "social_tendency": 0.4, "research_efficiency": 0.7},
    "privacy_specialist":   {"speed": 0.9, "social_tendency": 0.5, "research_efficiency": 0.8},
}


class LabEnvironment(Model):
    """Mesa model with persona-based agents, MazeAdapter, and FL support."""

    def __init__(self, config_path: str = None):
        super().__init__()

        # Load configuration
        self.config = self.load_config(config_path)

        # Reproducibility
        self.random = random.Random(self.config.get("simulation", {}).get("random_seed", 42))

        # Simulation parameters
        self.tick_rate = self.config.get("simulation", {}).get("tick_rate", 30)
        self.simulation_speed = self.config.get("simulation", {}).get("speed", 1.0)

        # Grid
        grid_width, grid_height = 20, 20
        self.grid = MultiGrid(grid_width, grid_height, True)

        # Scheduler
        self.schedule = RandomActivation(self)

        # MazeAdapter (GA Maze interface over Mesa grid)
        self.maze_adapter = MazeAdapter(self.grid)

        # Simulation time (starts at 8:00 AM on day 1)
        self.sim_time = datetime.datetime(2026, 3, 14, 8, 0, 0)

        # Create persona-based agents
        self.personas_dict = {}  # name -> ResearcherAgent
        self.create_agents()

        # Data collector
        self.datacollector = DataCollector(
            agent_reporters={"State": lambda a: a.state.value if hasattr(a, "state") else None},
            model_reporters={"AgentCount": lambda m: m.schedule.get_agent_count()}
        )

    def load_config(self, config_path: str) -> Dict:
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
        """Create 9 agents from persona bootstrap files, place in lab spawn tiles."""
        next_id = 0

        for lab_id, personas in PERSONA_REGISTRY.items():
            # Check lab is active
            labs_cfg = self.config.get("labs", {})
            if lab_id in labs_cfg and not labs_cfg[lab_id].get("active", True):
                continue

            # Get spawn tiles for this lab
            spawn_tiles = self.maze_adapter.get_lab_spawn_tiles(lab_id)
            if not spawn_tiles:
                logger.warning(f"No spawn tiles for lab {lab_id}, using (0,0)")
                spawn_tiles = [(0, 0)]

            for persona_name, role, specialization in personas:
                defaults = ROLE_DEFAULTS.get(role, {})

                agent = ResearcherAgent(
                    unique_id=next_id,
                    model=self,
                    role=role,
                    specializations=[specialization],
                    lab_id=lab_id,
                    persona_name=persona_name,
                    social_tendency=defaults.get("social_tendency", 0.5),
                    research_efficiency=defaults.get("research_efficiency", 0.5),
                    movement_speed=defaults.get("speed", 1.0),
                )

                # Place agent on grid in lab workspace
                tile = spawn_tiles[next_id % len(spawn_tiles)]
                self.grid.place_agent(agent, tuple(tile))
                agent.scratch.curr_tile = list(tile)

                # Set initial simulation time
                agent.set_curr_time(self.sim_time)

                # Register in scheduler and personas dict
                self.schedule.add(agent)
                self.personas_dict[agent.name] = agent

                # Add persona event to maze
                event = agent.scratch.get_curr_event_and_desc()
                self.maze_adapter.add_event_from_tile(event, tile)

                next_id += 1

        logger.info(
            f"Created {self.schedule.get_agent_count()} agents across "
            f"{len(PERSONA_REGISTRY)} labs"
        )

    def step(self):
        """Execute one simulation step."""
        # Advance simulation time (each step = 10 simulated minutes)
        self.sim_time += datetime.timedelta(minutes=10)

        # Update all agents' time
        for agent in self.schedule.agents:
            if hasattr(agent, 'set_curr_time'):
                agent.set_curr_time(self.sim_time)

        # Collect data
        self.datacollector.collect(self)

        # Step all agents
        self.schedule.step()

    def get_agent_states(self) -> List[Dict[str, Any]]:
        """Return states of all agents for frontend."""
        return [
            agent.get_state_data()
            for agent in self.schedule.agents
            if hasattr(agent, 'get_state_data')
        ]

    def get_lab_ids(self) -> List[str]:
        labs = self.config.get("labs", {})
        return [lab_id for lab_id, lab_cfg in labs.items() if lab_cfg.get("active", True)]

    def get_lab_agents(self, lab_id: str) -> List:
        return [
            agent for agent in self.schedule.agents
            if hasattr(agent, 'lab_id') and agent.lab_id == lab_id
        ]

    def get_agent_by_id(self, agent_id: int) -> Optional:
        for agent in self.schedule.agents:
            if agent.unique_id == agent_id:
                return agent
        return None

    def get_nearby_agents(self, agent, radius: int = 3) -> List:
        if not hasattr(agent, 'pos') or agent.pos is None:
            return []
        neighbors = self.grid.get_neighbors(
            agent.pos, moore=True, include_center=False, radius=radius
        )
        return [n for n in neighbors if n.unique_id != agent.unique_id]
