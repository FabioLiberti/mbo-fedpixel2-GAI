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
    ctx += f"Specialization: {s.fl_specialization or 'federated learning'}\n"
    ctx += f"Traits: {s.innate}\n" if s.innate else ""
    if s.curr_time:
        ctx += f"Current time: {s.curr_time.strftime('%H:%M on %A %B %d')}\n"
    return ctx


# ============================================================================
# Poignancy / Importance Scoring
# ============================================================================

def run_gpt_prompt_event_poignancy(persona, description):
    """Rate the poignancy (importance) of an event on a scale of 1-10."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_event_poignancy")
        score = 3
        if any(kw in description.lower() for kw in
               ["federated", "model", "training", "accuracy", "round", "aggregate"]):
            score = 7
        if any(kw in description.lower() for kw in
               ["error", "fail", "breakthrough", "converge", "privacy"]):
            score = 8
        return score, True

    prompt = (
        f"You are rating events in a federated learning research lab.\n"
        f"On a scale of 1-10 (1=mundane, 10=critical):\n"
        f"Event: {description}\n"
        f"Rating (just the number):"
    )
    try:
        response = GPT4_request(prompt)
        return _extract_number(response, default=5), True
    except Exception:
        return 5, False


def run_gpt_prompt_chat_poignancy(persona, description):
    """Rate the poignancy of a chat interaction."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_chat_poignancy")
        return 4, True
    return run_gpt_prompt_event_poignancy(persona, description)


# ============================================================================
# Focal Points & Reflection
# ============================================================================

def run_gpt_prompt_focal_pt(persona, statements, n=3):
    """Generate n focal points for reflection from recent statements."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_focal_pt")
        name = persona.scratch.name
        return [
            f"What is {name}'s current research progress on federated learning?",
            f"How should {name} collaborate with lab colleagues?",
            f"What should {name} prioritize in the FL pipeline?",
        ][:n], True

    ctx = _build_persona_context(persona)
    prompt = (
        f"{ctx}\n"
        f"Recent observations and thoughts:\n{statements}\n\n"
        f"Given the above, what are {n} important questions {persona.scratch.name} "
        f"should reflect on to advance their federated learning research?\n"
        f"List {n} questions:"
    )
    try:
        response = ChatGPT_request(prompt)
        points = _extract_list_items(response, n)
        return points if points else [f"What should {persona.scratch.name} focus on?"], True
    except Exception:
        return [f"What is important for {persona.scratch.name}?"], False


def run_gpt_prompt_insight_and_guidance(persona, statements, n=5):
    """Generate insights with evidence indices from statements."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_insight_and_guidance")
        return {f"{persona.scratch.name} is making steady research progress": [0]}, True

    prompt = (
        f"Given these numbered observations about FL research:\n{statements}\n\n"
        f"Generate up to {n} high-level insights. For each, list the statement "
        f"numbers (0-indexed) that support it.\n"
        f"Format: insight [evidence indices as comma-separated numbers]"
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
    except Exception:
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
        f"Convert this action into a (subject, predicate, object) triple.\n"
        f"Person: {persona.scratch.name}\n"
        f'Action: "{act_desp}"\n'
        f"Reply with exactly: subject, predicate, object"
    )
    try:
        response = GPT4_request(prompt)
        parts = [p.strip().strip('"\'()') for p in response.split(",")]
        if len(parts) >= 3:
            return (parts[0], parts[1], parts[2]), True
        return (persona.scratch.name, "is doing", act_desp), False
    except Exception:
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
        f"What time does {persona.scratch.name} typically arrive at the lab? "
        f"Answer with just the hour (e.g., 9):"
    )
    try:
        response = GPT4_request(prompt)
        return _extract_number(response, default=9, low=7, high=11), True
    except Exception:
        return 9, False


