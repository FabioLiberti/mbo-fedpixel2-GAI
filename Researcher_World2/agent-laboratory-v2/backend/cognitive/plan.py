"""
Plan module for generative agents.
Ported from Park et al. (UIST 2023).

Handles long-term daily planning, action determination, and reactive planning.
"""
import datetime
import math
import random
import logging

from .prompts.gpt_structure import get_embedding, ChatGPT_single_request
from .prompts.run_gpt_prompt import is_llm_enabled
from .prompts.run_gpt_prompt import (
    run_gpt_prompt_wake_up_hour,
    run_gpt_prompt_daily_plan,
    run_gpt_prompt_generate_hourly_schedule,
    run_gpt_prompt_task_decomp,
    run_gpt_prompt_action_sector,
    run_gpt_prompt_action_arena,
    run_gpt_prompt_action_game_object,
    run_gpt_prompt_pronunciatio,
    run_gpt_prompt_event_triple,
    run_gpt_prompt_act_obj_desc,
    run_gpt_prompt_act_obj_event_triple,
    run_gpt_prompt_decide_to_talk,
    run_gpt_prompt_decide_to_react,
    run_gpt_prompt_new_decomp_schedule,
    run_gpt_prompt_summarize_conversation,
)
from .retrieve import new_retrieve
from .converse import agent_chat_v2

logger = logging.getLogger(__name__)


# ============================================================================
# Generate Functions
# ============================================================================

def generate_wake_up_hour(persona):
    """Generate the hour the persona wakes up.
    Capped to max 7 AM so agents are always active during lab hours (8+)."""
    hour = int(run_gpt_prompt_wake_up_hour(persona)[0])
    return min(hour, 7)


def generate_first_daily_plan(persona, wake_up_hour):
    """Generate daily plan as list of broad-stroke activities."""
    return run_gpt_prompt_daily_plan(persona, wake_up_hour)[0]


def generate_hourly_schedule(persona, wake_up_hour):
    """
    Generate hourly schedule from daily plan.
    Returns list of [activity, duration_minutes].
    """
    hour_str = ["00:00 AM", "01:00 AM", "02:00 AM", "03:00 AM", "04:00 AM",
                "05:00 AM", "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM",
                "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM",
                "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM",
                "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"]

    n_m1_activity = []
    diversity_repeat_count = 3
    for _ in range(diversity_repeat_count):
        n_m1_activity_set = set(n_m1_activity)
        if len(n_m1_activity_set) < 5:
            n_m1_activity = []
            wuh = wake_up_hour
            for count, curr_hour_str in enumerate(hour_str):
                if wuh > 0:
                    n_m1_activity.append("sleeping")
                    wuh -= 1
                else:
                    n_m1_activity.append(
                        run_gpt_prompt_generate_hourly_schedule(
                            persona, curr_hour_str, n_m1_activity, hour_str)[0])

    # Compress to [activity, hours]
    _compressed = []
    prev = None
    for i in n_m1_activity:
        if i != prev:
            _compressed.append([i, 1])
            prev = i
        else:
            if _compressed:
                _compressed[-1][1] += 1

    # Convert hours to minutes
    return [[task, duration * 60] for task, duration in _compressed]


def generate_task_decomp(persona, task, duration):
    """Decompose a task into subtasks with durations."""
    return run_gpt_prompt_task_decomp(persona, task, duration)[0]


def generate_action_sector(act_desp, persona, maze):
    """Choose the sector for an action."""
    return run_gpt_prompt_action_sector(act_desp, persona, maze)[0]


def generate_action_arena(act_desp, persona, maze, act_world, act_sector):
    """Choose the arena within a sector for an action."""
    return run_gpt_prompt_action_arena(act_desp, persona, maze, act_world, act_sector)[0]


def generate_action_game_object(act_desp, act_address, persona, maze):
    """Choose a game object for the action."""
    accessible_objects = persona.s_mem.get_str_accessible_arena_game_objects(act_address)
    if not accessible_objects:
        generic_objects = ["area", "space", "room", "floor", "wall"]
        return generic_objects[hash(act_desp) % len(generic_objects)]
    return run_gpt_prompt_action_game_object(act_desp, persona, maze, act_address)[0]


