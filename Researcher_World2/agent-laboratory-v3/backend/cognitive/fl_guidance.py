# Path: backend/cognitive/fl_guidance.py
#
# Agent-guided federated learning.
#
# Every few rounds one agent per lab looks at how the federation is doing and
# proposes one change to its parameters. The proposals are put to a vote and
# the winning one is applied to the FL system. This is the mechanism through
# which the agents' reasoning (LLM, or a simple rule when the LLM is off)
# really changes the course of the training, instead of only commenting on it.

import logging
from collections import Counter
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# What can be changed, and within which limits
# ---------------------------------------------------------------------------

NOISE_MIN, NOISE_MAX = 0.2, 2.0
EPOCHS_MIN, EPOCHS_MAX = 2, 8

KEEP = "keep"
NOISE_DOWN = "noise_down"
NOISE_UP = "noise_up"
EPOCHS_UP = "epochs_up"
EPOCHS_DOWN = "epochs_down"

# Order matters: it is the order of the letters shown to the LLM (A, B, C...)
OPTIONS = [NOISE_DOWN, NOISE_UP, EPOCHS_UP, EPOCHS_DOWN, KEEP]

OPTION_TEXT = {
    NOISE_DOWN: "ridurre il rumore di privacy (più accuracy, meno privacy)",
    NOISE_UP: "aumentare il rumore di privacy (più privacy, meno accuracy)",
    EPOCHS_UP: "aumentare le epoche di addestramento locale",
    EPOCHS_DOWN: "ridurre le epoche di addestramento locale",
    KEEP: "non cambiare nulla",
}

# The same options as a short phrase that completes "propongo di ..."
OPTION_SHORT = {
    NOISE_DOWN: "ridurre il rumore di privacy",
    NOISE_UP: "aumentare il rumore di privacy",
    EPOCHS_UP: "aumentare le epoche locali",
    EPOCHS_DOWN: "ridurre le epoche locali",
    KEEP: "non cambiare nulla",
}

# Roles that put the protection of the data first; the others put the
# performance of the model first.
PRIVACY_FIRST_ROLES = {"privacy_specialist", "doctor"}

ROLE_TEXT = {
    "professor": "professore",
    "professor_senior": "professore senior",
    "privacy_specialist": "specialista di privacy",
    "researcher": "ricercatore",
    "student": "studente",
    "student_postdoc": "ricercatore post-dottorato",
    "doctor": "medico",
    "engineer": "ingegnere",
    "sw_engineer": "ingegnere del software",
}

# Accuracy above which the model is considered good enough to trade some of it
TARGET_ACCURACY = 0.85
# Change of the 3-round average below which the training is considered stalled
STALL_THRESHOLD = 0.01


# ---------------------------------------------------------------------------
# Context
# ---------------------------------------------------------------------------

