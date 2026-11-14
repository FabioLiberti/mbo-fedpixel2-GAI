"""
Test suite for refactored LabEnvironment and SimulationController (Incremento 7).
Tests agent creation, MazeAdapter integration, simulation stepping, and FL event injection.
"""
import os
import sys
import datetime

# Add backend to path
backend_dir = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_dir)


def test_environment_creation():
    """Test LabEnvironment creates 9 agents with MazeAdapter."""
    from models.environment import LabEnvironment

    config_path = os.path.join(backend_dir, "config", "simulation_config.json")
    env = LabEnvironment(config_path)

    assert env.schedule.get_agent_count() == 9
    assert env.maze_adapter is not None
    assert len(env.personas_dict) == 9
    assert env.sim_time is not None
    print("PASS: test_environment_creation")


def test_agents_placed_in_labs():
    """Test that agents are placed in correct lab tiles."""
    from models.environment import LabEnvironment

    config_path = os.path.join(backend_dir, "config", "simulation_config.json")
    env = LabEnvironment(config_path)

    for agent in env.schedule.agents:
        assert agent.pos is not None, f"Agent {agent.name} has no position"
        assert agent.scratch.curr_tile is not None, f"Agent {agent.name} has no curr_tile"
        # Agent should be in its own lab's tiles
        lab = env.maze_adapter.get_lab_for_tile(agent.scratch.curr_tile)
        assert lab == agent.lab_id, f"Agent {agent.name} in {lab}, expected {agent.lab_id}"

    print("PASS: test_agents_placed_in_labs")


def test_personas_dict():
    """Test personas_dict maps names to agents."""
    from models.environment import LabEnvironment

    config_path = os.path.join(backend_dir, "config", "simulation_config.json")
    env = LabEnvironment(config_path)

    assert "Marco Rossi" in env.personas_dict
    assert "Anna Lindberg" in env.personas_dict
    assert "Giulia Romano" in env.personas_dict

    marco = env.personas_dict["Marco Rossi"]
    assert marco.lab_id == "mercatorum"
    assert marco.scratch.name == "Marco Rossi"
    print("PASS: test_personas_dict")


def test_simulation_step():
    """Test that model.step() advances simulation time."""
    from models.environment import LabEnvironment

    config_path = os.path.join(backend_dir, "config", "simulation_config.json")
    env = LabEnvironment(config_path)

    t0 = env.sim_time
    env.step()
    t1 = env.sim_time

    # Each step = 10 minutes
    assert t1 - t0 == datetime.timedelta(minutes=10)
    # Agents should have updated time
    for agent in env.schedule.agents:
        assert agent.scratch.curr_time == t1
    print("PASS: test_simulation_step")


def test_get_agent_states():
    """Test that agent states contain cognitive fields."""
    from models.environment import LabEnvironment

    config_path = os.path.join(backend_dir, "config", "simulation_config.json")
    env = LabEnvironment(config_path)

    states = env.get_agent_states()
    assert len(states) == 9

    for state in states:
        assert "name" in state
        assert "lab_id" in state
        assert "fl_role" in state
        assert "act_description" in state
        assert "reflection_count" in state
        assert "dialog" in state
    print("PASS: test_get_agent_states")


def test_get_lab_agents():
    """Test lab agent filtering."""
    from models.environment import LabEnvironment

    config_path = os.path.join(backend_dir, "config", "simulation_config.json")
    env = LabEnvironment(config_path)

    mercatorum_agents = env.get_lab_agents("mercatorum")
    assert len(mercatorum_agents) == 3
    for a in mercatorum_agents:
        assert a.lab_id == "mercatorum"

    blekinge_agents = env.get_lab_agents("blekinge")
    assert len(blekinge_agents) == 3

    opbg_agents = env.get_lab_agents("opbg")
    assert len(opbg_agents) == 3
    print("PASS: test_get_lab_agents")


