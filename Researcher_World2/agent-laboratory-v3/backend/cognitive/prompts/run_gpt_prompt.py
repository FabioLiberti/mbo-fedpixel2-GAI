"""
GPT Prompt Functions for federated generative agents.
Each function wraps an LLM call with FL-specific prompt, validation, and cleanup.

USE_STUBS=True: returns sensible defaults without calling LLM (fast, deterministic)
USE_STUBS=False: calls LLM via gpt_structure.py (requires Ollama running)
"""
import logging
import random
import re

from .gpt_structure import (
    ChatGPT_request,
    GPT4_request,
    ChatGPT_safe_generate_response,
    GPT4_safe_generate_response,
    safe_generate_response,
    generate_prompt,
    get_embedding,
)

logger = logging.getLogger(__name__)

# ============================================================================
# Stub flag — runtime-toggleable from API/WebSocket
# True = returns sensible defaults (fast, no LLM needed)
# False = calls LLM via gpt_structure.py (requires Ollama)
# ============================================================================
USE_STUBS = True


def set_llm_enabled(enabled: bool):
    """Enable/disable real LLM calls at runtime (called from API)."""
    global USE_STUBS
    USE_STUBS = not enabled
    logger.info(f"LLM {'enabled' if enabled else 'disabled'} (USE_STUBS={USE_STUBS})")


def is_llm_enabled() -> bool:
    """Return True if real LLM calls are active."""
    return not USE_STUBS


def _stub_warn(fn_name):
    logger.debug(f"STUB: {fn_name} called - returning default value")


def _extract_number(text, default=5, low=1, high=10):
    """Extract first number from text, clamped to [low, high]."""
    nums = re.findall(r'\d+', text)
    if nums:
        return min(max(int(nums[0]), low), high)
    return default


def _extract_list_items(text, max_items=10):
    """Extract list items from numbered/bulleted LLM response."""
    items = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        # Strip numbering: "1.", "1)", "- ", "* "
        cleaned = re.sub(r'^[\d]+[.)]\s*', '', line)
        cleaned = re.sub(r'^[-*]\s*', '', cleaned)
        cleaned = cleaned.strip()
        if cleaned:
            items.append(cleaned)
    return items[:max_items]


def _build_persona_context(persona):
    """Build FL researcher context string for prompts."""
    s = persona.scratch
    ctx = f"Name: {s.name}\n"
    ctx += f"Role: {s.get_str_currently()}\n" if s.currently else ""
    ctx += f"Lab: {s.lab_id or 'research lab'}\n"
    ctx += f"FL role: {s.fl_role or 'researcher'}\n"
    ctx += f"Specialization: {s.fl_specialization or 'federated learning'}\n"
    ctx += f"Traits: {s.innate}\n" if s.innate else ""
    if s.curr_time:
        ctx += f"Current time: {s.curr_time.strftime('%H:%M on %A %B %d')}\n"
    if s.act_description and s.act_description != "idle":
        ctx += f"Current activity: {s.act_description}\n"
    return ctx


# Lab descriptions for prompt context
_LAB_DESCRIPTIONS = {
    "mercatorum": (
        "Università Mercatorum — specializzata in business intelligence, "
        "analisi finanziaria federata e compliance GDPR."
    ),
    "blekinge": (
        "Blekinge University — specializzata in architetture FL distribuite, "
        "comunicazione efficiente tra nodi federati e ottimizzazione."
    ),
    "opbg": (
        "OPBG IRCCS — specializzato in FL applicato alla medicina pediatrica, "
        "privacy engineering per dati sanitari e imaging clinico."
    ),
}

# Role-specific activity profiles for planning
_ROLE_ACTIVITIES = {
    "professor": [
        "supervisionare il team di ricerca sul federated learning",
        "revisionare paper e risultati sperimentali",
        "coordinare la strategia di aggregazione federata",
        "preparare presentazione per conferenza su FL",
    ],
    "professor_senior": [
        "definire la roadmap architetturale del progetto FL",
        "revisionare i protocolli di comunicazione federata",
        "mentoring dei ricercatori junior sulla teoria FL",
        "analizzare le metriche di convergenza del modello globale",
    ],
    "researcher": [
        "implementare e testare algoritmi di aggregazione federata",
        "analizzare i risultati dei round di training distribuito",
        "scrivere sezione paper su privacy-preserving FL",
        "sperimentare tecniche di differential privacy",
    ],
    "student": [
        "studiare la letteratura su federated learning",
        "implementare il pipeline di training locale",
        "preparare i dati per il prossimo round di FL",
        "analizzare i gradienti del modello locale",
    ],
    "student_postdoc": [
        "progettare esperimenti su dati non-IID federati",
        "ottimizzare l'architettura del modello locale",
        "scrivere codice per il benchmark FL",
        "analizzare il tradeoff privacy-utility",
    ],
    "doctor": [
        "validare i risultati clinici del modello federato",
        "preparare dataset clinici anonimizzati per il training",
        "verificare la compliance dei dati sanitari con la normativa",
        "valutare le predizioni del modello su casi pediatrici",
    ],
    "engineer": [
        "ottimizzare il pipeline di training del modello FL",
        "configurare i server per il training distribuito",
        "monitorare le metriche di performance del sistema FL",
        "debuggare problemi di comunicazione tra nodi federati",
    ],
    "sw_engineer": [
        "sviluppare la piattaforma software per il FL",
        "implementare protocolli di comunicazione sicura tra nodi",
        "testare il deployment del sistema di aggregazione",
        "ottimizzare le API per lo scambio dei pesi del modello",
    ],
    "privacy_specialist": [
        "verificare la compliance GDPR del sistema federato",
        "analizzare i rischi di privacy nei gradienti condivisi",
        "definire le policy di accesso ai dati sensibili",
        "testare le garanzie di differential privacy del sistema",
    ],
}