def generate_action_pronunciatio(act_desp, persona):
    """Generate emoji representation of an action."""
    try:
        x = run_gpt_prompt_pronunciatio(act_desp, persona)[0]
    except Exception as e:
        logger.debug(f"pronunciatio fallback: {e}")
        x = "🙂"
    return x if x else "🙂"


def generate_action_event_triple(act_desp, persona):
    """Generate (subject, predicate, object) triple for action."""
    return run_gpt_prompt_event_triple(act_desp, persona)[0]


def generate_act_obj_desc(act_game_object, act_desp, persona):
    """Generate object description for the action."""
    return run_gpt_prompt_act_obj_desc(act_game_object, act_desp, persona)[0]


def generate_act_obj_event_triple(act_game_object, act_obj_desc, persona):
    """Generate event triple for the action's object."""
    return run_gpt_prompt_act_obj_event_triple(act_game_object, act_obj_desc, persona)[0]


def generate_convo(maze, init_persona, target_persona):
    """Generate a conversation between two personas."""
    convo = agent_chat_v2(maze, init_persona, target_persona)
    all_utt = ""
    for row in convo:
        all_utt += f"{row[0]}: {row[1]}\n"
    convo_length = math.ceil(int(len(all_utt) / 8) / 30)
    return convo, convo_length


def generate_convo_summary(persona, convo):
    """Summarize a conversation."""
    return run_gpt_prompt_summarize_conversation(persona, convo)[0]


def generate_decide_to_talk(init_persona, target_persona, retrieved):
    """Decide whether to initiate a conversation."""
    x = run_gpt_prompt_decide_to_talk(init_persona, target_persona, retrieved)[0]
    return x == "yes"


def generate_decide_to_react(init_persona, target_persona, retrieved):
    """Decide how to react to another persona."""
    return run_gpt_prompt_decide_to_react(init_persona, target_persona, retrieved)[0]


def generate_new_decomp_schedule(persona, inserted_act, inserted_act_dur,
                                 start_hour, end_hour):
    """Generate new decomposed schedule after an interruption."""
    p = persona
    today_min_pass = int(p.scratch.curr_time.hour) * 60 + int(p.scratch.curr_time.minute) + 1

    main_act_dur = []
    truncated_act_dur = []
    dur_sum = 0
    count = 0
    truncated_fin = False

    for act, dur in p.scratch.f_daily_schedule:
        if (dur_sum >= start_hour * 60) and (dur_sum < end_hour * 60):
            main_act_dur.append([act, dur])
            if dur_sum <= today_min_pass:
                truncated_act_dur.append([act, dur])
            elif dur_sum > today_min_pass and not truncated_fin:
                truncated_act_dur.append([p.scratch.f_daily_schedule[count][0],
                                          dur_sum - today_min_pass])
                truncated_act_dur[-1][-1] -= (dur_sum - today_min_pass)
                truncated_fin = True
        dur_sum += dur
        count += 1

    if not truncated_act_dur:
        return main_act_dur

    x = truncated_act_dur[-1][0].split("(")[0].strip()
    if "(" in truncated_act_dur[-1][0]:
        x += " (on the way to " + truncated_act_dur[-1][0].split("(")[-1][:-1] + ")"
    truncated_act_dur[-1][0] = x

    if "(" in truncated_act_dur[-1][0]:
        inserted_act = truncated_act_dur[-1][0].split("(")[0].strip() + " (" + inserted_act + ")"

    truncated_act_dur.append([inserted_act, inserted_act_dur])
    start_time_hour = datetime.datetime(2022, 10, 31, 0, 0) + datetime.timedelta(hours=start_hour)
    end_time_hour = datetime.datetime(2022, 10, 31, 0, 0) + datetime.timedelta(hours=end_hour)

    return run_gpt_prompt_new_decomp_schedule(
        persona, main_act_dur, truncated_act_dur,
        start_time_hour, end_time_hour,
        inserted_act, inserted_act_dur)[0]


# ============================================================================
# Plan Functions
# ============================================================================

