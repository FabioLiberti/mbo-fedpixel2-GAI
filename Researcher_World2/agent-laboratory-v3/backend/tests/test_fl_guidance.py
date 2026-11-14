"""
Tests for agent-guided federated learning (cognitive/fl_guidance.py and its
use in the SimulationController).
"""
import os
import sys

backend_dir = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_dir)


def _ctx(**overrides):
    ctx = {
        "round": 10, "accuracy": 0.64, "recent_mean": 0.64, "previous_mean": 0.64,
        "trend": 0.0, "best": 0.70, "noise": 1.0, "epochs": 5, "dp_enabled": True,
        "history": [],
    }
    ctx.update(overrides)
    return ctx


def test_available_options_respect_limits():
    from cognitive import fl_guidance as G

    assert set(G.available_options(_ctx())) == set(G.OPTIONS)
    assert G.NOISE_DOWN not in G.available_options(_ctx(noise=G.NOISE_MIN))
    assert G.NOISE_UP not in G.available_options(_ctx(noise=G.NOISE_MAX))
    assert G.EPOCHS_UP not in G.available_options(_ctx(epochs=G.EPOCHS_MAX))
    assert G.EPOCHS_DOWN not in G.available_options(_ctx(epochs=G.EPOCHS_MIN))
    no_dp = G.available_options(_ctx(dp_enabled=False))
    assert G.NOISE_DOWN not in no_dp and G.NOISE_UP not in no_dp
    print("PASS: test_available_options_respect_limits")


def test_rule_based_choice():
    from cognitive import fl_guidance as G

    # stalled and not yet good: performance roles cut the noise, privacy roles
    # ask for more local training (which costs no privacy)
    assert G.rule_based_choice("professor", _ctx())["option"] == G.NOISE_DOWN
    assert G.rule_based_choice("privacy_specialist", _ctx())["option"] == G.EPOCHS_UP
    # still improving: nobody changes anything
    assert G.rule_based_choice("engineer", _ctx(trend=0.05))["option"] == G.KEEP
    # good and stable: privacy roles ask for more protection, the others keep
    good = _ctx(recent_mean=0.88, accuracy=0.88, trend=0.0)
    assert G.rule_based_choice("doctor", good)["option"] == G.NOISE_UP
    assert G.rule_based_choice("student", good)["option"] == G.KEEP
    # the rule makes a choice only: an agent's words always come from the model
    assert G.rule_based_choice("researcher", _ctx())["reason"] == ""
    print("PASS: test_rule_based_choice")


def test_rule_undoes_a_change_that_made_things_worse():
    from cognitive import fl_guidance as G

    worse = _ctx(recent_mean=0.71, history=[{
        "round": 10, "option": G.NOISE_UP, "option_text": "aumentare il rumore di privacy",
        "before": {}, "after": {}, "accuracy_before": 0.86, "accuracy_after": 0.72,
    }])
    choice = G.rule_based_choice("professor", worse)
    assert choice["option"] == G.NOISE_DOWN

    # a change that helped is not undone
    better = _ctx(trend=0.05, history=[{
        "round": 5, "option": G.NOISE_DOWN, "option_text": "ridurre il rumore di privacy",
        "before": {}, "after": {}, "accuracy_before": 0.58, "accuracy_after": 0.76,
    }])
    assert G.rule_based_choice("professor", better)["option"] == G.KEEP
    print("PASS: test_rule_undoes_a_change_that_made_things_worse")


