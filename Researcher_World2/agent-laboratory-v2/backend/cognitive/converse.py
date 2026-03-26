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

    Returns a short string with up to 2 recent insights (thoughts) about FL
    that can enrich conversation context.
    """
    spec = persona.scratch.fl_specialization or "federated learning"
    focal_points = [spec, target_name]
    try:
        retrieved = new_retrieve(persona, focal_points, n_count=5)
    except Exception:
        return ""

    insights = []
    for _fp, nodes in retrieved.items():
        for node in nodes:
            if node.type == "thought" and node.embedding_key:
                insights.append(node.embedding_key)
    # Deduplicate
    seen = set()
    unique = []
    for ins in insights:
        if ins not in seen:
            seen.add(ins)
            unique.append(ins)
    return "\n".join(unique[:2])


# Minimum number of exchanges before "end" is honored.
# This prevents overly short conversations (1-2 turns).
_MIN_CHAT_TURNS = 3


def generate_one_utterance(maze, init_persona, target_persona, retrieved, curr_chat):
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
            maze, init_persona, target_persona, retrieved, curr_chat)
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
            maze, target_persona, init_persona, retrieved, curr_chat)
        curr_chat.append([target_persona.scratch.name, utt])
        if end:
            break

    return curr_chat


# ==========================================================================
# FL-specific conversation generation (post-round)
# ==========================================================================

_FL_CONVO_SYSTEM = (
    "Genera un dialogo realistico in italiano tra due ricercatori che discutono "
    "i risultati dell'ultimo round di Federated Learning. "
    "REGOLE:\n"
    "- Ogni battuta: 1-2 frasi, naturale, coerente col ruolo\n"
    "- Il dialogo deve riflettere le competenze specifiche di ciascun ruolo\n"
    "- Usa i DATI REALI forniti (accuracy, gain, budget privacy)\n"
    "- Se ci sono RICORDI degli agenti, integra quei pensieri nel dialogo\n"
    "- Rispondi SOLO con il dialogo, formato: NomeAgente: battuta\n"
    "- Esattamente 4 battute alternate"
)

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

_FL_CONVO_STUBS = {
    "professor": [
        "I risultati di questo round mostrano come la diversità dei dati influenzi la convergenza.",
        "La federazione ci permette di generalizzare su fasce demografiche che non osserviamo localmente.",
        "Dobbiamo monitorare attentamente il trade-off tra privacy e utilità del modello.",
    ],
    "privacy_specialist": [
        "Il rumore differenziale sta proteggendo i gradienti senza compromettere troppo l'accuracy.",
        "Il budget di privacy si sta consumando come previsto, dobbiamo gestirlo con attenzione.",
        "Nessun dato grezzo è stato condiviso tra i laboratori — solo parametri del modello.",
    ],
    "researcher": [
        "L'accuracy globale sta migliorando grazie alla collaborazione tra i tre laboratori.",
        "Il modello federato riesce a generalizzare meglio del modello locale su dati non visti.",
        "Dovremmo analizzare il delta tra accuracy locale e globale per capire il contributo di ogni lab.",
    ],
    "student": [
        "È interessante vedere come il modello migliora usando dati che non abbiamo mai visto.",
        "Ho notato che il nostro dataset locale ha un bias per la fascia di età dei nostri pazienti.",
        "Il federated learning sembra davvero utile per la ricerca medica collaborativa.",
    ],
    "doctor": [
        "Dal punto di vista clinico, la diversità dei dati è fondamentale per un modello affidabile.",
        "Ogni ospedale ha pazienti con caratteristiche diverse — la federazione colma queste lacune.",
        "È rassicurante sapere che i dati dei pazienti non lasciano mai il nostro laboratorio.",
    ],
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


def generate_fl_conversation(
    agent_a,
    agent_b,
    fl_context: dict,
    use_llm: bool = False,
) -> list:
    """Generate a short FL-specific conversation between two agents.

    Args:
        agent_a, agent_b: agent objects with .name, .role, .lab_id, .scratch attributes
        fl_context: dict with keys like round, accuracy, gain, dp_budget, lab_id, demo
        use_llm: if True, call LLM; otherwise use role-based stubs

    Returns:
        List of [agent_name, utterance] pairs (4 turns)
    """
    name_a = agent_a.name
    name_b = agent_b.name
    role_a = getattr(agent_a, 'role', 'researcher')
    role_b = getattr(agent_b, 'role', 'researcher')

    if use_llm:
        # Retrieve FL memories for richer context (quick, ~0s for stubs)
        mem_a = _retrieve_agent_fl_memories(agent_a)
        mem_b = _retrieve_agent_fl_memories(agent_b)
        return _generate_fl_convo_llm(
            name_a, name_b, role_a, role_b, fl_context,
            memories_a=mem_a, memories_b=mem_b,
        )
    else:
        return _generate_fl_convo_stub(name_a, name_b, role_a, role_b, fl_context)


def _generate_fl_convo_stub(name_a, name_b, role_a, role_b, ctx):
    """Generate a stub FL conversation using role-based templates."""
    import random

    rnd = ctx.get("round", 0)
    acc = ctx.get("accuracy", 0)
    gain = ctx.get("gain", 0)
    dp_budget = ctx.get("dp_budget", 1.0)
    lab = ctx.get("lab_id", "")

    lines_a = _FL_CONVO_STUBS.get(role_a, _FL_CONVO_STUBS["researcher"])
    lines_b = _FL_CONVO_STUBS.get(role_b, _FL_CONVO_STUBS["researcher"])

    # Pick a line for each and add context
    rng = random.Random(rnd * 7 + hash(name_a) % 100)
    utt_a1 = rng.choice(lines_a)
    utt_b1 = rng.choice(lines_b)

    # Add round-specific details
    utt_a2 = f"Al round {rnd}, l'accuracy globale è {acc:.0%} con un gain di {gain:+.1%} per {lab}."
    utt_b2 = f"Il budget privacy è al {dp_budget:.0%}. {'Dobbiamo fare attenzione.' if dp_budget < 0.3 else 'Procediamo bene.'}"

    return [
        [name_a, utt_a1],
        [name_b, utt_b1],
        [name_a, utt_a2],
        [name_b, utt_b2],
    ]


def _generate_fl_convo_llm(name_a, name_b, role_a, role_b, ctx,
                           memories_a="", memories_b=""):
    """Generate an FL conversation via LLM call with agent memories."""
    from .prompts.gpt_structure import ollama_chat_request

    rnd = ctx.get("round", 0)
    acc = ctx.get("accuracy", 0)
    gain = ctx.get("gain", 0)
    dp_budget = ctx.get("dp_budget", 1.0)
    lab = ctx.get("lab_id", "")
    demo = ctx.get("demo", "pazienti")

    hint_a = _ROLE_CONVO_HINTS.get(role_a, "discute i risultati FL")
    hint_b = _ROLE_CONVO_HINTS.get(role_b, "discute i risultati FL")

    # Build memory section only if available
    mem_section = ""
    if memories_a:
        mem_section += f"\nRicordi recenti di {name_a}:\n{memories_a}\n"
    if memories_b:
        mem_section += f"\nRicordi recenti di {name_b}:\n{memories_b}\n"

    # Gain interpretation
    if gain > 0.02:
        gain_note = f"La federazione migliora l'accuracy di {gain:+.1%} rispetto al modello locale"
    elif gain < -0.02:
        gain_note = f"Il modello locale è ancora migliore di {abs(gain):.1%} — il globale deve convergere"
    else:
        gain_note = "Modello locale e globale hanno performance simili"

    prompt = (
        f"{_FL_CONVO_SYSTEM}\n\n"
        f"DATI ROUND:\n"
        f"- Lab: {lab} (specializzato in {demo})\n"
        f"- Round completato: {rnd}\n"
        f"- Accuracy modello globale: {acc:.1%}\n"
        f"- {gain_note}\n"
        f"- Budget privacy (DP-SGD): {dp_budget:.0%} rimanente"
        f"{' — ATTENZIONE: quasi esaurito!' if dp_budget < 0.2 else ''}\n"
        f"{mem_section}\n"
        f"PERSONAGGI:\n"
        f"- {name_a} ({role_a}): {hint_a}\n"
        f"- {name_b} ({role_b}): {hint_b}\n\n"
        f"Dialogo (4 battute: {name_a}, {name_b}, {name_a}, {name_b}):"
    )

    try:
        response = ollama_chat_request(prompt, max_tokens=250)
        return _parse_fl_convo_response(response, name_a, name_b, role_a, role_b, ctx)
    except Exception as e:
        logger.warning(f"FL convo LLM failed: {e}, falling back to stubs")
        return _generate_fl_convo_stub(name_a, name_b, role_a, role_b, ctx)


def _parse_fl_convo_response(response, name_a, name_b, role_a, role_b, ctx):
    """Parse LLM response into conversation list. Falls back to stubs on failure."""
    lines = [l.strip() for l in response.strip().split("\n") if l.strip()]
    convo = []

    for line in lines:
        # Try to parse "Name: utterance" format
        if ":" in line:
            parts = line.split(":", 1)
            speaker = parts[0].strip()
            utterance = parts[1].strip()
            if utterance:
                # Map speaker to actual agent name
                if name_a.lower() in speaker.lower() or role_a.lower() in speaker.lower():
                    convo.append([name_a, utterance])
                elif name_b.lower() in speaker.lower() or role_b.lower() in speaker.lower():
                    convo.append([name_b, utterance])
                else:
                    # Alternate assignment
                    expected = name_a if len(convo) % 2 == 0 else name_b
                    convo.append([expected, utterance])

    if len(convo) >= 2:
        return convo[:6]  # Cap at 6 turns

    # Fallback to stubs
    return _generate_fl_convo_stub(name_a, name_b, role_a, role_b, ctx)
