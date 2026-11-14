"""
Associative Memory (Memory Stream) for generative agents.
Ported from Park et al. (UIST 2023).

Stores long-term memory as ConceptNode objects with:
  - Subject-Predicate-Object triples
  - Poignancy scores (importance)
  - Embedding keys for semantic retrieval
  - Keyword-based fast lookup
  - Temporal decay: nodes auto-expire based on type and poignancy
"""
import json
import datetime
import logging
import os

logger = logging.getLogger(__name__)

# Maximum nodes per sequence before pruning kicks in.
# Expired nodes are always removed; if still over limit, lowest-poignancy
# oldest nodes are dropped.
MAX_SEQ_EVENT = 200
MAX_SEQ_THOUGHT = 150
MAX_SEQ_CHAT = 100

# Temporal decay: base lifetime (hours) per node type.
# High-poignancy nodes live longer: lifetime = base * (1 + poignancy/10).
# E.g., an event with poignancy 8 lasts 24 * (1 + 0.8) = 43.2 hours.
DECAY_BASE_HOURS = {
    "event": 24,      # routine events: ~1-2 sim days
    "thought": 72,    # reflections: ~3-6 sim days
    "chat": 48,       # conversations: ~2-4 sim days
}

from cognitive import check_if_file_exists, create_folder_if_not_there


class ConceptNode:
    def __init__(self,
                 node_id, node_count, type_count, node_type, depth,
                 created, expiration,
                 s, p, o,
                 description, embedding_key, poignancy, keywords, filling):
        self.node_id = node_id
        self.node_count = node_count
        self.type_count = type_count
        self.type = node_type  # "thought" / "event" / "chat"
        self.depth = depth

        self.created = created
        self.expiration = expiration
        self.last_accessed = self.created

        self.subject = s
        self.predicate = p
        self.object = o

        self.description = description
        self.embedding_key = embedding_key
        self.poignancy = poignancy
        self.keywords = keywords
        self.filling = filling

    def spo_summary(self):
        return (self.subject, self.predicate, self.object)


def compute_expiration(created: datetime.datetime, node_type: str, poignancy: float):
    """Compute expiration time based on node type and poignancy.

    Higher poignancy = longer lifetime. Returns datetime or None if no decay.
    """
    base_hours = DECAY_BASE_HOURS.get(node_type, 48)
    # Scale: poignancy 1 → 1.1x, poignancy 10 → 2.0x
    lifetime_hours = base_hours * (1.0 + poignancy / 10.0)
    return created + datetime.timedelta(hours=lifetime_hours)


# Role-specific keywords: when an agent with this role adds a memory
# containing these keywords, kw_strength gets a bonus (+2 instead of +1).
_ROLE_KW_BOOST = {
    "professor": {"architecture", "theory", "convergence", "framework", "design",
                  "architettura", "teoria", "convergenza", "progettazione"},
    "researcher": {"experiment", "accuracy", "model", "aggregation", "non-iid",
                   "esperimento", "accuratezza", "modello", "aggregazione"},
    "student": {"learning", "training", "gradient", "loss", "epoch",
                "apprendimento", "addestramento", "gradiente"},
    "doctor": {"patient", "clinical", "diagnosis", "health", "disease",
               "paziente", "clinico", "diagnosi", "salute", "malattia"},
    "privacy_specialist": {"privacy", "differential", "epsilon", "noise", "budget",
                           "gdpr", "compliance", "rumore", "protezione"},
}


