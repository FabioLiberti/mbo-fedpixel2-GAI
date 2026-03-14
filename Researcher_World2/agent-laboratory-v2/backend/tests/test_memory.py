"""
Test per le strutture memoria cognitive (Incremento 1).
Verifica creazione, add, retrieve per MemoryTree, AssociativeMemory, Scratch.
"""
import sys
import os
import datetime
import json
import tempfile
import shutil

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from cognitive.memory import MemoryTree, AssociativeMemory, ConceptNode, Scratch


def test_memory_tree():
    """Test MemoryTree (spatial memory) creation and queries."""
    print("=== Test MemoryTree ===")

    # Create from dict (no file)
    mt = MemoryTree()
    mt.tree = {
        "FL Research Ecosystem": {
            "Mercatorum Lab": {
                "Server Room": ["GPU Cluster", "Network Switch"],
                "Office Area": ["Desk 1", "Desk 2", "Whiteboard"]
            },
            "Blekinge Lab": {
                "Computing Lab": ["Workstation 1", "Workstation 2"]
            }
        }
    }

    # Test get_str_accessible_sectors
    sectors = mt.get_str_accessible_sectors("FL Research Ecosystem")
    assert "Mercatorum Lab" in sectors
    assert "Blekinge Lab" in sectors
    print(f"  Sectors: {sectors}")

    # Test get_str_accessible_sector_arenas
    arenas = mt.get_str_accessible_sector_arenas("FL Research Ecosystem:Mercatorum Lab")
    assert "Server Room" in arenas
    assert "Office Area" in arenas
    print(f"  Arenas: {arenas}")

    # Test get_str_accessible_arena_game_objects
    objects = mt.get_str_accessible_arena_game_objects("FL Research Ecosystem:Mercatorum Lab:Server Room")
    assert "GPU Cluster" in objects
    print(f"  Objects: {objects}")

    # Test save/load
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        tmp_path = f.name
    mt.save(tmp_path)
    mt2 = MemoryTree(tmp_path)
    assert mt2.get_str_accessible_sectors("FL Research Ecosystem") == sectors
    os.unlink(tmp_path)

    print("  PASS")


def test_associative_memory():
    """Test AssociativeMemory creation, add, and retrieve."""
    print("=== Test AssociativeMemory ===")

    # Create empty (no file)
    am = AssociativeMemory()
    assert len(am.id_to_node) == 0

    # Add event
    now = datetime.datetime(2026, 3, 14, 10, 0, 0)
    node = am.add_event(
        created=now,
        expiration=None,
        s="Dr. Marco Rossi",
        p="completed",
        o="FL training round 3",
        description="Dr. Marco Rossi completed FL training round 3 with accuracy +0.05",
        keywords={"fl_training", "round_3", "marco rossi"},
        poignancy=7,
        embedding_pair=("event_fl_round_3", [0.1, 0.2, 0.3]),
        filling=[]
    )

    assert node.node_id == "node_1"
    assert node.type == "event"
    assert node.poignancy == 7
    print(f"  Event added: {node.spo_summary()}")

    # Add thought
    thought = am.add_thought(
        created=now,
        expiration=None,
        s="Dr. Marco Rossi",
        p="reflects",
        o="non-IID data challenge",
        description="The non-IID data distribution is causing convergence issues",
        keywords={"reflection", "non-iid", "convergence"},
        poignancy=5,
        embedding_pair=("thought_noniid", [0.4, 0.5, 0.6]),
        filling=[]
    )

    assert thought.type == "thought"
    assert thought.depth == 1
    print(f"  Thought added: {thought.spo_summary()}")

    # Add chat
    chat = am.add_chat(
        created=now,
        expiration=None,
        s="Dr. Marco Rossi",
        p="discussed",
        o="Dr. Elena Bianchi",
        description="Discussion about privacy-preserving aggregation",
        keywords={"chat", "elena bianchi", "privacy"},
        poignancy=4,
        embedding_pair=("chat_privacy", [0.7, 0.8, 0.9]),
        filling=[["Marco", "We should consider differential privacy"],
                 ["Elena", "I agree, epsilon=1.0 seems reasonable"]]
    )

    assert chat.type == "chat"
    print(f"  Chat added: {chat.spo_summary()}")

    # Test retrieval
    events = am.retrieve_relevant_events("fl_training", None, None)
    assert len(events) >= 1
    print(f"  Retrieved events for 'fl_training': {len(events)}")

    thoughts = am.retrieve_relevant_thoughts("reflection", None, None)
    assert len(thoughts) >= 1
    print(f"  Retrieved thoughts for 'reflection': {len(thoughts)}")

    last_chat = am.get_last_chat("elena bianchi")
    assert last_chat is not False
    print(f"  Last chat with Elena: {last_chat.description}")

    # Test save/load
    tmp_dir = tempfile.mkdtemp()
    am.save(tmp_dir)
    am2 = AssociativeMemory(tmp_dir)
    assert len(am2.id_to_node) == 3
    assert len(am2.seq_event) == 1
    assert len(am2.seq_thought) == 1
    assert len(am2.seq_chat) == 1
    shutil.rmtree(tmp_dir)

    print("  PASS")