def test_parse_llm_answer():
    from cognitive import fl_guidance as G

    options = G.available_options(_ctx())
    parsed = G.parse_llm_answer(
        "SCELTA: A\nMOTIVO: L'accuracy è ferma al 64% e il rumore la frena.", options)
    assert parsed == {"option": G.NOISE_DOWN,
                      "reason": "L'accuracy è ferma al 64% e il rumore la frena."}
    # tolerant of decoration, lower case and extra text after the letter
    parsed = G.parse_llm_answer("**Scelta: c) aumentare le epoche**\n- Motivo: Serve più addestramento locale.", options)
    assert parsed["option"] == G.EPOCHS_UP

    # unusable answers are rejected, so that the caller falls back to the rule
    assert G.parse_llm_answer("OLLAMA ERROR", options) is None
    assert G.parse_llm_answer("", options) is None
    assert G.parse_llm_answer("Penso che dovremmo ridurre il rumore.", options) is None
    assert G.parse_llm_answer("SCELTA: A\nMOTIVO: ok", options) is None          # no real reason
    assert G.parse_llm_answer("SCELTA: E\nMOTIVO: Non cambierei nulla per ora.", options[:2]) is None  # letter not offered
    print("PASS: test_parse_llm_answer")


def test_vote_and_application():
    from cognitive import fl_guidance as G

    def proposals(*options):
        return [{"option": o} for o in options]

    assert G.decide(proposals(G.NOISE_DOWN, G.NOISE_DOWN, G.EPOCHS_UP)) == G.NOISE_DOWN
    assert G.decide(proposals(G.NOISE_DOWN, G.EPOCHS_UP)) == G.KEEP            # a tie changes nothing
    assert G.decide(proposals(G.NOISE_DOWN, G.EPOCHS_UP, G.KEEP)) == G.KEEP
    assert G.decide([]) == G.KEEP

    class FakeFL:
        dp_noise_multiplier = 1.0
        local_epochs = 5

    fl = FakeFL()
    change = G.apply_option(fl, G.NOISE_DOWN)
    assert change["changed"] and change["before"]["noise"] == 1.0 and change["after"]["noise"] == 0.7
    assert G.apply_option(fl, G.KEEP)["changed"] is False
    for _ in range(20):
        G.apply_option(fl, G.NOISE_DOWN)
        G.apply_option(fl, G.EPOCHS_UP)
    assert fl.dp_noise_multiplier == G.NOISE_MIN and fl.local_epochs == G.EPOCHS_MAX
    print("PASS: test_vote_and_application")


def test_controller_applies_the_agents_decision():
    """At a guidance round the controller asks one agent per lab, applies the
    winning proposal to the FL system and every agent remembers it."""
    import tempfile
    from simulation.controller import SimulationController

    with tempfile.TemporaryDirectory() as checkpoint_root:
        controller = SimulationController(fl_checkpoint_dir=checkpoint_root)
        assert controller.initialize_model()
        fl = controller.fl_system
        assert controller.fl_guidance_enabled and controller.fl_guidance_every == 5
        assert controller.fl_guidance_rule_fallback is False

        # five rounds with a flat accuracy: the training is stalled
        fl.round = 5
        fl.metrics["accuracy"] = [0.60, 0.61, 0.60, 0.61, 0.60]
        noise_before = fl.dp_noise_multiplier

        # with the model off the agents make no proposal: nothing is decided
        controller._run_agent_guidance()
        assert controller.fl_decisions == [] and fl.dp_noise_multiplier == noise_before

        # the rest of this test exercises the vote and its application with the
        # silent rule switched on
        controller.fl_guidance_rule_fallback = True
        controller._run_agent_guidance()
        assert len(controller.fl_decisions) == 1
        # a silent choice puts no words on screen: only the decision enters the feed
        assert [item["kind"] for item in controller.fl_conversations] == ["decision"]
        decision = controller.fl_decisions[0]
        assert decision["round"] == 5
        assert len(decision["proposals"]) == 3                       # one agent per lab
        # who was asked is recorded too, so that an abstention can be shown
        assert [p["agent"] for p in decision["proposers"]] == [p["agent"] for p in decision["proposals"]]
        assert {p["lab_id"] for p in decision["proposers"]} == {"mercatorum", "blekinge", "opbg"}
        assert {p["lab_id"] for p in decision["proposals"]} == {"mercatorum", "blekinge", "opbg"}
        assert all(p["from_llm"] is False for p in decision["proposals"])   # LLM is off
        assert decision["option"] == "noise_down" and decision["changed"]
        assert fl.dp_noise_multiplier < noise_before
        assert decision["after"]["noise"] == fl.dp_noise_multiplier

        # asked once per round, and not between guidance rounds
        controller._run_agent_guidance()
        assert len(controller.fl_decisions) == 1
        fl.round = 6
        controller._run_agent_guidance()
        assert len(controller.fl_decisions) == 1

        # the decision is in every agent's memory, and it does not expire soon
        for agent in controller.model.schedule.agents:
            remembered = [n for n in agent.a_mem.seq_event if "consorzio" in str(n.description)]
            assert len(remembered) == 1, agent.name
            assert (remembered[0].expiration - remembered[0].created).days > 1000

        # three rounds later the effect of the decision is measured
        fl.round = 8
        fl.metrics["accuracy"] += [0.70, 0.74, 0.78]
        controller._update_fl_decision_effects()
        assert controller.fl_decisions[0]["accuracy_after"] == 0.74

        # a different agent speaks for each lab at the next decision
        fl.round = 10
        fl.metrics["accuracy"] += [0.79, 0.80]
        controller._run_agent_guidance()
        assert len(controller.fl_decisions) == 2
        first = {p["agent"] for p in controller.fl_decisions[0]["proposals"]}
        second = {p["agent"] for p in controller.fl_decisions[1]["proposals"]}
        assert first.isdisjoint(second)
    print("PASS: test_controller_applies_the_agents_decision")