def _get_fl_system_prompt(persona):
    """Build FL research system prompt for LLM calls."""
    s = persona.scratch
    lab_desc = _LAB_DESCRIPTIONS.get(s.lab_id, "laboratorio di ricerca su federated learning")
    role_label = s.fl_role or persona.role if hasattr(persona, 'role') else "researcher"
    spec = s.fl_specialization or "federated learning"

    return (
        f"Contesto: simulazione di ricerca su Federated Learning (FL). "
        f"{s.name} è un {role_label} specializzato in {spec}, "
        f"lavora presso {lab_desc}. "
        f"Il progetto FL prevede: training locale sui dati di ciascun lab, "
        f"aggregazione federata (FedAvg), scambio sicuro dei pesi del modello, "
        f"e analisi delle metriche (loss, accuracy, privacy budget)."
    )


# ============================================================================
# Poignancy / Importance Scoring
# ============================================================================

def run_gpt_prompt_event_poignancy(persona, description):
    """Rate the poignancy (importance) of an event on a scale of 1-10."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_event_poignancy")
        desc_l = description.lower()
        score = 3
        # FL core operations
        if any(kw in desc_l for kw in
               ["federated", "model", "training", "accuracy", "round", "aggregate",
                "gradient", "weight", "fedavg", "local model", "global model"]):
            score = 7
        # Critical FL events
        if any(kw in desc_l for kw in
               ["error", "fail", "breakthrough", "converge", "privacy",
                "diverge", "attack", "leak", "compliance", "differential privacy"]):
            score = 8
        # Specialization-relevant events get a boost
        spec = (persona.scratch.fl_specialization or "").lower()
        if spec and any(kw in desc_l for kw in spec.split("_")):
            score = min(10, score + 1)
        return score, True

    sys_prompt = _get_fl_system_prompt(persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"Valuta l'importanza di questo evento per {persona.scratch.name} "
        f"(specializzazione: {persona.scratch.fl_specialization or 'FL'}).\n"
        f"Scala 1-10 (1=banale, 5=routine, 8=importante per la ricerca, 10=critico).\n"
        f"Evento: {description}\n"
        f"Rispondi solo con il numero:"
    )
    try:
        response = GPT4_request(prompt)
        return _extract_number(response, default=5), True
    except Exception as e:
        return 5, False


def run_gpt_prompt_chat_poignancy(persona, description):
    """Rate the poignancy of a chat interaction."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_chat_poignancy")
        desc_l = description.lower()
        score = 4
        if any(kw in desc_l for kw in ["federat", "model", "training", "aggregat",
                                         "privacy", "convergence", "round"]):
            score = 6
        return score, True
    return run_gpt_prompt_event_poignancy(persona, description)


# ============================================================================
# Focal Points & Reflection
# ============================================================================

def run_gpt_prompt_focal_pt(persona, statements, n=3):
    """Generate n focal points for reflection from recent statements."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_focal_pt")
        name = persona.scratch.name
        spec = persona.scratch.fl_specialization or "federated learning"
        role = persona.scratch.fl_role or "researcher"
        return [
            f"Qual è il progresso di {name} su {spec} nel contesto del FL?",
            f"Come può {name} ({role}) collaborare meglio con i colleghi del lab?",
            f"Quali sono le priorità di {name} per il prossimo round di training federato?",
        ][:n], True

    sys_prompt = _get_fl_system_prompt(persona)
    ctx = _build_persona_context(persona)
    prompt = (
        f"{sys_prompt}\n\n{ctx}\n"
        f"Osservazioni e pensieri recenti:\n{statements}\n\n"
        f"Genera {n} domande importanti su cui {persona.scratch.name} dovrebbe riflettere "
        f"per avanzare la propria ricerca su {persona.scratch.fl_specialization or 'FL'}.\n"
        f"Elenca {n} domande:"
    )
    try:
        response = ChatGPT_request(prompt)
        points = _extract_list_items(response, n)
        return points if points else [f"Cosa dovrebbe fare {persona.scratch.name}?"], True
    except Exception as e:
        return [f"Cosa è importante per {persona.scratch.name}?"], False


def run_gpt_prompt_insight_and_guidance(persona, statements, n=5):
    """Generate insights with evidence indices from statements."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_insight_and_guidance")
        spec = persona.scratch.fl_specialization or "FL"
        return {
            f"{persona.scratch.name} sta facendo progressi costanti su {spec}": [0],
        }, True

    sys_prompt = _get_fl_system_prompt(persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"Date queste osservazioni numerate sulla ricerca FL:\n{statements}\n\n"
        f"Genera fino a {n} insight di alto livello. Per ciascuno, elenca i numeri "
        f"delle osservazioni (indice da 0) che lo supportano.\n"
        f"Formato: insight [indici evidenza separati da virgola]"
    )
    try:
        response = ChatGPT_request(prompt)
        result = {}
        for line in response.split("\n"):
            line = line.strip()
            if not line:
                continue
            # Try to extract insight and indices
            match = re.search(r'\[([0-9,\s]+)\]', line)
            if match:
                thought = line[:match.start()].strip().rstrip(":")
                indices = [int(x.strip()) for x in match.group(1).split(",") if x.strip().isdigit()]
                if thought:
                    result[thought] = indices
        return result if result else {"research is progressing": [0]}, True
    except Exception as e:
        return {"reflection needed": [0]}, False


