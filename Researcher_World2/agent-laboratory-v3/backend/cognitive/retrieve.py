"""
Retrieve module for generative agents.
Ported from Park et al. (UIST 2023).

Implements weighted memory retrieval combining recency, importance, and relevance.
"""
import logging

from numpy import dot
from numpy.linalg import norm

from .prompts.gpt_structure import get_embedding

logger = logging.getLogger(__name__)


def retrieve(persona, perceived):
    """
    Takes perceived events and returns related events/thoughts as context.

    Args:
        persona: Persona instance
        perceived: list of ConceptNode events perceived
    Returns:
        dict[description] -> {"curr_event": node, "events": [...], "thoughts": [...]}
    """
    retrieved = dict()
    for event in perceived:
        retrieved[event.description] = dict()
        retrieved[event.description]["curr_event"] = event

        relevant_events = persona.a_mem.retrieve_relevant_events(
            event.subject, event.predicate, event.object)
        retrieved[event.description]["events"] = list(relevant_events)

        relevant_thoughts = persona.a_mem.retrieve_relevant_thoughts(
            event.subject, event.predicate, event.object)
        retrieved[event.description]["thoughts"] = list(relevant_thoughts)

    return retrieved


def cos_sim(a, b):
    """Cosine similarity between two vectors."""
    norm_a = norm(a)
    norm_b = norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0
    return dot(a, b) / (norm_a * norm_b)


def normalize_dict_floats(d, target_min, target_max):
    """Normalize dictionary float values to [target_min, target_max]."""
    if not d:
        return d
    min_val = min(d.values())
    max_val = max(d.values())
    range_val = max_val - min_val

    if range_val == 0:
        for key in d:
            d[key] = (target_max - target_min) / 2
    else:
        for key, val in d.items():
            d[key] = ((val - min_val) * (target_max - target_min)
                      / range_val + target_min)
    return d


def top_highest_x_values(d, x):
    """Return dict with the top x highest-valued entries."""
    return dict(sorted(d.items(), key=lambda item: item[1], reverse=True)[:x])


def extract_recency(persona, nodes):
    """Calculate recency scores using exponential decay."""
    recency_vals = [persona.scratch.recency_decay ** i
                    for i in range(1, len(nodes) + 1)]
    return {node.node_id: recency_vals[count]
            for count, node in enumerate(nodes)}


def extract_importance(persona, nodes):
    """Extract importance (poignancy) scores from nodes."""
    return {node.node_id: node.poignancy for node in nodes}


def extract_relevance(persona, nodes, focal_pt):
    """Calculate relevance scores via cosine similarity with focal point."""
    # Handle ConceptNode or string focal points
    if hasattr(focal_pt, 'description'):
        focal_pt = focal_pt.description
    focal_embedding = get_embedding(str(focal_pt))
    relevance_out = dict()
    for node in nodes:
        if node.embedding_key in persona.a_mem.embeddings:
            node_embedding = persona.a_mem.embeddings[node.embedding_key]
            relevance_out[node.node_id] = cos_sim(node_embedding, focal_embedding)
        else:
            relevance_out[node.node_id] = 0
    return relevance_out


def new_retrieve(persona, focal_points, n_count=30):
    """
    Weighted retrieval combining recency, importance, and relevance.

    Args:
        persona: Persona with a_mem and scratch
        focal_points: list of string descriptions to retrieve against
        n_count: max number of nodes to return per focal point
    Returns:
        dict[focal_pt] -> list of ConceptNode
    """
    retrieved = dict()
    for focal_pt in focal_points:
        # Get all non-idle events and thoughts, sorted by access time
        nodes = [[i.last_accessed, i]
                 for i in persona.a_mem.seq_event + persona.a_mem.seq_thought
                 if "idle" not in i.embedding_key]
        nodes = sorted(nodes, key=lambda x: x[0])
        nodes = [i for created, i in nodes]

        if not nodes:
            retrieved[focal_pt] = []
            continue

        # Calculate and normalize component scores
        recency_out = normalize_dict_floats(extract_recency(persona, nodes), 0, 1)
        importance_out = normalize_dict_floats(extract_importance(persona, nodes), 0, 1)
        relevance_out = normalize_dict_floats(extract_relevance(persona, nodes, focal_pt), 0, 1)

        # Weighted combination: [recency, relevance, importance]
        gw = [0.5, 3, 2]
        master_out = dict()
        for key in recency_out.keys():
            master_out[key] = (
                persona.scratch.recency_w * recency_out[key] * gw[0]
                + persona.scratch.relevance_w * relevance_out.get(key, 0) * gw[1]
                + persona.scratch.importance_w * importance_out[key] * gw[2]
            )

        # Extract top n nodes
        master_out = top_highest_x_values(master_out, n_count)
        master_nodes = [persona.a_mem.id_to_node[key]
                        for key in master_out.keys()
                        if key in persona.a_mem.id_to_node]

        # Update last accessed time
        for n in master_nodes:
            n.last_accessed = persona.scratch.curr_time

        retrieved[focal_pt] = master_nodes

    return retrieved
