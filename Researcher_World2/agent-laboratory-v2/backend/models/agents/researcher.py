# Path: backend/models/agents/researcher.py
#
# ResearcherAgent: Mesa agent with GA cognitive pipeline + FL participation.
# Refactored from threshold-based state machine to LLM-driven cognitive architecture.

import os
import datetime
import logging
import asyncio

from mesa import Agent, Model
from enum import Enum
from typing import List, Dict, Any, Optional

# Cognitive modules (ported from GA)
from cognitive.memory.spatial_memory import MemoryTree
from cognitive.memory.associative_memory import AssociativeMemory
from cognitive.memory.scratch import Scratch
from cognitive.perceive import perceive
from cognitive.retrieve import new_retrieve
from cognitive.plan import plan as cognitive_plan
from cognitive.reflect import reflect
from cognitive.execute import execute as cognitive_execute
from cognitive.prompts.run_gpt_prompt import is_llm_enabled
from cognitive.prompts.gpt_structure import get_and_reset_llm_success

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Base path for persona bootstrap data
PERSONAS_BASE = os.path.join(os.path.dirname(__file__), "..", "..", "config", "personas")


# --- Enumerations (kept from original) ---

class AgentState(Enum):
    WORKING = "working"
    MEETING = "meeting"
    RESTING = "resting"
    MOVING = "moving"
    DISCUSSING = "discussing"
    PRESENTING = "presenting"

    # FL states
    TRAINING_MODEL = "training_model"
    SENDING_MODEL = "sending_model"
    AGGREGATING_MODELS = "aggregating_models"
    RECEIVING_MODEL = "receiving_model"


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
    # Engineer
    MODEL_OPTIMIZATION = "model_optimization"
    PLATFORM_DEVELOPMENT = "platform_development"
    SYSTEMS_INTEGRATION = "systems_integration"
    # Doctor
    CLINICAL_DATA = "clinical_data"
    # Privacy Specialist
    COMPLIANCE_VERIFICATION = "compliance_verification"


class FLRole(Enum):
    DATA_PREPARER = "data_preparer"
    MODEL_TRAINER = "model_trainer"
    MODEL_AGGREGATOR = "model_aggregator"
    PRIVACY_GUARDIAN = "privacy_guardian"
    OBSERVER = "observer"


# --- Map from bootstrap fl_role string to FLRole enum ---
_FL_ROLE_MAP = {
    "client": FLRole.MODEL_TRAINER,
    "aggregator": FLRole.MODEL_AGGREGATOR,
    "coordinator": FLRole.MODEL_AGGREGATOR,
    "data_preparer": FLRole.DATA_PREPARER,
    "privacy_guardian": FLRole.PRIVACY_GUARDIAN,
    "observer": FLRole.OBSERVER,
}


