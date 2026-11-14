"""
Test suite for refactored ResearcherAgent (Incremento 6).
Tests cognitive memory loading, FL methods, cognitive pipeline, and state data.
"""
import os
import sys
import datetime

# Add backend to path
backend_dir = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_dir)

from models.agents.researcher import (
    ResearcherAgent, AgentState, Specialization, FLRole, _FL_ROLE_MAP
)


class MockModel:
    """Minimal Mesa Model mock compatible with Mesa 2.4+."""
    def __init__(self):
        self.grid = None
        self.maze_adapter = None
        self.personas_dict = {}
        self.schedule = None
        self._agents = {}
        self._steps = 0
        self.running = True

    def register_agent(self, agent):
        self._agents[agent.unique_id] = agent

    def deregister_agent(self, agent):
        self._agents.pop(agent.unique_id, None)

    @property
    def agents(self):
        return list(self._agents.values())


def create_test_agent(persona_name="Marco_Rossi", lab_id="mercatorum", role="student"):
    """Helper to create a test agent with real bootstrap data."""
    model = MockModel()
    agent = ResearcherAgent(
        unique_id=1,
        model=model,
        role=role,
        specializations=[Specialization.DATA_SCIENCE],
        lab_id=lab_id,
        persona_name=persona_name,
    )
    return agent, model


def test_agent_creation():
    """Test that agent loads persona from bootstrap files."""
    agent, _ = create_test_agent()
    assert agent.name == "Marco Rossi"
    assert agent.scratch.name == "Marco Rossi"
    assert agent.scratch.lab_id == "mercatorum"
    assert agent.scratch.fl_role == "client"
    assert agent.lab_id == "mercatorum"
    print("PASS: test_agent_creation")


def test_memory_loaded():
    """Test that all 3 memory levels are loaded."""
    agent, _ = create_test_agent()
    # Scratch loaded
    assert agent.scratch.age is not None
    assert agent.scratch.innate is not None
    # Spatial memory loaded
    assert isinstance(agent.s_mem.tree, dict)
    assert len(agent.s_mem.tree) > 0
    # Associative memory loaded (starts empty, but object exists)
    assert agent.a_mem is not None
    assert hasattr(agent.a_mem, 'seq_event')
    print("PASS: test_memory_loaded")


def test_fl_role_mapping():
    """Test FL role maps correctly from bootstrap data."""
    agent, _ = create_test_agent("Marco_Rossi", "mercatorum")
    assert agent.fl_role == FLRole.MODEL_TRAINER  # "client" -> MODEL_TRAINER

    agent2, _ = create_test_agent("Elena_Conti", "mercatorum", "researcher")
    assert agent2.fl_role == FLRole.MODEL_AGGREGATOR  # "aggregator" -> MODEL_AGGREGATOR

    agent3, _ = create_test_agent("Lars_Lindberg", "blekinge", "professor_senior")
    assert agent3.fl_role == FLRole.MODEL_AGGREGATOR  # "coordinator" -> MODEL_AGGREGATOR
    print("PASS: test_fl_role_mapping")


def test_assign_fl_task():
    """Test FL task assignment and state transitions."""
    agent, _ = create_test_agent()
    agent.assign_fl_task("train")
    assert agent.fl_task == "train"
    assert agent.fl_progress == 0.0
    assert agent.state == AgentState.TRAINING_MODEL
    assert agent.fl_contributing is True
    print("PASS: test_assign_fl_task")


def test_process_fl_task():
    """Test FL task progression and completion."""
    agent, _ = create_test_agent()
    agent.research_efficiency = 1.0  # Max efficiency for fast completion
    agent.assign_fl_task("train")

    # Process until complete
    for _ in range(20):
        completed = agent.process_fl_task(delta_time=1.0)
        if completed:
            break

    assert agent.fl_task is None
    assert agent.fl_progress == 0.0
    assert agent.fl_contributing is False
    print("PASS: test_process_fl_task")


def test_is_in_fl_task():
    """Test FL task detection."""
    agent, _ = create_test_agent()
    assert agent._is_in_fl_task() is False

    agent.assign_fl_task("train")
    assert agent._is_in_fl_task() is True

    # Complete it
    agent.fl_progress = 1.0
    assert agent._is_in_fl_task() is False
    print("PASS: test_is_in_fl_task")


def test_step_fl_priority():
    """Test that FL tasks block cognitive pipeline."""
    agent, model = create_test_agent()
    agent.assign_fl_task("train")
    agent.research_efficiency = 0.5

    initial_progress = agent.fl_progress
    agent.step()
    assert agent.fl_progress > initial_progress  # Progress made
    assert agent.cognitive_step_counter == 0  # Cognitive counter NOT incremented
    print("PASS: test_step_fl_priority")


