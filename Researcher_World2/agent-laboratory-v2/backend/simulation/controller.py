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
        self.fl_conversations: List[Dict[str, Any]] = []  # post-round FL dialogs

        # Dialog quality monitor
        self.dialog_monitor = DialogQualityMonitor()

        # Thread control
        self.simulation_thread = None
        self.stop_event = Event()
        self._lock = Lock()  # protects shared state (running, paused, speed, fl_*)

        logger.info(f"Simulation controller initialized with config: {config_path}")

    def initialize_model(self):
        """Initialize the simulation model, MazeAdapter, and FL system."""
        try:
            self.model = LabEnvironment(self.config_path)
            logger.info(
                f"Simulation model initialized: {self.model.schedule.get_agent_count()} agents, "
                f"maze_adapter ready, sim_time={self.model.sim_time}"
            )

            # Initialize FL system (try to restore from checkpoint)
            self.fl_system = FederatedLearningSystem(
                algorithm="fedavg",
                aggregation_rounds=5,
                client_fraction=0.8,
                model_type="simple_nn"
            )
            self._register_labs_as_clients()
            if self.fl_system.load_checkpoint():
                logger.info(f"FL system restored from checkpoint (round {self.fl_system.round})")
            else:
                logger.info("FL system initialized fresh (no checkpoint)")

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

            # Select two agents with different roles
            roles_seen = set()
            pair = []
            for agent in agents:
                role = getattr(agent, 'role', 'researcher')
                if role not in roles_seen and len(pair) < 2:
                    roles_seen.add(role)
                    pair.append(agent)
            if len(pair) < 2:
                pair = [agents[0], agents[1]]

            lab_lvg = lvg.get(lab_id, {})
            fl_context = {
                "round": fl_round,
                "accuracy": lab_lvg.get("global_acc", metrics.get("accuracy", [0])[-1] if metrics.get("accuracy") else 0),
                "gain": lab_lvg.get("gain", 0),
                "dp_budget": dp.get("budget_fraction", 1.0),
                "lab_id": lab_id,
                "demo": self._LAB_DEMOGRAPHICS.get(lab_id, "pazienti"),
            }
            tasks.append((pair, fl_context))

        # Generate conversations (parallel if LLM, sequential is fine for stubs)
        def _gen(args):
            pair, ctx = args
            try:
                return pair, ctx, generate_fl_conversation(
                    pair[0], pair[1], ctx, use_llm=use_llm
                )
            except Exception as e:
                logger.warning(f"FL convo for {ctx['lab_id']} failed: {e}")
                return pair, ctx, None

        if use_llm and len(tasks) > 1:
            with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
                results = list(pool.map(_gen, tasks))
        else:
            results = [_gen(t) for t in tasks]

        new_convos = []
        for pair, ctx, convo in results:
            if not convo:
                continue

            # Update agent dialog state for WebSocket broadcast
            for name, utterance in convo[-2:]:
                for agent in pair:
                    if agent.name == name:
                        agent.last_dialog = utterance
                        agent.dialog_is_llm = use_llm
            pair[0].scratch.chatting_with = pair[1].name
            pair[1].scratch.chatting_with = pair[0].name

            role_a = getattr(pair[0], 'role', 'researcher')
            role_b = getattr(pair[1], 'role', 'researcher')

            new_convos.append({
                "lab_id": ctx["lab_id"],
                "round": fl_round,
                "agents": [pair[0].name, pair[1].name],
                "roles": [role_a, role_b],
                "dialog": convo,
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
                    source="llm" if use_llm else "stub",
                    lab_id=ctx["lab_id"],
                )
            except Exception as e:
                logger.warning(f"Dialog quality eval failed for {ctx['lab_id']}: {e}")

        # Store for broadcast (keep last 3 rounds)
        self.fl_conversations = (self.fl_conversations + new_convos)[-9:]
        logger.info(f"Generated {len(new_convos)} FL conversations for round {fl_round}")

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
                "cross_lab": True,
                "lab_a": lab_a,
                "lab_b": lab_b,
            }
            tasks.append(([agent_a, agent_b], fl_context))

        from cognitive.converse import generate_fl_conversation

        def _gen(args):
            pair, ctx = args
            try:
                return pair, ctx, generate_fl_conversation(
                    pair[0], pair[1], ctx, use_llm=use_llm
                )
            except Exception as e:
                logger.warning(f"Cross-lab convo {ctx['lab_id']} failed: {e}")
                return pair, ctx, None

        if use_llm and len(tasks) > 1:
            with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
                results = list(pool.map(_gen, tasks))
        else:
            results = [_gen(t) for t in tasks]

        new_convos = []
        for pair, ctx, convo in results:
            if not convo:
                continue

            # Update agent dialog state
            for name, utterance in convo[-2:]:
                for agent in pair:
                    if agent.name == name:
                        agent.last_dialog = utterance
                        agent.dialog_is_llm = use_llm
            pair[0].scratch.chatting_with = pair[1].name
            pair[1].scratch.chatting_with = pair[0].name

            new_convos.append({
                "lab_id": ctx["lab_id"],
                "round": fl_round,
                "agents": [pair[0].name, pair[1].name],
                "roles": [getattr(pair[0], 'role', ''), getattr(pair[1], 'role', '')],
                "labs": [ctx["lab_a"], ctx["lab_b"]],
                "cross_lab": True,
                "dialog": convo,
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
                    source="llm" if use_llm else "stub",
                    lab_id=ctx["lab_id"],
                )
            except Exception as e:
                logger.warning(f"Dialog quality eval failed for cross-lab {ctx['lab_id']}: {e}")

        self.fl_conversations = (self.fl_conversations + new_convos)[-12:]
        logger.info(f"Generated {len(new_convos)} cross-lab FL conversations for round {fl_round}")

    # =========================================================================
    # Simulation Lifecycle
    # =========================================================================

    def start_simulation(self):
        with self._lock:
            if self.running:
                logger.warning("Simulation is already running")
                return False
            if not self.model and not self.initialize_model():
                logger.error("Could not initialize simulation model")
                return False

            self.running = True
            self.paused = False
            self.stop_event.clear()

            # Enable FL automatically so data is broadcast from the start
            if self.fl_system and not self.fl_enabled:
                self.fl_enabled = True
                logger.info("FL enabled automatically on simulation start")

            self.simulation_thread = Thread(target=self._simulation_loop)
            self.simulation_thread.daemon = True
            self.simulation_thread.start()

        logger.info("Simulation started")
        return True

    def stop_simulation(self):
        with self._lock:
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

        # --- DP budget enforcement: skip round if privacy budget exhausted ---
        convergence = self.fl_system.check_convergence()
        if convergence.get("budget_exhausted", False):
            logger.warning(
                f"FL round skipped: privacy budget exhausted "
                f"(ε_spent={self.fl_system.dp_epsilon_spent:.2f}"
                f"/ε_total={self.fl_system.dp_epsilon_total:.2f})"
            )
            return
        if convergence.get("converged", False):
            logger.info("FL round skipped: model has converged")
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
            try:
                self._deposit_fl_thought_nodes()
            except Exception as e:
                logger.warning(f"FL thought node deposit failed: {e}")

            # Trigger lightweight FL reflection (1 agent per lab, template-based)
            try:
                self._trigger_fl_reflection()
            except Exception as e:
                logger.warning(f"FL reflection failed: {e}")

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
    # Simulation Loop
    # =========================================================================

    def _simulation_loop(self):
        step_count = 0
        try:
            while self.running and not self.stop_event.is_set():
                if not self.paused:
                    step_time = 1.0 / (self.model.tick_rate * self.speed)

                    start_time = time.time()
                    self.model.step_parallel(max_workers=4)
                    step_count += 1

                    # Process FL logic
                    self._process_fl_logic()

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