class ResearcherAgent(Agent):
    """
    Mesa agent with GA cognitive architecture and FL participation.

    The agent has 3-level memory (spatial, associative, scratch) and runs
    a 5-stage cognitive pipeline: perceive -> retrieve -> plan -> reflect -> execute.
    FL tasks take absolute priority over the cognitive pipeline.

    Attributes:
        scratch: Working memory (identity, current action, schedule)
        a_mem:   Associative memory (long-term memory stream)
        s_mem:   Spatial memory (hierarchical world knowledge)
    """

    def __init__(
        self,
        unique_id: int,
        model: Model,
        role: str,
        specializations: List[Specialization],
        lab_id: str,
        persona_name: str,
        social_tendency: float = 0.5,
        research_efficiency: float = 0.5,
        movement_speed: float = 1.0,
    ):
        super().__init__(unique_id, model)

        # --- Base attributes (preserved for controller compatibility) ---
        self.role = role
        self.specializations = specializations
        self.social_tendency = social_tendency
        self.research_efficiency = research_efficiency
        self.movement_speed = movement_speed
        self.lab_id = lab_id
        self.type = self.role
        self.specialization = specializations[0].value if specializations else None

        # --- Load cognitive memory from bootstrap persona files ---
        persona_dir = os.path.join(PERSONAS_BASE, lab_id, persona_name, "bootstrap_memory")

        scratch_path = os.path.join(persona_dir, "scratch.json")
        self.scratch = Scratch(f_saved=scratch_path)

        spatial_path = os.path.join(persona_dir, "spatial_memory.json")
        self.s_mem = MemoryTree(f_saved=spatial_path)

        a_mem_dir = os.path.join(persona_dir, "associative_memory")
        self.a_mem = AssociativeMemory(f_saved=a_mem_dir)
        self.a_mem.agent_role = role  # enable role-based keyword strength tracking

        # --- Name property (used by cognitive modules via persona.name) ---
        self.name = self.scratch.name or persona_name.replace("_", " ")

        # --- FL attributes ---
        self.fl_role = _FL_ROLE_MAP.get(self.scratch.fl_role, FLRole.OBSERVER)
        self.fl_task = None
        self.fl_progress = 0.0
        self.fl_contributing = False

        # --- AgentState (for frontend display, derived from cognitive state) ---
        self.state = AgentState.RESTING

        # --- Cognitive step tracking ---
        # Stagger agents so not all run their cognitive cycle on the same step.
        # When LLM is enabled, each cognitive cycle takes ~5 min on CPU (Ollama).
        # Use a high interval (100) to keep simulation responsive.
        # When stubs are used, interval 10 is enough.
        base_interval = self.scratch.cognitive_step_interval or 10
        self.cognitive_step_interval = max(base_interval, 10)
        self.cognitive_step_counter = unique_id % self.cognitive_step_interval
        self.new_day_flag = "First day"  # triggers long-term planning on first cycle

        # --- Dialog (for frontend ThoughtBubble) ---
        self.last_dialog = None
        self.dialog_is_llm = False

        logger.info(
            f"Created {role} agent '{self.name}' (ID: {unique_id}, lab: {lab_id}) "
            f"FL role: {self.fl_role.value}, specialization: {self.scratch.fl_specialization}"
        )

    # =========================================================================
    # FL Methods (preserved from original)
    # =========================================================================

    def assign_fl_task(self, task_type: str):
        """Assign an FL task to this agent."""
        self.fl_task = task_type
        self.fl_progress = 0.0
        logger.info(f"Agent '{self.name}' (ID: {self.unique_id}) assigned FL task: {task_type}")
        self.handle_fl_task(task_type)

    def handle_fl_task(self, task_type: str):
        """Switch agent state to match the FL task."""
        self.fl_contributing = True
        if task_type == "train":
            self.state = AgentState.TRAINING_MODEL
        elif task_type == "send_model":
            self.state = AgentState.SENDING_MODEL
        elif task_type == "aggregate":
            self.state = AgentState.AGGREGATING_MODELS
        elif task_type == "receive_model":
            self.state = AgentState.RECEIVING_MODEL

    def process_fl_task(self, delta_time: float = 1.0):
        """Progress the current FL task. Returns True if task completed."""
        if not self.fl_task:
            return False

        progress_rate = 0.1 * self.research_efficiency
        if self.state == AgentState.TRAINING_MODEL:
            self.fl_progress += progress_rate * delta_time
        elif self.state == AgentState.AGGREGATING_MODELS:
            self.fl_progress += progress_rate * 1.5 * delta_time
        elif self.state in [AgentState.SENDING_MODEL, AgentState.RECEIVING_MODEL]:
            self.fl_progress += progress_rate * 2.0 * delta_time
        else:
            # Fallback: agent has FL task but state didn't match (e.g. aggregator assigned "train")
            self.fl_progress += progress_rate * delta_time

        self.fl_progress = min(1.0, self.fl_progress)

        if self.fl_progress >= 1.0:
            logger.info(f"Agent '{self.name}' completed FL task: {self.fl_task}")
            completed_task = self.fl_task
            self.fl_task = None
            self.fl_progress = 0.0
            self.fl_contributing = False

            # Boost importance accumulation to trigger reflection after FL task.
            # A completed FL round is a significant event worth reflecting on.
            boost = 50  # ~1/3 of importance_trigger_max (150)
            self.scratch.importance_trigger_curr = max(
                0, self.scratch.importance_trigger_curr - boost)
            logger.debug(
                f"Agent '{self.name}' FL task '{completed_task}' done — "
                f"importance_trigger_curr={self.scratch.importance_trigger_curr}"
            )

            # Inject FL completion as a high-poignancy event into associative memory
            try:
                from cognitive.prompts.gpt_structure import get_embedding
                import datetime
                spec = self.scratch.fl_specialization or "FL"
                desc = f"{self.name} ha completato il task FL '{completed_task}' su {spec}"
                created = self.scratch.curr_time or datetime.datetime.now()
                expiration = created + datetime.timedelta(days=30)
                embedding_pair = (desc, get_embedding(desc))
                self.a_mem.add_event(
                    created, expiration,
                    self.name, "completed FL task", completed_task,
                    desc, {self.name.lower(), "fl", completed_task, spec},
                    8,  # high poignancy
                    embedding_pair, None)
            except Exception as e:
                logger.debug(f"FL completion event injection failed: {e}")

            return True
        return False

    def _is_in_fl_task(self) -> bool:
        """Check if agent is currently occupied with an FL task."""
        return self.fl_task is not None and self.fl_progress < 1.0

    # =========================================================================
    # Cognitive Pipeline
    # =========================================================================

    def _run_cognitive_cycle(self, maze, personas_dict):
        """
        Run one full cognitive cycle: perceive -> retrieve -> plan -> reflect -> execute.

        Args:
            maze: MazeAdapter instance
            personas_dict: dict {name: ResearcherAgent} of all agents
        """
        try:
            # Reset LLM success tracker before this cycle
            get_and_reset_llm_success()

            # 1. PERCEIVE - detect nearby events
            perceived = perceive(self, maze)

            # 2. RETRIEVE - fetch relevant memories for perceived events
            retrieved = {}
            if perceived:
                focal_points = [e.description for e in perceived]
                retrieved = new_retrieve(self, focal_points)

            # 3. PLAN - determine next action (long-term on new day, short-term otherwise)
            act_address = cognitive_plan(
                self, maze, personas_dict, self.new_day_flag, retrieved
            )
            # Clear new_day_flag after first use
            if self.new_day_flag:
                self.new_day_flag = False

            # 4. REFLECT - check trigger, generate insights
            reflect(self)

            # Check if any LLM call actually succeeded during this cycle
            llm_actually_used = get_and_reset_llm_success()

            # 5. EXECUTE - compute movement path
            if act_address:
                next_tile, pronunciatio, description = cognitive_execute(
                    self, maze, personas_dict, act_address
                )
                # Move on grid
                if next_tile and next_tile != self.scratch.curr_tile:
                    self._move_to_tile(next_tile, maze)

            # Update state from cognitive action
            self._sync_state_from_scratch()

            # 6. GENERATE THOUGHT DIALOG - one dedicated LLM call for the panel
            if llm_actually_used:
                self.last_dialog = self._generate_thought_dialog()
                self.dialog_is_llm = True
            else:
                desc = self.scratch.act_description
                self.last_dialog = desc if desc and desc != "idle" else None
                self.dialog_is_llm = False

        except Exception as e:
            logger.error(f"Cognitive cycle error for '{self.name}': {e}")
            self.last_dialog = f"sto lavorando su {self.scratch.fl_specialization or 'ricerca'}"
            self.dialog_is_llm = False

    # Track recent dialogs to avoid repetition (class-level, shared across agents)
    _recent_dialogs: list = []
    _RECENT_DIALOG_MAX = 20

    def _generate_thought_dialog(self) -> str:
        """Generate a rich thought dialog via a single LLM call after cognitive cycle."""
        from cognitive.prompts.gpt_structure import ChatGPT_request

        # Build context from scratch data
        act = self.scratch.act_description or "research activities"
        spec = self.scratch.fl_specialization or "federated learning"
        plan = self.scratch.daily_plan_req or ""
        schedule_items = []
        if self.scratch.f_daily_schedule:
            idx = self.scratch.get_f_daily_schedule_index()
            for j in range(max(0, idx), min(len(self.scratch.f_daily_schedule), idx + 3)):
                task, dur = self.scratch.f_daily_schedule[j]
                if task:
                    schedule_items.append(f"- {task} ({dur} min)")

        schedule_str = "\n".join(schedule_items) if schedule_items else "Nessuna attività pianificata"

        # Build avoidance hint from recent dialogs
        avoid_hint = ""
        if ResearcherAgent._recent_dialogs:
            recent = ResearcherAgent._recent_dialogs[-5:]
            avoid_hint = (
                "\n\nNON ripetere frasi simili a queste già dette di recente:\n"
                + "\n".join(f'- "{d}"' for d in recent)
                + "\nSii originale e vario."
            )

        prompt = (
            f"Sei {self.name}, un {self.role} specializzato in {spec} "
            f"presso un laboratorio di ricerca sul federated learning ({self.lab_id}).\n"
            f"Attività corrente: {act}\n"
            f"Piano della giornata: {plan}\n"
            f"Prossime attività:\n{schedule_str}\n\n"
            f"Descrivi in 2-3 frasi a cosa stai pensando e su cosa stai lavorando. "
            f"Sii specifico riguardo alla tua ricerca. "
            f"Scrivi in prima persona, come un monologo interiore da ricercatore. "
            f"Rispondi in italiano."
            f"{avoid_hint}"
        )

        try:
            response = ChatGPT_request(prompt)
            if response and response != "OLLAMA ERROR" and len(response) > 5:
                # Track to avoid repetition in future prompts
                ResearcherAgent._recent_dialogs.append(response[:80])
                if len(ResearcherAgent._recent_dialogs) > ResearcherAgent._RECENT_DIALOG_MAX:
                    ResearcherAgent._recent_dialogs = ResearcherAgent._recent_dialogs[-ResearcherAgent._RECENT_DIALOG_MAX:]
                return response
        except Exception as e:
            logger.warning(f"Thought dialog generation failed for '{self.name}': {e}")

        # Fallback: compose from available data
        return f"{self.name} sta lavorando su {spec}: {act}"

    def _move_to_tile(self, next_tile, maze):
        """Move agent to a new tile on the Mesa grid, updating maze events."""
        old_tile = self.scratch.curr_tile
        if old_tile:
            maze.remove_event_from_tile(self.name, old_tile)

        self.scratch.curr_tile = next_tile

        # Update Mesa grid position if model has grid
        if hasattr(self.model, 'grid') and self.model.grid:
            try:
                self.model.grid.move_agent(self, tuple(next_tile))
            except Exception as e:
                logger.debug(f"grid.move_agent failed: {e}")

        # Add persona event to new tile
        event = self.scratch.get_curr_event_and_desc()
        maze.add_event_from_tile(event, next_tile)

    def _sync_state_from_scratch(self):
        """Derive AgentState from the current scratch action for frontend display."""
        desc = (self.scratch.act_description or "").lower()
        if self.scratch.chatting_with:
            self.state = AgentState.DISCUSSING
        elif any(kw in desc for kw in ["meeting", "present", "coordinat"]):
            self.state = AgentState.MEETING
        elif any(kw in desc for kw in ["rest", "break", "lunch", "coffee", "pausa"]):
            self.state = AgentState.RESTING
        elif self.scratch.planned_path:
            self.state = AgentState.MOVING
        else:
            self.state = AgentState.WORKING

    # =========================================================================
    # Mesa step()
    # =========================================================================

    def step(self):
        """
        Called every Mesa step. Two priorities:
        1. FL tasks are processed immediately (every step)
        2. Cognitive pipeline runs every cognitive_step_interval steps
        """
        # --- Priority 1: FL task processing ---
        if self._is_in_fl_task():
            self.process_fl_task(delta_time=1.0)
            # Set FL dialog only if current dialog is not LLM-generated
            # (preserve LLM dialogs so the panel can display them longer)
            if not self.dialog_is_llm:
                fl_descriptions = {
                    AgentState.TRAINING_MODEL: f"Addestramento modello locale su dati {self.scratch.fl_specialization or 'FL'}",
                    AgentState.SENDING_MODEL: "Invio aggiornamenti modello all'aggregatore",
                    AgentState.AGGREGATING_MODELS: "Aggregazione aggiornamenti modello federato",
                    AgentState.RECEIVING_MODEL: "Ricezione modello globale dal server",
                }
                self.last_dialog = fl_descriptions.get(self.state, f"Task FL: {self.fl_task}")
            return  # FL blocks cognitive pipeline

        # --- Priority 2: Cognitive pipeline (throttled) ---
        self.cognitive_step_counter += 1
        if self.cognitive_step_counter >= self.cognitive_step_interval:
            self.cognitive_step_counter = 0

            # Get maze and personas from model (injected by controller)
            maze = getattr(self.model, 'maze_adapter', None)
            personas_dict = getattr(self.model, 'personas_dict', {})

            if maze and self.scratch.curr_tile:
                # Time is already set by env.step() -> set_curr_time()
                self._run_cognitive_cycle(maze, personas_dict)

    # =========================================================================
    # Time Management
    # =========================================================================

    def set_curr_time(self, sim_time: datetime.datetime):
        """Set the agent's current simulation time (called by controller)."""
        old_day = self.scratch.curr_time.day if self.scratch.curr_time else None
        self.scratch.curr_time = sim_time
        if old_day and sim_time.day != old_day:
            self.new_day_flag = "New day"

    # =========================================================================
    # State Data (for frontend / WebSocket)
    # =========================================================================

    def _build_rich_dialog(self) -> str:
        """Build a rich dialog string with context from the cognitive pipeline."""
        parts = []

        # Current action (from LLM plan)
        act = self.scratch.act_description
        if act and act != "idle":
            duration = getattr(self.scratch, 'act_duration', None)
            addr = self.scratch.act_address
            line = f"{self.name} is {act}"
            if duration:
                line += f" ({duration} min)"
            if addr:
                line += f" @ {addr}"
            parts.append(line)

        # Daily plan overview (generated by LLM on new day)
        plan = self.scratch.daily_plan_req
        if plan:
            parts.append(f"Today's focus: {plan}")

        # Current + next schedule items for context
        if self.scratch.f_daily_schedule:
            idx = self.scratch.get_f_daily_schedule_index()
            schedule = self.scratch.f_daily_schedule
            items = []
            for j in range(max(0, idx), min(len(schedule), idx + 3)):
                marker = "→ " if j == idx else "  "
                items.append(f"{marker}{schedule[j][0]} ({schedule[j][1]} min)")
            if items:
                parts.append("Schedule:\n" + "\n".join(items))

        return "\n".join(parts) if parts else (self.last_dialog or "idle")

    def get_state_data(self) -> Dict[str, Any]:
        """Return state data for frontend visualization."""
        # Current daily schedule summary
        schedule_summary = ""
        if self.scratch.f_daily_schedule:
            idx = self.scratch.get_f_daily_schedule_index()
            if idx < len(self.scratch.f_daily_schedule):
                schedule_summary = self.scratch.f_daily_schedule[idx][0]

        # Build dialog: LLM dialog is already rich (from _generate_thought_dialog)
        if self.dialog_is_llm:
            dialog = self.last_dialog or ""
        elif not is_llm_enabled():
            dialog = self.last_dialog or self.scratch.act_description or "idle"
        else:
            dialog = ""  # LLM enabled but no LLM dialog yet — suppress stubs

        return {
            "id": self.unique_id,
            "name": self.name,
            "role": self.role,
            "state": self.state.value,
            "position": self.pos if hasattr(self, 'pos') and self.pos else self.scratch.curr_tile,
            "lab_id": self.lab_id,
            # Cognitive state
            "act_description": self.scratch.act_description,
            "act_pronunciatio": self.scratch.act_pronunciatio,
            "act_address": self.scratch.act_address,
            "current_schedule_task": schedule_summary,
            "chatting_with": self.scratch.chatting_with,
            "reflection_count": len(self.a_mem.seq_thought) if hasattr(self.a_mem, 'seq_thought') else 0,
            "memory_event_count": len(self.a_mem.seq_event) if hasattr(self.a_mem, 'seq_event') else 0,
            # FL state
            "specializations": [s.value for s in self.specializations],
            "fl_role": self.fl_role.value if self.fl_role else None,
            "fl_specialization": self.scratch.fl_specialization,
            "fl_task": self.fl_task,
            "fl_progress": round(self.fl_progress, 2) if self.fl_progress else 0,
            "fl_contributing": self.fl_contributing,
            # Dialog for panel
            "dialog": dialog,
            "dialog_is_llm": self.dialog_is_llm,
        }
