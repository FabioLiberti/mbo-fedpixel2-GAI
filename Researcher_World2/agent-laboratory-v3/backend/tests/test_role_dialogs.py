"""
Tests for the conversations personalised by kind of agent (cognitive/role_dialogs.py).
"""
import itertools
import os
import sys

backend_dir = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_dir)

BASE = {
    "round": 12, "accuracy": 0.64, "recent_mean": 0.64, "previous_mean": 0.63, "trend": 0.01,
    "gain": 0.04, "noise": 1.0, "epochs": 5, "demo": "pazienti anziani (over 60)",
    "next_decision_round": 15, "last_decision": None,
}
DECISION = {"round": 10, "changed": True, "option_text": "ridurre il rumore di privacy",
            "accuracy_before": 0.64, "accuracy_after": 0.84}


def test_situation():
    from cognitive import role_dialogs as R

    assert R.situation(dict(BASE)) == "stalled"
    assert R.situation(dict(BASE, trend=0.05)) == "rising"
    assert R.situation(dict(BASE, trend=-0.05)) == "falling"
    assert R.situation(dict(BASE, recent_mean=0.9, trend=-0.05)) == "good"
    print("PASS: test_situation")


def test_every_kind_of_agent_has_its_own_voice():
    from cognitive import role_dialogs as R

    # same situation, same listener: what is said depends on who speaks
    openings = {}
    for role in ("student", "professor", "researcher", "privacy_specialist", "doctor", "engineer"):
        convo = R.generate("Anna Verdi", "Bruno Neri", role, "researcher", dict(BASE))
        assert len(convo) == 4
        assert [name for name, _ in convo] == ["Anna Verdi", "Bruno Neri", "Anna Verdi", "Bruno Neri"]
        openings[role] = convo[0][1]
    assert len(set(openings.values())) == len(openings)

    # roles of the same family speak alike; a professor is addressed by title
    assert R.family("student_postdoc") == R.family("student")
    assert R.family("sw_engineer") == R.family("engineer")
    to_professor = R.generate("Marco Rossi", "Elena Conti", "student", "professor", dict(BASE))
    assert to_professor[0][1].startswith("Prof. Conti")
    to_student = R.generate("Elena Conti", "Marco Rossi", "professor", "student", dict(BASE))
    assert to_student[0][1].startswith("Marco")
    print("PASS: test_every_kind_of_agent_has_its_own_voice")


def test_dialogs_use_the_real_figures():
    from cognitive import role_dialogs as R

    ctx = dict(BASE, accuracy=0.71, recent_mean=0.70, previous_mean=0.61, trend=0.09, round=17, noise=0.7)
    text = " ".join(line for _, line in R.generate("Sofia Greco", "Marco Rossi", "researcher", "student", ctx))
    assert "71%" in text or "70%" in text or "61%" in text

    # with a decision of the consortium, the follow-up talks about it and its effect
    with_decision = R.generate("Sofia Greco", "Marco Rossi", "researcher", "student",
                               dict(ctx, last_decision=DECISION))
    assert "round 10" in with_decision[2][1]
    assert "64%" in with_decision[2][1] and "84%" in with_decision[2][1]
    # without one, it looks ahead to the next decision
    without = R.generate("Sofia Greco", "Marco Rossi", "researcher", "student", ctx)
    assert "round 10" not in without[2][1]
    print("PASS: test_dialogs_use_the_real_figures")


def test_all_combinations_are_well_formed():
    from cognitive import role_dialogs as R

    situations = ({"recent_mean": 0.9}, {"trend": 0.05}, {"trend": -0.05}, {})
    for role_a, role_b in itertools.product(R.ROLE_FAMILY, repeat=2):
        for extra in situations:
            for rnd in range(4):
                for decision in (None, DECISION):
                    ctx = dict(BASE, round=rnd, last_decision=decision, **extra)
                    for _, line in R.generate("Anna Verdi", "Bruno Neri", role_a, role_b, ctx):
                        assert line and "{" not in line and "}" not in line, line
                        assert len(line) <= 160, line
    # same round and pair: same conversation
    assert R.generate("A B", "C D", "student", "professor", dict(BASE)) == \
        R.generate("A B", "C D", "student", "professor", dict(BASE))
    print("PASS: test_all_combinations_are_well_formed")


def test_every_agent_of_a_lab_gets_to_talk():
    """Over six rounds the controller pairs every agent of a lab with every other one."""
    import tempfile
    from simulation.controller import SimulationController

    with tempfile.TemporaryDirectory() as checkpoint_root:
        controller = SimulationController(fl_checkpoint_dir=checkpoint_root)
        assert controller.initialize_model()
        fl = controller.fl_system
        pairs = set()
        for rnd in range(1, 7):
            fl.round = rnd
            fl.metrics["accuracy"].append(0.6)
            controller.fl_conversations = []
            controller._trigger_fl_conversations()
            for convo in controller.fl_conversations:
                if convo["lab_id"] == "mercatorum":
                    pairs.add(frozenset(convo["agents"]))
                    assert convo["is_llm"] is False
                    assert len(convo["dialog"]) == 4
        assert len(pairs) == 6          # 4 agents -> 6 different pairs
    print("PASS: test_every_agent_of_a_lab_gets_to_talk")


if __name__ == "__main__":
    for test in (test_situation, test_every_kind_of_agent_has_its_own_voice,
                 test_dialogs_use_the_real_figures, test_all_combinations_are_well_formed,
                 test_every_agent_of_a_lab_gets_to_talk):
        test()
