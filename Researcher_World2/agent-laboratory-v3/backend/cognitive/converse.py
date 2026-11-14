"""
Converse module for generative agents.
Ported from Park et al. (UIST 2023).

Handles agent-to-agent conversation generation.
"""
import math
import datetime
import logging

from .retrieve import new_retrieve
from .prompts.gpt_structure import get_embedding
from .prompts.run_gpt_prompt import (
    run_gpt_prompt_agent_chat_summarize_ideas,
    run_gpt_prompt_agent_chat_summarize_relationship,
    run_gpt_prompt_agent_chat,
    run_gpt_generate_iterative_chat_utt,
    run_gpt_prompt_event_triple,
    run_gpt_prompt_event_poignancy,
    run_gpt_prompt_chat_poignancy,
    run_gpt_prompt_summarize_ideas,
    run_gpt_prompt_generate_next_convo_line,
    run_gpt_prompt_generate_whisper_inner_thought,
)

logger = logging.getLogger(__name__)


def generate_agent_chat_summarize_ideas(init_persona, target_persona,
                                        retrieved, curr_context):
    """Summarize ideas from retrieved memories for conversation context."""
    all_embedding_keys = []
    for key, val in retrieved.items():
        for i in val:
            all_embedding_keys.append(i.embedding_key)
    all_embedding_key_str = "\n".join(all_embedding_keys)

    try:
        return run_gpt_prompt_agent_chat_summarize_ideas(
            init_persona, target_persona,
            all_embedding_key_str, curr_context)[0]
    except Exception as e:
        logger.warning(f"summarize_chat_ideas failed: {e}")
        return ""


def generate_summarize_agent_relationship(init_persona, target_persona, retrieved):
    """Summarize the relationship between two agents."""
    all_embedding_keys = []
    for key, val in retrieved.items():
        for i in val:
            all_embedding_keys.append(i.embedding_key)
    all_embedding_key_str = "\n".join(all_embedding_keys)

    return run_gpt_prompt_agent_chat_summarize_relationship(
        init_persona, target_persona, all_embedding_key_str)[0]


def generate_agent_chat(maze, init_persona, target_persona,
                        curr_context, init_summ_idea, target_summ_idea):
    """Generate a full conversation between two agents (batch mode)."""
    return run_gpt_prompt_agent_chat(
        maze, init_persona, target_persona,
        curr_context, init_summ_idea, target_summ_idea)[0]


def agent_chat_v1(maze, init_persona, target_persona):
    """Chat version 1: batch generation approach."""
    curr_context = (
        f"{init_persona.scratch.name} "
        f"was {init_persona.scratch.act_description} "
        f"when {init_persona.scratch.name} "
        f"saw {target_persona.scratch.name} "
        f"in the middle of {target_persona.scratch.act_description}.\n"
    )
    curr_context += (
        f"{init_persona.scratch.name} "
        f"is thinking of initiating a conversation with "
        f"{target_persona.scratch.name}."
    )

    summarized_ideas = []
    part_pairs = [(init_persona, target_persona),
                  (target_persona, init_persona)]
    for p_1, p_2 in part_pairs:
        focal_points = [f"{p_2.scratch.name}"]
        retrieved = new_retrieve(p_1, focal_points, 50)
        relationship = generate_summarize_agent_relationship(p_1, p_2, retrieved)
        focal_points = [f"{relationship}",
                        f"{p_2.scratch.name} is {p_2.scratch.act_description}"]
        retrieved = new_retrieve(p_1, focal_points, 25)
        summarized_idea = generate_agent_chat_summarize_ideas(
            p_1, p_2, retrieved, curr_context)
        summarized_ideas.append(summarized_idea)

    return generate_agent_chat(
        maze, init_persona, target_persona,
        curr_context, summarized_ideas[0], summarized_ideas[1])


