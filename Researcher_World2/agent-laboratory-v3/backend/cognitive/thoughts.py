# Path: backend/cognitive/thoughts.py
#
# What each agent is thinking, in a few words.
#
# The small boxes that appear next to the agents are written by the model like
# everything else the agents say: from the real figures of the run, each from
# the point of view of that kind of agent and of what it works on. A thought
# with a number that is not a real figure is not shown; with the model off the
# agents have no thoughts to show.

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

MAX_THOUGHT_WORDS = 16
# the small box on screen shows at most this many characters: a longer thought
# is not shown rather than shown cut
MAX_THOUGHT_CHARS = 120

_SYSTEM = (
    "Scrivi un pensiero breve per ciascuna di queste persone, che lavorano allo stesso "
    "progetto di Federated Learning in un laboratorio.\n"
    "REGOLE:\n"
    "- Un pensiero per persona, formato: Nome: pensiero\n"
    "- Massimo 12 parole, in prima persona, come un pensiero tra sé e sé\n"
    "- Ognuno pensa dal proprio punto di vista e a ciò di cui si occupa, indicati accanto al nome\n"
    "- I pensieri devono essere diversi tra loro\n"
    "- Usa SOLO i numeri dei DATI REALI, in CIFRE esattamente come sono (mai in lettere), "
    "oppure nessun numero\n"
    "- Non inventare fatti che non sono nei DATI REALI\n"
    "- Rispondi solo con i pensieri"
)


def build_prompt(agents: List[Any], facts: str) -> str:
    from . import role_dialogs

    people = []
    for agent in agents:
        fam = role_dialogs.family(getattr(agent, "role", "researcher"))
        topic = str(getattr(getattr(agent, "scratch", None), "fl_specialization", "") or "").replace("_", " ")
        about = f", si occupa di {topic}" if topic else ""
        people.append(f"- {agent.name}, {role_dialogs.FAMILY_LABEL[fam]}{about}: {role_dialogs.ROLE_VOICE[fam]}")
    return f"/no_think\n{_SYSTEM}\n\nDATI REALI:\n{facts}\n\nPERSONE:\n" + "\n".join(people) + "\n\nPensieri:"


def parse(answer: str, agents: List[Any], facts: str) -> Dict[str, str]:
    """Thoughts by agent name. Only those that are attributed to one of the
    agents, short enough, and whose numbers are all real figures."""
    from . import fact_check

    thoughts: Dict[str, str] = {}
    if not answer or "OLLAMA" in answer.upper()[:20]:
        return thoughts
    by_first = {agent.name.split()[0].lower(): agent.name for agent in agents}
    by_full = {agent.name.lower(): agent.name for agent in agents}
    lines = [raw.strip().lstrip("*-• ").strip() for raw in answer.strip().split("\n")]
    lines = [line for line in lines if ":" in line]
    for index, line in enumerate(lines):
        speaker, text = line.split(":", 1)
        speaker = speaker.strip().strip("*").lower()
        text = text.strip().strip('"«»“” ').strip()
        name = by_full.get(speaker) or by_first.get(speaker)
        if not name or name in thoughts or len(text) < 4:
            continue
        if len(text.split()) > MAX_THOUGHT_WORDS or len(text) > MAX_THOUGHT_CHARS:
            continue
        # the last line of the answer may have been cut by the length limit
        if index == len(lines) - 1 and text[-1:] not in ".?!…":
            continue
        if fact_check.unverified_numbers(text, facts):
            logger.warning(f"Thought of {name} discarded: numbers not in the real data")
            continue
        thoughts[name] = text
    return thoughts


def generate(agents: List[Any], facts: str) -> Dict[str, str]:
    """Ask the model for one thought per agent. Returns {agent name: thought};
    agents for which nothing verified was produced are simply absent."""
    from .prompts.gpt_structure import ollama_chat_request

    if not agents:
        return {}
    try:
        answer = ollama_chat_request(build_prompt(agents, facts), temperature=0.4,
                                     max_tokens=40 * len(agents))
    except Exception as e:
        logger.warning(f"Thoughts: LLM call failed: {e}")
        return {}
    return parse(answer, agents, facts)