# ============================================================================
# Event Triple Generation
# ============================================================================

def run_gpt_prompt_event_triple(act_desp, persona):
    """Generate (subject, predicate, object) triple for an action."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_event_triple")
        name = persona.scratch.name if hasattr(persona, 'scratch') else "Agent"
        return (name, "is doing", act_desp), True

    prompt = (
        f"Converti questa azione in una tripla (soggetto, predicato, oggetto).\n"
        f"Persona: {persona.scratch.name}\n"
        f'Azione: "{act_desp}"\n'
        f"Rispondi con esattamente: soggetto, predicato, oggetto"
    )
    try:
        response = GPT4_request(prompt)
        parts = [p.strip().strip('"\'()') for p in response.split(",")]
        if len(parts) >= 3:
            return (parts[0], parts[1], parts[2]), True
        return (persona.scratch.name, "is doing", act_desp), False
    except Exception as e:
        return (persona.scratch.name, "is doing", act_desp), False


# ============================================================================
# Planning
# ============================================================================

def run_gpt_prompt_wake_up_hour(persona):
    """Generate wake up / lab arrival hour for persona."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_wake_up_hour")
        return 8, True

    ctx = _build_persona_context(persona)
    prompt = (
        f"{ctx}\n"
        f"A che ora arriva di solito {persona.scratch.name} in laboratorio? "
        f"Rispondi solo con l'ora (es. 9):"
    )
    try:
        response = GPT4_request(prompt)
        return _extract_number(response, default=9, low=7, high=11), True
    except Exception as e:
        return 9, False


def run_gpt_prompt_daily_plan(persona, wake_up_hour):
    """Generate daily plan as list of FL research activities."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_daily_plan")
        role = persona.role if hasattr(persona, 'role') else "researcher"
        role_acts = _ROLE_ACTIVITIES.get(role, _ROLE_ACTIVITIES.get("researcher", []))
        # Pick 2 role-specific activities
        selected = random.sample(role_acts, min(2, len(role_acts))) if role_acts else []
        plan = [
            f"arrivare in laboratorio alle {wake_up_hour}:00",
            selected[0] if len(selected) > 0 else "lavorare sulla ricerca FL",
            "collaborare con i colleghi del lab sul progetto FL",
            "pausa pranzo alle 12:00",
            selected[1] if len(selected) > 1 else "analizzare i risultati del round FL",
            "riunione di lab alle 16:00 — stato del progetto federato",
            "chiudere il lavoro e uscire dal lab alle 18:00",
        ]
        return plan, True

    sys_prompt = _get_fl_system_prompt(persona)
    ctx = _build_persona_context(persona)
    role = persona.role if hasattr(persona, 'role') else "researcher"
    spec = persona.scratch.fl_specialization or "federated learning"
    prompt = (
        f"{sys_prompt}\n\n{ctx}\n"
        f"Oggi {persona.scratch.name} ({role}, specializzazione: {spec}) "
        f"arriva al laboratorio alle {wake_up_hour}:00.\n"
        f"Scrivi un piano giornaliero realistico (5-7 attività) per questo ricercatore FL.\n"
        f"Le attività devono riflettere il suo ruolo e la sua specializzazione.\n"
        f"Includi: lavoro di ricerca specifico, collaborazione, pranzo, riunioni.\n"
        f"Elenca le attività:"
    )
    try:
        response = ChatGPT_request(prompt)
        items = _extract_list_items(response, 8)
        return items if items else ["lavorare sulla ricerca"], True
    except Exception as e:
        return ["lavorare sulla ricerca"], False


def run_gpt_prompt_generate_hourly_schedule(persona, curr_hour_str, n_m1_activity, hour_str):
    """Generate activity for a specific hour in FL research context."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_generate_hourly_schedule")
        role = persona.role if hasattr(persona, 'role') else "researcher"
        spec = persona.scratch.fl_specialization or "FL"
        role_acts = _ROLE_ACTIVITIES.get(role, _ROLE_ACTIVITIES.get("researcher", []))
        # Role-specific activity for work hours
        role_act = random.choice(role_acts) if role_acts else f"lavorare su {spec}"
        defaults = {
            "08:00 AM": "arrivo in laboratorio e check email",
            "09:00 AM": f"revisione metriche del modello FL ({spec})",
            "10:00 AM": role_act,
            "11:00 AM": "collaborazione con colleghi sul progetto federato",
            "12:00 PM": "pausa pranzo",
            "01:00 PM": f"studio letteratura su {spec}",
            "02:00 PM": role_act,
            "03:00 PM": f"analisi risultati sperimentali ({spec})",
            "04:00 PM": "riunione di lab — aggiornamento progetto FL",
            "05:00 PM": "scrittura note di ricerca e documentazione",
            "06:00 PM": "chiusura lavoro giornaliero",
        }
        return defaults.get(curr_hour_str, f"lavorare su {spec}"), True

    sys_prompt = _get_fl_system_prompt(persona)
    recent = ', '.join(n_m1_activity[-3:]) if n_m1_activity else 'appena arrivato'
    spec = persona.scratch.fl_specialization or "FL"
    prompt = (
        f"{sys_prompt}\n\n"
        f"Sono le {curr_hour_str}. Attività recenti: {recent}\n"
        f"Cosa sta facendo {persona.scratch.name} (specializzazione: {spec}) adesso? "
        f"Rispondi con 1 frase breve:"
    )
    try:
        return ChatGPT_request(prompt).strip()[:100], True
    except Exception as e:
        return f"lavorare su {spec}", False