def _retrieve_fl_insights_for_convo(persona, target_name):
    """Retrieve FL insights from long-term memory relevant to a conversation.

    Returns a short string with up to 3 recent insights (thoughts and events)
    about FL that can enrich conversation context.
    """
    spec = persona.scratch.fl_specialization or "federated learning"
    focal_points = [spec, target_name, "accuracy", "federato", "round"]
    try:
        retrieved = new_retrieve(persona, focal_points, n_count=10)
    except Exception:
        return ""

    insights = []
    for _fp, nodes in retrieved.items():
        for node in nodes:
            # Include both thought and event nodes with FL-related content
            if node.type in ("thought", "event") and node.embedding_key:
                key_lower = node.embedding_key.lower()
                if any(kw in key_lower for kw in
                       ["fl ", "round", "accuracy", "federato", "privacy",
                        "modello", "aggreg", "convergenz", "gain"]):
                    insights.append(node.embedding_key)
    # Deduplicate
    seen = set()
    unique = []
    for ins in insights:
        if ins not in seen:
            seen.add(ins)
            unique.append(ins)
    return "\n".join(unique[:3])


# Minimum number of exchanges before "end" is honored.
# This prevents overly short conversations (1-2 turns).
_MIN_CHAT_TURNS = 3


def generate_one_utterance(maze, init_persona, target_persona, retrieved, curr_chat,
                           fl_insights_init="", fl_insights_target=""):
    """Generate a single utterance in a conversation."""
    spec_init = init_persona.scratch.fl_specialization or "FL"
    spec_target = target_persona.scratch.fl_specialization or "FL"
    curr_context = (
        f"{init_persona.scratch.name} ({spec_init}) "
        f"stava {init_persona.scratch.act_description} "
        f"quando ha visto {target_persona.scratch.name} ({spec_target}) "
        f"che stava {target_persona.scratch.act_description}.\n"
    )
    curr_context += (
        f"{init_persona.scratch.name} "
        f"avvia una conversazione con "
        f"{target_persona.scratch.name} sul progetto FL."
    )

    # Inject FL knowledge into conversation context
    if fl_insights_init:
        curr_context += (
            f"\n{init_persona.scratch.name} ricorda: "
            f"{fl_insights_init.split(chr(10))[0][:150]}"
        )
    if fl_insights_target:
        curr_context += (
            f"\n{target_persona.scratch.name} ricorda: "
            f"{fl_insights_target.split(chr(10))[0][:150]}"
        )

    x = run_gpt_generate_iterative_chat_utt(
        maze, init_persona, target_persona,
        retrieved, curr_context, curr_chat)[0]

    utt = x["utterance"]
    end = x["end"]

    # Enforce minimum turns: do not end before _MIN_CHAT_TURNS exchanges
    if end and len(curr_chat) < _MIN_CHAT_TURNS:
        end = False

    return utt, end