def run_gpt_prompt_daily_plan(persona, wake_up_hour):
    """Generate daily plan as list of FL research activities."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_daily_plan")
        return [
            f"arrive at the lab at {wake_up_hour}:00 am",
            "review federated learning model results",
            "collaborate with lab colleagues on research",
            "have lunch at 12:00 pm",
            "work on model training and optimization",
            "attend lab meeting at 4:00 pm",
            "wrap up work and leave lab at 6:00 pm",
        ], True

    ctx = _build_persona_context(persona)
    prompt = (
        f"{ctx}\n"
        f"Today {persona.scratch.name} arrives at {wake_up_hour}:00 AM.\n"
        f"Write a realistic daily plan (5-7 activities) for an FL researcher.\n"
        f"Include: research work, collaboration, lunch, meetings.\n"
        f"List activities:"
    )
    try:
        response = ChatGPT_request(prompt)
        items = _extract_list_items(response, 8)
        return items if items else ["work on research"], True
    except Exception:
        return ["work on research"], False


def run_gpt_prompt_generate_hourly_schedule(persona, curr_hour_str, n_m1_activity, hour_str):
    """Generate activity for a specific hour in FL research context."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_generate_hourly_schedule")
        defaults = {
            "08:00 AM": "arriving at the lab",
            "09:00 AM": "reviewing research data and FL model metrics",
            "10:00 AM": "working on federated learning model",
            "11:00 AM": "collaborating with colleagues on FL pipeline",
            "12:00 PM": "having lunch",
            "01:00 PM": "reading research papers on FL",
            "02:00 PM": "running model training experiments",
            "03:00 PM": "analyzing experimental results",
            "04:00 PM": "attending lab meeting",
            "05:00 PM": "writing research notes and documentation",
            "06:00 PM": "wrapping up work",
        }
        return defaults.get(curr_hour_str, "working on FL research"), True

    recent = ', '.join(n_m1_activity[-3:]) if n_m1_activity else 'just arrived'
    prompt = (
        f"{persona.scratch.name} is an FL researcher at {persona.scratch.lab_id or 'the lab'}.\n"
        f"It is {curr_hour_str}. Recent activities: {recent}\n"
        f"What is {persona.scratch.name} doing now? (1 sentence):"
    )
    try:
        return ChatGPT_request(prompt).strip()[:100], True
    except Exception:
        return "working on research", False


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
    except Exception:
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

    prompt = (
        f"{persona.scratch.name} needs to: {act_desp}\n"
        f"Available areas: {sectors}\n"
        f"Which area is most appropriate? (reply with just the area name):"
    )
    try:
        response = GPT4_request(prompt).strip().lower()
        sector_list = [s.strip() for s in sectors.split(",")]
        # Find best match
        for s in sector_list:
            if s.strip().lower() in response or response in s.strip().lower():
                return s.strip(), True
        return sector_list[0], True
    except Exception:
        return persona.scratch.lab_id or sector_list[0], False


def run_gpt_prompt_action_arena(act_desp, persona, maze, act_world, act_sector):
    """Choose arena within sector for action."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_action_arena")
        # Heuristic: map action keywords to arenas
        desc = act_desp.lower()
        if any(kw in desc for kw in ["lunch", "break", "coffee", "rest", "eat"]):
            return "break_room", True
        if any(kw in desc for kw in ["meeting", "present", "discuss", "coordinat"]):
            return "meeting_room", True
        if any(kw in desc for kw in ["server", "deploy", "gpu", "cluster"]):
            return "server_room", True
        return "workspace", True

    arenas = persona.s_mem.get_str_accessible_sector_arenas(f"{act_world}:{act_sector}")
    if not arenas:
        return "workspace", False

    prompt = (
        f"{persona.scratch.name} needs to: {act_desp}\n"
        f"Available rooms in {act_sector}: {arenas}\n"
        f"Which room? (reply with just the room name):"
    )
    try:
        response = GPT4_request(prompt).strip().lower()
        arena_list = [a.strip() for a in arenas.split(",")]
        for a in arena_list:
            if a.strip().lower() in response or response in a.strip().lower():
                return a.strip(), True
        return arena_list[0], True
    except Exception:
        return "workspace", False


def run_gpt_prompt_action_game_object(act_desp, persona, maze, act_address):
    """Choose game object at action location."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_action_game_object")
        objects = persona.s_mem.get_str_accessible_arena_game_objects(act_address)
        if objects:
            obj_list = [o.strip() for o in objects.split(",")]
            # Heuristic matching
            desc = act_desp.lower()
            if any(kw in desc for kw in ["write", "code", "analyze", "work"]):
                for o in obj_list:
                    if "desk" in o.lower():
                        return o, True
            if any(kw in desc for kw in ["present", "explain", "diagram"]):
                for o in obj_list:
                    if "whiteboard" in o.lower() or "projector" in o.lower():
                        return o, True
            if any(kw in desc for kw in ["coffee", "drink"]):
                for o in obj_list:
                    if "coffee" in o.lower():
                        return o, True
            if any(kw in desc for kw in ["server", "train", "gpu"]):
                for o in obj_list:
                    if "server" in o.lower() or "monitor" in o.lower():
                        return o, True
            return obj_list[0], True
        return "desk_1", True

    objects = persona.s_mem.get_str_accessible_arena_game_objects(act_address)
    if not objects:
        return "desk_1", False

    prompt = (
        f"{persona.scratch.name} needs to: {act_desp}\n"
        f"Available equipment: {objects}\n"
        f"Which to use? (reply with just the name):"
    )
    try:
        response = GPT4_request(prompt).strip().lower()
        obj_list = [o.strip() for o in objects.split(",")]
        for o in obj_list:
            if o.strip().lower() in response or response in o.strip().lower():
                return o.strip(), True
        return obj_list[0], True
    except Exception:
        return "desk_1", False


