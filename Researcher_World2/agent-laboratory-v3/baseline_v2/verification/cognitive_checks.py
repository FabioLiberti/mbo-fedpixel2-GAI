"""Cognitive-pipeline checks, run against the isolated copy of backend/."""
import collections
import datetime
import logging
import os
import sys
import tempfile

BACKEND = sys.argv[1]
MODE = sys.argv[2]
sys.path.insert(0, BACKEND)
logging.disable(logging.CRITICAL)

from cognitive.prompts.run_gpt_prompt import set_llm_enabled  # noqa: E402
from cognitive.prompts.gpt_structure import get_embedding  # noqa: E402
from models.environment import LabEnvironment  # noqa: E402

CFG = os.path.join(BACKEND, "config", "simulation_config.json")


def all_texts(agent):
    out = []
    for seq in (agent.a_mem.seq_event, agent.a_mem.seq_thought, agent.a_mem.seq_chat):
        for n in seq:
            out.append(str(getattr(n, "description", "")) + " " + str(getattr(n, "embedding_key", "")))
    s = agent.scratch
    out += [str(s.act_description), str(getattr(s, "currently", "")), str(getattr(s, "daily_req", "")),
            str(getattr(s, "f_daily_schedule", "")), str(getattr(agent, "last_dialog", ""))]
    return out


if MODE == "schedule":
    print("[1.1] DO AGENTS PROGRESS THROUGH THEIR SCHEDULE? (stub mode, 1500 steps = ~10 simulated days)")
    set_llm_enabled(False)
    env = LabEnvironment(CFG)
    changes = collections.Counter()
    distinct = collections.defaultdict(set)
    last = {}
    chat_since = {}
    for step in range(1500):
        env.step_parallel(max_workers=4)
        for a in env.schedule.agents:
            d = a.scratch.act_description
            distinct[a.name].add(d)
            if last.get(a.name) != d:
                changes[a.name] += 1
                last[a.name] = d
            if a.scratch.chatting_with and a.name not in chat_since:
                chat_since[a.name] = step
            if not a.scratch.chatting_with:
                chat_since.pop(a.name, None)
    print(f"  sim clock advanced to {env.sim_time}")
    for a in env.schedule.agents:
        stuck = f"in chat since step {chat_since[a.name]}" if a.name in chat_since else "not chatting"
        print(f"  {a.name:16s} action changes={changes[a.name]:3d} distinct={len(distinct[a.name]):2d} "
              f"| {stuck} | now: {str(a.scratch.act_description)[:48]}")

elif MODE == "prune":
    print("[1.2/1.3] MEMORY PRUNE AND NODE IDS")
    set_llm_enabled(False)
    env = LabEnvironment(CFG)
    a = env.schedule.agents[0]
    t0 = env.sim_time
    base = len(a.a_mem.seq_event)

    def add(i):
        desc = f"FL round {i} local model training"
        a.a_mem.add_event(t0 + datetime.timedelta(minutes=i), None, a.name, "participated in", desc,
                          f"{a.name} participated in {desc}", {"fl", "round"}, 7,
                          (desc, get_embedding(desc)), [])

    for i in range(200 - base):
        add(i)
    a.a_mem.decay_memories()
    print(f"  sim time {t0} vs wall clock {datetime.datetime.now():%Y-%m-%d}")
    print(f"  events at the cap: {len(a.a_mem.seq_event)} (after decay_memories, nothing pruned yet)")
    add(999)
    a.a_mem.decay_memories()
    print(f"  after adding ONE more event and decay_memories: {len(a.a_mem.seq_event)} events left")
    before_ids = set(a.a_mem.id_to_node)
    add(1000); add(1001)
    seq_nodes = len(a.a_mem.seq_event) + len(a.a_mem.seq_thought) + len(a.a_mem.seq_chat)
    print(f"  after 2 new events: nodes in sequences={seq_nodes}, entries in id_to_node={len(a.a_mem.id_to_node)}, "
          f"new ids reused existing ones: {len(a.a_mem.id_to_node) == len(before_ids)}")
    try:
        a.a_mem.save(tempfile.mkdtemp(prefix="amem_"))
        print("  save(): ok")
    except Exception as e:
        print(f"  save(): raises {type(e).__name__}: {e}")

    print("  -- targeted case: a long-lived reflection survives the wipe --")
    mem = type(a.a_mem)()

    def ev(i):
        desc = f"FL round {i} local model training"
        mem.add_event(t0 + datetime.timedelta(minutes=i), None, a.name, "participated in", desc,
                      f"{a.name} participated in {desc}", {"fl", "round"}, 7,
                      (desc, get_embedding(desc)), [])

    ev(0)                                             # node_1
    desc = "reflection on the privacy budget"
    mem.add_thought(t0, datetime.datetime(2100, 1, 1), a.name, "reflects on", desc,
                    f"{a.name} reflects on {desc}", {"privacy"}, 9,
                    (desc, get_embedding(desc)), [])  # node_2, does not expire
    reflection = mem.seq_thought[0]
    for i in range(1, 201):                           # the 201st event triggers the wipe
        ev(i)
    print(f"  after the wipe: events={len(mem.seq_event)} thoughts={len(mem.seq_thought)} "
          f"ids left={sorted(mem.id_to_node)}")
    ev(500)
    still = mem.id_to_node.get(reflection.node_id) is reflection
    print(f"  after ONE new event: {reflection.node_id} still points to the reflection: {still} "
          f"(now a {mem.id_to_node[reflection.node_id].type})")
    try:
        mem.save(tempfile.mkdtemp(prefix="amem_"))
        print("  save(): ok")
    except Exception as e:
        print(f"  save(): raises {type(e).__name__}: {e}")

elif MODE == "sentinel":
    print("[1.4] LLM ENABLED BUT OLLAMA UNREACHABLE (150 steps): what ends up in agent state?")
    set_llm_enabled(True)
    env = LabEnvironment(CFG)
    for a in env.schedule.agents:
        a.cognitive_step_interval = 10
    for _ in range(150):
        env.step_parallel(max_workers=4)
    hits = collections.Counter()
    example = None
    for a in env.schedule.agents:
        for t in all_texts(a):
            if "OLLAMA" in t:
                hits[a.name] += 1
                example = example or t.strip()[:150]
    print(f"  agents whose memory/plan/dialog contains an 'OLLAMA ...' error string: {len(hits)}/12")
    print(f"  occurrences per agent: {dict(hits)}")
    print(f"  example: {example!r}")
    flags = collections.Counter(bool(getattr(a, 'dialog_is_llm', False)) for a in env.schedule.agents)
    print(f"  dialog_is_llm flags across agents: {dict(flags)}")
