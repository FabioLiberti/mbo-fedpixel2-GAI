"""Controller lifecycle checks, run against the isolated copy of backend/."""
import logging
import sys
import threading
import time

BACKEND = sys.argv[1]
sys.path.insert(0, BACKEND)
logging.disable(logging.CRITICAL)

from simulation.controller import SimulationController  # noqa: E402


def sim_threads():
    return [t for t in threading.enumerate()
            if getattr(t, "_target", None) is not None
            and getattr(t._target, "__name__", "") == "_simulation_loop" and t.is_alive()]


print("[1] RESET vs FL CHECKPOINT")
c = SimulationController()
assert c.initialize_model()
print(f"  agents created: {c.model.schedule.get_agent_count()} "
      f"({ {lab: len(c.model.get_lab_agents(lab)) for lab in c.model.get_lab_ids()} })")
print(f"  roles: {sorted({a.role for a in c.model.schedule.agents})}")
print(f"  fresh FL: round={c.fl_system.round} eps_spent={c.fl_system.dp_epsilon_spent} "
      f"dp_enabled={c.fl_system.dp_enabled} eps_total={c.fl_system.dp_epsilon_total} "
      f"noise_multiplier={c.fl_system.dp_noise_multiplier}")
for _ in range(9):
    updates, metrics = c._collect_client_updates()
    c.fl_system.aggregate_models(updates, client_metrics=metrics)
    c.fl_system.update_client_models()
conv = c.fl_system.check_convergence()
print(f"  after 9 rounds: round={c.fl_system.round} eps_spent={c.fl_system.dp_epsilon_spent} "
      f"budget_exhausted={conv['budget_exhausted']}")
c.reset_simulation()
conv = c.fl_system.check_convergence()
print(f"  after reset_simulation(): round={c.fl_system.round} "
      f"eps_spent={c.fl_system.dp_epsilon_spent} budget_exhausted={conv['budget_exhausted']}")
before = c.fl_system.round
c.fl_enabled = True
c._start_fl_round()
print(f"  _start_fl_round() after reset -> round_in_progress={c.fl_round_in_progress} "
      f"(round still {c.fl_system.round}, was {before})")

print("\n[2] STOP + START WHILE A STEP IS STILL BLOCKED (slow LLM call stand-in)")
c2 = SimulationController()
assert c2.initialize_model()
calls = {"n": 0}
lock = threading.Lock()


def slow_step(max_workers=4):
    with lock:
        calls["n"] += 1
    time.sleep(4.0)  # stands in for a cognitive cycle waiting on the LLM


c2.model.step_parallel = slow_step
c2.fl_enabled = False
c2.start_simulation()
c2.fl_enabled = False
time.sleep(0.5)
print(f"  loops alive after start: {len(sim_threads())}")
c2.stop_simulation()          # join(timeout=2.0) expires while the step is blocked
print(f"  loops alive right after stop: {len(sim_threads())}")
c2.start_simulation()
c2.fl_enabled = False
time.sleep(6.0)               # old step returns, old loop re-checks its condition
print(f"  loops alive 6s after second start: {len(sim_threads())}")
n0 = calls["n"]
time.sleep(8.5)
print(f"  step calls in the next 8.5s (one loop would make ~2): {calls['n'] - n0}")
c2.running = False
c2.stop_event.set()
