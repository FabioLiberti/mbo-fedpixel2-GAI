"""
Test per Incremento 3: Moduli Cognitivi
Testa import, funzioni helper retrieve, e perceive con mock persona.
"""
import sys
import os
import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def test_imports():
    """Verifica che tutti i moduli si importino senza errori."""
    from cognitive.perceive import perceive, generate_poig_score
    from cognitive.retrieve import (retrieve, new_retrieve, cos_sim,
                                     normalize_dict_floats, top_highest_x_values,
                                     extract_recency, extract_importance)
    from cognitive.plan import plan, generate_wake_up_hour
    from cognitive.reflect import reflect, reflection_trigger
    from cognitive.execute import execute
    from cognitive.converse import agent_chat_v1, agent_chat_v2
    from cognitive.path_finder import path_finder, COLLISION_BLOCK_ID
    from cognitive.prompts.run_gpt_prompt import (
        run_gpt_prompt_event_poignancy,
        run_gpt_prompt_focal_pt,
        run_gpt_prompt_wake_up_hour,
    )
    print("  [OK] All imports successful")


def test_cos_sim():
    """Test cosine similarity."""
    from cognitive.retrieve import cos_sim
    import numpy as np

    a = [1, 0, 0]
    b = [1, 0, 0]
    assert abs(cos_sim(a, b) - 1.0) < 1e-6

    a = [1, 0, 0]
    b = [0, 1, 0]
    assert abs(cos_sim(a, b)) < 1e-6

    a = [1, 1, 0]
    b = [1, 0, 0]
    assert 0 < cos_sim(a, b) < 1

    # Zero vector
    assert cos_sim([0, 0, 0], [1, 0, 0]) == 0

    print("  [OK] cos_sim")


def test_normalize_dict():
    """Test dictionary normalization."""
    from cognitive.retrieve import normalize_dict_floats

    d = {'a': 1.0, 'b': 3.0, 'c': 5.0}
    result = normalize_dict_floats(d, 0, 1)
    assert abs(result['a'] - 0.0) < 1e-6
    assert abs(result['c'] - 1.0) < 1e-6
    assert 0 < result['b'] < 1

    # All same values
    d2 = {'a': 2.0, 'b': 2.0}
    result2 = normalize_dict_floats(d2, 0, 1)
    assert abs(result2['a'] - 0.5) < 1e-6

    # Empty dict
    d3 = {}
    result3 = normalize_dict_floats(d3, 0, 1)
    assert result3 == {}

    print("  [OK] normalize_dict_floats")


def test_top_highest():
    """Test top-x extraction."""
    from cognitive.retrieve import top_highest_x_values

    d = {'a': 1, 'b': 5, 'c': 3, 'd': 7}
    result = top_highest_x_values(d, 2)
    assert 'd' in result
    assert 'b' in result
    assert len(result) == 2

    print("  [OK] top_highest_x_values")


def test_path_finder():
    """Test pathfinding on simple maze."""
    from cognitive.path_finder import path_finder

    maze = [
        ['#', '#', '#', '#', '#'],
        [' ', ' ', ' ', ' ', '#'],
        ['#', '#', ' ', '#', '#'],
        ['#', ' ', ' ', ' ', '#'],
        ['#', '#', '#', '#', '#'],
    ]

    # Same position
    path = path_finder(maze, (0, 1), (0, 1), '#')
    assert path == [(0, 1)]

    # Simple path
    path = path_finder(maze, (0, 1), (3, 3), '#')
    assert len(path) > 0
    assert path[0] == (0, 1)
    assert path[-1] == (3, 3)

    print(f"  Path found: {len(path)} steps")
    print("  [OK] path_finder")


