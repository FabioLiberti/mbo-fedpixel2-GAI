"""Verification harness for fl/federated.py, run against an isolated copy.

Replays the exact round logic of SimulationController._collect_client_updates +
aggregate_models + update_client_models, then measures what the shipped metrics
do and do not capture.
"""
import logging
import os
import subprocess
import sys
import tempfile

import numpy as np

BACKEND = sys.argv[1]
MODE = sys.argv[2] if len(sys.argv) > 2 else "all"
sys.path.insert(0, BACKEND)
logging.disable(logging.CRITICAL)

from fl import federated as F  # noqa: E402

LABS = ["mercatorum", "blekinge", "opbg"]
DATA = F._load_heart_dataset()
X_ALL, Y_ALL = DATA["X"], DATA["y"]
MAJORITY = max(float(Y_ALL.mean()), 1 - float(Y_ALL.mean()))


def make_fl(seed, dp_enabled=True, noise=2.0, algorithm="fedavg", mu=0.01):
    fl = F.FederatedLearningSystem(
        algorithm=algorithm, mu=mu, seed=seed,
        checkpoint_dir=tempfile.mkdtemp(prefix="flck_"),
        dp_enabled=dp_enabled, dp_noise_multiplier=noise,
    )
    for lab in LABS:
        fl.register_client(lab)
    return fl


def shipped_round(fl):
    """One round exactly as the controller does it."""
    updates, metrics = {}, {}
    for lab in LABS:
        x, y = F.generate_client_data(lab, n_samples=120, seed=42 + fl.round)
        m, w = fl.train_client(lab, x, y)
        updates[lab], metrics[lab] = w, m
    fl.aggregate_models(updates, client_metrics=metrics)
    fl.update_client_models()


def global_acc(fl, x=X_ALL, y=Y_ALL):
    return F.FederatedLearningSystem._eval_weights(fl.global_model, x, y)["accuracy"]


def run_shipped(seed, max_rounds, **kw):
    fl = make_fl(seed, **kw)
    reported, true_pooled = [], []
    for _ in range(max_rounds):
        if fl.check_convergence()["budget_exhausted"]:
            break
        shipped_round(fl)
        reported.append(fl.metrics["accuracy"][-1])
        true_pooled.append(global_acc(fl))
    return fl, reported, true_pooled


def exp_as_shipped():
    print(f"majority-class baseline on all 303 rows: {MAJORITY:.3f}")
    print("\n[A] AS SHIPPED (DP on, noise_multiplier=2.0, eps_total=20), 10 seeds")
    rounds_done, last_rep, last_true, best_true = [], [], [], []
    for seed in range(10):
        fl, rep, tru = run_shipped(seed, max_rounds=40)
        rounds_done.append(len(rep))
        last_rep.append(rep[-1]); last_true.append(tru[-1]); best_true.append(max(tru))
        if seed < 3:
            print(f"  seed {seed}: rounds={len(rep)} eps_spent={fl.dp_epsilon_spent}"
                  f"\n     reported 'accuracy' : {[round(a, 2) for a in rep]}"
                  f"\n     global model, pooled: {[round(a, 2) for a in tru]}")
    print(f"  rounds before budget stop: {sorted(set(rounds_done))}")
    print(f"  final reported acc   mean={np.mean(last_rep):.3f} sd={np.std(last_rep):.3f}")
    print(f"  final true pooled acc mean={np.mean(last_true):.3f} sd={np.std(last_true):.3f}"
          f"  min={np.min(last_true):.3f} max={np.max(last_true):.3f}")
    print(f"  runs where final global model beats majority baseline: "
          f"{sum(a > MAJORITY for a in last_true)}/10")


def exp_noise_sweep():
    print("\n[B] NOISE SWEEP, 9 rounds each, 10 seeds (true pooled accuracy of global model)")
    for noise, dp in [(0.0, False), (0.25, True), (0.5, True), (1.0, True), (2.0, True)]:
        finals = []
        for seed in range(10):
            fl = make_fl(seed, dp_enabled=dp, noise=noise)
            fl.dp_epsilon_total = 1e9  # isolate the effect of noise from the budget stop
            for _ in range(9):
                shipped_round(fl)
            finals.append(global_acc(fl))
        label = "DP off" if not dp else f"noise_multiplier={noise}"
        print(f"  {label:24s} mean={np.mean(finals):.3f} sd={np.std(finals):.3f} "
              f"min={np.min(finals):.3f} max={np.max(finals):.3f}")