def revise_identity(persona):
    """Revise persona's identity/status at start of new day."""
    if not is_llm_enabled():
        # Stub mode: keep current identity unchanged
        return

    p_name = persona.scratch.name

    focal_points = [
        f"{p_name}'s plan for {persona.scratch.get_str_curr_date_str()}.",
        f"Important recent events for {p_name}'s life."
    ]
    retrieved = new_retrieve(persona, focal_points)

    statements = "[Statements]\n"
    for key, val in retrieved.items():
        for i in val:
            statements += f"{i.created.strftime('%A %B %d -- %H:%M %p')}: {i.embedding_key}\n"

    plan_prompt = statements + "\n"
    plan_prompt += f"Given the statements above, is there anything that {p_name} should remember as they plan for"
    plan_prompt += f" *{persona.scratch.curr_time.strftime('%A %B %d')}*? "
    plan_prompt += f"If there is any scheduling information, be as specific as possible (include date, time, and location if stated in the statement)\n\n"
    plan_prompt += f"Write the response from {p_name}'s perspective."
    plan_note = ChatGPT_single_request(plan_prompt)

    thought_prompt = statements + "\n"
    thought_prompt += f"Given the statements above, how might we summarize {p_name}'s feelings about their days up to now?\n\n"
    thought_prompt += f"Write the response from {p_name}'s perspective."
    thought_note = ChatGPT_single_request(thought_prompt)

    currently_prompt = f"{p_name}'s status from {(persona.scratch.curr_time - datetime.timedelta(days=1)).strftime('%A %B %d')}:\n"
    currently_prompt += f"{persona.scratch.currently}\n\n"
    currently_prompt += f"{p_name}'s thoughts at the end of {(persona.scratch.curr_time - datetime.timedelta(days=1)).strftime('%A %B %d')}:\n"
    currently_prompt += (plan_note + thought_note).replace('\n', '') + "\n\n"
    currently_prompt += f"It is now {persona.scratch.curr_time.strftime('%A %B %d')}. Given the above, write {p_name}'s status for {persona.scratch.curr_time.strftime('%A %B %d')} that reflects {p_name}'s thoughts at the end of {(persona.scratch.curr_time - datetime.timedelta(days=1)).strftime('%A %B %d')}. Write this in third-person talking about {p_name}."
    currently_prompt += f"If there is any scheduling information, be as specific as possible (include date, time, and location if stated in the statement).\n\n"
    currently_prompt += "Follow this format below:\nStatus: <new status>"
    new_currently = ChatGPT_single_request(currently_prompt)
    persona.scratch.currently = new_currently

    daily_req_prompt = persona.scratch.get_str_iss() + "\n"
    daily_req_prompt += f"Today is {persona.scratch.curr_time.strftime('%A %B %d')}. Here is {persona.scratch.name}'s plan today in broad-strokes (with the time of the day. e.g., have a lunch at 12:00 pm, watch TV from 7 to 8 pm).\n\n"
    daily_req_prompt += f"Follow this format (the list should have 4~6 items but no more):\n"
    daily_req_prompt += f"1. wake up and complete the morning routine at <time>, 2. ..."
    new_daily_req = ChatGPT_single_request(daily_req_prompt).replace('\n', ' ')
    persona.scratch.daily_plan_req = new_daily_req


def _long_term_planning(persona, new_day):
    """Generate daily long-term plan (wake up hour + hourly schedule)."""
    wake_up_hour = generate_wake_up_hour(persona)

    if new_day == "First day":
        persona.scratch.daily_req = generate_first_daily_plan(persona, wake_up_hour)
    elif new_day == "New day":
        revise_identity(persona)
        persona.scratch.daily_req = persona.scratch.daily_req

    persona.scratch.f_daily_schedule = generate_hourly_schedule(persona, wake_up_hour)
    persona.scratch.f_daily_schedule_hourly_org = persona.scratch.f_daily_schedule[:]

    # Add daily plan to memory
    thought = f"This is {persona.scratch.name}'s plan for {persona.scratch.curr_time.strftime('%A %B %d')}:"
    for i in persona.scratch.daily_req:
        thought += f" {i},"
    thought = thought[:-1] + "."

    created = persona.scratch.curr_time
    expiration = persona.scratch.curr_time + datetime.timedelta(days=30)
    s, p, o = (persona.scratch.name, "plan", persona.scratch.curr_time.strftime('%A %B %d'))
    keywords = set(["plan"])
    thought_poignancy = 5
    thought_embedding_pair = (thought, get_embedding(thought))
    persona.a_mem.add_thought(created, expiration, s, p, o,
                              thought, keywords, thought_poignancy,
                              thought_embedding_pair, None)


