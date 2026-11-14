"""
Tests for the agents' points of view and for the rule that nothing an agent
says is pre-written (cognitive/role_dialogs.py, cognitive/converse.py).
"""
import os
import sys

backend_dir = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_dir)

CTX = {
    "round": 12, "accuracy": 0.82, "local_acc": 0.71, "global_acc": 0.80,
    "recent_mean": 0.80, "previous_mean": 0.69, "trend": 0.11, "noise": 0.7, "epochs": 5,
    "lab_id": "mercatorum", "demo": "pazienti anziani (over 60)", "next_decision_round": 15,
    "last_decision": {"round": 10, "changed": True, "option_text": "ridurre il rumore di privacy",
                      "accuracy_before": 0.64, "accuracy_after": 0.84},
}


def test_every_kind_of_agent_has_a_point_of_view():
    from cognitive import role_dialogs as R

    families = set(R.ROLE_FAMILY.values())
    assert families == set(R.ROLE_VOICE) == set(R.FAMILY_LABEL)
    assert len(set(R.ROLE_VOICE.values())) == len(families)      # each one different
    assert R.family("student_postdoc") == "student"
    assert R.family("professor_senior") == "professor"
    assert R.family("sw_engineer") == "engineer"
    assert R.family("privacy_specialist") == "privacy"
    assert R.family("unknown_role") == "researcher"
    print("PASS: test_every_kind_of_agent_has_a_point_of_view")


def test_nothing_is_said_without_the_model():
    """There are no template conversations: with the model off there is no dialog."""
    from cognitive.converse import generate_fl_conversation

    class Agent:
        def __init__(self, name, role):
            self.name, self.role, self.lab_id, self.scratch = name, role, "mercatorum", None

    convo = generate_fl_conversation(Agent("Marco Rossi", "student"), Agent("Elena Conti", "professor"),
                                     dict(CTX), use_llm=False)
    assert list(convo) == [] and convo.from_llm is False
    print("PASS: test_nothing_is_said_without_the_model")


def test_facts_given_to_the_model_are_the_real_figures():
    from cognitive.converse import build_fl_facts

    facts = build_fl_facts(dict(CTX))
    for expected in ("12", "82%", "71%", "80%", "69%", "0.70", "5", "round 10", "64%", "84%", "round 15"):
        assert expected in facts, expected
    # no decision yet: the facts do not mention one
    assert "ultima decisione" not in build_fl_facts(dict(CTX, last_decision=None))
    print("PASS: test_facts_given_to_the_model_are_the_real_figures")


def test_only_verified_turns_are_kept(monkeypatch=None):
    """The model's answer is kept up to the first turn with a number that is
    not a real figure, a sentence cut short or a ramble; fewer than two good
    turns means nothing is shown."""
    from cognitive import converse
    from cognitive.prompts import gpt_structure

    answers = []

    def fake_request(prompt, **kwargs):
        return answers.pop(0)

    original = gpt_structure.ollama_chat_request
    gpt_structure.ollama_chat_request = fake_request
    try:
        def run():
            return converse._generate_fl_convo_llm("Marco Rossi", "Elena Conti", "student", "professor", dict(CTX))

        # all good
        answers[:] = ["Marco Rossi: Perché siamo saliti al 82%?\nElena Conti: Perché il rumore è sceso a 0.70.\n"
                      "Marco Rossi: E prima eravamo al 69%?\nElena Conti: Sì, nei tre round precedenti."]
        convo = run()
        assert convo.from_llm and len(convo) == 3      # a conversation has at most three turns

        # third turn invents a number: the first two are kept
        answers[:] = ["Marco Rossi: Siamo al 82%.\nElena Conti: Con rumore a 0.70.\n"
                      "Marco Rossi: Arriveremo al 95% presto.\nElena Conti: Vedremo."]
        convo = run()
        assert convo.from_llm and len(convo) == 2
        assert all("95" not in line for _, line in convo)

        # numbers in words are checked too: 72 is not a real figure
        answers[:] = ["Marco Rossi: Il rumore è allo zero settantadue.\nElena Conti: Esatto.",
                      "Marco Rossi: Siamo al novanta per cento.\nElena Conti: Bene."]
        convo = run()
        assert not convo.from_llm and list(convo) == []

        # a real figure written in words is accepted
        answers[:] = ["Marco Rossi: Siamo al round dodici con cinque epoche.\nElena Conti: E la media è 80%."]
        convo = run()
        assert convo.from_llm and len(convo) == 2

        # a sentence cut short, an error string, an empty answer: nothing is shown
        answers[:] = ["Marco Rossi: Siamo al 82% e\nElena Conti: Bene.", "OLLAMA ERROR"]
        assert list(run()) == []
        answers[:] = ["", ""]
        assert list(run()) == []
    finally:
        gpt_structure.ollama_chat_request = original
    print("PASS: test_only_verified_turns_are_kept")


def test_every_agent_of_a_lab_gets_to_talk():
    """Round after round a different pair of the lab talks: in six rounds, all six pairs."""
    from simulation.controller import SimulationController

    agents = ["A", "B", "C", "D"]
    pairs = [SimulationController._fl_conversation_pair(agents, rnd) for rnd in range(12)]
    assert len({frozenset(p) for p in pairs[:6]}) == 6
    assert pairs[6] == list(reversed(pairs[0]))        # then who opens alternates

    # one conversation per decision cycle, after its first round: alternately
    # inside a lab and between labs
    import tempfile
    with tempfile.TemporaryDirectory() as checkpoint_root:
        controller = SimulationController(fl_checkpoint_dir=checkpoint_root)
        controller.fl_guidance_every = 5
        turns = {rnd: controller._fl_conversation_turn(rnd) for rnd in range(1, 17)}
    assert {r for r, t in turns.items() if t} == {1, 6, 11, 16}
    assert [turns[1], turns[6], turns[11], turns[16]] == ["intra", "cross", "intra", "cross"]

    # between labs the model is also given what each lab would have alone
    from cognitive.converse import build_fl_facts
    facts = build_fl_facts({
        "round": 6, "accuracy": 0.74, "cross_lab": True, "lab_id": "mercatorum↔opbg", "demo": "pazienti",
        "benefit": {"mercatorum": {"alone_common": 0.46, "federated_common": 0.74},
                    "opbg": {"alone_common": 0.54, "federated_common": 0.74}},
    })
    assert "- mercatorum: il modello che addestra da solo, senza la federazione, arriva a 46%" in facts
    assert "- opbg: il modello che addestra da solo, senza la federazione, arriva a 54%" in facts
    print("PASS: test_every_agent_of_a_lab_gets_to_talk")


if __name__ == "__main__":
    for test in (test_every_kind_of_agent_has_a_point_of_view, test_nothing_is_said_without_the_model,
                 test_facts_given_to_the_model_are_the_real_figures, test_only_verified_turns_are_kept,
                 test_every_agent_of_a_lab_gets_to_talk):
        test()