def run_gpt_prompt_task_decomp(persona, task, duration):
    """Decompose task into subtasks with durations (in minutes)."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_task_decomp")
        n_subtasks = max(1, duration // 15)
        subtask_dur = duration // n_subtasks
        return [[f"{task} (step {i+1})", subtask_dur] for i in range(n_subtasks)], True

    prompt = (
        f"Break down this research task into specific steps:\n"
        f"Task: {task}\n"
        f"Total time: {duration} minutes\n"
        f"Format each line as: step description, minutes\n"
        f"Steps:"
    )
    try:
        response = ChatGPT_request(prompt)
        result = []
        for line in response.split("\n"):
            if "," in line:
                parts = line.rsplit(",", 1)
                nums = re.findall(r'\d+', parts[1])
                mins = int(nums[0]) if nums else 15
                result.append([parts[0].strip().lstrip("0123456789.) -"), mins])
        if result:
            # Normalize durations to sum to total
            total = sum(r[1] for r in result)
            if total > 0:
                scale = duration / total
                for r in result:
                    r[1] = max(5, round(r[1] * scale))
            return result, True
        return [[task, duration]], True
    except Exception as e:
        return [[task, duration]], False


# ============================================================================
# Action Location (critical: must return valid spatial memory addresses)
# ============================================================================

def run_gpt_prompt_action_sector(act_desp, persona, maze):
    """Choose sector for action from spatial memory."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_action_sector")
        # Return agent's own lab (sector = lab_id in our spatial layout)
        curr_tile = persona.scratch.curr_tile
        if curr_tile:
            tile_info = maze.access_tile(curr_tile)
            if tile_info.get("sector"):
                return tile_info["sector"], True
        # Fallback: use lab_id from scratch
        if persona.scratch.lab_id:
            return persona.scratch.lab_id, True
        return "mercatorum", True

    # With LLM: list available sectors, let LLM choose
    curr_tile = persona.scratch.curr_tile
    if curr_tile:
        world = maze.access_tile(curr_tile).get("world", "")
    else:
        world = "fl_research_center"

    sectors = persona.s_mem.get_str_accessible_sectors(world)
    if not sectors:
        return persona.scratch.lab_id or "mercatorum", False

    sys_prompt = _get_fl_system_prompt(persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"{persona.scratch.name} deve: {act_desp}\n"
        f"Aree disponibili: {sectors}\n"
        f"Quale area è più appropriata? (rispondi solo con il nome):"
    )
    try:
        response = GPT4_request(prompt).strip().lower()
        sector_list = [s.strip() for s in sectors.split(",")]
        # Find best match
        for s in sector_list:
            if s.strip().lower() in response or response in s.strip().lower():
                return s.strip(), True
        return sector_list[0], True
    except Exception as e:
        return persona.scratch.lab_id or sector_list[0], False