def _determine_action(persona, maze):
    """
    Create next action for the persona. Decomposes hourly schedule as needed
    and sets up all action variables.
    """
    def determine_decomp(act_desp, act_dura):
        if "sleep" not in act_desp and "bed" not in act_desp:
            return True
        elif "sleeping" in act_desp or "asleep" in act_desp or "in bed" in act_desp:
            return False
        elif "sleep" in act_desp or "bed" in act_desp:
            if act_dura > 60:
                return False
        return True

    curr_index = persona.scratch.get_f_daily_schedule_index()
    curr_index_60 = persona.scratch.get_f_daily_schedule_index(advance=60)

    # Decompose tasks as needed
    if curr_index == 0:
        act_desp, act_dura = persona.scratch.f_daily_schedule[curr_index]
        if act_dura >= 60 and determine_decomp(act_desp, act_dura):
            persona.scratch.f_daily_schedule[curr_index:curr_index+1] = (
                generate_task_decomp(persona, act_desp, act_dura))
        if curr_index_60 + 1 < len(persona.scratch.f_daily_schedule):
            act_desp, act_dura = persona.scratch.f_daily_schedule[curr_index_60+1]
            if act_dura >= 60 and determine_decomp(act_desp, act_dura):
                persona.scratch.f_daily_schedule[curr_index_60+1:curr_index_60+2] = (
                    generate_task_decomp(persona, act_desp, act_dura))

    if curr_index_60 < len(persona.scratch.f_daily_schedule):
        if persona.scratch.curr_time.hour < 23:
            act_desp, act_dura = persona.scratch.f_daily_schedule[curr_index_60]
            if act_dura >= 60 and determine_decomp(act_desp, act_dura):
                persona.scratch.f_daily_schedule[curr_index_60:curr_index_60+1] = (
                    generate_task_decomp(persona, act_desp, act_dura))

    # Pad schedule to 1440 minutes if needed
    x_emergency = sum(i[1] for i in persona.scratch.f_daily_schedule)
    if 1440 - x_emergency > 0:
        persona.scratch.f_daily_schedule.append(["sleeping", 1440 - x_emergency])

    act_desp, act_dura = persona.scratch.f_daily_schedule[curr_index]

    # Determine action location
    act_world = maze.access_tile(persona.scratch.curr_tile)["world"]
    act_sector = generate_action_sector(act_desp, persona, maze)
    act_arena = generate_action_arena(act_desp, persona, maze, act_world, act_sector)
    act_address = f"{act_world}:{act_sector}:{act_arena}"
    act_game_object = generate_action_game_object(act_desp, act_address, persona, maze)
    new_address = f"{act_world}:{act_sector}:{act_arena}:{act_game_object}"
    act_pron = generate_action_pronunciatio(act_desp, persona)
    act_event = generate_action_event_triple(act_desp, persona)
    act_obj_desp = generate_act_obj_desc(act_game_object, act_desp, persona)
    act_obj_pron = generate_action_pronunciatio(act_obj_desp, persona)
    act_obj_event = generate_act_obj_event_triple(act_game_object, act_obj_desp, persona)

    persona.scratch.add_new_action(
        new_address, int(act_dura), act_desp, act_pron, act_event,
        None, None, None, None,
        act_obj_desp, act_obj_pron, act_obj_event)


def _choose_retrieved(persona, retrieved):
    """Choose which perceived event to focus on.

    Handles both formats:
      - Original GA: {event_desc: {"curr_event": ConceptNode, ...}}
      - new_retrieve: {focal_pt: [ConceptNode, ...]}
    Returns: {"curr_event": ConceptNode} or None
    """
    candidates = []
    for event_desc, rel_ctx in retrieved.items():
        if isinstance(rel_ctx, list):
            # new_retrieve format: list of ConceptNode
            for node in rel_ctx:
                if hasattr(node, 'subject') and node.subject != persona.name:
                    candidates.append(node)
        elif isinstance(rel_ctx, dict) and "curr_event" in rel_ctx:
            # Original GA format
            if rel_ctx["curr_event"].subject != persona.name:
                candidates.append(rel_ctx["curr_event"])

    if not candidates:
        return None

    # Priority: other personas (subjects without ":" = not objects/places)
    persona_events = [n for n in candidates if ":" not in n.subject]
    if persona_events:
        return {"curr_event": random.choice(persona_events)}

    # Then non-idle events
    non_idle = [n for n in candidates if "is idle" not in n.description]
    if non_idle:
        return {"curr_event": random.choice(non_idle)}

    return {"curr_event": random.choice(candidates)}


