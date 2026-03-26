"""
Converse module for generative agents.
Ported from Park et al. (UIST 2023).

Handles agent-to-agent conversation generation.
"""
import math
import datetime
import logging

from .retrieve import new_retrieve
from .prompts.gpt_structure import get_embedding
from .prompts.run_gpt_prompt import (
    run_gpt_prompt_agent_chat_summarize_ideas,
    run_gpt_prompt_agent_chat_summarize_relationship,
    run_gpt_prompt_agent_chat,
    run_gpt_generate_iterative_chat_utt,
    run_gpt_prompt_event_triple,
    run_gpt_prompt_event_poignancy,
    run_gpt_prompt_chat_poignancy,
    run_gpt_prompt_summarize_ideas,
    run_gpt_prompt_generate_next_convo_line,
    run_gpt_prompt_generate_whisper_inner_thought,
)

logger = logging.getLogger(__name__)


def generate_agent_chat_summarize_ideas(init_persona, target_persona,
                                        retrieved, curr_context):
    """Summarize ideas from retrieved memories for conversation context."""
    all_embedding_keys = []
    for key, val in retrieved.items():
        for i in val:
            all_embedding_keys.append(i.embedding_key)
    all_embedding_key_str = "\n".join(all_embedding_keys)

    try:
        return run_gpt_prompt_agent_chat_summarize_ideas(
            init_persona, target_persona,
            all_embedding_key_str, curr_context)[0]
    except Exception as e:
        logger.warning(f"summarize_chat_ideas failed: {e}")
        return ""


def generate_summarize_agent_relationship(init_persona, target_persona, retrieved):
    """Summarize the relationship between two agents."""
    all_embedding_keys = []
    for key, val in retrieved.items():
        for i in val:
            all_embedding_keys.append(i.embedding_key)
    all_embedding_key_str = "\n".join(all_embedding_keys)

    return run_gpt_prompt_agent_chat_summarize_relationship(
        init_persona, target_persona, all_embedding_key_str)[0]


def generate_agent_chat(maze, init_persona, target_persona,
                        curr_context, init_summ_idea, target_summ_idea):
    """Generate a full conversation between two agents (batch mode)."""
    return run_gpt_prompt_agent_chat(
        maze, init_persona, target_persona,
        curr_context, init_summ_idea, target_summ_idea)[0]


def agent_chat_v1(maze, init_persona, target_persona):
    """Chat version 1: batch generation approach."""
    curr_context = (
        f"{init_persona.scratch.name} "
        f"was {init_persona.scratch.act_description} "
        f"when {init_persona.scratch.name} "
        f"saw {target_persona.scratch.name} "
        f"in the middle of {target_persona.scratch.act_description}.\n"
    )
    curr_context += (
        f"{init_persona.scratch.name} "
        f"is thinking of initiating a conversation with "
        f"{target_persona.scratch.name}."
    )

    summarized_ideas = []
    part_pairs = [(init_persona, target_persona),
                  (target_persona, init_persona)]
    for p_1, p_2 in part_pairs:
        focal_points = [f"{p_2.scratch.name}"]
        retrieved = new_retrieve(p_1, focal_points, 50)
        relationship = generate_summarize_agent_relationship(p_1, p_2, retrieved)
        focal_points = [f"{relationship}",
                        f"{p_2.scratch.name} is {p_2.scratch.act_description}"]
        retrieved = new_retrieve(p_1, focal_points, 25)
        summarized_idea = generate_agent_chat_summarize_ideas(
            p_1, p_2, retrieved, curr_context)
        summarized_ideas.append(summarized_idea)

    return generate_agent_chat(
        maze, init_persona, target_persona,
        curr_context, summarized_ideas[0], summarized_ideas[1])


def _retrieve_fl_insights_for_convo(persona, target_name):
    """Retrieve FL insights from long-term memory relevant to a conversation.

    Returns a short string with up to 2 recent insights (thoughts) about FL
    that can enrich conversation context.
    """
    spec = persona.scratch.fl_specialization or "federated learning"
    focal_points = [spec, target_name]
    try:
        retrieved = new_retrieve(persona, focal_points, n_count=5)
    except Exception:
        return ""

    insights = []
    for _fp, nodes in retrieved.items():
        for node in nodes:
            if node.type == "thought" and node.embedding_key:
                insights.append(node.embedding_key)
    # Deduplicate
    seen = set()
    unique = []
    for ins in insights:
        if ins not in seen:
            seen.add(ins)
            unique.append(ins)
    return "\n".join(unique[:2])