def agent_chat_v2(maze, init_persona, target_persona):
    """Chat version 2: iterative turn-by-turn dialogue.

    Enriched with FL insights from long-term memory and enforces a minimum
    of _MIN_CHAT_TURNS exchanges before allowing the conversation to end.
    """
    curr_chat = []

    # Retrieve FL insights to enrich the conversation context
    insights_init = _retrieve_fl_insights_for_convo(
        init_persona, target_persona.scratch.name)
    insights_target = _retrieve_fl_insights_for_convo(
        target_persona, init_persona.scratch.name)

    for _ in range(8):
        # Init persona's turn
        focal_points = [f"{target_persona.scratch.name}"]
        # Add FL insights as extra focal points for richer retrieval
        if insights_init:
            focal_points.append(insights_init.split("\n")[0][:80])
        retrieved = new_retrieve(init_persona, focal_points, 50)
        relationship = generate_summarize_agent_relationship(
            init_persona, target_persona, retrieved)
        last_chat = "\n".join([": ".join(i) for i in curr_chat[-4:]])
        if last_chat:
            focal_points = [
                f"{relationship}",
                f"{target_persona.scratch.name} sta {target_persona.scratch.act_description}",
                last_chat
            ]
        else:
            focal_points = [
                f"{relationship}",
                f"{target_persona.scratch.name} sta {target_persona.scratch.act_description}"
            ]
        if insights_init:
            focal_points.append(insights_init.split("\n")[0][:80])
        retrieved = new_retrieve(init_persona, focal_points, 15)
        utt, end = generate_one_utterance(
            maze, init_persona, target_persona, retrieved, curr_chat,
            fl_insights_init=insights_init, fl_insights_target=insights_target)
        curr_chat.append([init_persona.scratch.name, utt])
        if end:
            break

        # Target persona's turn
        focal_points = [f"{init_persona.scratch.name}"]
        if insights_target:
            focal_points.append(insights_target.split("\n")[0][:80])
        retrieved = new_retrieve(target_persona, focal_points, 50)
        relationship = generate_summarize_agent_relationship(
            target_persona, init_persona, retrieved)
        last_chat = "\n".join([": ".join(i) for i in curr_chat[-4:]])
        if last_chat:
            focal_points = [
                f"{relationship}",
                f"{init_persona.scratch.name} sta {init_persona.scratch.act_description}",
                last_chat
            ]
        else:
            focal_points = [
                f"{relationship}",
                f"{init_persona.scratch.name} sta {init_persona.scratch.act_description}"
            ]
        if insights_target:
            focal_points.append(insights_target.split("\n")[0][:80])
        retrieved = new_retrieve(target_persona, focal_points, 15)
        utt, end = generate_one_utterance(
            maze, target_persona, init_persona, retrieved, curr_chat,
            fl_insights_init=insights_target, fl_insights_target=insights_init)
        curr_chat.append([target_persona.scratch.name, utt])
        if end:
            break

    return curr_chat


# ==========================================================================
# FL-specific conversation generation (post-round)
# ==========================================================================

_FL_CONVO_SYSTEM = (
    "Scrivi un breve dialogo in italiano tra due persone che lavorano a un progetto di "
    "Federated Learning e commentano i risultati reali dell'ultimo round.\n"
    "REGOLE:\n"
    "- Esattamente 3 battute alternate, formato: Nome: battuta\n"
    "- Ogni battuta è UNA frase completa di massimo 20 parole\n"
    "- Ognuno parla dal proprio punto di vista, indicato accanto al suo nome\n"
    "- Usa SOLO i numeri elencati nei DATI REALI, scritti in CIFRE esattamente come sono "
    "(mai in lettere); non scrivere nessun altro numero, nemmeno approssimato o calcolato\n"
    "- Attribuisci ogni numero alla grandezza a cui si riferisce nei DATI REALI\n"
    "- Non inventare fatti, esperimenti o risultati che non sono nei DATI REALI\n"
    "- Rispondi solo con le 3 battute"
)

# A turn longer than this is a ramble, not a line of dialog: it is not shown
_MAX_TURN_WORDS = 30

# Role-specific conversation style hints for richer LLM prompts
_ROLE_CONVO_HINTS = {
    "professor": "analizza criticamente i risultati, pone domande profonde sul bias e la generalizzazione",
    "privacy_specialist": "si concentra sulla protezione dei dati, epsilon budget, rumore gaussiano, compliance",
    "researcher": "cita numeri precisi, confronta metriche, propone esperimenti futuri",
    "student": "chiede spiegazioni, mostra curiosità, collega teoria e pratica",
    "doctor": "ragiona sulle implicazioni cliniche, si preoccupa della validità per i pazienti reali",
    "professor_senior": "visione strategica, paragona con altri approcci, guida il team",
    "sw_engineer": "discute implementazione, performance del sistema, scalabilità",
    "engineer": "si concentra sull'infrastruttura, comunicazione tra nodi, efficienza",
    "student_postdoc": "analisi approfondita, propone miglioramenti metodologici",
}