def _should_react(persona, retrieved, personas):
    """Determine reaction mode: 'chat with X', 'wait: time', or False."""
    def lets_talk(init_persona, target_persona, retrieved):
        if (not target_persona.scratch.act_address
                or not target_persona.scratch.act_description
                or not init_persona.scratch.act_address
                or not init_persona.scratch.act_description):
            return False
        if ("sleeping" in target_persona.scratch.act_description
                or "sleeping" in init_persona.scratch.act_description):
            return False
        if init_persona.scratch.curr_time.hour == 23:
            return False
        if "<waiting>" in target_persona.scratch.act_address:
            return False
        if (target_persona.scratch.chatting_with
                or init_persona.scratch.chatting_with):
            return False
        if target_persona.name in init_persona.scratch.chatting_with_buffer:
            if init_persona.scratch.chatting_with_buffer[target_persona.name] > 0:
                return False
        return generate_decide_to_talk(init_persona, target_persona, retrieved)

    def lets_react(init_persona, target_persona, retrieved):
        if (not target_persona.scratch.act_address
                or not target_persona.scratch.act_description
                or not init_persona.scratch.act_address
                or not init_persona.scratch.act_description):
            return False
        if ("sleeping" in target_persona.scratch.act_description
                or "sleeping" in init_persona.scratch.act_description):
            return False
        if init_persona.scratch.curr_time.hour == 23:
            return False
        if "waiting" in target_persona.scratch.act_description:
            return False
        if init_persona.scratch.planned_path == []:
            return False
        if init_persona.scratch.act_address != target_persona.scratch.act_address:
            return False

        react_mode = generate_decide_to_react(init_persona, target_persona, retrieved)
        if react_mode == "1":
            wait_until = (
                (target_persona.scratch.act_start_time
                 + datetime.timedelta(minutes=target_persona.scratch.act_duration - 1))
                .strftime("%B %d, %Y, %H:%M:%S"))
            return f"wait: {wait_until}"
        return False

    if persona.scratch.chatting_with:
        return False
    if "<waiting>" in (persona.scratch.act_address or ""):
        return False

    curr_event = retrieved["curr_event"]
    if ":" not in curr_event.subject:
        if curr_event.subject in personas:
            if lets_talk(persona, personas[curr_event.subject], retrieved):
                return f"chat with {curr_event.subject}"
            return lets_react(persona, personas[curr_event.subject], retrieved)
    return False


def _create_react(persona, inserted_act, inserted_act_dur,
                  act_address, act_event, chatting_with, chat,
                  chatting_with_buffer, chatting_end_time,
                  act_pronunciatio, act_obj_description,
                  act_obj_pronunciatio, act_obj_event,
                  act_start_time=None):
    """Create a reactive action and reschedule."""
    p = persona
    min_sum = 0
    org_index = p.scratch.get_f_daily_schedule_hourly_org_index()
    for i in range(org_index):
        min_sum += p.scratch.f_daily_schedule_hourly_org[i][1]
    start_hour = int(min_sum / 60)

    curr_dur = p.scratch.f_daily_schedule_hourly_org[org_index][1]
    if curr_dur >= 120:
        end_hour = start_hour + curr_dur / 60
    elif org_index + 1 < len(p.scratch.f_daily_schedule_hourly_org):
        next_dur = p.scratch.f_daily_schedule_hourly_org[org_index + 1][1]
        end_hour = start_hour + (curr_dur + next_dur) / 60
    else:
        end_hour = start_hour + 2
    end_hour = int(end_hour)

    dur_sum = 0
    count = 0
    start_index = None
    end_index = None
    for act, dur in p.scratch.f_daily_schedule:
        if dur_sum >= start_hour * 60 and start_index is None:
            start_index = count
        if dur_sum >= end_hour * 60 and end_index is None:
            end_index = count
        dur_sum += dur
        count += 1

    if start_index is not None and end_index is not None:
        ret = generate_new_decomp_schedule(
            p, inserted_act, inserted_act_dur, start_hour, end_hour)
        p.scratch.f_daily_schedule[start_index:end_index] = ret

    p.scratch.add_new_action(
        act_address, inserted_act_dur, inserted_act,
        act_pronunciatio, act_event,
        chatting_with, chat, chatting_with_buffer, chatting_end_time,
        act_obj_description, act_obj_pronunciatio, act_obj_event,
        act_start_time)


