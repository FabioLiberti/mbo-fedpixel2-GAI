"""
Test suite for FL-adapted prompt functions (Incremento 8).
Tests stub mode returns valid values that work with MazeAdapter addresses.
"""
import os
import sys

backend_dir = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_dir)

from models.environment import LabEnvironment
from cognitive.prompts.run_gpt_prompt import (
    USE_STUBS,
    run_gpt_prompt_event_poignancy,
    run_gpt_prompt_wake_up_hour,
    run_gpt_prompt_daily_plan,
    run_gpt_prompt_action_sector,
    run_gpt_prompt_action_arena,
    run_gpt_prompt_action_game_object,
    run_gpt_prompt_pronunciatio,
    run_gpt_prompt_event_triple,
    run_gpt_prompt_focal_pt,
    run_gpt_prompt_decide_to_talk,
    run_gpt_prompt_agent_chat,
    run_gpt_prompt_task_decomp,
)


def create_env():
    config_path = os.path.join(backend_dir, "config", "simulation_config.json")
    return LabEnvironment(config_path)


def test_stubs_enabled():
    assert USE_STUBS is True, "Stubs should be enabled for testing"
    print("PASS: test_stubs_enabled")


def test_event_poignancy():
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]

    # Normal event
    score, ok = run_gpt_prompt_event_poignancy(agent, "checking email")
    assert ok
    assert 1 <= score <= 10
    assert score == 3  # mundane

    # FL event
    score2, ok2 = run_gpt_prompt_event_poignancy(agent, "model training started")
    assert ok2
    assert score2 > score  # FL events score higher
    print("PASS: test_event_poignancy")


def test_wake_up_hour():
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]
    hour, ok = run_gpt_prompt_wake_up_hour(agent)
    assert ok
    assert 5 <= hour <= 12
    print("PASS: test_wake_up_hour")


def test_daily_plan():
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]
    plan, ok = run_gpt_prompt_daily_plan(agent, 8)
    assert ok
    assert len(plan) >= 3
    # Should contain FL-related activity
    plan_text = " ".join(plan).lower()
    assert any(kw in plan_text for kw in ["federated", "model", "lab", "research"])
    print("PASS: test_daily_plan")


def test_action_sector_returns_valid_lab():
    """Action sector should return agent's own lab."""
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]
    maze = env.maze_adapter

    sector, ok = run_gpt_prompt_action_sector("analyzing data", agent, maze)
    assert ok
    assert sector == "mercatorum", f"Expected mercatorum, got {sector}"

    # Check Blekinge agent
    agent2 = env.personas_dict["Anna Lindberg"]
    sector2, ok2 = run_gpt_prompt_action_sector("reviewing results", agent2, maze)
    assert ok2
    assert sector2 == "blekinge"
    print("PASS: test_action_sector_returns_valid_lab")


def test_action_arena_keyword_mapping():
    """Action arena should map keywords to correct rooms."""
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]
    maze = env.maze_adapter

    # Lunch -> break_room
    arena, ok = run_gpt_prompt_action_arena("having lunch", agent, maze, "fl_research_center", "mercatorum")
    assert arena == "break_room", f"Expected break_room for lunch, got {arena}"

    # Meeting -> meeting_room
    arena2, ok2 = run_gpt_prompt_action_arena("attending meeting", agent, maze, "fl_research_center", "mercatorum")
    assert arena2 == "meeting_room", f"Expected meeting_room, got {arena2}"

    # Research work -> workspace
    arena3, ok3 = run_gpt_prompt_action_arena("analyzing model data", agent, maze, "fl_research_center", "mercatorum")
    assert arena3 == "workspace", f"Expected workspace, got {arena3}"

    # Server -> server_room
    arena4, ok4 = run_gpt_prompt_action_arena("deploying to server", agent, maze, "fl_research_center", "mercatorum")
    assert arena4 == "server_room", f"Expected server_room, got {arena4}"
    print("PASS: test_action_arena_keyword_mapping")