def run_gpt_prompt_action_arena(act_desp, persona, maze, act_world, act_sector):
    """Choose arena within sector for action."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_action_arena")
        desc = act_desp.lower()
        if any(kw in desc for kw in ["lunch", "break", "coffee", "rest", "eat",
                                      "pranzo", "pausa", "caffè"]):
            return "break_room", True
        if any(kw in desc for kw in ["meeting", "present", "discuss", "coordinat",
                                      "riunione", "collabora", "sincronizz"]):
            return "meeting_room", True
        if any(kw in desc for kw in ["server", "deploy", "gpu", "cluster", "train",
                                      "aggregat", "model", "gradient", "weight",
                                      "addestramento", "nodo federato"]):
            return "server_room", True
        return "workspace", True

    sys_prompt = _get_fl_system_prompt(persona)
    arenas = persona.s_mem.get_str_accessible_sector_arenas(f"{act_world}:{act_sector}")
    if not arenas:
        return "workspace", False

    prompt = (
        f"{sys_prompt}\n\n"
        f"{persona.scratch.name} deve: {act_desp}\n"
        f"Stanze disponibili in {act_sector}: {arenas}\n"
        f"Quale stanza è più appropriata? (rispondi solo con il nome):"
    )
    try:
        response = GPT4_request(prompt).strip().lower()
        arena_list = [a.strip() for a in arenas.split(",")]
        for a in arena_list:
            if a.strip().lower() in response or response in a.strip().lower():
                return a.strip(), True
        return arena_list[0], True
    except Exception as e:
        return "workspace", False


def run_gpt_prompt_action_game_object(act_desp, persona, maze, act_address):
    """Choose game object at action location."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_action_game_object")
        objects = persona.s_mem.get_str_accessible_arena_game_objects(act_address)
        if objects:
            obj_list = [o.strip() for o in objects.split(",")]
            desc = act_desp.lower()
            if any(kw in desc for kw in ["write", "code", "analyze", "work",
                                          "scriv", "analiz", "lavorar", "studio"]):
                for o in obj_list:
                    if "desk" in o.lower():
                        return o, True
            if any(kw in desc for kw in ["present", "explain", "diagram",
                                          "present", "diagramm", "whiteboard"]):
                for o in obj_list:
                    if "whiteboard" in o.lower() or "projector" in o.lower():
                        return o, True
            if any(kw in desc for kw in ["coffee", "drink", "caffè", "pausa"]):
                for o in obj_list:
                    if "coffee" in o.lower():
                        return o, True
            if any(kw in desc for kw in ["server", "train", "gpu", "model",
                                          "aggregat", "gradient", "deploy",
                                          "addestramento", "nodo"]):
                for o in obj_list:
                    if "server" in o.lower() or "monitor" in o.lower():
                        return o, True
            if any(kw in desc for kw in ["read", "paper", "leggere", "letteratura"]):
                for o in obj_list:
                    if "bookshelf" in o.lower() or "shelf" in o.lower():
                        return o, True
            return obj_list[0], True
        return "desk_1", True

    objects = persona.s_mem.get_str_accessible_arena_game_objects(act_address)
    if not objects:
        return "desk_1", False

    sys_prompt = _get_fl_system_prompt(persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"{persona.scratch.name} deve: {act_desp}\n"
        f"Attrezzatura disponibile: {objects}\n"
        f"Quale usare? (rispondi solo con il nome):"
    )
    try:
        response = GPT4_request(prompt).strip().lower()
        obj_list = [o.strip() for o in objects.split(",")]
        for o in obj_list:
            if o.strip().lower() in response or response in o.strip().lower():
                return o.strip(), True
        return obj_list[0], True
    except Exception as e:
        return "desk_1", False


def run_gpt_prompt_pronunciatio(act_desp, persona):
    """Generate emoji representation of an action."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_pronunciatio")
        emoji_map = {
            # General activities
            "sleep": "\U0001f634", "eat": "\U0001f37d\ufe0f", "work": "\U0001f4bb",
            "research": "\U0001f52c", "talk": "\U0001f4ac", "walk": "\U0001f6b6",
            "read": "\U0001f4d6", "write": "\u270d\ufe0f", "meet": "\U0001f91d",
            "lunch": "\U0001f37d\ufe0f", "coffee": "\u2615", "break": "\U0001f3d6\ufe0f",
            "present": "\U0001f4ca", "server": "\U0001f5a5\ufe0f",
            # FL-specific
            "train": "\U0001f3cb\ufe0f", "model": "\U0001f9ee", "data": "\U0001f4ca",
            "aggregat": "\U0001f504", "federat": "\U0001f310",
            "gradient": "\U0001f4c9", "weight": "\u2696\ufe0f",
            "privacy": "\U0001f512", "encrypt": "\U0001f510",
            "convergence": "\U0001f4c8", "accuracy": "\U0001f3af",
            "loss": "\U0001f4c9", "round": "\U0001f504",
            "deploy": "\U0001f680", "debug": "\U0001f41b",
            "compliance": "\U0001f4dc", "gdpr": "\U0001f6e1\ufe0f",
            # Italian keywords
            "addestramento": "\U0001f3cb\ufe0f", "modello": "\U0001f9ee",
            "analiz": "\U0001f52c", "collabora": "\U0001f91d",
            "riunione": "\U0001f4cb", "pranzo": "\U0001f37d\ufe0f",
            "pausa": "\u2615", "scriv": "\u270d\ufe0f",
            "studio": "\U0001f4d6", "revisione": "\U0001f50d",
        }
        desc_l = act_desp.lower()
        for kw, emoji in emoji_map.items():
            if kw in desc_l:
                return emoji, True
        return "\U0001f642", True

    prompt = (
        f"Converti questa attività di ricerca FL in 1-2 emoji: {act_desp}\n"
        f"Rispondi solo con le emoji:"
    )
    try:
        response = ChatGPT_request(prompt).strip()
        emojis = ''.join(c for c in response if ord(c) > 127)
        return emojis[:4] if emojis else "\U0001f642", True
    except Exception as e:
        return "\U0001f642", False


def run_gpt_prompt_act_obj_desc(act_game_object, act_desp, persona):
    """Generate object state description during action."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_act_obj_desc")
        return f"{act_game_object} in uso per {act_desp}", True

    prompt = (
        f"{persona.scratch.name} sta usando {act_game_object} per {act_desp}.\n"
        f"Descrivi lo stato di {act_game_object} in una frase breve:"
    )
    try:
        return GPT4_request(prompt).strip()[:100], True
    except Exception as e:
        return f"{act_game_object} in uso", False