def _retrieve_agent_fl_memories(agent, n=2) -> str:
    """Retrieve recent FL-related memories from an agent's associative memory.
    Returns a short string (max 2 memories) for prompt enrichment."""
    try:
        spec = getattr(agent.scratch, 'fl_specialization', None) or "federated learning"
        retrieved = new_retrieve(agent, [spec, "round", "accuracy"], n_count=5)
        memories = []
        for _fp, nodes in retrieved.items():
            for node in nodes:
                key = getattr(node, 'embedding_key', '') or ''
                if key and any(kw in key.lower() for kw in ['fl ', 'round', 'accuracy', 'federato', 'privacy', 'modello']):
                    memories.append(key.strip())
        # Deduplicate and cap
        seen = set()
        unique = []
        for m in memories:
            if m not in seen:
                seen.add(m)
                unique.append(m)
        return "\n".join(unique[:n])
    except Exception:
        return ""


class Conversation(list):
    """A list of [agent_name, utterance] turns written by the model.

    from_llm is True when the turns come from the model and every number in
    them is a real figure of the run. Otherwise the list is empty: there are
    no template conversations, so when the model is off, does not answer or
    writes a number it was not given, nothing is said."""

    def __init__(self, turns=(), from_llm: bool = False):
        super().__init__(turns)
        self.from_llm = from_llm


def generate_fl_conversation(
    agent_a,
    agent_b,
    fl_context: dict,
    use_llm: bool = False,
) -> Conversation:
    """Conversation between two agents about the real state of the federation,
    each from the point of view of its kind of agent, written by the model.

    Args:
        agent_a, agent_b: agent objects with .name, .role, .lab_id, .scratch attributes
        fl_context: real figures of the run (see SimulationController._fl_dialog_figures)
        use_llm: False returns an empty conversation (nothing is pre-written)

    Returns:
        Conversation: [agent_name, utterance] turns, empty if nothing verified was produced
    """
    if not use_llm:
        return Conversation()

    name_a = agent_a.name
    name_b = agent_b.name
    role_a = getattr(agent_a, 'role', 'researcher')
    role_b = getattr(agent_b, 'role', 'researcher')
    return _generate_fl_convo_llm(
        name_a, name_b, role_a, role_b, fl_context,
        memories_a=_retrieve_agent_fl_memories(agent_a),
        memories_b=_retrieve_agent_fl_memories(agent_b),
    )


def build_fl_facts(ctx: dict) -> str:
    """The real figures of the run, as the lines given to the model. These are
    the only numbers the model may use (see cognitive/fact_check.py)."""
    def pct(value):
        return f"{float(value):.0%}"

    lines = [f"- round completati: {ctx.get('round', 0)}"]
    lines.append(f"- accuracy del modello globale sul test comune: {pct(ctx.get('accuracy', 0))}")
    if ctx.get("local_acc") is not None and ctx.get("global_acc") is not None and not ctx.get("cross_lab"):
        lines.append(
            f"- sui dati di {ctx.get('lab_id', 'questo laboratorio')} ({ctx.get('demo', 'pazienti')}): "
            f"modello locale {pct(ctx['local_acc'])}, modello globale {pct(ctx['global_acc'])}")
    elif ctx.get("demo"):
        lines.append(f"- laboratori coinvolti: {ctx.get('lab_id', '')} ({ctx['demo']})")
    if ctx.get("recent_mean") is not None:
        lines.append(
            f"- media dell'accuracy negli ultimi 3 round: {pct(ctx['recent_mean'])}; "
            f"nei 3 round precedenti: {pct(ctx.get('previous_mean', ctx['recent_mean']))}")
    if ctx.get("noise") is not None:
        lines.append(f"- rumore di privacy applicato: {float(ctx['noise']):.2f}")
    if ctx.get("epochs") is not None:
        lines.append(f"- epoche di addestramento locale: {ctx['epochs']}")
    decision = ctx.get("last_decision")
    if decision and decision.get("changed"):
        line = f"- ultima decisione del consorzio: al round {decision['round']}, {decision['option_text']}"
        if decision.get("accuracy_after") is not None:
            line += (f"; accuracy media prima {pct(decision['accuracy_before'])}, "
                     f"dopo {pct(decision['accuracy_after'])}")
        lines.append(line)
    if ctx.get("next_decision_round"):
        lines.append(f"- prossima decisione del consorzio: al round {ctx['next_decision_round']}")
    return "\n".join(lines)