def test_action_game_object():
    """Action game object should return valid object from spatial memory."""
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]
    maze = env.maze_adapter

    obj, ok = run_gpt_prompt_action_game_object(
        "writing code", agent, maze,
        "fl_research_center:mercatorum:workspace"
    )
    assert ok
    assert "desk" in obj.lower(), f"Expected desk for coding, got {obj}"
    print("PASS: test_action_game_object")


def test_pronunciatio():
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]

    emoji, ok = run_gpt_prompt_pronunciatio("working on research", agent)
    assert ok
    assert emoji  # Should be non-empty

    emoji2, ok2 = run_gpt_prompt_pronunciatio("having lunch", agent)
    assert ok2
    print("PASS: test_pronunciatio")


def test_event_triple():
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]
    triple, ok = run_gpt_prompt_event_triple("training the FL model", agent)
    assert ok
    assert len(triple) == 3
    assert triple[0] == "Marco Rossi"
    print("PASS: test_event_triple")


def test_focal_points():
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]
    points, ok = run_gpt_prompt_focal_pt(agent, "working on FL model", n=3)
    assert ok
    assert len(points) == 3
    print("PASS: test_focal_points")


def test_decide_to_talk():
    env = create_env()
    a1 = env.personas_dict["Marco Rossi"]
    a2 = env.personas_dict["Elena Conti"]  # same lab
    result, ok = run_gpt_prompt_decide_to_talk(a1, a2, {})
    assert ok
    assert result in ["yes", "no"]
    print("PASS: test_decide_to_talk")


def test_agent_chat():
    env = create_env()
    a1 = env.personas_dict["Marco Rossi"]
    a2 = env.personas_dict["Elena Conti"]
    convo, ok = run_gpt_prompt_agent_chat(env.maze_adapter, a1, a2, "", "", "")
    assert ok
    assert len(convo) >= 2
    assert convo[0][0] == "Marco Rossi"
    print("PASS: test_agent_chat")


def test_task_decomp():
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]
    tasks, ok = run_gpt_prompt_task_decomp(agent, "training FL model", 60)
    assert ok
    assert len(tasks) >= 1
    total_dur = sum(t[1] for t in tasks)
    assert total_dur == 60, f"Expected 60 min total, got {total_dur}"
    print("PASS: test_task_decomp")


def test_full_address_chain():
    """Test that sector -> arena -> game_object produces valid MazeAdapter address."""
    env = create_env()
    agent = env.personas_dict["Marco Rossi"]
    maze = env.maze_adapter

    sector, _ = run_gpt_prompt_action_sector("working on code", agent, maze)
    world = "fl_research_center"
    arena, _ = run_gpt_prompt_action_arena("working on code", agent, maze, world, sector)
    address = f"{world}:{sector}:{arena}"
    obj, _ = run_gpt_prompt_action_game_object("working on code", agent, maze, address)

    full_address = f"{address}:{obj}"
    # Check address exists in MazeAdapter
    assert address in maze.address_tiles, f"Address {address} not in maze"
    assert full_address in maze.address_tiles, f"Full address {full_address} not in maze"
    print("PASS: test_full_address_chain")


if __name__ == "__main__":
    tests = [
        test_stubs_enabled,
        test_event_poignancy,
        test_wake_up_hour,
        test_daily_plan,
        test_action_sector_returns_valid_lab,
        test_action_arena_keyword_mapping,
        test_action_game_object,
        test_pronunciatio,
        test_event_triple,
        test_focal_points,
        test_decide_to_talk,
        test_agent_chat,
        test_task_decomp,
        test_full_address_chain,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"FAIL: {test.__name__}: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print(f"\n{'='*50}")
    print(f"Results: {passed}/{passed+failed} passed")
    if failed == 0:
        print("All tests passed!")