def run_gpt_prompt_act_obj_event_triple(act_game_object, act_obj_desc, persona):
    """Generate event triple for action's object."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_act_obj_event_triple")
        return (act_game_object, "is", "in use"), True
    return (act_game_object, "is", "in use"), True


# ============================================================================
# Social Interaction Decisions
# ============================================================================

def run_gpt_prompt_decide_to_talk(init_persona, target_persona, retrieved):
    """Decide whether to initiate conversation."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_decide_to_talk")
        same_lab = (init_persona.scratch.lab_id and target_persona.scratch.lab_id and
                    init_persona.scratch.lab_id == target_persona.scratch.lab_id)
        # Complementary specializations boost conversation probability
        spec_i = (init_persona.scratch.fl_specialization or "").lower()
        spec_t = (target_persona.scratch.fl_specialization or "").lower()
        complementary = spec_i != spec_t and spec_i and spec_t
        if same_lab and complementary:
            return random.choice(["yes", "yes", "yes", "no"]), True
        if same_lab:
            return random.choice(["yes", "yes", "no"]), True
        return random.choice(["yes", "no", "no"]), True

    sys_prompt = _get_fl_system_prompt(init_persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"{init_persona.scratch.name} ({init_persona.scratch.fl_specialization}) "
        f"vede {target_persona.scratch.name} ({target_persona.scratch.fl_specialization}).\n"
        f"{init_persona.scratch.name} sta: {init_persona.scratch.act_description}\n"
        f"{target_persona.scratch.name} sta: {target_persona.scratch.act_description}\n"
        f"Dovrebbe {init_persona.scratch.name} avviare una conversazione su FL? (yes/no):"
    )
    try:
        response = GPT4_request(prompt).strip().lower()
        return "yes" if "yes" in response else "no", True
    except Exception as e:
        return "no", False


def run_gpt_prompt_decide_to_react(init_persona, target_persona, retrieved):
    """Decide reaction mode: '1' (wait), '2' (other), '3' (keep current action)."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_decide_to_react")
        return "3", True
    return "3", True


def run_gpt_prompt_new_decomp_schedule(persona, main_act_dur, truncated_act_dur,
                                        start_time_hour, end_time_hour,
                                        inserted_act, inserted_act_dur):
    """Generate new decomposed schedule after interruption."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_new_decomp_schedule")
        return truncated_act_dur, True
    return truncated_act_dur, True


# ============================================================================
# Conversation
# ============================================================================

def run_gpt_prompt_summarize_conversation(persona, convo):
    """Summarize a conversation."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_summarize_conversation")
        spec = persona.scratch.fl_specialization or "FL"
        if convo and len(convo) >= 2:
            other = convo[1][0] if convo[0][0] == persona.scratch.name else convo[0][0]
            return f"{persona.scratch.name} ha discusso di {spec} e strategie FL con {other}", True
        return f"{persona.scratch.name} ha discusso del progetto FL", True

    convo_str = "\n".join([f"{row[0]}: {row[1]}" for row in convo]) if convo else ""
    sys_prompt = _get_fl_system_prompt(persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"Riassumi questa conversazione in una frase:\n{convo_str}\n"
        f"Riassunto:"
    )
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception as e:
        return "ha avuto una conversazione", False


def run_gpt_prompt_agent_chat_summarize_ideas(init_persona, target_persona,
                                               all_embedding_key_str, curr_context):
    """Summarize ideas for conversation context."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_agent_chat_summarize_ideas")
        spec_i = init_persona.scratch.fl_specialization or "FL"
        spec_t = target_persona.scratch.fl_specialization or "FL"
        return (
            f"{init_persona.scratch.name} vuole discutere i progressi su {spec_i} "
            f"e coordinare con {target_persona.scratch.name} ({spec_t})"
        ), True

    sys_prompt = _get_fl_system_prompt(init_persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"{init_persona.scratch.name} sta per parlare con {target_persona.scratch.name}.\n"
        f"Contesto: {curr_context}\n"
        f"Memorie rilevanti: {all_embedding_key_str[:500]}\n"
        f"Di cosa vuole discutere {init_persona.scratch.name}? (1 frase):"
    )
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception as e:
        return "", False