def build_context(fl_system, decisions: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Summary of the federation that an agent looks at before proposing.

    decisions: the consortium's earlier decisions. Those that changed something
    are passed on with the accuracy measured before and after, so that a new
    proposal can take into account how the previous ones turned out."""
    acc = list(fl_system.metrics.get("accuracy", []))
    recent = acc[-3:]
    previous = acc[-6:-3]
    recent_mean = sum(recent) / len(recent) if recent else 0.0
    previous_mean = sum(previous) / len(previous) if previous else recent_mean
    return {
        "round": fl_system.round,
        "accuracy": acc[-1] if acc else 0.0,
        "recent_mean": round(recent_mean, 4),
        "previous_mean": round(previous_mean, 4),
        "trend": round(recent_mean - previous_mean, 4),
        "best": max(acc) if acc else 0.0,
        "noise": float(fl_system.dp_noise_multiplier),
        "epochs": int(fl_system.local_epochs),
        "dp_enabled": bool(fl_system.dp_enabled),
        "history": [
            {key: d.get(key) for key in
             ("round", "option", "option_text", "before", "after", "accuracy_before", "accuracy_after")}
            for d in (decisions or []) if d.get("changed")
        ][-2:],
    }


OPPOSITE = {NOISE_DOWN: NOISE_UP, NOISE_UP: NOISE_DOWN, EPOCHS_UP: EPOCHS_DOWN, EPOCHS_DOWN: EPOCHS_UP}
# Fall of the average accuracy after a change that counts as "it made things worse"
WORSE_THRESHOLD = 0.02


def last_measured_change(ctx: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """The most recent change whose effect has been measured, if any."""
    for past in reversed(ctx.get("history") or []):
        if past.get("accuracy_after") is not None and past.get("accuracy_before") is not None:
            return past
    return None


def available_options(ctx: Dict[str, Any]) -> List[str]:
    """Options that can actually be applied given the current values."""
    options = []
    for option in OPTIONS:
        if option in (NOISE_DOWN, NOISE_UP) and not ctx["dp_enabled"]:
            continue
        if option == NOISE_DOWN and ctx["noise"] <= NOISE_MIN + 1e-9:
            continue
        if option == NOISE_UP and ctx["noise"] >= NOISE_MAX - 1e-9:
            continue
        if option == EPOCHS_UP and ctx["epochs"] >= EPOCHS_MAX:
            continue
        if option == EPOCHS_DOWN and ctx["epochs"] <= EPOCHS_MIN:
            continue
        options.append(option)
    return options


# ---------------------------------------------------------------------------
# Proposals
# ---------------------------------------------------------------------------

def rule_based_choice(role: str, ctx: Dict[str, Any]) -> Dict[str, str]:
    """A choice made without the model, by a simple declared rule. It is used
    only if the configuration asks for it (fl.agent_guidance.rule_fallback),
    and it carries no words: an agent's words always come from the model.

    - model good and stable: who protects the data asks for more privacy,
      the others leave things as they are;
    - model not yet good and no longer improving: who looks at performance
      asks for less noise (or more local training), who protects the data
      asks for more local training, which costs no privacy;
    - a change after which the accuracy fell is undone;
    - otherwise nothing is changed.
    """
    options = available_options(ctx)
    privacy_first = role in PRIVACY_FIRST_ROLES
    stalled = ctx["trend"] < STALL_THRESHOLD
    good = ctx["recent_mean"] >= TARGET_ACCURACY

    def pick(*wanted):
        for option in wanted:
            if option in options:
                return option
        return KEEP

    past = last_measured_change(ctx)
    if past and past["accuracy_after"] < past["accuracy_before"] - WORSE_THRESHOLD:
        undo = OPPOSITE.get(past["option"])
        accepted_price = privacy_first and past["option"] == NOISE_UP and good
        if undo in options and not accepted_price:
            return {"option": undo, "reason": ""}

    if good:
        option = pick(NOISE_UP) if privacy_first else KEEP
    elif stalled:
        option = pick(EPOCHS_UP) if privacy_first else pick(NOISE_DOWN, EPOCHS_UP)
    else:
        option = KEEP
    return {"option": option, "reason": ""}


def build_facts(ctx: Dict[str, Any]) -> str:
    """The real figures an agent decides on. They are the only numbers the
    model may write in its answer (see cognitive/fact_check.py)."""
    return (
        f"DATI REALI:\n"
        f"- round completati: {ctx['round']}\n"
        f"- accuracy del modello globale sul test: {ctx['accuracy']:.0%}\n"
        f"- media degli ultimi 3 round: {ctx['recent_mean']:.0%} "
        f"(i 3 precedenti: {ctx['previous_mean']:.0%})\n"
        f"- rumore di privacy attuale: {ctx['noise']:.2f}\n"
        f"- epoche di addestramento locale: {ctx['epochs']}\n"
        + _history_text(ctx)
    )


def build_prompt(name: str, role: str, lab_id: str, ctx: Dict[str, Any], options: List[str],
                 reminder: bool = False) -> str:
    letters = "ABCDE"
    lines = [f"{letters[i]}) {OPTION_TEXT[option]}" for i, option in enumerate(options)]
    stance = ("Per te la protezione dei dati viene prima di tutto."
              if role in PRIVACY_FIRST_ROLES else
              "Per te contano soprattutto le prestazioni del modello.")
    return (
        f"/no_think\n"
        f"Sei {name}, {ROLE_TEXT.get(role, role)} del laboratorio {lab_id}. {stance}\n"
        f"Il consorzio federato deve decidere come proseguire l'addestramento.\n\n"
        + build_facts(ctx) +
        f"\nOPZIONI:\n" + "\n".join(lines) + "\n\n"
        f"Rispondi esattamente in questo formato, senza altro testo:\n"
        f"SCELTA: <lettera>\n"
        f"MOTIVO: <una frase in prima persona che dice che cosa proponi e perché, dal tuo punto di vista>\n"
        f"Nel motivo usa SOLO i numeri dei DATI REALI, scritti in CIFRE esattamente come sono "
        f"(mai in lettere), oppure nessun numero. Massimo 25 parole."
        + ("\nATTENZIONE: la risposta precedente conteneva numeri che non sono nei DATI REALI."
           if reminder else "")
    )


def _history_text(ctx: Dict[str, Any]) -> str:
    """Earlier decisions and their measured effect, as lines for the prompt."""
    lines = []
    for past in ctx.get("history") or []:
        line = f"- al round {past['round']} il consorzio ha deciso di {past['option_text']}"
        if past.get("accuracy_after") is not None:
            line += (f": l'accuracy media è passata dal {past['accuracy_before']:.0%} "
                     f"al {past['accuracy_after']:.0%}")
        else:
            line += " (effetto non ancora misurato)"
        lines.append(line)
    if not lines:
        return ""
    return "\nDECISIONI PRECEDENTI:\n" + "\n".join(lines) + "\n"


def parse_llm_answer(answer: str, options: List[str]) -> Optional[Dict[str, str]]:
    """Read 'SCELTA: X / MOTIVO: ...'. None if the answer is not usable."""
    if not answer or "OLLAMA" in answer.upper()[:20]:
        return None
    choice, reason = None, ""
    for raw in answer.splitlines():
        line = raw.strip().lstrip("*-• ").strip()
        upper = line.upper()
        if upper.startswith("SCELTA") and ":" in line:
            value = line.split(":", 1)[1].strip().upper()
            for ch in value:
                if ch in "ABCDE":
                    choice = "ABCDE".index(ch)
                    break
        elif upper.startswith("MOTIVO") and ":" in line:
            reason = line.split(":", 1)[1].strip().strip('"«»')
    if choice is None or choice >= len(options) or len(reason) < 8:
        return None
    return {"option": options[choice], "reason": reason[:220]}


def propose(agent, ctx: Dict[str, Any], use_llm: bool,
            rule_fallback: bool = False) -> Optional[Dict[str, Any]]:
    """One agent's proposal: the choice and the words are the model's.

    The answer is kept only if it names one of the options and every number in
    its reason is a real figure of the run; otherwise the agent is asked once
    more, and then it simply makes no proposal (returns None). Nothing is
    pre-written. Only with rule_fallback (off by default) a silent choice is
    made by the declared rule, with no words attached.
    """
    role = getattr(agent, "role", "researcher")
    proposal: Optional[Dict[str, str]] = None

    if use_llm:
        from cognitive.prompts.gpt_structure import ollama_chat_request
        from cognitive import fact_check
        options = available_options(ctx)
        facts = build_facts(ctx)
        for attempt in range(2):
            try:
                answer = ollama_chat_request(
                    build_prompt(agent.name, role, getattr(agent, "lab_id", ""), ctx, options,
                                 reminder=attempt > 0),
                    temperature=0.2, max_tokens=90,
                )
            except Exception as e:
                logger.warning(f"FL guidance: LLM call failed for {agent.name}: {e}")
                break
            parsed = parse_llm_answer(answer, options)
            if parsed is None:
                logger.warning(f"FL guidance: unusable LLM answer for {agent.name}")
                continue
            if len(parsed["reason"].split()) > 32:
                logger.warning(f"FL guidance: {agent.name}'s reason discarded, too long")
                continue
            invented = fact_check.unverified_numbers(parsed["reason"], facts)
            if invented:
                logger.warning(f"FL guidance: {agent.name}'s reason discarded, "
                               f"numbers not in the real data {invented[:5]}")
                continue
            proposal = parsed
            break

    from_llm = proposal is not None
    if proposal is None:
        if not rule_fallback:
            return None
        proposal = rule_based_choice(role, ctx)

    return {
        "agent": agent.name,
        "lab_id": getattr(agent, "lab_id", ""),
        "role": role,
        "option": proposal["option"],
        "option_text": OPTION_SHORT[proposal["option"]],
        "reason": proposal["reason"],
        "from_llm": from_llm,
    }


# ---------------------------------------------------------------------------
# Vote and application
# ---------------------------------------------------------------------------

def decide(proposals: List[Dict[str, Any]]) -> str:
    """The option with most votes wins; a tie changes nothing."""
    votes = Counter(p["option"] for p in proposals)
    if not votes:
        return KEEP
    ranked = votes.most_common()
    if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
        return KEEP
    return ranked[0][0]


def apply_option(fl_system, option: str) -> Dict[str, Any]:
    """Apply the winning option to the FL system. Returns the values before and after."""
    before = {"noise": round(float(fl_system.dp_noise_multiplier), 3),
              "epochs": int(fl_system.local_epochs)}
    if option == NOISE_DOWN:
        fl_system.dp_noise_multiplier = max(NOISE_MIN, round(fl_system.dp_noise_multiplier * 0.7, 3))
    elif option == NOISE_UP:
        fl_system.dp_noise_multiplier = min(NOISE_MAX, round(fl_system.dp_noise_multiplier * 1.3, 3))
    elif option == EPOCHS_UP:
        fl_system.local_epochs = min(EPOCHS_MAX, fl_system.local_epochs + 1)
    elif option == EPOCHS_DOWN:
        fl_system.local_epochs = max(EPOCHS_MIN, fl_system.local_epochs - 1)
    after = {"noise": round(float(fl_system.dp_noise_multiplier), 3),
             "epochs": int(fl_system.local_epochs)}
    return {"before": before, "after": after, "changed": before != after}