def test_proposals_are_the_models_own_words_with_real_numbers():
    """A proposal is kept only if the model names an option and every number
    in its reason is a real figure; otherwise the agent makes no proposal."""
    from cognitive import fl_guidance as G
    from cognitive.prompts import gpt_structure

    class Agent:
        name, role, lab_id = "Elena Conti", "professor", "mercatorum"

    answers = []
    original = gpt_structure.ollama_chat_request
    gpt_structure.ollama_chat_request = lambda prompt, **kwargs: answers.pop(0)
    try:
        ctx = _ctx()
        # a usable answer: kept as it is, marked as the model's
        answers[:] = ["SCELTA: A\nMOTIVO: Propongo di ridurre il rumore perché siamo fermi al 64%."]
        p = G.propose(Agent(), ctx, use_llm=True)
        assert p["from_llm"] and p["option"] == G.NOISE_DOWN
        assert p["reason"] == "Propongo di ridurre il rumore perché siamo fermi al 64%."

        # an invented number: asked again, and the second answer is good
        answers[:] = ["SCELTA: A\nMOTIVO: Propongo di ridurre il rumore per arrivare al 90%.",
                      "SCELTA: C\nMOTIVO: Propongo più epoche locali, ora sono 5."]
        p = G.propose(Agent(), ctx, use_llm=True)
        assert p["from_llm"] and p["option"] == G.EPOCHS_UP and "90" not in p["reason"]

        # never a usable answer: no proposal, and nothing pre-written in its place
        answers[:] = ["SCELTA: A\nMOTIVO: Arriveremo al 95% di sicuro.", "Non saprei."]
        assert G.propose(Agent(), ctx, use_llm=True) is None

        # model off: no proposal either
        assert G.propose(Agent(), ctx, use_llm=False) is None
        # only with the explicit fallback a silent choice is made by the rule
        silent = G.propose(Agent(), ctx, use_llm=False, rule_fallback=True)
        assert silent["from_llm"] is False and silent["reason"] == "" and silent["option"] == G.NOISE_DOWN
    finally:
        gpt_structure.ollama_chat_request = original
    print("PASS: test_proposals_are_the_models_own_words_with_real_numbers")


if __name__ == "__main__":
    tests = [
        test_proposals_are_the_models_own_words_with_real_numbers,
        test_available_options_respect_limits,
        test_rule_based_choice,
        test_rule_undoes_a_change_that_made_things_worse,
        test_parse_llm_answer,
        test_vote_and_application,
        test_controller_applies_the_agents_decision,
    ]
    failed = 0
    for test in tests:
        try:
            test()
        except Exception as e:
            failed += 1
            print(f"FAIL: {test.__name__}: {e}")
            import traceback
            traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