def run_gpt_prompt_agent_chat_summarize_relationship(init_persona, target_persona,
                                                      all_embedding_key_str):
    """Summarize relationship between two agents."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_agent_chat_summarize_relationship")
        same_lab = (init_persona.scratch.lab_id == target_persona.scratch.lab_id)
        spec_i = init_persona.scratch.fl_specialization or "FL"
        spec_t = target_persona.scratch.fl_specialization or "FL"
        if same_lab:
            return (
                f"{init_persona.scratch.name} e {target_persona.scratch.name} sono colleghi "
                f"nello stesso lab, collaborano su {spec_i} e {spec_t}"
            ), True
        return (
            f"{init_persona.scratch.name} ({spec_i}) e {target_persona.scratch.name} ({spec_t}) "
            f"sono ricercatori di lab diversi che collaborano sul progetto FL federato"
        ), True

    sys_prompt = _get_fl_system_prompt(init_persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"Basandosi sulle interazioni:\n{all_embedding_key_str[:500]}\n"
        f"Riassumi la relazione tra {init_persona.scratch.name} "
        f"e {target_persona.scratch.name} in una frase:"
    )
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception as e:
        return "colleghi", False


def run_gpt_prompt_agent_chat(maze, init_persona, target_persona,
                               curr_context, init_summ_idea, target_summ_idea):
    """Generate a full batch conversation between two FL researchers."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_agent_chat")
        n1 = init_persona.scratch.name
        n2 = target_persona.scratch.name
        spec1 = init_persona.scratch.fl_specialization or "FL"
        spec2 = target_persona.scratch.fl_specialization or "FL"
        lab1 = init_persona.scratch.lab_id or "lab"
        # Contextual FL stub conversations
        convos = [
            [
                [n1, f"Ho analizzato i risultati dell'ultimo round di training su {spec1}. Le metriche di convergenza sono promettenti."],
                [n2, f"Interessante. Dal lato {spec2}, sto notando un tradeoff tra privacy e accuracy."],
                [n1, f"Potremmo provare a calibrare il noise budget per bilanciare meglio. Hai già testato con differential privacy?"],
                [n2, f"Sì, con epsilon=1.0 la loss scende bene. Sincronizziamoci per il prossimo round FedAvg."],
            ],
            [
                [n1, f"Il modello locale di {lab1} ha raggiunto una buona accuracy. Come va l'aggregazione?"],
                [n2, f"L'aggregazione FedAvg funziona, ma i dati non-IID tra i lab creano instabilità."],
                [n1, f"Posso contribuire con la mia esperienza in {spec1} per mitigare il problema."],
                [n2, f"Perfetto. Propongo di usare una strategia di weighted averaging basata sulla qualità dei dati locali."],
            ],
            [
                [n1, f"Sto lavorando sulla {spec1}. Hai visto gli ultimi paper su FedProx?"],
                [n2, f"Sì, FedProx potrebbe aiutare con l'eterogeneità statistica. Io mi concentro su {spec2}."],
                [n1, f"Dovremmo integrare i nostri approcci. Il tuo lavoro su {spec2} è complementare al mio."],
                [n2, f"Concordo. Organizziamo una sessione congiunta per definire la strategia del prossimo esperimento."],
            ],
        ]
        return random.choice(convos), True

    n1 = init_persona.scratch.name
    n2 = target_persona.scratch.name
    sys_prompt = _get_fl_system_prompt(init_persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"Genera una conversazione (3-5 scambi) tra due ricercatori FL in italiano.\n"
        f"{n1} ({init_persona.scratch.fl_specialization}): {init_summ_idea}\n"
        f"{n2} ({target_persona.scratch.fl_specialization}): {target_summ_idea}\n"
        f"Contesto: {curr_context}\n\n"
        f"La conversazione deve essere tecnica e specifica sul FL.\n"
        f"Formato: Nome: dialogo"
    )
    try:
        response = ChatGPT_request(prompt)
        convo = []
        for line in response.split("\n"):
            if ":" in line:
                parts = line.split(":", 1)
                speaker = parts[0].strip()
                text = parts[1].strip()
                if speaker and text:
                    if n1.split()[0] in speaker:
                        convo.append([n1, text])
                    elif n2.split()[0] in speaker:
                        convo.append([n2, text])
        return convo if convo else [[n1, "Ciao."], [n2, "Ciao."]], True
    except Exception as e:
        return [[n1, "Ciao."], [n2, "Ciao."]], False