def run_gpt_prompt_pronunciatio(act_desp, persona):
    """Generate emoji representation of an action."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_pronunciatio")
        emoji_map = {
            "sleep": "\U0001f634", "eat": "\U0001f37d\ufe0f", "work": "\U0001f4bb",
            "research": "\U0001f52c", "talk": "\U0001f4ac", "walk": "\U0001f6b6",
            "read": "\U0001f4d6", "write": "\u270d\ufe0f", "train": "\U0001f3cb\ufe0f",
            "meet": "\U0001f91d", "model": "\U0001f9ee", "data": "\U0001f4ca",
            "lunch": "\U0001f37d\ufe0f", "coffee": "\u2615", "break": "\U0001f3d6\ufe0f",
            "present": "\U0001f4ca", "server": "\U0001f5a5\ufe0f",
        }
        for kw, emoji in emoji_map.items():
            if kw in act_desp.lower():
                return emoji, True
        return "\U0001f642", True

    prompt = f"Convert this action to 1-2 emojis: {act_desp}\nEmojis:"
    try:
        response = ChatGPT_request(prompt).strip()
        # Extract just emoji characters
        emojis = ''.join(c for c in response if ord(c) > 127)
        return emojis[:4] if emojis else "\U0001f642", True
    except Exception:
        return "\U0001f642", False


def run_gpt_prompt_act_obj_desc(act_game_object, act_desp, persona):
    """Generate object state description during action."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_act_obj_desc")
        return f"{act_game_object} is being used for {act_desp}", True

    prompt = (
        f"{persona.scratch.name} is using {act_game_object} to {act_desp}.\n"
        f"Describe the state of {act_game_object} in one short sentence:"
    )
    try:
        return GPT4_request(prompt).strip()[:100], True
    except Exception:
        return f"{act_game_object} is in use", False


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
        # Higher chance if same lab
        if (init_persona.scratch.lab_id and target_persona.scratch.lab_id and
            init_persona.scratch.lab_id == target_persona.scratch.lab_id):
            return random.choice(["yes", "yes", "no"]), True
        return random.choice(["yes", "no", "no"]), True

    prompt = (
        f"{init_persona.scratch.name} ({init_persona.scratch.fl_specialization}) "
        f"sees {target_persona.scratch.name} ({target_persona.scratch.fl_specialization}).\n"
        f"{init_persona.scratch.name} is currently: {init_persona.scratch.act_description}\n"
        f"Should {init_persona.scratch.name} initiate a conversation? (yes/no):"
    )
    try:
        response = GPT4_request(prompt).strip().lower()
        return "yes" if "yes" in response else "no", True
    except Exception:
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
        return f"{persona.scratch.name} had a research discussion about FL", True

    convo_str = "\n".join([f"{row[0]}: {row[1]}" for row in convo]) if convo else ""
    prompt = f"Summarize this conversation in one sentence:\n{convo_str}\nSummary:"
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception:
        return "had a conversation", False


def run_gpt_prompt_agent_chat_summarize_ideas(init_persona, target_persona,
                                               all_embedding_key_str, curr_context):
    """Summarize ideas for conversation context."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_agent_chat_summarize_ideas")
        return (
            f"{init_persona.scratch.name} wants to discuss "
            f"{init_persona.scratch.fl_specialization or 'FL research'} progress"
        ), True

    prompt = (
        f"{init_persona.scratch.name} is about to talk with {target_persona.scratch.name}.\n"
        f"Context: {curr_context}\n"
        f"Relevant memories: {all_embedding_key_str[:500]}\n"
        f"What does {init_persona.scratch.name} want to discuss? (1 sentence):"
    )
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception:
        return "", False


def run_gpt_prompt_agent_chat_summarize_relationship(init_persona, target_persona,
                                                      all_embedding_key_str):
    """Summarize relationship between two agents."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_agent_chat_summarize_relationship")
        same_lab = (init_persona.scratch.lab_id == target_persona.scratch.lab_id)
        if same_lab:
            return f"{init_persona.scratch.name} and {target_persona.scratch.name} are lab colleagues who work together on FL", True
        return f"{init_persona.scratch.name} and {target_persona.scratch.name} are researchers from different labs collaborating on FL", True

    prompt = (
        f"Based on their interactions:\n{all_embedding_key_str[:500]}\n"
        f"Summarize the relationship between {init_persona.scratch.name} "
        f"and {target_persona.scratch.name} in one sentence:"
    )
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception:
        return "colleagues", False


