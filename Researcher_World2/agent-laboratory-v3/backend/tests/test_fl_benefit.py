"""
Tests for the benefit of the federation: the global model against the model
each lab trains alone (fl/federated.py), and the summary sent to the interface.
"""
import os
import sys
import tempfile

backend_dir = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_dir)

LABS = ["mercatorum", "blekinge", "opbg"]


def _run(rounds, checkpoint_dir, with_reference=True, seed=3):
    from fl.federated import FederatedLearningSystem, generate_client_data

    fl = FederatedLearningSystem(seed=seed, checkpoint_dir=checkpoint_dir)
    for lab in LABS:
        fl.register_client(lab)
    if not with_reference:
        fl.local_only_models = {}
    for _ in range(rounds):
        updates, metrics = {}, {}
        for lab in LABS:
            m, w = fl.train_client(lab, *generate_client_data(lab, n_samples=120, seed=42 + fl.round))
            updates[lab], metrics[lab] = w, m
        fl.aggregate_models(updates, client_metrics=metrics)
        fl.update_client_models()
    return fl


def test_reference_models_do_not_change_the_federation():
    """The models the labs train alone are a measurement: the federation gives
    exactly the same results with and without them."""
    with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
        with_ref = _run(4, a, with_reference=True)
        without = _run(4, b, with_reference=False)
        assert with_ref.metrics["accuracy"] == without.metrics["accuracy"]
        assert without.metrics["federation_benefit"] == [{}, {}, {}, {}]
    print("PASS: test_reference_models_do_not_change_the_federation")


def test_benefit_compares_on_held_out_patients():
    import numpy as np
    from fl.federated import lab_partition_sizes

    with tempfile.TemporaryDirectory() as tmp:
        fl = _run(3, tmp)
        sizes = lab_partition_sizes()
        assert len(fl.metrics["federation_benefit"]) == 3
        latest = fl.metrics["federation_benefit"][-1]
        assert set(latest) == set(LABS)
        common = sum(s["test"] for s in sizes.values())
        for lab in LABS:
            b = latest[lab]
            assert b["own_test_rows"] == sizes[lab]["test"] and b["train_rows"] == sizes[lab]["train"]
            assert b["common_test_rows"] == common
            # the federated figure on everyone's patients is the accuracy of the federation
            assert b["federated_common"] == fl.metrics["accuracy"][-1]
            for key in ("alone_own", "federated_own", "alone_common"):
                assert 0.0 <= b[key] <= 1.0
            # the lab's solo model is its own: never replaced by the global one
            assert any(not np.array_equal(x, y) for x, y in zip(fl.local_only_models[lab], fl.global_model))
        # each lab's patients are in its own age range
        assert sizes["mercatorum"]["age_min"] >= 60 and sizes["opbg"]["age_max"] < 50
        assert 50 <= sizes["blekinge"]["age_min"] and sizes["blekinge"]["age_max"] < 60
    print("PASS: test_benefit_compares_on_held_out_patients")


def test_reference_models_survive_a_restart():
    import numpy as np
    from fl.federated import FederatedLearningSystem

    with tempfile.TemporaryDirectory() as tmp:
        fl = _run(3, tmp)
        resumed = FederatedLearningSystem(seed=99, checkpoint_dir=tmp)
        assert resumed.load_checkpoint() and resumed.round == 3
        assert resumed.metrics["federation_benefit"] == fl.metrics["federation_benefit"]
        for lab in LABS:
            for x, y in zip(resumed.local_only_models[lab], fl.local_only_models[lab]):
                assert np.array_equal(x, y)

        # a run saved without the solo models continues without them: a
        # reference started later would have trained for fewer rounds
        os.remove(os.path.join(tmp, "local_only_weights.npz"))
        old = FederatedLearningSystem(seed=99, checkpoint_dir=tmp)
        for lab in LABS:
            old.register_client(lab)
        assert old.load_checkpoint()
        assert old.local_only_models == {} and old._evaluate_federation_benefit() == {}
    print("PASS: test_reference_models_survive_a_restart")


def test_controller_sends_the_federation_summary():
    from simulation.controller import SimulationController

    with tempfile.TemporaryDirectory() as checkpoint_root:
        controller = SimulationController(fl_checkpoint_dir=checkpoint_root)
        assert controller.initialize_model()
        view = controller._federation_view()
        assert set(view["labs"]) == set(LABS)
        assert view["baseline_available"] is True
        assert view["common_test_rows"] == sum(lab["test_rows"] for lab in view["labs"].values())
        for lab in view["labs"].values():
            assert lab["train_rows"] > 0 and lab["benefit"] is None      # no round yet

        updates, metrics = controller._collect_client_updates()
        controller.fl_system.aggregate_models(updates, client_metrics=metrics)
        view = controller._federation_view()
        for lab in view["labs"].values():
            assert set(lab["benefit"]) >= {"alone_own", "federated_own", "alone_common", "federated_common"}
    print("PASS: test_controller_sends_the_federation_summary")


if __name__ == "__main__":
    tests = [
        test_reference_models_do_not_change_the_federation,
        test_benefit_compares_on_held_out_patients,
        test_reference_models_survive_a_restart,
        test_controller_sends_the_federation_summary,
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