def run_gpt_generate_iterative_chat_utt(maze, init_persona, target_persona,
                                         retrieved, curr_context, curr_chat):
    """Generate one utterance in iterative chat."""
    if USE_STUBS:
        _stub_warn("run_gpt_generate_iterative_chat_utt")
        spec = init_persona.scratch.fl_specialization or "FL"
        responses_early = [
            f"Come stanno procedendo i risultati su {spec}?",
            "Ho notato un miglioramento nella convergenza dell'ultimo round.",
            f"Sto sperimentando un nuovo approccio per la {spec}.",
            "I dati non-IID tra i lab stanno creando sfide interessanti.",
            "Dovremmo confrontare le metriche di privacy prima del prossimo round.",
        ]
        responses_mid = [
            "Buon punto. Posso condividere i miei risultati preliminari.",
            f"Dal lato {spec}, ho trovato che il tuning degli iperparametri è critico.",
            "Concordo. Potremmo provare FedProx per mitigare l'eterogeneità.",
            "Le metriche di loss mostrano un pattern interessante — devo approfondire.",
            "Propongo di organizzare una sessione di revisione congiunta.",
        ]
        responses_late = [
            "Perfetto, fissiamo per dopo la prossima riunione di lab.",
            "D'accordo. Aggiorno il mio branch e condivido i risultati.",
            "Ottimo scambio. Riprendiamo dopo il prossimo round di training.",
        ]
        n_exchanges = len(curr_chat)
        if n_exchanges < 2:
            utt = random.choice(responses_early)
        elif n_exchanges < 4:
            utt = random.choice(responses_mid)
        else:
            utt = random.choice(responses_late)
        end = n_exchanges >= 5
        return {"utterance": utt, "end": end}, True

    n1 = init_persona.scratch.name
    spec1 = init_persona.scratch.fl_specialization or "FL"
    spec2 = target_persona.scratch.fl_specialization or "FL"
    chat_str = "\n".join([f"{r[0]}: {r[1]}" for r in curr_chat]) if curr_chat else ""
    sys_prompt = _get_fl_system_prompt(init_persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"Conversazione tra ricercatori FL ({spec1} e {spec2}):\n{chat_str}\n\n"
        f"È il turno di {n1}. Genera la prossima battuta in italiano e decidi "
        f"se la conversazione deve terminare (dopo 3-5 scambi).\n"
        f"La battuta deve essere tecnica e specifica sul FL.\n"
        f"Formato: battuta | end (true/false)"
    )
    try:
        response = ChatGPT_request(prompt).strip()
        parts = response.split("|")
        utt = parts[0].strip()
        end = "true" in parts[1].lower() if len(parts) > 1 else len(curr_chat) >= 5
        return {"utterance": utt, "end": end}, True
    except Exception as e:
        return {"utterance": "Capisco, ne riparliamo.", "end": True}, False


def run_gpt_prompt_summarize_ideas(persona, statements, question):
    """Summarize ideas relevant to a question."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_summarize_ideas")
        spec = persona.scratch.fl_specialization or "FL"
        return f"{persona.scratch.name} ha insight su {question} legati a {spec}", True
    sys_prompt = _get_fl_system_prompt(persona)
    prompt = f"{sys_prompt}\n\nDato:\n{statements}\n\nRiassumi le idee rilevanti per: {question}"
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception as e:
        return "", False


def run_gpt_prompt_generate_next_convo_line(persona, interlocutor_desc,
                                             prev_convo, summarized_idea):
    """Generate next line in a conversation."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_generate_next_convo_line")
        return "Ci penso e ti aggiorno dopo il prossimo round di training.", True
    return "Ci penso e ti aggiorno.", True


def run_gpt_prompt_generate_whisper_inner_thought(persona, whisper):
    """Generate inner thought from a whisper/hint."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_generate_whisper_inner_thought")
        return f"{persona.scratch.name} riflette: {whisper}", True
    return whisper, True


def run_gpt_prompt_planning_thought_on_convo(persona, all_utt):
    """Generate planning thought after a conversation."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_planning_thought_on_convo")
        spec = persona.scratch.fl_specialization or "FL"
        return (
            f"dare seguito alla discussione: approfondire {spec} "
            f"e preparare i risultati per il prossimo round FL"
        ), True

    sys_prompt = _get_fl_system_prompt(persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"Dopo questa conversazione:\n{all_utt}\n\n"
        f"Cosa dovrebbe pianificare {persona.scratch.name} come prossimo passo? (1 frase):"
    )
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception as e:
        return "dare seguito alla discussione", False


def run_gpt_prompt_memo_on_convo(persona, all_utt):
    """Generate memo/summary thought after a conversation."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_memo_on_convo")
        spec = persona.scratch.fl_specialization or "FL"
        return (
            f"conversazione utile: nuovi spunti su {spec} "
            f"e coordinamento con i colleghi per il progetto FL"
        ), True

    sys_prompt = _get_fl_system_prompt(persona)
    prompt = (
        f"{sys_prompt}\n\n"
        f"Dopo questa conversazione:\n{all_utt}\n\n"
        f"Qual è il takeaway principale per {persona.scratch.name}? (1 frase):"
    )
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception as e:
        return "conversazione utile sul progetto FL", False
