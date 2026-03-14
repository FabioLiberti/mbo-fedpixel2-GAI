"""
Execute module for generative agents.
Ported from Park et al. (UIST 2023).

Handles action execution and pathfinding to target locations.
"""
import random
import logging

from .path_finder import path_finder, COLLISION_BLOCK_ID

logger = logging.getLogger(__name__)


def execute(persona, maze, personas, plan):
    """
    Execute an action plan by computing movement path.

    Args:
        persona: Current Persona instance
        maze: Maze/MazeAdapter instance
        personas: dict of all personas {name: Persona}
        plan: String address of action target
              e.g., "world:sector:arena:game_object"
              Special: "<persona> Name", "<waiting> x y", "<random>"
    Returns:
        (next_tile, pronunciatio, description) tuple
    """
    if "<random>" in plan and persona.scratch.planned_path == []:
        persona.scratch.act_path_set = False

    if not persona.scratch.act_path_set:
        target_tiles = None

        if "<persona>" in plan:
            # Persona-persona interaction: move toward target persona
            target_name = plan.split("<persona>")[-1].strip()
            if target_name in personas:
                target_p_tile = personas[target_name].scratch.curr_tile
                potential_path = path_finder(
                    maze.collision_maze,
                    persona.scratch.curr_tile,
                    target_p_tile,
                    COLLISION_BLOCK_ID)
                if len(potential_path) <= 2:
                    target_tiles = [potential_path[0]]
                else:
                    mid = int(len(potential_path) / 2)
                    potential_1 = path_finder(
                        maze.collision_maze,
                        persona.scratch.curr_tile,
                        potential_path[mid],
                        COLLISION_BLOCK_ID)
                    potential_2 = path_finder(
                        maze.collision_maze,
                        persona.scratch.curr_tile,
                        potential_path[mid + 1],
                        COLLISION_BLOCK_ID)
                    if len(potential_1) <= len(potential_2):
                        target_tiles = [potential_path[mid]]
                    else:
                        target_tiles = [potential_path[mid + 1]]
            else:
                target_tiles = [persona.scratch.curr_tile]

        elif "<waiting>" in plan:
            x = int(plan.split()[1])
            y = int(plan.split()[2])
            target_tiles = [[x, y]]

        elif "<random>" in plan:
            plan_addr = ":".join(plan.split(":")[:-1])
            if hasattr(maze, 'address_tiles') and plan_addr in maze.address_tiles:
                target_tiles = random.sample(list(maze.address_tiles[plan_addr]), 1)
            else:
                target_tiles = [list(persona.scratch.curr_tile)]

        else:
            # Default: go to action location
            if hasattr(maze, 'address_tiles') and plan in maze.address_tiles:
                target_tiles = maze.address_tiles[plan]
            else:
                target_tiles = [list(persona.scratch.curr_tile)]

        # Sample a few target tiles
        if target_tiles:
            if len(target_tiles) < 4:
                target_tiles = random.sample(list(target_tiles), len(target_tiles))
            else:
                target_tiles = random.sample(list(target_tiles), 4)

        # Avoid tiles occupied by other personas
        if target_tiles and hasattr(maze, 'access_tile'):
            persona_name_set = set(personas.keys())
            new_target_tiles = []
            for tile in target_tiles:
                try:
                    curr_event_set = maze.access_tile(tile).get("events", set())
                    pass_curr_tile = any(j[0] in persona_name_set for j in curr_event_set)
                    if not pass_curr_tile:
                        new_target_tiles.append(tile)
                except Exception:
                    new_target_tiles.append(tile)
            if new_target_tiles:
                target_tiles = new_target_tiles

        # Find shortest path to closest target tile
        if target_tiles:
            curr_tile = persona.scratch.curr_tile
            closest_target_tile = None
            path = None
            for tile in target_tiles:
                try:
                    curr_path = path_finder(
                        maze.collision_maze,
                        curr_tile, tile,
                        COLLISION_BLOCK_ID)
                    if closest_target_tile is None or len(curr_path) < len(path):
                        closest_target_tile = tile
                        path = curr_path
                except Exception:
                    continue

            if path:
                persona.scratch.planned_path = path[1:]
            else:
                persona.scratch.planned_path = []
        else:
            persona.scratch.planned_path = []

        persona.scratch.act_path_set = True

    # Take next step
    ret = persona.scratch.curr_tile
    if persona.scratch.planned_path:
        ret = persona.scratch.planned_path[0]
        persona.scratch.planned_path = persona.scratch.planned_path[1:]

    description = f"{persona.scratch.act_description}"
    if persona.scratch.act_address:
        description += f" @ {persona.scratch.act_address}"

    execution = ret, persona.scratch.act_pronunciatio, description
    return execution