def _generate_fl_convo_llm(name_a, name_b, role_a, role_b, ctx,
                           memories_a="", memories_b=""):
    """Ask the model for the conversation; keep it only if it is well formed
    and every number in it is one of the real figures it was given."""
    from .prompts.gpt_structure import ollama_chat_request
    from . import role_dialogs, fact_check

    def character(name, role):
        fam = role_dialogs.family(role)
        return (f"- {name}, {role_dialogs.FAMILY_LABEL[fam]}: {role_dialogs.ROLE_VOICE[fam]}; "
                f"{_ROLE_CONVO_HINTS.get(role, 'discute i risultati')}")

    facts = "DATI REALI:\n" + build_fl_facts(ctx)
    memories = ""
    if memories_a:
        memories += f"\nRICORDI DI {name_a}:\n{memories_a}"
    if memories_b:
        memories += f"\nRICORDI DI {name_b}:\n{memories_b}"
    characters = f"PERSONAGGI:\n{character(name_a, role_a)}\n{character(name_b, role_b)}"
    # Everything the model is told as a fact: its numbers are the allowed ones
    allowed_source = facts + memories

    base_prompt = (
        f"/no_think\n{_FL_CONVO_SYSTEM}\n\n{facts}{memories}\n\n{characters}\n\n"
        f"Dialogo ({name_a}, {name_b}, {name_a}):"
    )
    reminder = ("\n\nATTENZIONE: nella risposta precedente c'erano numeri che non sono nei DATI REALI. "
                "Riscrivi usando solo quei numeri, oppure nessun numero.")

    for attempt in range(2):
        prompt = base_prompt if attempt == 0 else base_prompt + reminder
        try:
            response = ollama_chat_request(prompt, temperature=0.2, max_tokens=220)
        except Exception as e:
            logger.warning(f"FL convo LLM failed: {e}")
            return Conversation()
        convo = _parse_fl_convo_response(response, name_a, name_b, role_a, role_b)
        # Keep the turns up to the first one that cannot be shown: a number
        # that is not a real figure, a sentence cut short, or a ramble
        kept = []
        for name, line in convo:
            invented = fact_check.unverified_numbers(line, allowed_source)
            if invented:
                logger.warning(f"FL convo: turn discarded, numbers not in the real data {invented[:5]}")
                break
            if len(line.split()) > _MAX_TURN_WORDS or line[-1:] not in ".?!":
                logger.warning("FL convo: turn discarded, too long or cut short")
                break
            kept.append([name, line])
        if len(kept) >= 2:
            return Conversation(kept, from_llm=True)
        logger.warning("FL convo: nothing usable in the model's answer")
    return Conversation()


def _parse_fl_convo_response(response, name_a, name_b, role_a, role_b):
    """Parse the model's answer into [name, utterance] turns (at most 4).
    Lines that are not attributed to one of the two agents are ignored."""
    convo = []
    if not response or "OLLAMA" in response.upper()[:20]:
        return convo
    first_a, first_b = name_a.split()[0].lower(), name_b.split()[0].lower()
    for raw in response.strip().split("\n"):
        line = raw.strip().lstrip("*-• ").strip()
        if ":" not in line:
            continue
        speaker, utterance = line.split(":", 1)
        speaker = speaker.strip().strip("*").lower()
        utterance = utterance.strip().strip('"«»“” ').strip()
        if len(utterance) < 4:
            continue
        if name_a.lower() in speaker or speaker == first_a:
            convo.append([name_a, utterance])
        elif name_b.lower() in speaker or speaker == first_b:
            convo.append([name_b, utterance])
    return convo[:3]
