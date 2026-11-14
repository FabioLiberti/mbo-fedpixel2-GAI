"""
Integration test: full stack with 9 agents, cognitive pipeline, FL rounds.
Verifies the complete data flow: LabEnvironment -> Agents -> Cognitive -> MazeAdapter -> FL.
"""
import os
import sys
import datetime

backend_dir = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_dir)


def create_stack():
    """Create full simulation stack: LabEnvironment with 9 agents + MazeAdapter."""
    from models.environment import LabEnvironment
    config_path = os.path.join(backend_dir, "config", "simulation_config.json")
    env = LabEnvironment(config_path)
    return env


def test_nine_agents_three_labs():
    """Verify 9 agents across 3 labs with correct personas."""
    env = create_stack()
    assert env.schedule.get_agent_count() == 9

    lab_counts = {}
    for agent in env.schedule.agents:
        lab_counts[agent.lab_id] = lab_counts.get(agent.lab_id, 0) + 1

    assert lab_counts == {"mercatorum": 3, "blekinge": 3, "opbg": 3}
    print("PASS: test_nine_agents_three_labs")


def test_agents_have_cognitive_memory():
    """Verify all agents have loaded 3-level memory."""
    env = create_stack()
    for agent in env.schedule.agents:
        assert agent.scratch is not None, f"{agent.name} missing scratch"
        assert agent.a_mem is not None, f"{agent.name} missing a_mem"
        assert agent.s_mem is not None, f"{agent.name} missing s_mem"
        assert agent.scratch.name is not None, f"{agent.name} missing name in scratch"
        assert agent.scratch.lab_id is not None, f"{agent.name} missing lab_id"
        assert len(agent.s_mem.tree) > 0, f"{agent.name} has empty spatial memory"
    print("PASS: test_agents_have_cognitive_memory")


def test_maze_adapter_integrated():
    """Verify MazeAdapter is accessible and agents are placed correctly."""
    env = create_stack()
    maze = env.maze_adapter

    assert maze is not None
    assert len(maze.address_tiles) > 0

    # All agents should be in their lab's workspace tiles
    for agent in env.schedule.agents:
        tile = agent.scratch.curr_tile
        assert tile is not None, f"{agent.name} has no tile"
        lab = maze.get_lab_for_tile(tile)
        assert lab == agent.lab_id, f"{agent.name} at {tile} in {lab}, expected {agent.lab_id}"
    print("PASS: test_maze_adapter_integrated")


def test_simulation_advances_time():
    """Verify simulation steps advance time consistently."""
    env = create_stack()
    t0 = env.sim_time

    for _ in range(6):  # 6 steps = 1 hour
        env.step()

    t1 = env.sim_time
    delta = t1 - t0
    assert delta == datetime.timedelta(minutes=60), f"Expected 60 min, got {delta}"

    # All agents should have matching time
    for agent in env.schedule.agents:
        assert agent.scratch.curr_time == t1, f"{agent.name} time mismatch"
    print("PASS: test_simulation_advances_time")


def test_cognitive_step_counter():
    """Verify cognitive step throttling works across steps."""
    env = create_stack()
    agent = env.personas_dict["Marco Rossi"]

    # Run steps less than interval
    for _ in range(agent.cognitive_step_interval - 1):
        env.step()

    # Counter should be building up (not 0, since it resets on interval)
    assert agent.cognitive_step_counter > 0
    print("PASS: test_cognitive_step_counter")


def test_fl_task_assignment_and_completion():
    """Verify FL task assignment works through the full agent hierarchy."""
    env = create_stack()
    from models.agents.researcher import AgentState, FLRole

    # Only assign "train" to agents whose role can handle it
    trainable_roles = [FLRole.MODEL_TRAINER, FLRole.DATA_PREPARER]
    trainable_agents = [
        a for a in env.get_lab_agents("mercatorum")
        if a.fl_role in trainable_roles
    ]
    for agent in trainable_agents:
        agent.assign_fl_task("train")

    # Trainable agents should be in FL mode
    for agent in trainable_agents:
        assert agent.state == AgentState.TRAINING_MODEL
        assert agent.fl_contributing is True

    # Run steps to complete FL task
    for agent in trainable_agents:
        agent.research_efficiency = 1.0
    for _ in range(15):
        env.step()

    # All assigned tasks should be complete
    for agent in trainable_agents:
        assert agent.fl_task is None, f"{agent.name} still has FL task"
    print("PASS: test_fl_task_assignment_and_completion")


