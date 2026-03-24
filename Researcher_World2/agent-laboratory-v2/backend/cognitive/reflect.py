"""
Reflect module for generative agents.
Ported from Park et al. (UIST 2023).

Generates insights and reflections based on accumulated experiences.
"""
import datetime
import logging

from .prompts.gpt_structure import get_embedding
from .prompts.run_gpt_prompt import (
    run_gpt_prompt_focal_pt,
    run_gpt_prompt_insight_and_guidance,
    run_gpt_prompt_event_triple,
    run_gpt_prompt_event_poignancy,
    run_gpt_prompt_chat_poignancy,
    run_gpt_prompt_planning_thought_on_convo,
    run_gpt_prompt_memo_on_convo,
)
from .retrieve import new_retrieve

logger = logging.getLogger(__name__)


def generate_focal_points(persona, n=3):
    """Generate focal points for reflection from recent events."""
    nodes = [[i.last_accessed, i]
             for i in persona.a_mem.seq_event + persona.a_mem.seq_thought
             if "idle" not in i.embedding_key]
    nodes = sorted(nodes, key=lambda x: x[0])
    nodes = [i for created, i in nodes]

    statements = ""
    for node in nodes[-1 * persona.scratch.importance_ele_n:]:
        statements += node.embedding_key + "\n"

    return run_gpt_prompt_focal_pt(persona, statements, n)[0]


def generate_insights_and_evidence(persona, nodes, n=5):
    """Generate insights with evidence from memory nodes."""
    statements = ""
    for count, node in enumerate(nodes):
        statements += f'{count}. {node.embedding_key}\n'

    ret = run_gpt_prompt_insight_and_guidance(persona, statements, n)[0]

    try:
        for thought, evi_raw in ret.items():
            evidence_node_id = [nodes[i].node_id for i in evi_raw]
            ret[thought] = evidence_node_id
        return ret
    except Exception as e:
        logger.warning(f"reflect generate_insights failed: {e}")
        return {"this is blank": []}


def generate_action_event_triple(act_desp, persona):
    """Generate (subject, predicate, object) triple from action description."""
    return run_gpt_prompt_event_triple(act_desp, persona)[0]


def generate_poig_score(persona, event_type, description):
    """Generate poignancy score for event/thought/chat."""
    if "is idle" in description:
        return 1

    if event_type in ("event", "thought"):
        return run_gpt_prompt_event_poignancy(persona, description)[0]
    elif event_type == "chat":
        return run_gpt_prompt_chat_poignancy(
            persona, persona.scratch.act_description)[0]
    return 1


def run_reflect(persona):
    """
    Run reflection: generate focal points, retrieve relevant nodes,
    generate insights and store as thoughts.
    """
    focal_points = generate_focal_points(persona, 3)
    retrieved = new_retrieve(persona, focal_points)

    for focal_pt, nodes in retrieved.items():
        thoughts = generate_insights_and_evidence(persona, nodes, 5)
        for thought, evidence in thoughts.items():
            created = persona.scratch.curr_time
            expiration = persona.scratch.curr_time + datetime.timedelta(days=30)
            s, p, o = generate_action_event_triple(thought, persona)
            keywords = set([s, p, o])
            thought_poignancy = generate_poig_score(persona, "thought", thought)
            thought_embedding_pair = (thought, get_embedding(thought))

            persona.a_mem.add_thought(
                created, expiration, s, p, o,
                thought, keywords, thought_poignancy,
                thought_embedding_pair, evidence)


def reflection_trigger(persona):
    """Check if reflection should be triggered based on importance accumulation."""
    if (persona.scratch.importance_trigger_curr <= 0 and
            persona.a_mem.seq_event + persona.a_mem.seq_thought):
        return True
    return False


def reset_reflection_counter(persona):
    """Reset counters used for reflection trigger."""
    persona.scratch.importance_trigger_curr = persona.scratch.importance_trigger_max
    persona.scratch.importance_ele_n = 0


def reflect(persona):
    """
    Main reflection entry point.
    Checks trigger, runs reflection, processes post-chat thoughts.
    """
    if reflection_trigger(persona):
        run_reflect(persona)
        reset_reflection_counter(persona)

    # Post-chat reflection: generate planning thoughts and memos
    if persona.scratch.chatting_end_time:
        if (persona.scratch.curr_time + datetime.timedelta(0, 10)
                == persona.scratch.chatting_end_time):
            all_utt = ""
            if persona.scratch.chat:
                for row in persona.scratch.chat:
                    all_utt += f"{row[0]}: {row[1]}\n"

            evidence = []
            last_chat = persona.a_mem.get_last_chat(persona.scratch.chatting_with)
            if last_chat:
                evidence = [last_chat.node_id]

            # Planning thought from conversation
            planning_thought = run_gpt_prompt_planning_thought_on_convo(persona, all_utt)[0]
            planning_thought = f"For {persona.scratch.name}'s planning: {planning_thought}"

            created = persona.scratch.curr_time
            expiration = persona.scratch.curr_time + datetime.timedelta(days=30)
            s, p, o = generate_action_event_triple(planning_thought, persona)
            keywords = set([s, p, o])
            thought_poignancy = generate_poig_score(persona, "thought", planning_thought)
            thought_embedding_pair = (planning_thought, get_embedding(planning_thought))

            persona.a_mem.add_thought(
                created, expiration, s, p, o,
                planning_thought, keywords, thought_poignancy,
                thought_embedding_pair, evidence)

            # Memo from conversation
            memo_thought = run_gpt_prompt_memo_on_convo(persona, all_utt)[0]
            memo_thought = f"{persona.scratch.name} {memo_thought}"

            created = persona.scratch.curr_time
            expiration = persona.scratch.curr_time + datetime.timedelta(days=30)
            s, p, o = generate_action_event_triple(memo_thought, persona)
            keywords = set([s, p, o])
            thought_poignancy = generate_poig_score(persona, "thought", memo_thought)
            thought_embedding_pair = (memo_thought, get_embedding(memo_thought))

            persona.a_mem.add_thought(
                created, expiration, s, p, o,
                memo_thought, keywords, thought_poignancy,
                thought_embedding_pair, evidence)
