# Path: backend/simulation/controller.py
#
# SimulationController: orchestrates the simulation loop, FL rounds,
# and injects FL events into agent cognitive memory.

import os
import datetime
import asyncio
import logging
import json
import uuid
import queue
import numpy as np
from typing import Dict, List, Any, Optional, Callable
import threading
import collections
from threading import Thread, Event, Lock
import time

from models.environment import LabEnvironment
from fl.federated import FederatedLearningSystem
from cognitive.prompts.gpt_structure import get_embedding
from cognitive.converse import generate_fl_conversation
from cognitive.dialog_quality import DialogQualityMonitor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SimulationController:
    """Controller for the lab simulation with FL and cognitive agent support."""

    def __init__(
        self,
        config_path: str = None,
        on_step_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        fl_checkpoint_dir: Optional[str] = None
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
        self.fl_conversations: List[Dict[str, Any]] = []  # post-round FL dialogs

        # FL experiment runs. Each run keeps its checkpoint in its own folder,
        # <root>/runs/<run_id>/, and <root>/current_run names the run that a
        # backend restart resumes. A reset opens a new run instead of
        # reloading the old one. Checkpoint files left directly in <root> by
        # earlier versions are not read.
        self.fl_checkpoint_root = (
            fl_checkpoint_dir or FederatedLearningSystem._DEFAULT_CHECKPOINT_DIR
        )
        self.fl_run_id: Optional[str] = None

        # FL pacing in wall-clock time: a new round starts every
        # fl_round_interval seconds and its four phases share that time, so the
        # process can be followed on screen whatever the simulation speed.
        self.fl_round_interval = 10.0
        self._fl_round_started_at = 0.0
        self._fl_phase_started_at = 0.0

        # Post-round dialogs written by the LLM are generated in background
        # threads and handed back through this queue: the simulation loop only
        # applies the finished results and never waits for the model.
        self._fl_dialog_results: "queue.Queue" = queue.Queue()
        self._fl_dialog_threads: Dict[str, Thread] = {}

        # The FL process runs on its own clock thread (_fl_loop), so it keeps
        # its pace even while a simulation step is waiting on the LLM. That
        # thread never writes into the agents' memories: those writes are
        # queued here and executed by the simulation loop between two steps.
        self._fl_logic_lock = Lock()
        self._fl_memory_writes: "collections.deque" = collections.deque(maxlen=300)

        # Agent-guided FL: every fl_guidance_every rounds one agent per lab
        # proposes a change to the FL parameters, the proposals are voted and
        # the winner is applied (see cognitive/fl_guidance.py)
        self.fl_guidance_enabled = True
        self.fl_guidance_every = 5
        self.fl_decisions: List[Dict[str, Any]] = []
        self._fl_guidance_turn = 0

        # Dialog quality monitor
        self.dialog_monitor = DialogQualityMonitor()

        # Thread control. Every simulation loop gets its own stop token:
        # stop_event is the token of the most recently started loop. A loop
        # that is still inside a slow step when it is stopped keeps its own
        # (set) token, so a later start cannot bring it back to life.
        self.simulation_thread = None
        self.stop_event = Event()
        self.stop_join_timeout = 2.0  # seconds stop_simulation waits for the loop
        self._lock = Lock()  # protects shared state (running, paused, speed, fl_*)

        logger.info(f"Simulation controller initialized with config: {config_path}")

    def _read_current_fl_run(self) -> Optional[str]:
        """Return the id of the FL run to resume, or None if there is none."""
        pointer = os.path.join(self.fl_checkpoint_root, "current_run")
        try:
            with open(pointer, "r") as f:
                run_id = f.read().strip()
        except OSError:
            return None
        # The id is used as a folder name: accept a plain name only.
        if not run_id or run_id in (".", "..") or os.path.basename(run_id) != run_id:
            logger.warning(f"Ignoring invalid FL run id in {pointer}")
            return None
        return run_id

    def _open_new_fl_run(self) -> str:
        """Create a new FL run id and record it as the current run."""
        run_id = (
            datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
            + "-" + uuid.uuid4().hex[:6]
        )
        os.makedirs(self.fl_checkpoint_root, exist_ok=True)
        pointer = os.path.join(self.fl_checkpoint_root, "current_run")
        tmp_pointer = pointer + ".tmp"
        with open(tmp_pointer, "w") as f:
            f.write(run_id + "\n")
        os.replace(tmp_pointer, pointer)
        return run_id

    def initialize_model(self, new_fl_run: bool = False):
        """Initialize the simulation model, MazeAdapter, and FL system.

        With new_fl_run=False the FL system resumes the current run, if one
        was checkpointed (backend restart). With new_fl_run=True it always
        starts a new run from round 0 (reset).
        """
        try:
            self.model = LabEnvironment(self.config_path)
            logger.info(
                f"Simulation model initialized: {self.model.schedule.get_agent_count()} agents, "
                f"maze_adapter ready, sim_time={self.model.sim_time}"
            )

            # Initialize FL system: resume the current run, or open a new one
            fl_cfg = (getattr(self.model, "config", None) or {}).get("fl", {})
            patience = fl_cfg.get("convergence_patience", 20)
            run_id = None if new_fl_run else self._read_current_fl_run()
            resuming = run_id is not None
            if run_id is None:
                run_id = self._open_new_fl_run()
            self.fl_run_id = run_id
            # FL parameters come from the "fl" section of simulation_config.json
            privacy_cfg = fl_cfg.get("privacy", {})
            self.fl_round_interval = float(fl_cfg.get("round_interval_seconds", 10.0))
            self._fl_round_started_at = 0.0
            self._fl_phase_started_at = 0.0
            guidance_cfg = fl_cfg.get("agent_guidance", {})
            self.fl_guidance_enabled = bool(guidance_cfg.get("enabled", True))
            self.fl_guidance_every = max(1, int(guidance_cfg.get("every_rounds", 5)))
            self.fl_decisions = []
            self._fl_guidance_turn = 0
            self.fl_system = FederatedLearningSystem(
                algorithm="fedavg",
                aggregation_rounds=5,
                client_fraction=0.8,
                model_type="simple_nn",
                convergence_patience=patience,
                checkpoint_dir=os.path.join(self.fl_checkpoint_root, "runs", run_id),
                dp_enabled=bool(privacy_cfg.get("differential_privacy", True)),
                dp_noise_multiplier=float(privacy_cfg.get("noise_multiplier", 0.5)),
                dp_max_grad_norm=float(privacy_cfg.get("max_grad_norm", 1.0)),
                dp_epsilon_total=float(privacy_cfg.get("epsilon_total", 1000.0)),
                dp_enforce_budget=bool(privacy_cfg.get("enforce_budget", False)),
                stop_on_convergence=bool(fl_cfg.get("stop_on_convergence", False)),
            )
            self._register_labs_as_clients()
            if resuming and self.fl_system.load_checkpoint():
                logger.info(
                    f"FL run {run_id} restored from checkpoint (round {self.fl_system.round})"
                )
            else:
                logger.info(f"FL run {run_id} initialized fresh (round 0)")

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
    # Agent Memory Checkpointing
    # =========================================================================

    def _checkpoint_agent_memories(self, step_count: int):
        """Save all agent cognitive memories to disk for crash recovery."""
        if not self.model:
            return
        checkpoint_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "checkpoints", "agent_memories"
        )
        os.makedirs(checkpoint_dir, exist_ok=True)

        saved = 0
        for agent in self.model.schedule.agents:
            try:
                agent_dir = os.path.join(checkpoint_dir, str(agent.unique_id))
                os.makedirs(agent_dir, exist_ok=True)

                # Save associative memory (events, thoughts, chats)
                if hasattr(agent, 'a_mem') and agent.a_mem:
                    a_mem_dir = os.path.join(agent_dir, "associative_memory")
                    os.makedirs(a_mem_dir, exist_ok=True)
                    agent.a_mem.save(a_mem_dir)

                # Save scratch (working memory)
                if hasattr(agent, 'scratch') and agent.scratch:
                    scratch_path = os.path.join(agent_dir, "scratch.json")
                    agent.scratch.save(scratch_path)

                saved += 1
            except Exception as e:
                logger.warning(f"Failed to checkpoint agent {agent.unique_id}: {e}")

        logger.info(f"Agent memory checkpoint: {saved} agents saved at step {step_count}")

    # =========================================================================
    # FL Event Injection into Agent Memory
    # =========================================================================

    def _inject_fl_event(self, agent, description: str, poignancy: int = 7, lasting: bool = False):
        """
        Inject an FL event into an agent's associative memory.
        This allows agents to "remember" FL activities and reflect on them.
        """
        if self._on_fl_clock():
            # Called from the FL clock thread: the write is done later by the
            # simulation loop, the only thread that touches agent memories
            self._fl_memory_writes.append(
                ("event", lambda: self._inject_fl_event(agent, description, poignancy, lasting))
            )
            return
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
            # A lasting memory does not expire with simulated time (which runs
            # days per minute): it is given up only for lack of room, and last
            expiration = None
            if lasting and agent.scratch.curr_time:
                expiration = agent.scratch.curr_time + datetime.timedelta(days=3650)

            agent.a_mem.add_event(
                agent.scratch.curr_time,  # created
                expiration,                # None = computed from the importance
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

    # Lab demographic descriptions for agent awareness
    _LAB_DEMOGRAPHICS = {
        "mercatorum": "pazienti anziani (over 60)",
        "blekinge": "pazienti di mezza età (50-59 anni)",
        "opbg": "pazienti pediatrici e giovani (under 50)",
    }

    # Role → what kind of insight they notice
    _ROLE_INSIGHT_TEMPLATES = {
        "professor": (
            "Il dataset {lab} contiene solo {demo}. "
            "Il modello locale ha accuracy {local_acc:.0%} ma il modello federato "
            "raggiunge {global_acc:.0%} ({gain_word} di {abs_gain:.1%} grazie alla collaborazione). "
            "La federazione permette di generalizzare su fasce demografiche mai osservate localmente."
        ),
        "privacy_specialist": (
            "I dati dei pazienti {demo} di {lab} non sono mai stati condivisi con gli altri laboratori. "
            "Il modello federato raggiunge accuracy {global_acc:.0%} anche sui dati di {other_labs}. "
            "{dp_insight}"
            "Il federated learning con DP-SGD garantisce privacy formale dei dati sanitari."
        ),
        "student": (
            "Ho osservato che il nostro dataset {lab} ha solo {demo}. "
            "Il modello locale ha accuracy {local_acc:.0%}, "
            "ma quello federato è a {global_acc:.0%} ({gain_word} {abs_gain:.1%}). "
            "La collaborazione con gli altri laboratori sta migliorando le predizioni."
        ),
        "researcher": (
            "Analisi round {fl_round}: il modello globale su dati {lab} ({demo}) "
            "ha accuracy {global_acc:.0%} vs locale {local_acc:.0%} (delta {gain:+.1%}). "
            "Cross-evaluation sugli altri lab: {cross_summary}."
        ),
    }

    def _inject_fl_awareness_events(self):
        """Inject role-specific bias-awareness insights after each FL round completion."""
        if not self.model or not self.fl_system:
            return

        fl_state = self.fl_system.get_state()
        fl_round = fl_state["round"]
        metrics = fl_state["metrics"]

        # Get latest local_vs_global and cross_eval
        lvg_list = metrics.get("local_vs_global", [])
        cross_list = metrics.get("cross_eval", [])
        if not lvg_list or not cross_list:
            return

        lvg = lvg_list[-1]   # {lab_id: {local_acc, global_acc, gain}}
        cross = cross_list[-1]  # {lab_id: {accuracy, loss, samples}}

        for lab_id in self.model.get_lab_ids():
            lab_lvg = lvg.get(lab_id, {})
            local_acc = lab_lvg.get("local_acc", 0)
            global_acc = lab_lvg.get("global_acc", 0)
            gain = lab_lvg.get("gain", 0)
            abs_gain = abs(gain)
            gain_word = "miglioramento" if gain >= 0 else "differenza"
            demo = self._LAB_DEMOGRAPHICS.get(lab_id, "pazienti")

            # Other labs for privacy specialist
            other_labs = [lid for lid in self.model.get_lab_ids() if lid != lab_id]
            other_labs_str = " e ".join(other_labs)

            # Cross-eval summary for researcher
            cross_parts = []
            for olid in other_labs:
                c = cross.get(olid, {})
                cross_parts.append(f"{olid} {c.get('accuracy', 0):.0%}")
            cross_summary = ", ".join(cross_parts)

            # DP-SGD insight for privacy_specialist
            dp = fl_state.get("dp", {})
            if dp.get("enabled"):
                budget_pct = dp.get("budget_fraction", 1.0) * 100
                eps_spent = dp.get("epsilon_spent", 0)
                eps_total = dp.get("epsilon_total", 10)
                dp_insight = (
                    f"Il budget di privacy (ε) è al {budget_pct:.0f}% "
                    f"({eps_spent:.2f}/{eps_total} consumato). "
                    f"Il rumore gaussiano (σ={dp.get('noise_multiplier', 0.5)}) "
                    f"protegge ogni aggiornamento dei gradienti. "
                )
            else:
                dp_insight = ""

            for agent in self.model.get_lab_agents(lab_id):
                role = getattr(agent, "role", "researcher")
                template = self._ROLE_INSIGHT_TEMPLATES.get(
                    role, self._ROLE_INSIGHT_TEMPLATES["researcher"]
                )

                try:
                    insight = template.format(
                        lab=lab_id,
                        demo=demo,
                        local_acc=local_acc,
                        global_acc=global_acc,
                        gain=gain,
                        abs_gain=abs_gain,
                        gain_word=gain_word,
                        fl_round=fl_round,
                        other_labs=other_labs_str,
                        cross_summary=cross_summary,
                        dp_insight=dp_insight,
                    )
                except KeyError:
                    insight = (
                        f"FL round {fl_round} completato per {lab_id}: "
                        f"accuracy globale {global_acc:.0%}, locale {local_acc:.0%}."
                    )

                # High poignancy (8) to trigger reflection
                self._inject_fl_event(agent, insight, poignancy=8)

        logger.info(f"Injected FL bias-awareness events for round {fl_round}")

    # Role-specific poignancy for FL thought nodes
    _ROLE_FL_POIGNANCY = {
        "professor": 7,
        "researcher": 8,
        "student": 6,
        "doctor": 7,
        "privacy_specialist": 9,
        "professor_senior": 7,
        "sw_engineer": 6,
        "engineer": 6,
        "student_postdoc": 7,
    }

    # Role-specific FL thought templates (concise, for embedding_key)
    _ROLE_FL_THOUGHT_TEMPLATES = {
        "professor": (
            "Round {round}: accuracy globale {acc:.0%} (gain {gain:+.1%} per {lab}). "
            "La federazione tra laboratori sta {trend}."
        ),
        "researcher": (
            "Round {round}: modello globale accuracy {acc:.0%}, delta locale {gain:+.1%}. "
            "Budget privacy al {budget:.0%}. {trend_detail}"
        ),
        "student": (
            "Round {round}: ho appreso che il modello federato raggiunge {acc:.0%}. "
            "Il nostro lab {lab} contribuisce con un gain di {gain:+.1%}."
        ),
        "doctor": (
            "Round {round}: il modello su dati clinici di {lab} ({demo}) ha accuracy {acc:.0%}. "
            "Implicazioni per la diagnosi: {trend}."
        ),
        "privacy_specialist": (
            "Round {round}: budget privacy (ε) al {budget:.0%}. "
            "Accuracy {acc:.0%} con DP-SGD attivo. {dp_note}"
        ),
    }

    def _deposit_fl_thought_nodes(self):
        """Deposit FL round results as thought nodes in each agent's memory.

        Unlike event nodes (24h lifetime), thought nodes persist 72-144h
        and are retrieved by _retrieve_fl_insights_for_convo() to enrich dialogs.
        """
        if not self.model or not self.fl_system:
            return

        fl_state = self.fl_system.get_state()
        fl_round = fl_state["round"]
        metrics = fl_state["metrics"]
        dp = fl_state.get("dp", {})

        lvg_list = metrics.get("local_vs_global", [])
        lvg = lvg_list[-1] if lvg_list else {}

        budget = dp.get("budget_fraction", 1.0)
        dp_note = "Attenzione: budget quasi esaurito!" if budget < 0.25 else "Consumo nella norma."

        deposited = 0
        for lab_id in self.model.get_lab_ids():
            lab_lvg = lvg.get(lab_id, {})
            acc = lab_lvg.get("global_acc", 0)
            gain = lab_lvg.get("gain", 0)
            demo = self._LAB_DEMOGRAPHICS.get(lab_id, "pazienti")

            if gain > 0.02:
                trend = "migliorando la generalizzazione"
                trend_detail = "Il modello federato migliora rispetto al locale."
            elif gain < -0.02:
                trend = "ancora convergendo"
                trend_detail = "Il modello locale è ancora migliore — serve convergenza."
            else:
                trend = "stabilizzandosi"
                trend_detail = "Locale e globale sono allineati."

            for agent in self.model.get_lab_agents(lab_id):
                role = getattr(agent, "role", "researcher")
                poignancy = self._ROLE_FL_POIGNANCY.get(role, 7)

                # Select template (fallback to researcher)
                template = self._ROLE_FL_THOUGHT_TEMPLATES.get(
                    role, self._ROLE_FL_THOUGHT_TEMPLATES["researcher"]
                )

                try:
                    thought_text = template.format(
                        round=fl_round, acc=acc, gain=gain,
                        lab=lab_id, demo=demo, budget=budget,
                        trend=trend, trend_detail=trend_detail,
                        dp_note=dp_note,
                    )
                except KeyError:
                    thought_text = (
                        f"Round {fl_round}: accuracy {acc:.0%}, "
                        f"gain {gain:+.1%} per {lab_id}."
                    )

                try:
                    s = agent.name
                    p = "ha appreso dal round FL"
                    o = f"round {fl_round} {lab_id}"

                    keywords = {"fl", "round", "accuracy", "federato",
                                role, lab_id, f"round_{fl_round}"}

                    embedding = get_embedding(thought_text)
                    embedding_pair = (thought_text, embedding)

                    agent.a_mem.add_thought(
                        agent.scratch.curr_time,  # created
                        None,                      # expiration (auto via compute_expiration)
                        s, p, o,
                        thought_text,
                        keywords,
                        poignancy,
                        embedding_pair,
                        [],                        # filling
                    )

                    # Accumulate importance for reflection trigger
                    agent.scratch.importance_trigger_curr -= poignancy
                    agent.scratch.importance_ele_n += 1
                    deposited += 1

                except Exception as e:
                    logger.error(f"Failed to deposit FL thought for '{agent.name}': {e}")

        logger.info(f"Deposited {deposited} FL thought nodes for round {fl_round}")

    # Template-based FL reflections (no LLM call needed)
    _FL_REFLECTION_TEMPLATES = {
        "professor": [
            "Riflettendo sul round {round}: l'accuracy {acc:.0%} suggerisce che la diversità dei dati tra i lab sta {trend}. Dovremmo considerare l'impatto sulla generalizzazione clinica.",
            "Dopo il round {round}, noto che il gain di {gain:+.1%} per {lab} indica {gain_insight}. La strategia di federazione merita una revisione critica.",
        ],
        "researcher": [
            "Analizzando i risultati del round {round}: il delta accuracy di {gain:+.1%} indica {gain_insight}. Potrebbe essere utile esplorare aggregazioni alternative.",
            "Post round {round}: l'accuracy {acc:.0%} con budget privacy al {budget:.0%} conferma {dp_insight}. Devo approfondire il trade-off.",
        ],
        "student": [
            "Dopo il round {round} ho capito meglio come il federated learning bilancia i dati di {lab} ({demo}) con quelli degli altri laboratori. Il gain {gain:+.1%} è {gain_word}.",
        ],
        "doctor": [
            "Riflettendo sul round {round}: accuracy {acc:.0%} sui dati clinici di {lab} ({demo}). Per la pratica clinica, {clinical_insight}. La privacy dei pazienti è garantita.",
        ],
        "privacy_specialist": [
            "Post round {round}: il budget ε è al {budget:.0%}. {dp_detail}. L'accuracy {acc:.0%} conferma che la protezione DP-SGD non compromette significativamente l'utilità.",
        ],
    }

    def _trigger_fl_reflection(self):
        """Trigger lightweight FL reflection for one agent per lab.

        Generates template-based thought nodes (depth=2) without LLM calls,
        keeping latency near zero. These reflections build on the FL thought
        nodes from _deposit_fl_thought_nodes() and persist 72-144h.
        """
        if not self.model or not self.fl_system:
            return

        fl_state = self.fl_system.get_state()
        fl_round = fl_state["round"]
        metrics = fl_state["metrics"]
        dp = fl_state.get("dp", {})

        lvg_list = metrics.get("local_vs_global", [])
        lvg = lvg_list[-1] if lvg_list else {}
        budget = dp.get("budget_fraction", 1.0)

        reflected = 0
        for lab_id in self.model.get_lab_ids():
            agents = self.model.get_lab_agents(lab_id)
            if not agents:
                continue

            # Select one agent per lab for reflection (highest role poignancy)
            agent = max(agents, key=lambda a: self._ROLE_FL_POIGNANCY.get(
                getattr(a, "role", "researcher"), 6))

            role = getattr(agent, "role", "researcher")
            lab_lvg = lvg.get(lab_id, {})
            acc = lab_lvg.get("global_acc", 0)
            gain = lab_lvg.get("gain", 0)
            demo = self._LAB_DEMOGRAPHICS.get(lab_id, "pazienti")

            # Contextual substitutions
            if gain > 0.02:
                trend = "contribuendo positivamente alla convergenza"
                gain_insight = "che la collaborazione federata sta funzionando"
                gain_word = "incoraggiante"
            elif gain < -0.02:
                trend = "ancora adattandosi alle differenze tra dataset"
                gain_insight = "che il modello globale deve ancora adattarsi ai nostri dati"
                gain_word = "preoccupante ma atteso nelle fasi iniziali"
            else:
                trend = "raggiungendo un equilibrio"
                gain_insight = "una buona convergenza locale-globale"
                gain_word = "stabile"

            if budget < 0.25:
                dp_insight = "che stiamo avvicinandoci al limite di privacy"
                dp_detail = "Il budget sta per esaurirsi, dovremo ridurre i round futuri"
            else:
                dp_insight = "un buon equilibrio privacy-utilità"
                dp_detail = "Il consumo è nella norma, possiamo continuare"

            clinical_insight = (
                "serve cautela nell'applicazione diagnostica"
                if acc < 0.75 else "i risultati sono promettenti per l'uso clinico"
            )

            import random
            templates = self._FL_REFLECTION_TEMPLATES.get(
                role, self._FL_REFLECTION_TEMPLATES["researcher"])
            rng = random.Random(fl_round * 13 + hash(agent.name) % 100)
            template = rng.choice(templates)

            try:
                reflection_text = template.format(
                    round=fl_round, acc=acc, gain=gain,
                    lab=lab_id, demo=demo, budget=budget,
                    trend=trend, gain_insight=gain_insight,
                    gain_word=gain_word, dp_insight=dp_insight,
                    dp_detail=dp_detail, clinical_insight=clinical_insight,
                )
            except KeyError:
                reflection_text = (
                    f"Riflettendo sul round {fl_round}: accuracy {acc:.0%}, "
                    f"gain {gain:+.1%} per {lab_id}."
                )

            try:
                s = agent.name
                p = "riflette sui risultati FL"
                o = f"round {fl_round}"

                keywords = {"fl", "riflessione", "round", "insight",
                            role, lab_id, f"round_{fl_round}"}

                embedding = get_embedding(reflection_text)
                embedding_pair = (reflection_text, embedding)

                # Find the FL thought node just deposited as evidence
                evidence = []
                for node in agent.a_mem.seq_thought[:3]:
                    if f"round {fl_round}" in (node.object or ""):
                        evidence.append(node.node_id)
                        break

                agent.a_mem.add_thought(
                    agent.scratch.curr_time,
                    None,                      # auto expiration
                    s, p, o,
                    reflection_text,
                    keywords,
                    7,                         # poignancy
                    embedding_pair,
                    evidence,
                )

                agent.scratch.importance_trigger_curr -= 7
                agent.scratch.importance_ele_n += 1
                reflected += 1

            except Exception as e:
                logger.error(f"Failed FL reflection for '{agent.name}': {e}")

        logger.info(f"FL reflection: {reflected} agents reflected on round {fl_round}")

    def _seconds_to_next_fl_round(self) -> float:
        """Seconds until the next round starts (0 while a round is in progress)."""
        if self.fl_round_in_progress or not self._fl_round_started_at:
            return 0.0
        remaining = self.fl_round_interval - (time.monotonic() - self._fl_round_started_at)
        return round(max(0.0, remaining), 1)

    def _generate_fl_dialogs(self, kind: str, tasks: list, generate, apply, use_llm: bool,
                             priority: int = 1, generate_template=None):
        """Generate one batch of post-round dialogs and apply the results.

        Without the LLM the texts are instant templates: generated and applied
        right away. With the LLM each text takes many seconds, so the batch is
        generated in a background thread and applied later by the simulation
        loop (_apply_pending_fl_dialogs). If the previous batch of the same
        kind is still being written, this round is simply not commented.
        """
        if not tasks:
            return
        if not use_llm:
            apply([generate(task) for task in tasks])
            return

        running = self._fl_dialog_threads.get(kind)
        if running is not None and running.is_alive():
            # The model is still writing the previous batch: this round gets
            # template dialogs (if the caller has them) instead of none at all
            if generate_template is not None:
                apply([generate_template(task) for task in tasks])
            else:
                logger.info(f"FL dialogs ({kind}): previous batch still being written, round skipped")
            return

        run_id = self.fl_run_id

        def urgent(task):
            # These few calls drive the federation: they go before the many
            # calls of the agents' cognitive cycle in the queue for the model
            from cognitive.prompts.gpt_structure import urgent_llm
            with urgent_llm(priority):
                return generate(task)

        def worker():
            from concurrent.futures import ThreadPoolExecutor
            try:
                with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
                    results = list(pool.map(urgent, tasks))
                self._fl_dialog_results.put((run_id, kind, apply, results))
            except Exception as e:
                logger.warning(f"FL dialogs ({kind}) generation failed: {e}")

        thread = Thread(target=worker, daemon=True, name=f"fl-dialogs-{kind}")
        self._fl_dialog_threads[kind] = thread
        thread.start()

    def _apply_pending_fl_dialogs(self):
        """Apply dialog batches finished by the background threads (loop thread only)."""
        while True:
            try:
                run_id, kind, apply, results = self._fl_dialog_results.get_nowait()
            except queue.Empty:
                return
            if run_id != self.fl_run_id:
                continue  # written for a run that has been reset since
            try:
                apply(results)
            except Exception as e:
                logger.warning(f"FL dialogs ({kind}) could not be applied: {e}")

    def _fl_dialog_figures(self) -> Dict[str, Any]:
        """Real figures of the run that the agents talk about in their dialogs."""
        from cognitive import fl_guidance
        ctx = fl_guidance.build_context(self.fl_system, self.fl_decisions)
        changed = [d for d in self.fl_decisions if d.get("changed")]
        every = max(1, self.fl_guidance_every)
        return {
            "recent_mean": ctx["recent_mean"],
            "previous_mean": ctx["previous_mean"],
            "trend": ctx["trend"],
            "noise": ctx["noise"],
            "epochs": ctx["epochs"],
            "last_decision": changed[-1] if changed else None,
            "next_decision_round": (self.fl_system.round // every + 1) * every,
        }

    def _trigger_fl_conversations(self):
        """Generate post-round FL conversations between agent pairs in each lab.

        Selects one pair per lab (two agents with different roles) and generates
        a short FL-focused dialog. LLM calls are parallelized across labs (~17s
        for 3 labs instead of ~36s sequential).
        """
        if not self.model or not self.fl_system:
            return

        from cognitive.prompts.run_gpt_prompt import is_llm_enabled
        from concurrent.futures import ThreadPoolExecutor

        fl_state = self.fl_system.get_state()
        fl_round = fl_state["round"]
        metrics = fl_state["metrics"]
        dp = fl_state.get("dp", {})

        lvg_list = metrics.get("local_vs_global", [])
        lvg = lvg_list[-1] if lvg_list else {}

        use_llm = is_llm_enabled()

        # Prepare tasks: (pair, fl_context) per lab
        tasks = []
        for lab_id in self.model.get_lab_ids():
            agents = self.model.get_lab_agents(lab_id)
            if len(agents) < 2:
                continue

            # A different pair at every round, so that over time every agent
            # of the lab talks with every other one; who opens alternates too
            import itertools
            pairs = list(itertools.combinations(agents, 2))
            first, second = pairs[fl_round % len(pairs)]
            pair = [first, second] if (fl_round // len(pairs)) % 2 == 0 else [second, first]

            lab_lvg = lvg.get(lab_id, {})
            fl_context = {
                "round": fl_round,
                "accuracy": lab_lvg.get("global_acc", metrics.get("accuracy", [0])[-1] if metrics.get("accuracy") else 0),
                "gain": lab_lvg.get("gain", 0),
                "dp_budget": dp.get("budget_fraction", 1.0),
                "lab_id": lab_id,
                "demo": self._LAB_DEMOGRAPHICS.get(lab_id, "pazienti"),
                **self._fl_dialog_figures(),
            }
            tasks.append((pair, fl_context))

        # A model answer takes several seconds, and a session lasts minutes:
        # the model writes the conversation of one lab per round (the one on
        # screen, otherwise one in turn) and the others use templates.
        lab_ids = [ctx["lab_id"] for _, ctx in tasks]
        llm_lab = getattr(self.model, "selected_lab_id", None)
        if llm_lab not in lab_ids and lab_ids:
            llm_lab = lab_ids[fl_round % len(lab_ids)]

        def _gen(args):
            pair, ctx = args
            try:
                return pair, ctx, generate_fl_conversation(
                    pair[0], pair[1], ctx, use_llm=use_llm and ctx["lab_id"] == llm_lab
                )
            except Exception as e:
                logger.warning(f"FL convo for {ctx['lab_id']} failed: {e}")
                return pair, ctx, None

        def _apply(results):
            new_convos = []
            for pair, ctx, convo in results:
                if not convo:
                    continue

                # Who really wrote this text: the model, or a template used
                # because the LLM is off or its call failed
                from_llm = bool(getattr(convo, "from_llm", False))

                # Update agent dialog state for WebSocket broadcast
                for name, utterance in convo[-2:]:
                    for agent in pair:
                        if agent.name == name:
                            agent.last_dialog = utterance
                            agent.dialog_is_llm = from_llm
                pair[0].scratch.chatting_with = pair[1].name
                pair[1].scratch.chatting_with = pair[0].name

                role_a = getattr(pair[0], 'role', 'researcher')
                role_b = getattr(pair[1], 'role', 'researcher')

                new_convos.append({
                    "lab_id": ctx["lab_id"],
                    "round": fl_round,
                    "agents": [pair[0].name, pair[1].name],
                    "roles": [role_a, role_b],
                    "dialog": list(convo),
                    "is_llm": from_llm,
                })

                # Inject conversation as memory events
                full_text = " | ".join([f"{n}: {u}" for n, u in convo])
                for agent in pair:
                    self._inject_fl_event(
                        agent,
                        f"Discussione FL round {fl_round} con collega: {full_text[:200]}",
                        poignancy=7,
                    )

                # Evaluate dialog quality
                try:
                    # Collect recent FL memories for memory_integration scoring
                    agent_memories = {}
                    for agent in pair:
                        fl_thoughts = [
                            n.embedding_key for n in agent.a_mem.seq_thought[:5]
                            if any(kw in (n.embedding_key or "").lower()
                                   for kw in ["fl", "round", "accuracy", "federato"])
                        ]
                        if fl_thoughts:
                            agent_memories[agent.name] = " ".join(fl_thoughts[:2])

                    self.dialog_monitor.evaluate(
                        dialog=convo,
                        fl_context=ctx,
                        roles={pair[0].name: role_a, pair[1].name: role_b},
                        memories=agent_memories,
                        expected_speakers=[pair[0].name, pair[1].name],
                        source="llm" if from_llm else "stub",
                        lab_id=ctx["lab_id"],
                    )
                except Exception as e:
                    logger.warning(f"Dialog quality eval failed for {ctx['lab_id']}: {e}")

            # Store for broadcast (keep last 3 rounds)
            self.fl_conversations = (self.fl_conversations + new_convos)[-9:]
            logger.info(f"Generated {len(new_convos)} FL conversations for round {fl_round}")

        def _gen_template(args):
            pair, ctx = args
            return pair, ctx, generate_fl_conversation(pair[0], pair[1], ctx, use_llm=False)

        self._generate_fl_dialogs("intra", tasks, _gen, _apply, use_llm, generate_template=_gen_template)

    def _trigger_cross_lab_conversations(self):
        """Generate cross-lab FL conversations after global aggregation.

        Pairs agents from different labs (prioritizing different roles) to discuss
        the federated results, bias differences across demographics, and
        collaborative insights. This simulates inter-institutional collaboration.
        """
        if not self.model or not self.fl_system:
            return

        import random
        from cognitive.prompts.run_gpt_prompt import is_llm_enabled
        from concurrent.futures import ThreadPoolExecutor

        fl_state = self.fl_system.get_state()
        fl_round = fl_state["round"]
        metrics = fl_state["metrics"]
        dp = fl_state.get("dp", {})

        lvg_list = metrics.get("local_vs_global", [])
        lvg = lvg_list[-1] if lvg_list else {}

        use_llm = is_llm_enabled()

        lab_ids = self.model.get_lab_ids()
        if len(lab_ids) < 2:
            return

        # Build cross-lab pairs: one agent per lab, different roles preferred
        # Generate up to 2 cross-lab conversations per round
        cross_pairs = []
        lab_agents = {lid: self.model.get_lab_agents(lid) for lid in lab_ids}

        for i in range(len(lab_ids)):
            for j in range(i + 1, len(lab_ids)):
                lab_a, lab_b = lab_ids[i], lab_ids[j]
                agents_a = lab_agents[lab_a]
                agents_b = lab_agents[lab_b]
                if not agents_a or not agents_b:
                    continue

                # Pick agents with different roles if possible
                agent_a = random.choice(agents_a)
                candidates_b = [a for a in agents_b
                                if getattr(a, 'role', '') != getattr(agent_a, 'role', '')]
                agent_b = random.choice(candidates_b) if candidates_b else random.choice(agents_b)
                cross_pairs.append((agent_a, agent_b, lab_a, lab_b))

        # Limit to 2 cross-lab conversations per round
        if len(cross_pairs) > 2:
            cross_pairs = random.sample(cross_pairs, 2)

        tasks = []
        for agent_a, agent_b, lab_a, lab_b in cross_pairs:
            fl_context = {
                "round": fl_round,
                "accuracy": metrics.get("accuracy", [0])[-1] if metrics.get("accuracy") else 0,
                "gain": lvg.get(lab_a, {}).get("gain", 0),
                "dp_budget": dp.get("budget_fraction", 1.0),
                "lab_id": f"{lab_a}↔{lab_b}",
                "demo": (
                    f"{self._LAB_DEMOGRAPHICS.get(lab_a, 'pazienti')} ({lab_a}) e "
                    f"{self._LAB_DEMOGRAPHICS.get(lab_b, 'pazienti')} ({lab_b})"
                ),
                # short form for the template dialogs (the long one names both labs)
                "demo_short": "pazienti",
                "cross_lab": True,
                "lab_a": lab_a,
                "lab_b": lab_b,
                **self._fl_dialog_figures(),
            }
            tasks.append(([agent_a, agent_b], fl_context))

        from cognitive.converse import generate_fl_conversation

        # As for the intra-lab dialogs: the model writes one cross-lab
        # conversation per round, the other uses a template
        llm_task = id(tasks[0][1]) if tasks else None

        def _gen(args):
            pair, ctx = args
            try:
                return pair, ctx, generate_fl_conversation(
                    pair[0], pair[1], ctx, use_llm=use_llm and id(ctx) == llm_task
                )
            except Exception as e:
                logger.warning(f"Cross-lab convo {ctx['lab_id']} failed: {e}")
                return pair, ctx, None

        def _apply(results):
            new_convos = []
            for pair, ctx, convo in results:
                if not convo:
                    continue

                from_llm = bool(getattr(convo, "from_llm", False))

                # Update agent dialog state
                for name, utterance in convo[-2:]:
                    for agent in pair:
                        if agent.name == name:
                            agent.last_dialog = utterance
                            agent.dialog_is_llm = from_llm
                pair[0].scratch.chatting_with = pair[1].name
                pair[1].scratch.chatting_with = pair[0].name

                new_convos.append({
                    "lab_id": ctx["lab_id"],
                    "round": fl_round,
                    "agents": [pair[0].name, pair[1].name],
                    "roles": [getattr(pair[0], 'role', ''), getattr(pair[1], 'role', '')],
                    "labs": [ctx["lab_a"], ctx["lab_b"]],
                    "cross_lab": True,
                    "dialog": list(convo),
                    "is_llm": from_llm,
                })

                # Inject cross-lab conversation as high-poignancy memory
                full_text = " | ".join([f"{n}: {u}" for n, u in convo])
                for agent in pair:
                    self._inject_fl_event(
                        agent,
                        f"Collaborazione inter-lab round {fl_round} "
                        f"({ctx['lab_a']}↔{ctx['lab_b']}): {full_text[:200]}",
                        poignancy=8,
                    )

                # Evaluate cross-lab dialog quality
                role_a = getattr(pair[0], 'role', 'researcher')
                role_b = getattr(pair[1], 'role', 'researcher')
                try:
                    self.dialog_monitor.evaluate(
                        dialog=convo,
                        fl_context=ctx,
                        roles={pair[0].name: role_a, pair[1].name: role_b},
                        expected_speakers=[pair[0].name, pair[1].name],
                        source="llm" if from_llm else "stub",
                        lab_id=ctx["lab_id"],
                    )
                except Exception as e:
                    logger.warning(f"Dialog quality eval failed for cross-lab {ctx['lab_id']}: {e}")

            self.fl_conversations = (self.fl_conversations + new_convos)[-12:]
            logger.info(f"Generated {len(new_convos)} cross-lab FL conversations for round {fl_round}")

        # =========================================================================
        # Simulation Lifecycle
        # =========================================================================

        def _gen_template(args):
            pair, ctx = args
            return pair, ctx, generate_fl_conversation(pair[0], pair[1], ctx, use_llm=False)

        self._generate_fl_dialogs("cross", tasks, _gen, _apply, use_llm, generate_template=_gen_template)

    def start_simulation(self):
        with self._lock:
            if self.running:
                if self.paused:
                    # Start on a paused simulation resumes it
                    self.paused = False
                    logger.info("Simulation resumed (start requested while paused)")
                    return True
                logger.warning("Simulation is already running")
                return False
            if not self.model and not self.initialize_model():
                logger.error("Could not initialize simulation model")
                return False

            # A loop stopped while inside a slow step may still be finishing it
            previous_thread = self.simulation_thread
            if previous_thread is not None and not previous_thread.is_alive():
                previous_thread = None

            self.running = True
            self.paused = False
            stop_token = Event()
            self.stop_event = stop_token

            # Enable FL automatically so data is broadcast from the start
            if self.fl_system and not self.fl_enabled:
                self.fl_enabled = True
                logger.info("FL enabled automatically on simulation start")

            self.simulation_thread = Thread(
                target=self._simulation_loop,
                args=(stop_token, previous_thread),
            )
            self.simulation_thread.daemon = True
            self.simulation_thread.start()

            fl_clock = Thread(target=self._fl_loop, args=(stop_token,), name="fl-clock")
            fl_clock.daemon = True
            fl_clock._fl_clock = True
            fl_clock.start()

        logger.info("Simulation started")
        return True

    def stop_simulation(self):
        with self._lock:
            if not self.running:
                logger.warning("Simulation is not running")
                return False
            self.running = False
            self.stop_event.set()
            thread = self.simulation_thread

        if thread:
            thread.join(timeout=self.stop_join_timeout)
            if thread.is_alive():
                # Still inside a step (e.g. waiting on the LLM). Its stop token
                # is set, so it exits as soon as the step returns. The
                # reference is kept so that the next start can wait for it.
                logger.warning(
                    "Simulation thread is still finishing its current step; "
                    "it will exit when the step returns"
                )
            else:
                with self._lock:
                    if self.simulation_thread is thread:
                        self.simulation_thread = None

        logger.info("Simulation stopped")
        return True

    def pause_simulation(self):
        with self._lock:
            if not self.running:
                return False
            self.paused = True
        logger.info("Simulation paused")
        return True

    def resume_simulation(self):
        with self._lock:
            if not self.running:
                return False
            self.paused = False
        logger.info("Simulation resumed")
        return True

    def set_speed(self, speed: float):
        if speed <= 0:
            return False
        with self._lock:
            self.speed = speed
        logger.info(f"Simulation speed set to {speed}")
        return True

    def set_selected_lab(self, lab_id):
        """Scope the cognitive pipeline to a single lab (None = all labs).

        Agents outside the selected lab still run FL training but skip the
        LLM-heavy cognitive cycle, greatly reducing load when observing one lab.
        """
        if not self.model:
            return False
        valid = set(self.model.get_lab_ids())
        if lab_id is not None and lab_id not in valid:
            logger.warning(f"set_selected_lab: unknown lab '{lab_id}' (valid: {valid})")
            return False
        self.model.selected_lab_id = lab_id
        logger.info(f"Cognition scoped to lab: {lab_id or 'ALL'}")
        return True

    def enable_federated_learning(self, enabled: bool = True):
        if not self.fl_system:
            logger.warning("FL system not initialized")
            return False
        with self._lock:
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

        # A new round starts fl_round_interval seconds after the previous one
        now = time.monotonic()
        if self._fl_round_started_at and now - self._fl_round_started_at < self.fl_round_interval:
            return

        # Rounds stop only if the configuration asks for it (enforced privacy
        # budget, or stop on convergence): by default the federation keeps going
        convergence = self.fl_system.check_convergence()
        if convergence.get("budget_exhausted", False):
            logger.warning(
                f"FL round skipped: privacy budget exhausted "
                f"(ε_spent={self.fl_system.dp_epsilon_spent:.2f}"
                f"/ε_total={self.fl_system.dp_epsilon_total:.2f})"
            )
            return
        if convergence.get("should_stop", False):
            logger.info("FL round skipped: model has converged")
            return

        selected_labs = self.fl_system.select_clients()
        if not selected_labs:
            logger.warning("No labs selected for FL round")
            return

        self.fl_round_in_progress = True
        self.fl_step_counter = 0
        self.fl_current_phase = "training"
        self._fl_round_started_at = now
        self._fl_phase_started_at = now

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
        # Each phase lasts at least a fifth of the round interval, so it can be
        # seen on screen, and at most twice that: when steps are slow (LLM on)
        # the agents' progress must not hold the round back.
        min_phase = self.fl_round_interval / 5.0
        elapsed = time.monotonic() - self._fl_phase_started_at
        if elapsed < min_phase:
            return False
        if elapsed >= 2 * min_phase:
            return True
        for lab_id in self.model.get_lab_ids():
            for agent in self.model.get_lab_agents(lab_id):
                if hasattr(agent, 'fl_task') and agent.fl_task and agent.fl_progress < 1.0:
                    return False
        return True

    def _advance_fl_phase(self):
        if not self.fl_round_in_progress:
            return

        phase = self.fl_current_phase
        self._fl_phase_started_at = time.monotonic()

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
            client_updates, client_metrics = self._collect_client_updates()
            self.fl_system.aggregate_models(client_updates, client_metrics=client_metrics)

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

            # Inject bias-aware insights per lab (uses local_vs_global + cross_eval)
            self._inject_fl_awareness_events()

            # Deposit FL results as thought nodes (persist 72-144h for dialog enrichment)
            self._write_memory_later("thought_nodes", self._deposit_fl_thought_nodes)

            # Trigger lightweight FL reflection (1 agent per lab, template-based)
            self._write_memory_later("reflection", self._trigger_fl_reflection)

            # Generate FL conversations between agent pairs (intra-lab)
            try:
                self._trigger_fl_conversations()
            except Exception as e:
                logger.warning(f"FL conversations failed: {e}")

            # Generate cross-lab FL conversations (inter-lab)
            try:
                self._trigger_cross_lab_conversations()
            except Exception as e:
                logger.warning(f"Cross-lab FL conversations failed: {e}")

            # Every few rounds the agents decide how the federation continues
            try:
                self._update_fl_decision_effects()
                self._run_agent_guidance()
            except Exception as e:
                logger.warning(f"FL agent guidance failed: {e}")

            logger.info("FL round completed")

    def _collect_client_updates(self) -> Dict[str, Any]:
        from fl.federated import generate_client_data

        client_updates = {}
        client_metrics = {}
        fl_round = self.fl_system.round if self.fl_system else 0

        for lab_id in self.model.get_lab_ids():
            # Consistent synthetic data per lab, seeded by lab_id + round
            data_x, data_y = generate_client_data(
                client_id=lab_id,
                n_samples=120,
                seed=42 + fl_round,
            )
            metrics, weights = self.fl_system.train_client(lab_id, data_x, data_y)
            client_updates[lab_id] = weights
            client_metrics[lab_id] = metrics

        return client_updates, client_metrics

    def _process_fl_logic(self):
        with self._lock:
            fl_enabled = self.fl_enabled
            fl_in_progress = self.fl_round_in_progress
        if not fl_enabled:
            return
        if not fl_in_progress:
            self._start_fl_round()
        else:
            with self._lock:
                self.fl_step_counter += 1
            if self._check_fl_phase_completion():
                self._advance_fl_phase()

    # =========================================================================
    # Agent-guided FL
    # =========================================================================

    def _run_agent_guidance(self):
        """Every fl_guidance_every rounds, ask one agent per lab how the
        federation should continue, and apply the proposal that wins the vote."""
        if not (self.fl_guidance_enabled and self.fl_system and self.model):
            return
        asked_at = self.fl_system.round
        if asked_at == 0 or asked_at % self.fl_guidance_every != 0:
            return
        if any(d["round"] == asked_at for d in self.fl_decisions):
            return

        from collections import Counter
        from cognitive import fl_guidance
        from cognitive.prompts.run_gpt_prompt import is_llm_enabled

        ctx = fl_guidance.build_context(self.fl_system, self.fl_decisions)
        turn = self._fl_guidance_turn
        self._fl_guidance_turn += 1

        # One proposer per lab, a different agent at every decision
        proposers = []
        for lab_id in self.model.get_lab_ids():
            agents = self.model.get_lab_agents(lab_id)
            if agents:
                proposers.append(agents[turn % len(agents)])
        use_llm = is_llm_enabled()

        def _gen(agent):
            try:
                return fl_guidance.propose(agent, ctx, use_llm)
            except Exception as e:
                logger.warning(f"FL guidance: proposal of {agent.name} failed: {e}")
                return None

        def _apply(results):
            proposals = [p for p in results if p]
            if not proposals:
                return
            option = fl_guidance.decide(proposals)
            change = fl_guidance.apply_option(self.fl_system, option)
            decision = {
                "round": asked_at,
                "applied_at_round": self.fl_system.round,
                "option": option,
                "option_text": fl_guidance.OPTION_SHORT[option],
                "changed": change["changed"],
                "before": change["before"],
                "after": change["after"],
                "votes": dict(Counter(p["option"] for p in proposals)),
                "proposals": proposals,
                "accuracy_before": ctx["recent_mean"],
                "accuracy_after": None,
            }
            self.fl_decisions = (self.fl_decisions + [decision])[-20:]

            # Each proposer says its proposal (shown as its box on screen)
            by_name = {agent.name: agent for agent in proposers}
            for p in proposals:
                agent = by_name.get(p["agent"])
                if agent is not None:
                    agent.last_dialog = f"Propongo di {p['option_text']}. {p['reason']}"
                    agent.dialog_is_llm = bool(p["from_llm"])

            # ...and every agent remembers what was decided
            winners = [p["agent"] for p in proposals if p["option"] == option]
            if change["changed"]:
                # No parentheses here: the memory strips what precedes them
                if change["before"]["noise"] != change["after"]["noise"]:
                    detail = (f"il rumore di privacy passa da {change['before']['noise']} "
                              f"a {change['after']['noise']}")
                else:
                    detail = (f"le epoche locali passano da {change['before']['epochs']} "
                              f"a {change['after']['epochs']}")
                outcome = (
                    f"Round {asked_at}: il consorzio ha deciso di {decision['option_text']}, "
                    f"{detail}, su proposta di {' e '.join(winners)}."
                )
            else:
                outcome = (
                    f"Round {asked_at}: il consorzio ha discusso i parametri del FL "
                    f"e ha deciso di non cambiare nulla."
                )
            for agent in self.model.schedule.agents:
                # A decision of the consortium is what the agents must still
                # remember rounds later: highest importance, and it does not expire
                self._inject_fl_event(agent, outcome, poignancy=9, lasting=True)
            logger.info(f"FL guidance at round {asked_at}: {option} {change['after']}")

        # The proposals go before the post-round dialogs in the queue for the model
        self._generate_fl_dialogs("guidance", proposers, _gen, _apply, use_llm, priority=2)

    def _update_fl_decision_effects(self):
        """Fill in what happened to the accuracy after each applied decision
        (mean of the 3 rounds that followed it)."""
        if not self.fl_system:
            return
        acc = self.fl_system.metrics.get("accuracy", [])
        for decision in self.fl_decisions:
            if decision.get("accuracy_after") is not None:
                continue
            start = decision["applied_at_round"]
            following = acc[start:start + 3]
            if len(following) == 3:
                decision["accuracy_after"] = round(sum(following) / 3, 4)

    # =========================================================================
    # FL clock thread and deferred memory writes
    # =========================================================================

    @staticmethod
    def _on_fl_clock() -> bool:
        """True when running on the FL clock thread."""
        return getattr(threading.current_thread(), "_fl_clock", False)

    def _write_memory_later(self, kind: str, action):
        """Run an action that writes into agent memories: now, or (from the FL
        clock thread) queued for the simulation loop."""
        if self._on_fl_clock():
            self._fl_memory_writes.append((kind, action))
            return
        try:
            action()
        except Exception as e:
            logger.warning(f"FL memory write ({kind}) failed: {e}")

    def _drain_fl_memory_writes(self):
        """Perform the queued memory writes (simulation loop thread only).

        Single events are all applied. Whole-round updates (thought nodes,
        reflection) read the current FL state when they run, so if several
        piled up while a slow step was running only the latest of each kind
        is executed.
        """
        pending = []
        while True:
            try:
                pending.append(self._fl_memory_writes.popleft())
            except IndexError:
                break
        if not pending:
            return
        last_of_kind = {kind: i for i, (kind, _) in enumerate(pending) if kind != "event"}
        for i, (kind, action) in enumerate(pending):
            if kind != "event" and last_of_kind[kind] != i:
                continue
            try:
                action()
            except Exception as e:
                logger.warning(f"FL memory write ({kind}) failed: {e}")

    def _broadcast_state(self):
        """Send the current state to the interface (used by the FL clock thread)."""
        if not self.on_step_callback or not self.model:
            return
        try:
            self.on_step_callback(self._collect_simulation_data())
        except Exception as e:
            logger.warning(f"FL state broadcast failed: {e}")

    def _fl_loop(self, stop_token: Event):
        """Clock of the FL process: advances rounds in wall-clock time,
        independently of how fast simulation steps are running."""
        last_view = None
        while not stop_token.is_set():
            if not self.paused:
                try:
                    with self._fl_logic_lock:
                        if stop_token.is_set():
                            break
                        self._process_fl_logic()
                        self._apply_pending_fl_dialogs()
                    view = (
                        self.fl_current_phase,
                        self.fl_system.round if self.fl_system else None,
                        len(self.fl_conversations),
                    )
                    if view != last_view:
                        last_view = view
                        self._broadcast_state()
                except Exception:
                    logger.exception("Error in FL clock")
            stop_token.wait(0.25)

    # =========================================================================
    # Simulation Loop
    # =========================================================================

    def _simulation_loop(self, stop_token: Event, previous_thread: Optional[Thread] = None):
        """Run simulation steps until stop_token is set.

        stop_token belongs to this loop only. previous_thread is an earlier
        loop that was stopped while inside a step on the same model: this loop
        waits for it to finish, so the model is never stepped by two loops.
        """
        step_count = 0
        try:
            while (
                previous_thread is not None
                and previous_thread.is_alive()
                and not stop_token.is_set()
            ):
                previous_thread.join(timeout=0.2)

            while not stop_token.is_set():
                if not self.paused:
                    step_time = 1.0 / (self.model.tick_rate * self.speed)

                    start_time = time.time()
                    self.model.step_parallel(max_workers=4)
                    if stop_token.is_set():
                        # Stopped (or reset) while the step was running: do not
                        # touch FL state or broadcast on behalf of a new loop.
                        break
                    step_count += 1

                    # The FL process runs on its own clock (_fl_loop); here the
                    # loop only performs the memory writes that it queued
                    self._drain_fl_memory_writes()

                    # Collect and broadcast data (every 10 steps to avoid flooding Chrome)
                    if step_count % 10 == 0:
                        sim_data = self._collect_simulation_data()
                        if self.on_step_callback:
                            self.on_step_callback(sim_data)

                    # Throttle
                    elapsed = time.time() - start_time
                    remaining = step_time - elapsed
                    if remaining > 0:
                        time.sleep(remaining)

                    # Temporal decay: prune expired memories every 100 steps
                    if step_count % 100 == 0:
                        for agent in self.model.schedule.agents:
                            if hasattr(agent, 'a_mem') and agent.a_mem:
                                agent.a_mem.decay_memories()

                    # Checkpoint agent cognitive memories every 500 steps
                    if step_count % 500 == 0:
                        self._checkpoint_agent_memories(step_count)

                    if step_count % 100 == 0:
                        logger.info(
                            f"Step {step_count}, sim_time={self.model.sim_time.strftime('%H:%M')}"
                        )
                else:
                    time.sleep(0.1)
        except Exception as e:
            logger.error(f"Error in simulation loop: {e}")
            with self._lock:
                # Only the current loop may mark the simulation as stopped
                if self.stop_event is stop_token:
                    self.running = False
        finally:
            logger.info(f"Simulation loop terminated after {step_count} steps")

    # =========================================================================
    # Data Collection
    # =========================================================================

    def _collect_simulation_data(self) -> Dict[str, Any]:
        """Collect simulation data for frontend broadcast."""
        with self._lock:
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
                    "run_id": self.fl_run_id,
                    "round_interval": self.fl_round_interval,
                    "seconds_to_next_round": self._seconds_to_next_fl_round(),
                    "params": {
                        "noise_multiplier": self.fl_system.dp_noise_multiplier,
                        "local_epochs": self.fl_system.local_epochs,
                    },
                    "guidance": {
                        "enabled": self.fl_guidance_enabled,
                        "every_rounds": self.fl_guidance_every,
                        "next_at_round": (
                            (fl_state["round"] // self.fl_guidance_every + 1) * self.fl_guidance_every
                        ),
                    },
                    "decisions": self.fl_decisions[-6:],
                    "round": fl_state["round"],
                    "algorithm": fl_state.get("algorithm", "fedavg"),
                    "mu": self.fl_system.mu if self.fl_system else 0.01,
                    "metrics": fl_state["metrics"],
                    "dp": fl_state.get("dp"),
                    "convergence": self.fl_system.check_convergence() if self.fl_system else None,
                    "conversations": self.fl_conversations,
                }

        return base_data

    def get_simulation_state(self) -> Dict[str, Any]:
        with self._lock:
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
                    "run_id": self.fl_run_id,
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
        with self._lock:
            was_running = self.running
        if was_running:
            self.stop_simulation()

        with self._lock:
            # The model is replaced below: a loop still finishing a step works
            # on the old model, so the new loop does not need to wait for it.
            self.simulation_thread = None
            self.model = None
            self.fl_system = None
            self.fl_enabled = False
            self.fl_round_in_progress = False
            self.fl_step_counter = 0
            self.fl_current_phase = None
            self.fl_conversations = []
            self._fl_round_started_at = 0.0
            self._fl_phase_started_at = 0.0

        # A reset starts a new FL run: the previous run's checkpoint stays on
        # disk in its own folder and is not reloaded.
        success = self.initialize_model(new_fl_run=True)
        if success and was_running:
            self.start_simulation()

        logger.info("Simulation reset")
        return success