def run_gpt_prompt_agent_chat(maze, init_persona, target_persona,
                               curr_context, init_summ_idea, target_summ_idea):
    """Generate a full batch conversation between two FL researchers."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_agent_chat")
        n1 = init_persona.scratch.name
        n2 = target_persona.scratch.name
        return [
            [n1, f"How is your work on {init_persona.scratch.fl_specialization or 'FL'} going?"],
            [n2, f"Making progress. I've been focusing on {target_persona.scratch.fl_specialization or 'my part'}."],
            [n1, "We should coordinate our approaches for the next FL round."],
            [n2, "Agreed. Let's sync up after the next training round."],
        ], True

    n1 = init_persona.scratch.name
    n2 = target_persona.scratch.name
    prompt = (
        f"Generate a short conversation (3-5 exchanges) between two FL researchers.\n"
        f"{n1} ({init_persona.scratch.fl_specialization}): {init_summ_idea}\n"
        f"{n2} ({target_persona.scratch.fl_specialization}): {target_summ_idea}\n"
        f"Context: {curr_context}\n\n"
        f"Conversation (format: Name: dialogue):"
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
                    # Map to actual names
                    if n1.split()[0] in speaker:
                        convo.append([n1, text])
                    elif n2.split()[0] in speaker:
                        convo.append([n2, text])
        return convo if convo else [[n1, "Hello."], [n2, "Hi."]], True
    except Exception:
        return [[n1, "Hello."], [n2, "Hi."]], False


def run_gpt_generate_iterative_chat_utt(maze, init_persona, target_persona,
                                         retrieved, curr_context, curr_chat):
    """Generate one utterance in iterative chat."""
    if USE_STUBS:
        _stub_warn("run_gpt_generate_iterative_chat_utt")
        responses = [
            "How is the model training going?",
            "Have you seen the latest FL round results?",
            "We should coordinate our approaches.",
            "That's a good point about the privacy-utility tradeoff.",
            "I'll update my local model configuration.",
        ]
        end = len(curr_chat) >= 4
        return {"utterance": random.choice(responses), "end": end}, True

    n1 = init_persona.scratch.name
    chat_str = "\n".join([f"{r[0]}: {r[1]}" for r in curr_chat]) if curr_chat else ""
    prompt = (
        f"Conversation between FL researchers:\n{chat_str}\n\n"
        f"{n1}'s turn. Generate the next line and decide if the conversation "
        f"should end (after 3-5 exchanges).\n"
        f"Format: utterance | end (true/false)"
    )
    try:
        response = ChatGPT_request(prompt).strip()
        parts = response.split("|")
        utt = parts[0].strip()
        end = "true" in parts[1].lower() if len(parts) > 1 else len(curr_chat) >= 4
        return {"utterance": utt, "end": end}, True
    except Exception:
        return {"utterance": "I see.", "end": True}, False


def run_gpt_prompt_summarize_ideas(persona, statements, question):
    """Summarize ideas relevant to a question."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_summarize_ideas")
        return f"{persona.scratch.name} has insights about {question}", True
    prompt = f"Given:\n{statements}\n\nSummarize ideas relevant to: {question}"
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception:
        return "", False


def run_gpt_prompt_generate_next_convo_line(persona, interlocutor_desc,
                                             prev_convo, summarized_idea):
    """Generate next line in a conversation."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_generate_next_convo_line")
        return "I'll think about that and get back to you.", True
    return "I'll think about that.", True


def run_gpt_prompt_generate_whisper_inner_thought(persona, whisper):
    """Generate inner thought from a whisper/hint."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_generate_whisper_inner_thought")
        return f"{persona.scratch.name} considers: {whisper}", True
    return whisper, True


def run_gpt_prompt_planning_thought_on_convo(persona, all_utt):
    """Generate planning thought after a conversation."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_planning_thought_on_convo")
        return "should follow up on the discussion about FL research progress", True

    prompt = (
        f"After this conversation:\n{all_utt}\n\n"
        f"What should {persona.scratch.name} plan to do next? (1 sentence):"
    )
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception:
        return "should follow up", False


def run_gpt_prompt_memo_on_convo(persona, all_utt):
    """Generate memo/summary thought after a conversation."""
    if USE_STUBS:
        _stub_warn("run_gpt_prompt_memo_on_convo")
        return "had an insightful conversation about federated learning research", True

    prompt = (
        f"After this conversation:\n{all_utt}\n\n"
        f"What is {persona.scratch.name}'s key takeaway? (1 sentence):"
    )
    try:
        return ChatGPT_request(prompt).strip()[:200], True
    except Exception:
        return "had a conversation", False
