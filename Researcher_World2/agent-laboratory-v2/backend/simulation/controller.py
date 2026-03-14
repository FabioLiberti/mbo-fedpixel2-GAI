# Path: backend/simulation/controller.py
#
# SimulationController: orchestrates the simulation loop, FL rounds,
# and injects FL events into agent cognitive memory.

import os
import datetime
import asyncio
import logging
import json
import numpy as np
from typing import Dict, List, Any, Optional, Callable
from threading import Thread, Event
import time

from models.environment import LabEnvironment
from fl.federated import FederatedLearningSystem
from cognitive.prompts.gpt_structure import get_embedding

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SimulationController:
    """Controller for the lab simulation with FL and cognitive agent support."""

    def __init__(
        self,
        config_path: str = None,
        on_step_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        if config_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            config_path = os.path.join(base_dir, "config", "simulation_config.json")

        self.config_path = config_path
        self.on_step_callback = on_step_callback

        # Simulation state
        self.running = False
        self.paused = False
        self.speed = 1.0

        # Model instance
        self.model = None

        # FL system
        self.fl_system = None
        self.fl_enabled = False
        self.fl_round_in_progress = False
        self.fl_step_counter = 0
        self.fl_steps_per_round = 50
        self.fl_current_phase = None

        # Thread control
        self.simulation_thread = None
        self.stop_event = Event()

        logger.info(f"Simulation controller initialized with config: {config_path}")

    def initialize_model(self):
        """Initialize the simulation model, MazeAdapter, and FL system."""
        try:
            self.model = LabEnvironment(self.config_path)
            logger.info(
                f"Simulation model initialized: {self.model.schedule.get_agent_count()} agents, "
                f"maze_adapter ready, sim_time={self.model.sim_time}"
            )

            # Initialize FL system
            self.fl_system = FederatedLearningSystem(
                algorithm="fedavg",
                aggregation_rounds=5,
                client_fraction=0.8,
                model_type="simple_nn"
            )
            self._register_labs_as_clients()
            logger.info("Federated Learning system initialized")

            return True
        except Exception as e:
            logger.error(f"Failed to initialize simulation model: {e}")
            return False

    def _register_labs_as_clients(self):
        if not self.model or not self.fl_system:
            return
        for lab_id in self.model.get_lab_ids():
            self.fl_system.register_client(lab_id)
            logger.info(f"Registered lab {lab_id} as FL client")

    # =========================================================================
    # FL Event Injection into Agent Memory
    # =========================================================================

    def _inject_fl_event(self, agent, description: str, poignancy: int = 7):
        """
        Inject an FL event into an agent's associative memory.
        This allows agents to "remember" FL activities and reflect on them.
        """
        try:
            s = agent.name
            p = "participated in"
            o = description

            keywords = set()
            keywords.update(["federated learning", agent.lab_id])
            for word in ["training", "aggregation", "model", "round"]:
                if word in description.lower():
                    keywords.add(word)

            # Get embedding for the event description
            embedding = get_embedding(description)
            embedding_pair = (description, embedding)

            # Add to associative memory
            agent.a_mem.add_event(
                agent.scratch.curr_time,  # created
                None,                      # expiration
                s, p, o,
                f"{s} {p} {o}",           # full description
                keywords,
                poignancy,
                embedding_pair,
                []                         # filling (chat_node_ids)
            )

            # Accumulate importance for reflection trigger
            agent.scratch.importance_trigger_curr -= poignancy
            agent.scratch.importance_ele_n += 1

            logger.debug(f"Injected FL event for '{agent.name}': {description}")
        except Exception as e:
            logger.error(f"Failed to inject FL event for '{agent.name}': {e}")

    def _inject_fl_round_events(self, phase: str, lab_ids: List[str] = None):
        """Inject FL phase events into all participating agents' memory."""
        if not self.model:
            return

        target_labs = lab_ids or self.model.get_lab_ids()
        fl_round = self.fl_system.get_state()["round"] if self.fl_system else 0

        descriptions = {
            "training": f"FL round {fl_round} local model training",
            "sending": f"FL round {fl_round} model parameters sent to server",
            "aggregating": f"FL round {fl_round} model aggregation completed",
            "receiving": f"FL round {fl_round} received updated global model",
            "completed": f"FL round {fl_round} completed successfully",
        }
        desc = descriptions.get(phase, f"FL round {fl_round} {phase}")

        for lab_id in target_labs:
            for agent in self.model.get_lab_agents(lab_id):
                self._inject_fl_event(agent, desc)

    # =========================================================================
    # Simulation Lifecycle
    # =========================================================================

    def start_simulation(self):
        if self.running:
            logger.warning("Simulation is already running")
            return False
        if not self.model and not self.initialize_model():
            logger.error("Could not initialize simulation model")
            return False

        self.running = True
        self.paused = False
        self.stop_event.clear()

        self.simulation_thread = Thread(target=self._simulation_loop)
        self.simulation_thread.daemon = True
        self.simulation_thread.start()

        logger.info("Simulation started")
        return True

    def stop_simulation(self):
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
        return True

    def pause_simulation(self):
        if not self.running:
            return False
        self.paused = True
        logger.info("Simulation paused")
        return True

    def resume_simulation(self):
        if not self.running:
            return False
        self.paused = False
        logger.info("Simulation resumed")
        return True

    def set_speed(self, speed: float):
        if speed <= 0:
            return False
        self.speed = speed
        logger.info(f"Simulation speed set to {speed}")
        return True

    def enable_federated_learning(self, enabled: bool = True):
        if not self.fl_system:
            logger.warning("FL system not initialized")
            return False

        self.fl_enabled = enabled
        if not enabled:
            self.fl_round_in_progress = False
            self.fl_step_counter = 0
            self.fl_current_phase = None
        logger.info(f"Federated Learning {'enabled' if enabled else 'disabled'}")
        return True

    # =========================================================================
    # FL Round Logic (preserved from original, with memory injection)
    # =========================================================================

    def _start_fl_round(self):
        if not self.fl_system:
            return

        selected_labs = self.fl_system.select_clients()
        if not selected_labs:
            logger.warning("No labs selected for FL round")
            return

        self.fl_round_in_progress = True
        self.fl_step_counter = 0
        self.fl_current_phase = "training"

        for lab_id in selected_labs:
            self._assign_fl_task_to_lab_agents(lab_id, "train")

        # Inject training event into agent memory
        self._inject_fl_round_events("training", selected_labs)
        logger.info(f"FL round started with labs: {selected_labs}")

    def _assign_fl_task_to_lab_agents(self, lab_id: str, task_type: str):
        if not self.model:
            return
        for agent in self.model.get_lab_agents(lab_id):
            if hasattr(agent, 'assign_fl_task'):
                agent.assign_fl_task(task_type)

    def _check_fl_phase_completion(self):
        if not self.fl_round_in_progress or not self.model:
            return False
        for lab_id in self.model.get_lab_ids():
            for agent in self.model.get_lab_agents(lab_id):
                if hasattr(agent, 'fl_task') and agent.fl_task and agent.fl_progress < 1.0:
                    return False
        return True

    def _advance_fl_phase(self):
        if not self.fl_round_in_progress:
            return

        phase = self.fl_current_phase

        if phase == "training":
            self.fl_current_phase = "sending"
            for lab_id in self.model.get_lab_ids():
                self._assign_fl_task_to_lab_agents(lab_id, "send_model")
            self._inject_fl_round_events("sending")
            logger.info("FL phase: training -> sending")

        elif phase == "sending":
            self.fl_current_phase = "aggregating"
            for lab_id in self.model.get_lab_ids():
                for agent in self.model.get_lab_agents(lab_id):
                    if hasattr(agent, 'fl_role') and agent.fl_role and \
                       getattr(agent.fl_role, 'value', '') == "model_aggregator":
                        agent.assign_fl_task("aggregate")
            self._inject_fl_round_events("aggregating")
            logger.info("FL phase: sending -> aggregating")

        elif phase == "aggregating":
            client_updates = self._collect_client_updates()
            self.fl_system.aggregate_models(client_updates)

            self.fl_current_phase = "receiving"
            for lab_id in self.model.get_lab_ids():
                self._assign_fl_task_to_lab_agents(lab_id, "receive_model")
            self._inject_fl_round_events("receiving")
            logger.info("FL phase: aggregating -> receiving")

        elif phase == "receiving":
            self.fl_system.update_client_models()

            self.fl_round_in_progress = False
            self.fl_step_counter = 0
            self.fl_current_phase = None

            # Inject round-completed event into all agents
            self._inject_fl_round_events("completed")
            logger.info("FL round completed")

    def _collect_client_updates(self) -> Dict[str, Any]:
        client_updates = {}
        for lab_id in self.model.get_lab_ids():
            data_x = np.random.randn(100, 10)
            data_y = np.random.randint(0, 2, size=(100, 1))
            metrics, weights = self.fl_system.train_client(lab_id, data_x, data_y)
            client_updates[lab_id] = weights
        return client_updates

    def _process_fl_logic(self):
        if not self.fl_enabled:
            return
        if not self.fl_round_in_progress:
            self._start_fl_round()
        else:
            self.fl_step_counter += 1
            if self._check_fl_phase_completion():
                self._advance_fl_phase()

    # =========================================================================
    # Simulation Loop
    # =========================================================================

    def _simulation_loop(self):
        step_count = 0
        try:
            while self.running and not self.stop_event.is_set():
                if not self.paused:
                    step_time = 1.0 / (self.model.tick_rate * self.speed)

                    start_time = time.time()
                    self.model.step()
                    step_count += 1

                    # Process FL logic
                    self._process_fl_logic()

                    # Collect and broadcast data
                    sim_data = self._collect_simulation_data()
                    if self.on_step_callback:
                        self.on_step_callback(sim_data)

                    # Throttle
                    elapsed = time.time() - start_time
                    remaining = step_time - elapsed
                    if remaining > 0:
                        time.sleep(remaining)

                    if step_count % 100 == 0:
                        logger.info(
                            f"Step {step_count}, sim_time={self.model.sim_time.strftime('%H:%M')}"
                        )
                else:
                    time.sleep(0.1)
        except Exception as e:
            logger.error(f"Error in simulation loop: {e}")
            self.running = False
        finally:
            logger.info(f"Simulation loop terminated after {step_count} steps")

    # =========================================================================
    # Data Collection
    # =========================================================================

    def _collect_simulation_data(self) -> Dict[str, Any]:
        """Collect simulation data for frontend broadcast."""
        base_data = {
            "step": self.model.schedule.steps if self.model else 0,
            "sim_time": self.model.sim_time.isoformat() if self.model else None,
            "agent_count": self.model.schedule.get_agent_count() if self.model else 0,
            "agent_states": self.model.get_agent_states() if self.model else [],
            "simulation": {
                "running": self.running,
                "paused": self.paused,
                "speed": self.speed
            }
        }

        # FL data
        if self.fl_enabled and self.fl_system:
            fl_state = self.fl_system.get_state()
            base_data["fl"] = {
                "enabled": self.fl_enabled,
                "round_in_progress": self.fl_round_in_progress,
                "current_phase": self.fl_current_phase,
                "step_counter": self.fl_step_counter,
                "steps_per_round": self.fl_steps_per_round,
                "round": fl_state["round"],
                "metrics": fl_state["metrics"]
            }

        return base_data

    def get_simulation_state(self) -> Dict[str, Any]:
        state = {
            "initialized": self.model is not None,
            "running": self.running,
            "paused": self.paused,
            "speed": self.speed,
            "step": self.model.schedule.steps if self.model else 0,
            "sim_time": self.model.sim_time.isoformat() if self.model else None,
            "agent_count": self.model.schedule.get_agent_count() if self.model else 0
        }

        if self.fl_system:
            fl_state = self.fl_system.get_state()
            state["fl"] = {
                "enabled": self.fl_enabled,
                "round": fl_state["round"],
                "algorithm": fl_state["algorithm"],
                "round_in_progress": self.fl_round_in_progress,
                "current_phase": self.fl_current_phase
            }

        return state

    # =========================================================================
    # Agent Access
    # =========================================================================

    def get_agent(self, agent_id):
        if not self.model:
            return None
        return self.model.get_agent_by_id(agent_id)

    def get_nearby_agents(self, agent):
        if not self.model:
            return []
        return self.model.get_nearby_agents(agent)

    # =========================================================================
    # Reset
    # =========================================================================

    def reset_simulation(self):
        was_running = self.running
        if was_running:
            self.stop_simulation()

        self.model = None
        self.fl_system = None
        self.fl_enabled = False
        self.fl_round_in_progress = False
        self.fl_step_counter = 0

        success = self.initialize_model()
        if success and was_running:
            self.start_simulation()

        logger.info("Simulation reset")
        return success