class AssociativeMemory:
    def __init__(self, f_saved=None):
        self.id_to_node = dict()

        self.seq_event = []
        self.seq_thought = []
        self.seq_chat = []

        self.kw_to_event = dict()
        self.kw_to_thought = dict()
        self.kw_to_chat = dict()

        self.kw_strength_event = dict()
        self.kw_strength_thought = dict()

        self.embeddings = dict()

        # Role of the owning agent (set after construction)
        self.agent_role = None

        # Number given to the next node. It only grows: a number is never
        # reused after its node has been pruned (reusing it overwrote surviving
        # nodes and broke save()).
        self._next_node_number = 1
        # Latest simulated time seen by this memory: the "now" that expirations
        # are compared against (expirations are in simulated time too).
        self._clock = None

        if f_saved and os.path.isdir(f_saved):
            embeddings_path = os.path.join(f_saved, "embeddings.json")
            if check_if_file_exists(embeddings_path):
                with open(embeddings_path) as f:
                    self.embeddings = json.load(f)

            nodes_path = os.path.join(f_saved, "nodes.json")
            if check_if_file_exists(nodes_path):
                with open(nodes_path) as f:
                    nodes_load = json.load(f)

                # Handle empty bootstrap (list or empty dict)
                if not isinstance(nodes_load, dict) or not nodes_load:
                    nodes_load = {}

                # Every saved node, oldest first, each keeping its own number
                # (numbers can have gaps where nodes were pruned)
                for node_id in sorted(nodes_load, key=lambda k: nodes_load[k]["node_count"]):
                    node_details = nodes_load[node_id]

                    node_count = node_details["node_count"]
                    self._next_node_number = max(self._next_node_number, node_count)
                    type_count = node_details["type_count"]
                    node_type = node_details["type"]
                    depth = node_details["depth"]

                    created = datetime.datetime.strptime(
                        node_details["created"], '%Y-%m-%d %H:%M:%S')
                    expiration = None
                    if node_details["expiration"]:
                        expiration = datetime.datetime.strptime(
                            node_details["expiration"], '%Y-%m-%d %H:%M:%S')

                    s = node_details["subject"]
                    p = node_details["predicate"]
                    o = node_details["object"]

                    description = node_details["description"]
                    embedding_pair = (node_details["embedding_key"],
                                      self.embeddings.get(node_details["embedding_key"], []))
                    poignancy = node_details["poignancy"]
                    keywords = set(node_details["keywords"])
                    filling = node_details["filling"]

                    if node_type == "event":
                        self.add_event(created, expiration, s, p, o,
                                       description, keywords, poignancy,
                                       embedding_pair, filling)
                    elif node_type == "chat":
                        self.add_chat(created, expiration, s, p, o,
                                      description, keywords, poignancy,
                                      embedding_pair, filling)
                    elif node_type == "thought":
                        self.add_thought(created, expiration, s, p, o,
                                         description, keywords, poignancy,
                                         embedding_pair, filling)

            kw_strength_path = os.path.join(f_saved, "kw_strength.json")
            if check_if_file_exists(kw_strength_path):
                with open(kw_strength_path) as f:
                    kw_strength_load = json.load(f)
                if kw_strength_load.get("kw_strength_event"):
                    self.kw_strength_event = kw_strength_load["kw_strength_event"]
                if kw_strength_load.get("kw_strength_thought"):
                    self.kw_strength_thought = kw_strength_load["kw_strength_thought"]

    # ------------------------------------------------------------------
    # Memory pruning
    # ------------------------------------------------------------------
    def _prune(self, seq_name: str, max_size: int):
        """Remove expired nodes, then drop least-important if over limit."""
        seq = getattr(self, seq_name)
        if len(seq) <= max_size:
            return

        # Only the excess is removed, never the whole sequence. Expired nodes
        # go first, then the least important, then the oldest. "Expired" is
        # judged against the simulated clock: comparing a simulated expiration
        # with the wall clock made every node look expired and emptied the
        # memory as soon as it went over its limit.
        now = self._clock
        excess = len(seq) - max_size

        def removal_order(node):
            expired = bool(now and node.expiration and node.expiration < now)
            return (0 if expired else 1, node.poignancy, node.created)

        to_remove = sorted(seq, key=removal_order)[:excess]

        if not to_remove:
            return

        remove_set = set(id(n) for n in to_remove)
        # remove from sequence
        setattr(self, seq_name, [n for n in seq if id(n) not in remove_set])

        # clean up indexes
        kw_map_name = seq_name.replace("seq_", "kw_to_")
        kw_map = getattr(self, kw_map_name, {})
        for kw in list(kw_map.keys()):
            kw_map[kw] = [n for n in kw_map[kw] if id(n) not in remove_set]
            if not kw_map[kw]:
                del kw_map[kw]

        # clean up id_to_node and embeddings
        for node in to_remove:
            self.id_to_node.pop(node.node_id, None)
            self.embeddings.pop(node.embedding_key, None)

        logger.debug(f"Pruned {len(to_remove)} nodes from {seq_name} "
                     f"(now {len(getattr(self, seq_name))})")

    def save(self, out_json):
        create_folder_if_not_there(out_json + "/nodes.json")

        r = dict()
        for node_id, node in sorted(self.id_to_node.items(),
                                    key=lambda item: item[1].node_count, reverse=True):

            r[node_id] = dict()
            r[node_id]["node_count"] = node.node_count
            r[node_id]["type_count"] = node.type_count
            r[node_id]["type"] = node.type
            r[node_id]["depth"] = node.depth

            r[node_id]["created"] = node.created.strftime('%Y-%m-%d %H:%M:%S')
            r[node_id]["expiration"] = None
            if node.expiration:
                r[node_id]["expiration"] = node.expiration.strftime('%Y-%m-%d %H:%M:%S')

            r[node_id]["subject"] = node.subject
            r[node_id]["predicate"] = node.predicate
            r[node_id]["object"] = node.object

            r[node_id]["description"] = node.description
            r[node_id]["embedding_key"] = node.embedding_key
            r[node_id]["poignancy"] = node.poignancy
            r[node_id]["keywords"] = list(node.keywords)
            r[node_id]["filling"] = node.filling

        with open(os.path.join(out_json, "nodes.json"), "w") as outfile:
            json.dump(r, outfile, indent=2)

        kw = dict()
        kw["kw_strength_event"] = self.kw_strength_event
        kw["kw_strength_thought"] = self.kw_strength_thought
        with open(os.path.join(out_json, "kw_strength.json"), "w") as outfile:
            json.dump(kw, outfile, indent=2)

        with open(os.path.join(out_json, "embeddings.json"), "w") as outfile:
            json.dump(self.embeddings, outfile)

    def _kw_strength_increment(self, kw: str) -> int:
        """Return kw_strength increment: +2 if keyword matches agent role, else +1."""
        if self.agent_role:
            role_kws = _ROLE_KW_BOOST.get(self.agent_role, set())
            if kw in role_kws:
                return 2
        return 1

    def _take_node_number(self, created) -> int:
        """Return the number for a new node and move the simulated clock forward."""
        number = self._next_node_number
        self._next_node_number += 1
        if isinstance(created, datetime.datetime) and (self._clock is None or created > self._clock):
            self._clock = created
        return number

    def decay_memories(self):
        """Run temporal decay: prune expired nodes from all sequences."""
        self._prune("seq_event", MAX_SEQ_EVENT)
        self._prune("seq_thought", MAX_SEQ_THOUGHT)
        self._prune("seq_chat", MAX_SEQ_CHAT)

    def add_event(self, created, expiration, s, p, o,
                  description, keywords, poignancy,
                  embedding_pair, filling):
        # Auto-set expiration via temporal decay if not provided
        if expiration is None and created:
            expiration = compute_expiration(created, "event", poignancy)

        node_count = self._take_node_number(created)
        type_count = len(self.seq_event) + 1
        node_type = "event"
        node_id = f"node_{node_count}"
        depth = 0

        # Clean up descriptions with parentheses
        if "(" in description:
            description = (" ".join(description.split()[:3])
                           + " "
                           + description.split("(")[-1][:-1])

        node = ConceptNode(node_id, node_count, type_count, node_type, depth,
                           created, expiration,
                           s, p, o,
                           description, embedding_pair[0],
                           poignancy, keywords, filling)

        self.seq_event[0:0] = [node]
        keywords_lower = [i.lower() for i in keywords]
        for kw in keywords_lower:
            if kw in self.kw_to_event:
                self.kw_to_event[kw][0:0] = [node]
            else:
                self.kw_to_event[kw] = [node]
        self.id_to_node[node_id] = node

        if f"{p} {o}" != "is idle":
            for kw in keywords_lower:
                inc = self._kw_strength_increment(kw)
                if kw in self.kw_strength_event:
                    self.kw_strength_event[kw] += inc
                else:
                    self.kw_strength_event[kw] = inc

        self.embeddings[embedding_pair[0]] = embedding_pair[1]
        self._prune("seq_event", MAX_SEQ_EVENT)
        return node

    def add_thought(self, created, expiration, s, p, o,
                    description, keywords, poignancy,
                    embedding_pair, filling):
        # Auto-set expiration via temporal decay if not provided
        if expiration is None and created:
            expiration = compute_expiration(created, "thought", poignancy)

        node_count = self._take_node_number(created)
        type_count = len(self.seq_thought) + 1
        node_type = "thought"
        node_id = f"node_{node_count}"
        depth = 1
        try:
            if filling:
                depth += max([self.id_to_node[i].depth for i in filling])
        except (KeyError, ValueError, AttributeError):
            pass

        node = ConceptNode(node_id, node_count, type_count, node_type, depth,
                           created, expiration,
                           s, p, o,
                           description, embedding_pair[0], poignancy,
                           keywords, filling)

        self.seq_thought[0:0] = [node]
        keywords_lower = [i.lower() for i in keywords]
        for kw in keywords_lower:
            if kw in self.kw_to_thought:
                self.kw_to_thought[kw][0:0] = [node]
            else:
                self.kw_to_thought[kw] = [node]
        self.id_to_node[node_id] = node

        if f"{p} {o}" != "is idle":
            for kw in keywords_lower:
                inc = self._kw_strength_increment(kw)
                if kw in self.kw_strength_thought:
                    self.kw_strength_thought[kw] += inc
                else:
                    self.kw_strength_thought[kw] = inc

        self.embeddings[embedding_pair[0]] = embedding_pair[1]
        self._prune("seq_thought", MAX_SEQ_THOUGHT)
        return node

    def add_chat(self, created, expiration, s, p, o,
                 description, keywords, poignancy,
                 embedding_pair, filling):
        # Auto-set expiration via temporal decay if not provided
        if expiration is None and created:
            expiration = compute_expiration(created, "chat", poignancy)

        node_count = self._take_node_number(created)
        type_count = len(self.seq_chat) + 1
        node_type = "chat"
        node_id = f"node_{node_count}"
        depth = 0

        node = ConceptNode(node_id, node_count, type_count, node_type, depth,
                           created, expiration,
                           s, p, o,
                           description, embedding_pair[0], poignancy,
                           keywords, filling)

        self.seq_chat[0:0] = [node]
        keywords_lower = [i.lower() for i in keywords]
        for kw in keywords_lower:
            if kw in self.kw_to_chat:
                self.kw_to_chat[kw][0:0] = [node]
            else:
                self.kw_to_chat[kw] = [node]
        self.id_to_node[node_id] = node

        self.embeddings[embedding_pair[0]] = embedding_pair[1]
        self._prune("seq_chat", MAX_SEQ_CHAT)
        return node

    def get_summarized_latest_events(self, retention):
        ret_set = set()
        for e_node in self.seq_event[:retention]:
            ret_set.add(e_node.spo_summary())
        return ret_set

    def get_str_seq_events(self):
        ret_str = ""
        for count, event in enumerate(self.seq_event):
            ret_str += f"Event {len(self.seq_event) - count}: {event.spo_summary()} -- {event.description}\n"
        return ret_str

    def get_str_seq_thoughts(self):
        ret_str = ""
        for count, event in enumerate(self.seq_thought):
            ret_str += f"Thought {len(self.seq_thought) - count}: {event.spo_summary()} -- {event.description}\n"
        return ret_str

    def get_str_seq_chats(self):
        ret_str = ""
        for count, event in enumerate(self.seq_chat):
            ret_str += f"with {event.object} ({event.description})\n"
            ret_str += f'{event.created.strftime("%B %d, %Y, %H:%M:%S")}\n'
            if event.filling:
                for row in event.filling:
                    ret_str += f"{row[0]}: {row[1]}\n"
        return ret_str

    def retrieve_relevant_thoughts(self, s_content, p_content, o_content):
        contents = [s_content, p_content, o_content]
        ret = []
        for i in contents:
            if i and i.lower() in self.kw_to_thought:
                ret += self.kw_to_thought[i.lower()]
        return set(ret)

    def retrieve_relevant_events(self, s_content, p_content, o_content):
        contents = [s_content, p_content, o_content]
        ret = []
        for i in contents:
            if i and i in self.kw_to_event:
                ret += self.kw_to_event[i]
        return set(ret)

    def get_last_chat(self, target_persona_name):
        if target_persona_name.lower() in self.kw_to_chat:
            return self.kw_to_chat[target_persona_name.lower()][0]
        return False