# Minimum number of exchanges before "end" is honored.
# This prevents overly short conversations (1-2 turns).
_MIN_CHAT_TURNS = 3


def generate_one_utterance(maze, init_persona, target_persona, retrieved, curr_chat):
    """Generate a single utterance in a conversation."""
    spec_init = init_persona.scratch.fl_specialization or "FL"
    spec_target = target_persona.scratch.fl_specialization or "FL"
    curr_context = (
        f"{init_persona.scratch.name} ({spec_init}) "
        f"stava {init_persona.scratch.act_description} "
        f"quando ha visto {target_persona.scratch.name} ({spec_target}) "
        f"che stava {target_persona.scratch.act_description}.\n"
    )
    curr_context += (
        f"{init_persona.scratch.name} "
        f"avvia una conversazione con "
        f"{target_persona.scratch.name} sul progetto FL."
    )

    x = run_gpt_generate_iterative_chat_utt(
        maze, init_persona, target_persona,
        retrieved, curr_context, curr_chat)[0]

    utt = x["utterance"]
    end = x["end"]

    # Enforce minimum turns: do not end before _MIN_CHAT_TURNS exchanges
    if end and len(curr_chat) < _MIN_CHAT_TURNS:
        end = False

    return utt, end


def agent_chat_v2(maze, init_persona, target_persona):
    """Chat version 2: iterative turn-by-turn dialogue.

    Enriched with FL insights from long-term memory and enforces a minimum
    of _MIN_CHAT_TURNS exchanges before allowing the conversation to end.
    """
    curr_chat = []

    # Retrieve FL insights to enrich the conversation context
    insights_init = _retrieve_fl_insights_for_convo(
        init_persona, target_persona.scratch.name)
    insights_target = _retrieve_fl_insights_for_convo(
        target_persona, init_persona.scratch.name)

    for _ in range(8):
        # Init persona's turn
        focal_points = [f"{target_persona.scratch.name}"]
        # Add FL insights as extra focal points for richer retrieval
        if insights_init:
            focal_points.append(insights_init.split("\n")[0][:80])
        retrieved = new_retrieve(init_persona, focal_points, 50)
        relationship = generate_summarize_agent_relationship(
            init_persona, target_persona, retrieved)
        last_chat = "\n".join([": ".join(i) for i in curr_chat[-4:]])
        if last_chat:
            focal_points = [
                f"{relationship}",
                f"{target_persona.scratch.name} sta {target_persona.scratch.act_description}",
                last_chat
            ]
        else:
            focal_points = [
                f"{relationship}",
                f"{target_persona.scratch.name} sta {target_persona.scratch.act_description}"
            ]
        if insights_init:
            focal_points.append(insights_init.split("\n")[0][:80])
        retrieved = new_retrieve(init_persona, focal_points, 15)
        utt, end = generate_one_utterance(
            maze, init_persona, target_persona, retrieved, curr_chat)
        curr_chat.append([init_persona.scratch.name, utt])
        if end:
            break

        # Target persona's turn
        focal_points = [f"{init_persona.scratch.name}"]
        if insights_target:
            focal_points.append(insights_target.split("\n")[0][:80])
        retrieved = new_retrieve(target_persona, focal_points, 50)
        relationship = generate_summarize_agent_relationship(
            target_persona, init_persona, retrieved)
        last_chat = "\n".join([": ".join(i) for i in curr_chat[-4:]])
        if last_chat:
            focal_points = [
                f"{relationship}",
                f"{init_persona.scratch.name} sta {init_persona.scratch.act_description}",
                last_chat
            ]
        else:
            focal_points = [
                f"{relationship}",
                f"{init_persona.scratch.name} sta {init_persona.scratch.act_description}"
            ]
        if insights_target:
            focal_points.append(insights_target.split("\n")[0][:80])
        retrieved = new_retrieve(target_persona, focal_points, 15)
        utt, end = generate_one_utterance(
            maze, target_persona, init_persona, retrieved, curr_chat)
        curr_chat.append([target_persona.scratch.name, utt])
        if end:
            break

    return curr_chat