def exp_no_dp_long():
    print("\n[C] DP OFF, 30 rounds, seed 0: does plain FedAvg learn?")
    fl, rep, tru = run_shipped(0, max_rounds=30, dp_enabled=False)
    idx = [0, 4, 9, 19, 29]
    print("  round            :", [i + 1 for i in idx])
    print("  reported accuracy:", [round(rep[i], 3) for i in idx])
    print("  true pooled acc  :", [round(tru[i], 3) for i in idx])


def exp_holdout():
    print("\n[D] IN-SAMPLE vs HELD-OUT (DP off, 15 rounds, 20 random 75/25 splits)")
    ages = DATA["ages"]
    masks = {lab: (ages >= lo) & (ages < hi) for lab, (lo, hi) in F._LAB_AGE_RANGES.items()}
    ins, outs = [], []
    for seed in range(20):
        rng = np.random.RandomState(1000 + seed)
        split = {}
        for lab in LABS:
            idx = np.flatnonzero(masks[lab]); rng.shuffle(idx)
            k = int(len(idx) * 0.75)
            split[lab] = (idx[:k], idx[k:])
        fl = make_fl(seed, dp_enabled=False)
        for _ in range(15):
            updates, metrics = {}, {}
            for lab in LABS:
                tr = split[lab][0]
                m, w = fl.train_client(lab, X_ALL[tr], Y_ALL[tr])
                updates[lab], metrics[lab] = w, m
            fl.aggregate_models(updates, client_metrics=metrics)
            fl.update_client_models()
        tr_all = np.concatenate([split[l][0] for l in LABS])
        te_all = np.concatenate([split[l][1] for l in LABS])
        ins.append(global_acc(fl, X_ALL[tr_all], Y_ALL[tr_all]))
        outs.append(global_acc(fl, X_ALL[te_all], Y_ALL[te_all]))
    print(f"  accuracy on data the model trained on : mean={np.mean(ins):.3f} sd={np.std(ins):.3f}")
    print(f"  accuracy on held-out 25%              : mean={np.mean(outs):.3f} sd={np.std(outs):.3f}")
    print(f"  optimism of in-sample evaluation      : {np.mean(ins) - np.mean(outs):+.3f}")


def exp_selection():
    print("\n[E] CLIENT SELECTION: does select_clients() affect who trains?")
    fl = make_fl(0, dp_enabled=False)
    sel = fl.select_clients()
    shipped_round(fl)
    trained = [lab for lab in LABS if fl.clients[lab]["last_round"] == 0]
    print(f"  selected by select_clients(): {sorted(sel)}")
    print(f"  actually trained+aggregated : {sorted(trained)}")


def exp_single():
    """Child-process mode: print reported accuracy history for one fixed seed."""
    fl, rep, _ = run_shipped(42, max_rounds=5)
    sizes = [len(F.generate_client_data("blekinge", n_samples=120, seed=42)[0])]
    first = int(np.flatnonzero(
        (X_ALL == F.generate_client_data("blekinge", n_samples=120, seed=42)[0][0]).all(axis=1))[0])
    print(rep, "| blekinge first sampled row index:", first, sizes)


def exp_repro():
    print("\n[F] REPRODUCIBILITY: same seed=42, three separate processes")
    for hs in ("0", "1", "random"):
        env = dict(os.environ, PYTHONHASHSEED=hs, PYTHONDONTWRITEBYTECODE="1")
        out = subprocess.run([sys.executable, __file__, BACKEND, "single"],
                             capture_output=True, text=True, env=env)
        print(f"  PYTHONHASHSEED={hs:6s} -> {out.stdout.strip() or out.stderr.strip()[-300:]}")


if MODE == "single":
    exp_single()
else:
    exp_as_shipped()
    exp_noise_sweep()
    exp_no_dp_long()
    exp_holdout()
    exp_selection()
    exp_repro()