def test_scratch():
    """Test Scratch (working memory) creation and methods."""
    print("=== Test Scratch ===")

    # Create empty
    s = Scratch()
    s.name = "Dr. Marco Rossi"
    s.first_name = "Marco"
    s.last_name = "Rossi"
    s.age = 32
    s.innate = "analytical, meticulous, collaborative"
    s.learned = "Expert in federated learning optimization and non-IID data handling"
    s.currently = "Working on FL model convergence at Mercatorum Lab"
    s.lifestyle = "Arrives at the lab at 8am, runs experiments until noon, cross-lab meetings in the afternoon"
    s.living_area = "FL Research Ecosystem:Mercatorum Lab:Office Area"
    s.daily_plan_req = "Focus on improving FL round convergence and prepare presentation"
    s.curr_time = datetime.datetime(2026, 3, 14, 10, 30, 0)
    s.lab_id = "mercatorum"
    s.fl_role = "model_trainer"
    s.fl_specialization = "optimization_theory"

    # Test ISS
    iss = s.get_str_iss()
    assert "Marco Rossi" in iss
    assert "analytical" in iss
    assert "federated learning" in iss
    print(f"  ISS:\n{iss}")

    # Test daily schedule
    s.f_daily_schedule = [
        ["sleeping", 480],
        ["arrive at lab and check emails", 30],
        ["run FL training experiments", 120],
        ["lunch break", 60],
        ["cross-lab meeting on model aggregation", 90],
        ["analyze convergence metrics", 120],
        ["prepare presentation", 60],
        ["wrap up and go home", 30]
    ]
    s.f_daily_schedule_hourly_org = s.f_daily_schedule.copy()

    schedule_str = s.get_str_daily_schedule_summary()
    assert "FL training" in schedule_str
    print(f"  Schedule:\n{schedule_str}")

    # Test schedule index
    idx = s.get_f_daily_schedule_index()
    print(f"  Current schedule index at 10:30: {idx}")

    # Test act_check_finished
    s.act_address = "FL Research Ecosystem:Mercatorum Lab:Server Room:GPU Cluster"
    s.act_start_time = datetime.datetime(2026, 3, 14, 10, 0, 0)
    s.act_duration = 60
    assert not s.act_check_finished()  # 10:30 < 11:00

    # Test save/load
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        tmp_path = f.name
    s.save(tmp_path)
    s2 = Scratch(tmp_path)
    assert s2.name == "Dr. Marco Rossi"
    assert s2.lab_id == "mercatorum"
    assert s2.fl_role == "model_trainer"
    assert s2.fl_specialization == "optimization_theory"
    os.unlink(tmp_path)

    print("  PASS")


if __name__ == "__main__":
    test_memory_tree()
    test_associative_memory()
    test_scratch()
    print("\n=== ALL TESTS PASSED ===")