def _chat_react(maze, persona, focused_event, reaction_mode, personas):
    """Handle chat reaction between two personas."""
    init_persona = persona
    target_persona = personas[reaction_mode[9:].strip()]

    convo, duration_min = generate_convo(maze, init_persona, target_persona)
    convo_summary = generate_convo_summary(init_persona, convo)
    inserted_act = convo_summary
    inserted_act_dur = duration_min

    act_start_time = target_persona.scratch.act_start_time
    curr_time = target_persona.scratch.curr_time
    if curr_time.second != 0:
        temp_curr_time = curr_time + datetime.timedelta(seconds=60 - curr_time.second)
        chatting_end_time = temp_curr_time + datetime.timedelta(minutes=inserted_act_dur)
    else:
        chatting_end_time = curr_time + datetime.timedelta(minutes=inserted_act_dur)

    for role, p in [("init", init_persona), ("target", target_persona)]:
        if role == "init":
            act_address = f"<persona> {target_persona.name}"
            act_event = (p.name, "chat with", target_persona.name)
            chatting_with = target_persona.name
            chatting_with_buffer = {target_persona.name: 800}
        else:
            act_address = f"<persona> {init_persona.name}"
            act_event = (p.name, "chat with", init_persona.name)
            chatting_with = init_persona.name
            chatting_with_buffer = {init_persona.name: 800}

        _create_react(
            p, inserted_act, inserted_act_dur,
            act_address, act_event, chatting_with, convo,
            chatting_with_buffer, chatting_end_time,
            "💬", None, None, (None, None, None), act_start_time)


def _wait_react(persona, reaction_mode):
    """Handle wait reaction."""
    p = persona
    inserted_act = f'waiting to start {p.scratch.act_description.split("(")[-1][:-1]}'
    end_time = datetime.datetime.strptime(reaction_mode[6:].strip(), "%B %d, %Y, %H:%M:%S")
    inserted_act_dur = ((end_time.minute + end_time.hour * 60)
                        - (p.scratch.curr_time.minute + p.scratch.curr_time.hour * 60) + 1)

    act_address = f"<waiting> {p.scratch.curr_tile[0]} {p.scratch.curr_tile[1]}"
    act_event = (p.name, "waiting to start", p.scratch.act_description.split("(")[-1][:-1])

    _create_react(
        p, inserted_act, inserted_act_dur,
        act_address, act_event, None, None, None, None,
        "⌛", None, None, (None, None, None))


# ============================================================================
# Main Plan Function
# ============================================================================

def plan(persona, maze, personas, new_day, retrieved):
    """
    Main planning function. Handles long-term planning, action determination,
    and reactive planning based on perceived events.

    Args:
        persona: Current Persona instance
        maze: Current Maze/MazeAdapter instance
        personas: dict {name: Persona} of all personas
        new_day: False, "First day", or "New day"
        retrieved: dict of retrieved memory contexts
    Returns:
        persona.scratch.act_address (target action location)
    """
    # PART 1: Long-term planning on new day
    if new_day:
        _long_term_planning(persona, new_day)

    # PART 2: Determine next action if current one is finished
    if persona.scratch.act_check_finished():
        _determine_action(persona, maze)

    # PART 3: React to perceived events
    focused_event = False
    if retrieved.keys():
        focused_event = _choose_retrieved(persona, retrieved)

    if focused_event:
        reaction_mode = _should_react(persona, focused_event, personas)
        if reaction_mode:
            if reaction_mode[:9] == "chat with":
                _chat_react(maze, persona, focused_event, reaction_mode, personas)
            elif reaction_mode[:4] == "wait":
                _wait_react(persona, reaction_mode)

    # Chat state cleanup
    if persona.scratch.act_event[1] != "chat with":
        persona.scratch.chatting_with = None
        persona.scratch.chat = None
        persona.scratch.chatting_end_time = None

    # Decrement chat buffer
    curr_buffer = persona.scratch.chatting_with_buffer
    for persona_name, buffer_count in curr_buffer.items():
        if persona_name != persona.scratch.chatting_with:
            persona.scratch.chatting_with_buffer[persona_name] -= 1

    return persona.scratch.act_address
