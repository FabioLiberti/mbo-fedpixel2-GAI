"""
Perceive module for generative agents.
Ported from Park et al. (UIST 2023).

Handles perception of events and spaces in the environment.
"""
import math
import logging
from operator import itemgetter

from .prompts.gpt_structure import get_embedding
from .prompts.run_gpt_prompt import (
    run_gpt_prompt_event_poignancy,
    run_gpt_prompt_chat_poignancy,
)

logger = logging.getLogger(__name__)


def generate_poig_score(persona, event_type, description):
    """Generate poignancy (importance) score for an event."""
    if "is idle" in description:
        return 1

    if event_type == "event":
        return run_gpt_prompt_event_poignancy(persona, description)[0]
    elif event_type == "chat":
        return run_gpt_prompt_chat_poignancy(
            persona, persona.scratch.act_description)[0]
    return 1


def perceive(persona, maze):
    """
    Perceive events around the persona and save to memory.

    Perceives nearby events within vision_r radius. New events (not in
    latest retention events) are added to associative memory.

    Args:
        persona: Persona instance with s_mem, a_mem, scratch
        maze: Maze/MazeAdapter instance
    Returns:
        list of ConceptNode instances for newly perceived events
    """
    # PERCEIVE SPACE
    nearby_tiles = maze.get_nearby_tiles(persona.scratch.curr_tile,
                                         persona.scratch.vision_r)

    # Store perceived space in spatial memory tree
    for i in nearby_tiles:
        tile_info = maze.access_tile(i)
        if tile_info["world"]:
            if tile_info["world"] not in persona.s_mem.tree:
                persona.s_mem.tree[tile_info["world"]] = {}
        if tile_info["sector"]:
            if tile_info["sector"] not in persona.s_mem.tree.get(tile_info["world"], {}):
                persona.s_mem.tree.setdefault(tile_info["world"], {})[tile_info["sector"]] = {}
        if tile_info["arena"]:
            world_tree = persona.s_mem.tree.get(tile_info["world"], {})
            sector_tree = world_tree.get(tile_info["sector"], {})
            if tile_info["arena"] not in sector_tree:
                persona.s_mem.tree.setdefault(tile_info["world"], {}).setdefault(
                    tile_info["sector"], {})[tile_info["arena"]] = []
        if tile_info["game_object"]:
            arena_list = (persona.s_mem.tree
                          .get(tile_info["world"], {})
                          .get(tile_info["sector"], {})
                          .get(tile_info["arena"], []))
            if tile_info["game_object"] not in arena_list:
                arena_list.append(tile_info["game_object"])

    # PERCEIVE EVENTS
    curr_arena_path = maze.get_tile_path(persona.scratch.curr_tile, "arena")
    percept_events_set = set()
    percept_events_list = []

    for tile in nearby_tiles:
        tile_details = maze.access_tile(tile)
        if tile_details["events"]:
            if maze.get_tile_path(tile, "arena") == curr_arena_path:
                dist = math.dist(
                    [tile[0], tile[1]],
                    [persona.scratch.curr_tile[0], persona.scratch.curr_tile[1]]
                )
                for event in tile_details["events"]:
                    if event not in percept_events_set:
                        percept_events_list.append([dist, event])
                        percept_events_set.add(event)

    # Sort by distance, take att_bandwidth closest
    percept_events_list = sorted(percept_events_list, key=itemgetter(0))
    perceived_events = [event for dist, event in
                        percept_events_list[:persona.scratch.att_bandwidth]]

    # Store new events in associative memory
    ret_events = []
    for p_event in perceived_events:
        s, p, o, desc = p_event
        if not p:
            p = "is"
            o = "idle"
            desc = "idle"
        desc = f"{s.split(':')[-1]} is {desc}"
        p_event = (s, p, o)

        latest_events = persona.a_mem.get_summarized_latest_events(
            persona.scratch.retention)
        if p_event not in latest_events:
            # Manage keywords
            keywords = set()
            sub = p_event[0].split(":")[-1] if ":" in p_event[0] else p_event[0]
            obj = p_event[2].split(":")[-1] if ":" in p_event[2] else p_event[2]
            keywords.update([sub, obj])

            # Get event embedding
            desc_embedding_in = desc
            if "(" in desc:
                desc_embedding_in = desc.split("(")[1].split(")")[0].strip()
            if desc_embedding_in in persona.a_mem.embeddings:
                event_embedding = persona.a_mem.embeddings[desc_embedding_in]
            else:
                event_embedding = get_embedding(desc_embedding_in)
            event_embedding_pair = (desc_embedding_in, event_embedding)

            # Get event poignancy
            event_poignancy = generate_poig_score(persona, "event", desc_embedding_in)

            # Handle self-chat perception
            chat_node_ids = []
            if p_event[0] == persona.name and p_event[1] == "chat with":
                curr_event = persona.scratch.act_event
                if persona.scratch.act_description in persona.a_mem.embeddings:
                    chat_embedding = persona.a_mem.embeddings[persona.scratch.act_description]
                else:
                    chat_embedding = get_embedding(persona.scratch.act_description)
                chat_embedding_pair = (persona.scratch.act_description, chat_embedding)
                chat_poignancy = generate_poig_score(
                    persona, "chat", persona.scratch.act_description)
                chat_node = persona.a_mem.add_chat(
                    persona.scratch.curr_time, None,
                    curr_event[0], curr_event[1], curr_event[2],
                    persona.scratch.act_description, keywords,
                    chat_poignancy, chat_embedding_pair,
                    persona.scratch.chat)
                chat_node_ids = [chat_node.node_id]

            # Add event to memory
            ret_events.append(persona.a_mem.add_event(
                persona.scratch.curr_time, None,
                s, p, o, desc, keywords, event_poignancy,
                event_embedding_pair, chat_node_ids))
            persona.scratch.importance_trigger_curr -= event_poignancy
            persona.scratch.importance_ele_n += 1

    return ret_events