def test_step_cognitive_throttle():
    """Test that cognitive pipeline runs every N steps."""
    agent, model = create_test_agent()
    # No FL task, no maze -> cognitive won't run but counter increments
    for i in range(1, agent.cognitive_step_interval):
        agent.step()
        assert agent.cognitive_step_counter == i

    # On the Nth step, counter resets
    agent.step()
    assert agent.cognitive_step_counter == 0
    print("PASS: test_step_cognitive_throttle")


def test_set_curr_time():
    """Test time management and new day detection."""
    agent, _ = create_test_agent()
    t1 = datetime.datetime(2026, 3, 14, 9, 0)
    agent.set_curr_time(t1)
    assert agent.scratch.curr_time == t1

    # Same day -> no new_day_flag change
    agent.new_day_flag = False
    t2 = datetime.datetime(2026, 3, 14, 15, 0)
    agent.set_curr_time(t2)
    assert agent.new_day_flag is False

    # Next day -> new_day_flag set
    t3 = datetime.datetime(2026, 3, 15, 9, 0)
    agent.set_curr_time(t3)
    assert agent.new_day_flag == "New day"
    print("PASS: test_set_curr_time")


def test_sync_state_from_scratch():
    """Test state derivation from scratch description."""
    agent, _ = create_test_agent()

    agent.scratch.act_description = "having lunch"
    agent.scratch.chatting_with = None
    agent.scratch.planned_path = []
    agent._sync_state_from_scratch()
    assert agent.state == AgentState.RESTING

    agent.scratch.act_description = "attending meeting with team"
    agent._sync_state_from_scratch()
    assert agent.state == AgentState.MEETING

    agent.scratch.chatting_with = "Elena Conti"
    agent._sync_state_from_scratch()
    assert agent.state == AgentState.DISCUSSING

    agent.scratch.chatting_with = None
    agent.scratch.act_description = "analyzing data"
    agent._sync_state_from_scratch()
    assert agent.state == AgentState.WORKING
    print("PASS: test_sync_state_from_scratch")


def test_get_state_data():
    """Test state data output for frontend."""
    agent, _ = create_test_agent()
    agent.scratch.curr_time = datetime.datetime(2026, 3, 14, 10, 0)
    data = agent.get_state_data()

    assert data["id"] == 1
    assert data["name"] == "Marco Rossi"
    assert data["role"] == "student"
    assert data["lab_id"] == "mercatorum"
    assert data["fl_role"] == "model_trainer"
    assert "dialog" in data
    assert "reflection_count" in data
    assert "memory_event_count" in data
    assert "fl_specialization" in data
    print("PASS: test_get_state_data")


def test_all_twelve_agents():
    """Test that all 12 bootstrap personas can be loaded."""
    agents_config = [
        ("mercatorum", "Elena_Conti",     "professor"),
        ("mercatorum", "Luca_Bianchi",    "privacy_specialist"),
        ("mercatorum", "Marco_Rossi",     "student"),
        ("mercatorum", "Sofia_Greco",     "researcher"),
        ("blekinge",   "Lars_Lindberg",   "professor_senior"),
        ("blekinge",   "Erik_Johansson",  "student"),
        ("blekinge",   "Sara_Nilsson",    "sw_engineer"),
        ("blekinge",   "Nils_Eriksson",   "engineer"),
        ("opbg",       "Matteo_Ferri",    "doctor"),
        ("opbg",       "Marco_Romano",    "student_postdoc"),
        ("opbg",       "Lorenzo_Mancini", "engineer"),
        ("opbg",       "Giulia_Conti",    "researcher"),
    ]

    for i, (lab, persona, role) in enumerate(agents_config):
        model = MockModel()
        agent = ResearcherAgent(
            unique_id=i,
            model=model,
            role=role,
            specializations=[Specialization.DATA_SCIENCE],
            lab_id=lab,
            persona_name=persona,
        )
        assert agent.name == persona.replace("_", " ")
        assert agent.scratch.lab_id == lab

    print("PASS: test_all_twelve_agents")


if __name__ == "__main__":
    tests = [
        test_agent_creation,
        test_memory_loaded,
        test_fl_role_mapping,
        test_assign_fl_task,
        test_process_fl_task,
        test_is_in_fl_task,
        test_step_fl_priority,
        test_step_cognitive_throttle,
        test_set_curr_time,
        test_sync_state_from_scratch,
        test_get_state_data,
        test_all_twelve_agents,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"FAIL: {test.__name__}: {e}")
            failed += 1

    print(f"\n{'='*50}")
    print(f"Results: {passed}/{passed+failed} passed")
    if failed == 0:
        print("All tests passed!")