def test_stub_prompts():
    """Test stub prompt functions return reasonable defaults."""
    from cognitive.prompts.run_gpt_prompt import (
        run_gpt_prompt_event_poignancy,
        run_gpt_prompt_wake_up_hour,
        run_gpt_prompt_event_triple,
        run_gpt_prompt_daily_plan,
    )

    # Mock persona with minimal scratch
    class MockScratch:
        name = "Alice"
        curr_time = datetime.datetime(2024, 1, 15, 9, 0)
        def get_str_iss(self): return "Alice is a researcher."
        def get_str_curr_date_str(self): return "January 15, 2024"

    class MockPersona:
        scratch = MockScratch()
        name = "Alice"

    persona = MockPersona()

    score, _ = run_gpt_prompt_event_poignancy(persona, "federated learning round completed")
    assert isinstance(score, int)
    assert 1 <= score <= 10
    print(f"  Poignancy score for FL event: {score}")

    hour, _ = run_gpt_prompt_wake_up_hour(persona)
    assert isinstance(hour, int)
    assert 5 <= hour <= 11
    print(f"  Wake up hour: {hour}")

    triple, _ = run_gpt_prompt_event_triple("working on research", persona)
    assert len(triple) == 3
    print(f"  Event triple: {triple}")

    plan, _ = run_gpt_prompt_daily_plan(persona, 8)
    assert isinstance(plan, list)
    assert len(plan) > 0
    print(f"  Daily plan items: {len(plan)}")

    print("  [OK] Stub prompts")


def test_perceive_with_mock():
    """Test perceive() with mocked persona and maze."""
    from cognitive.perceive import perceive
    from cognitive.memory.associative_memory import AssociativeMemory
    from cognitive.memory.spatial_memory import MemoryTree
    from cognitive.memory.scratch import Scratch

    # Create minimal scratch
    scratch = Scratch.__new__(Scratch)
    scratch.name = "TestAgent"
    scratch.curr_tile = (5, 5)
    scratch.vision_r = 3
    scratch.att_bandwidth = 5
    scratch.retention = 5
    scratch.act_description = "working on research"
    scratch.act_event = ("TestAgent", "is", "working")
    scratch.chat = None
    scratch.curr_time = datetime.datetime(2024, 1, 15, 10, 0)
    scratch.importance_trigger_curr = 100
    scratch.importance_ele_n = 0

    # Create memory structures
    a_mem = AssociativeMemory.__new__(AssociativeMemory)
    a_mem.id_to_node = {}
    a_mem.seq_event = []
    a_mem.seq_thought = []
    a_mem.seq_chat = []
    a_mem.kw_to_event = {}
    a_mem.kw_to_thought = {}
    a_mem.kw_to_chat = {}
    a_mem.kw_strength_event = {}
    a_mem.kw_strength_thought = {}
    a_mem.embeddings = {}
    a_mem.event_count = 0
    a_mem.thought_count = 0
    a_mem.chat_count = 0

    s_mem = MemoryTree.__new__(MemoryTree)
    s_mem.tree = {}

    # Mock persona
    class MockPersona:
        pass

    persona = MockPersona()
    persona.name = "TestAgent"
    persona.scratch = scratch
    persona.a_mem = a_mem
    persona.s_mem = s_mem

    # Mock maze with no events nearby
    class MockMaze:
        def get_nearby_tiles(self, curr_tile, vision_r):
            return [(4, 4), (5, 4), (5, 5), (6, 5)]

        def access_tile(self, tile):
            return {
                "world": "lab_world",
                "sector": "mercatorum",
                "arena": "main_lab",
                "game_object": "desk",
                "events": set(),
            }

        def get_tile_path(self, tile, level):
            return "lab_world:mercatorum:main_lab"

    maze = MockMaze()
    ret_events = perceive(persona, maze)

    # With no events in tiles, should return empty
    assert isinstance(ret_events, list)
    assert len(ret_events) == 0

    # Verify spatial memory was updated
    assert "lab_world" in persona.s_mem.tree
    assert "mercatorum" in persona.s_mem.tree["lab_world"]

    print(f"  Perceived events: {len(ret_events)}")
    print(f"  Spatial memory updated: {list(persona.s_mem.tree.keys())}")
    print("  [OK] perceive() with mock")


if __name__ == "__main__":
    tests = [
        ("Imports", test_imports),
        ("Cosine Similarity", test_cos_sim),
        ("Dict Normalization", test_normalize_dict),
        ("Top Highest Values", test_top_highest),
        ("Path Finder", test_path_finder),
        ("Stub Prompts", test_stub_prompts),
        ("Perceive with Mock", test_perceive_with_mock),
    ]

    passed = 0
    failed = 0
    for name, test_fn in tests:
        print(f"\n--- {name} ---")
        try:
            test_fn()
            passed += 1
        except Exception as e:
            import traceback
            print(f"  [FAIL] {e}")
            traceback.print_exc()
            failed += 1

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)}")
    if failed == 0:
        print("ALL TESTS PASSED")
    else:
        print("SOME TESTS FAILED")
        sys.exit(1)
