"""
Tests for the agents' thoughts written by the model (cognitive/thoughts.py).
"""
import os
import sys

backend_dir = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_dir)

FACTS = "- round completati: 13\n- accuracy del modello globale sul test comune: 84%\n- rumore di privacy applicato: 0.70"


class _Scratch:
    def __init__(self, spec):
        self.fl_specialization = spec


class _Agent:
    def __init__(self, name, role, spec):
        self.name, self.role, self.lab_id, self.scratch = name, role, "mercatorum", _Scratch(spec)


LAB = [_Agent("Elena Conti", "professor", "privacy_economics"),
       _Agent("Luca Bianchi", "privacy_specialist", "privacy_engineering"),
       _Agent("Marco Rossi", "student", "business_intelligence")]


def test_prompt_gives_each_agent_its_point_of_view():
    from cognitive import thoughts as T

    prompt = T.build_prompt(LAB, FACTS)
    assert FACTS in prompt
    for line in ("Elena Conti, professore, si occupa di privacy economics",
                 "Luca Bianchi, specialista di privacy, si occupa di privacy engineering",
                 "Marco Rossi, studente, si occupa di business intelligence"):
        assert line in prompt, line
    print("PASS: test_prompt_gives_each_agent_its_point_of_view")


def test_only_verified_thoughts_are_kept():
    from cognitive import thoughts as T

    answer = (
        "Elena Conti: Voglio prove prima di cambiare ancora il rumore.\n"
        "Luca Bianchi: Con rumore a 0.70 i dati restano protetti?\n"
        "Marco Rossi: Arriveremo al 95% entro domani.\n"           # invented number
        "Giulia Verdi: Non sono di questo laboratorio.\n"          # not one of the agents
    )
    thoughts = T.parse(answer, LAB, FACTS)
    assert thoughts == {
        "Elena Conti": "Voglio prove prima di cambiare ancora il rumore.",
        "Luca Bianchi": "Con rumore a 0.70 i dati restano protetti?",
    }

    # too long, or cut by the length limit at the end of the answer: not shown
    long_thought = "Elena Conti: " + " ".join(["parola"] * 20) + "."
    assert T.parse(long_thought, LAB, FACTS) == {}
    assert T.parse("Elena Conti: Il modello sta migliorando e io", LAB, FACTS) == {}
    wide = "Elena Conti: " + " ".join(["approfondimento"] * 10) + "."      # few words, too many characters
    assert T.parse(wide, LAB, FACTS) == {}
    # first names are enough to attribute a thought; an error string gives nothing
    assert T.parse("Marco: Perché siamo al 84%?", LAB, FACTS) == {"Marco Rossi": "Perché siamo al 84%?"}
    assert T.parse("OLLAMA ERROR", LAB, FACTS) == {}
    assert T.parse("", LAB, FACTS) == {}
    print("PASS: test_only_verified_thoughts_are_kept")


def test_no_thoughts_without_the_model():
    """The controller asks for thoughts only with the model on."""
    import tempfile
    from simulation.controller import SimulationController

    with tempfile.TemporaryDirectory() as checkpoint_root:
        controller = SimulationController(fl_checkpoint_dir=checkpoint_root)
        assert controller.initialize_model()
        controller.fl_system.round = 3
        controller.fl_system.metrics["accuracy"] = [0.5, 0.6, 0.6]
        controller._trigger_agent_thoughts()
        for agent in controller.model.schedule.agents:
            assert agent.current_thought == "" and agent.thought_round == 0
            assert agent.get_state_data()["thought"] == ""
    print("PASS: test_no_thoughts_without_the_model")


if __name__ == "__main__":
    test_prompt_gives_each_agent_its_point_of_view()
    test_only_verified_thoughts_are_kept()
    test_no_thoughts_without_the_model()