def test_fl_event_injection():
    """Test that FL events can be injected into agent memory."""
    from models.environment import LabEnvironment

    config_path = os.path.join(backend_dir, "config", "simulation_config.json")
    env = LabEnvironment(config_path)
    env.step()  # Advance time so agents have curr_time

    agent = env.personas_dict["Marco Rossi"]
    initial_events = len(agent.a_mem.seq_event)

    # Simulate FL event injection (same logic as controller)
    from cognitive.prompts.gpt_structure import get_embedding

    desc = "FL round 1 local model training"
    embedding = get_embedding(desc)
    agent.a_mem.add_event(
        agent.scratch.curr_time, None,
        agent.name, "participated in", desc,
        f"{agent.name} participated in {desc}",
        {"federated learning", "training"},
        7,  # poignancy
        (desc, embedding),
        []
    )

    assert len(agent.a_mem.seq_event) == initial_events + 1
    latest = agent.a_mem.seq_event[-1]
    assert "FL round" in latest.description
    print("PASS: test_fl_event_injection")


def test_reset_opens_new_fl_run():
    """Reset restarts FL from round 0 in a new run; a restart resumes the current run."""
    import tempfile
    from simulation.controller import SimulationController

    with tempfile.TemporaryDirectory() as checkpoint_root:
        controller = SimulationController(fl_checkpoint_dir=checkpoint_root)
        assert controller.initialize_model()
        first_run = controller.fl_run_id
        assert first_run

        for _ in range(2):
            updates, metrics = controller._collect_client_updates()
            controller.fl_system.aggregate_models(updates, client_metrics=metrics)
        assert controller.fl_system.round == 2
        assert controller.fl_system.dp_epsilon_spent > 0

        # Backend restart: a new controller resumes the same run
        restarted = SimulationController(fl_checkpoint_dir=checkpoint_root)
        assert restarted.initialize_model()
        assert restarted.fl_run_id == first_run
        assert restarted.fl_system.round == 2

        # Reset: new run, FL back to round 0, the old checkpoint stays on disk
        assert restarted.reset_simulation()
        second_run = restarted.fl_run_id
        assert second_run != first_run
        assert restarted.fl_system.round == 0
        assert restarted.fl_system.dp_epsilon_spent == 0.0
        assert restarted.fl_system.metrics["accuracy"] == []
        assert not restarted.fl_system.check_convergence()["budget_exhausted"]
        assert os.path.exists(
            os.path.join(checkpoint_root, "runs", first_run, "fl_state.json")
        )

        # Restart after a reset resumes the new run, not the old one
        after_reset = SimulationController(fl_checkpoint_dir=checkpoint_root)
        assert after_reset.initialize_model()
        assert after_reset.fl_run_id == second_run
        assert after_reset.fl_system.round == 0

    print("PASS: test_reset_opens_new_fl_run")


def test_stop_start_keeps_single_loop():
    """Stop + start while a step is still blocked must not leave two loops stepping."""
    import tempfile
    import threading
    import time
    from simulation.controller import SimulationController

    with tempfile.TemporaryDirectory() as checkpoint_root:
        controller = SimulationController(fl_checkpoint_dir=checkpoint_root)
        assert controller.initialize_model()
        controller.stop_join_timeout = 0.1

        counters = {"active": 0, "max_active": 0, "calls": 0}
        guard = threading.Lock()

        def slow_step(max_workers=4):
            # Stands in for a cognitive cycle waiting on a slow LLM call
            with guard:
                counters["active"] += 1
                counters["calls"] += 1
                counters["max_active"] = max(counters["max_active"], counters["active"])
            time.sleep(0.6)
            with guard:
                counters["active"] -= 1

        controller.model.step_parallel = slow_step

        assert controller.start_simulation()
        controller.fl_enabled = False
        time.sleep(0.2)  # the first step is now in progress
        first_thread = controller.simulation_thread

        assert controller.stop_simulation()  # returns while the step is blocked
        assert first_thread.is_alive()

        assert controller.start_simulation()
        controller.fl_enabled = False
        second_thread = controller.simulation_thread
        time.sleep(2.0)

        assert not first_thread.is_alive(), "the stopped loop came back to life"
        assert second_thread.is_alive()
        assert counters["max_active"] == 1, "two loops stepped the model at once"
        assert counters["calls"] >= 2, "the new loop is not stepping"

        assert controller.stop_simulation()
        second_thread.join(timeout=3.0)
        assert not second_thread.is_alive()

    print("PASS: test_stop_start_keeps_single_loop")


if __name__ == "__main__":
    tests = [
        test_environment_creation,
        test_agents_placed_in_labs,
        test_personas_dict,
        test_simulation_step,
        test_get_agent_states,
        test_get_lab_agents,
        test_fl_event_injection,
        test_reset_opens_new_fl_run,
        test_stop_start_keeps_single_loop,
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