def test_fl_event_memory_injection():
    """Verify FL events can be injected into agent associative memory."""
    env = create_stack()
    env.step()  # Advance time

    from cognitive.prompts.gpt_structure import get_embedding

    agent = env.personas_dict["Anna Lindberg"]
    initial_events = len(agent.a_mem.seq_event)

    # Inject FL event
    desc = "FL round 1 completed - global model accuracy improved to 85%"
    embedding = get_embedding(desc)
    agent.a_mem.add_event(
        agent.scratch.curr_time, None,
        agent.name, "participated in", desc,
        f"{agent.name} participated in {desc}",
        {"federated learning", "accuracy", "round"},
        8,
        (desc, embedding),
        []
    )

    assert len(agent.a_mem.seq_event) == initial_events + 1
    latest = agent.a_mem.seq_event[-1]
    assert "FL round" in latest.description
    assert latest.poignancy == 8
    print("PASS: test_fl_event_memory_injection")


def test_perceive_on_populated_maze():
    """Verify perceive() works with agents on the maze."""
    env = create_stack()
    env.step()  # Place events

    from cognitive.perceive import perceive

    agent = env.personas_dict["Marco Rossi"]
    maze = env.maze_adapter

    # perceive should not crash even if no nearby events
    events = perceive(agent, maze)
    assert isinstance(events, list)
    print("PASS: test_perceive_on_populated_maze")


def test_get_state_data_complete():
    """Verify get_state_data returns all required fields for frontend."""
    env = create_stack()
    env.step()

    required_fields = [
        "id", "name", "role", "state", "position", "lab_id",
        "act_description", "act_pronunciatio", "act_address",
        "current_schedule_task", "chatting_with",
        "reflection_count", "memory_event_count",
        "specializations", "fl_role", "fl_specialization",
        "fl_task", "fl_progress", "fl_contributing",
        "dialog", "dialog_is_llm",
    ]

    for agent in env.schedule.agents:
        data = agent.get_state_data()
        for field in required_fields:
            assert field in data, f"{agent.name} missing field: {field}"
    print("PASS: test_get_state_data_complete")


def test_collect_simulation_data():
    """Verify simulation data collection for WebSocket broadcast."""
    env = create_stack()
    env.step()

    states = env.get_agent_states()
    assert len(states) == 9

    # Verify structure
    for state in states:
        assert "name" in state
        assert "lab_id" in state
        assert "dialog" in state
    print("PASS: test_collect_simulation_data")


def test_personas_dict_accessible_by_model():
    """Verify agents can access personas_dict through model for cognitive pipeline."""
    env = create_stack()

    # This is how ResearcherAgent.step() accesses it
    personas_dict = getattr(env, 'personas_dict', {})
    assert len(personas_dict) == 9

    for name, agent in personas_dict.items():
        assert agent.name == name
        assert agent.scratch.name == name
    print("PASS: test_personas_dict_accessible_by_model")


def test_spatial_memory_matches_maze():
    """Verify agents' spatial memory is consistent with MazeAdapter."""
    env = create_stack()
    maze = env.maze_adapter

    for agent in env.schedule.agents:
        # Agent's spatial memory should know about the world
        if agent.s_mem.tree:
            world_name = list(agent.s_mem.tree.keys())[0]
            # World should match maze
            assert world_name == "fl_research_center", f"{agent.name}: {world_name}"
            # Lab should exist in spatial memory
            sectors = agent.s_mem.tree.get(world_name, {})
            assert agent.lab_id in sectors, f"{agent.name}: {agent.lab_id} not in {list(sectors.keys())}"
    print("PASS: test_spatial_memory_matches_maze")


def test_multi_step_simulation():
    """Run 30 steps (5 hours simulated) and verify stability."""
    env = create_stack()

    for i in range(30):
        env.step()

    # Should be 5 hours later (30 steps * 10 min = 300 min)
    expected_time = datetime.datetime(2026, 3, 14, 8, 0) + datetime.timedelta(minutes=300)
    assert env.sim_time == expected_time

    # All agents should still be valid
    assert env.schedule.get_agent_count() == 9
    for agent in env.schedule.agents:
        assert agent.scratch.curr_time == expected_time
        data = agent.get_state_data()
        assert data["name"] is not None
    print("PASS: test_multi_step_simulation")


if __name__ == "__main__":
    tests = [
        test_nine_agents_three_labs,
        test_agents_have_cognitive_memory,
        test_maze_adapter_integrated,
        test_simulation_advances_time,
        test_cognitive_step_counter,
        test_fl_task_assignment_and_completion,
        test_fl_event_memory_injection,
        test_perceive_on_populated_maze,
        test_get_state_data_complete,
        test_collect_simulation_data,
        test_personas_dict_accessible_by_model,
        test_spatial_memory_matches_maze,
        test_multi_step_simulation,
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

    print(f"\n{'='*60}")
    print(f"INTEGRATION TEST RESULTS: {passed}/{passed+failed} passed")
    if failed == 0:
        print("ALL INTEGRATION TESTS PASSED!")
    else:
        print(f"{failed} test(s) FAILED")
