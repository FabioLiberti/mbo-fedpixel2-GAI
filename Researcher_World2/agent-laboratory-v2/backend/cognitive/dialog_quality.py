"""
Dialog Quality Monitor for FL conversations.

Evaluates generated dialogs with zero-overhead metrics (no LLM calls):
  - data_grounding:       does the dialog cite real FL data?
  - role_differentiation: do speakers use role-coherent vocabulary?
  - memory_integration:   does the dialog reflect agent memories?
  - repetition_score:     how novel is this dialog vs recent history?
  - format_compliance:    correct turn count and alternation?
  - overall_quality:      weighted average of all metrics

Results are logged to a persistent JSON file and exposed via API.
"""

import json
import os
import re
import logging
import datetime
from typing import Dict, List, Any, Optional, Tuple
from collections import Counter

logger = logging.getLogger(__name__)

# Role-specific vocabulary sets for differentiation scoring
_ROLE_VOCABULARY = {
    "professor": {
        "convergenza", "generalizzazione", "bias", "framework", "architettura",
        "teoria", "analisi", "critica", "supervisione", "strategia",
        "convergence", "generalization", "bias", "framework", "architecture",
    },
    "researcher": {
        "accuracy", "metriche", "esperimento", "delta", "aggregazione",
        "modello", "dataset", "non-iid", "cross-evaluation", "benchmark",
        "metrics", "experiment", "aggregation", "model",
    },
    "student": {
        "appreso", "capito", "interessante", "curiosità", "formazione",
        "osservato", "domanda", "imparato", "studio", "tesi",
        "learned", "interesting", "observed", "question",
    },
    "doctor": {
        "clinico", "paziente", "diagnosi", "clinica", "validità",
        "sanitario", "terapia", "prognosi", "patologia", "salute",
        "clinical", "patient", "diagnosis", "health", "medical",
    },
    "privacy_specialist": {
        "privacy", "epsilon", "budget", "rumore", "differenziale",
        "gdpr", "protezione", "compliance", "dp-sgd", "gaussiano",
        "noise", "differential", "protection",
    },
    "professor_senior": {
        "strategia", "visione", "coordinamento", "leadership",
        "inter-laboratorio", "confronto", "approccio", "lungo termine",
    },
    "sw_engineer": {
        "implementazione", "scalabilità", "performance", "sistema",
        "infrastruttura", "api", "piattaforma", "deploy",
    },
    "engineer": {
        "infrastruttura", "comunicazione", "nodi", "efficienza",
        "ottimizzazione", "latenza", "throughput", "rete",
    },
    "student_postdoc": {
        "metodologia", "miglioramento", "analisi", "approfondimento",
        "prototipo", "sperimentale", "ipotesi", "risultato",
    },
}

# FL data keywords that should appear if data_grounding is high
_FL_DATA_PATTERNS = [
    r"\d+[.,]?\d*\s*%",         # percentages (78%, 3.2%)
    r"accuracy",
    r"gain",
    r"budget\s*(privacy|di privacy)",
    r"round\s*\d+",
    r"modello\s*(globale|locale|federato)",
    r"epsilon|ε",
    r"dp-sgd|differenziale",
]

# Default log directory
_DEFAULT_LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "logs", "dialog_quality")


class DialogQualityMonitor:
    """Monitors and scores dialog quality with persistent logging."""

    def __init__(self, log_dir: Optional[str] = None, history_size: int = 50):
        self.log_dir = log_dir or _DEFAULT_LOG_DIR
        os.makedirs(self.log_dir, exist_ok=True)

        self._log_path = os.path.join(self.log_dir, "dialog_scores.jsonl")
        self._summary_path = os.path.join(self.log_dir, "quality_summary.json")

        # Rolling history for repetition detection
        self._history_size = history_size
        self._recent_dialogs: List[str] = []

        # Aggregate stats
        self._total_evaluated = 0
        self._score_sums: Dict[str, float] = {
            "data_grounding": 0.0,
            "role_differentiation": 0.0,
            "memory_integration": 0.0,
            "repetition_score": 0.0,
            "format_compliance": 0.0,
            "overall_quality": 0.0,
        }
        self._per_round_scores: List[Dict[str, Any]] = []

        # Load existing history if available
        self._load_history()

        logger.info(f"DialogQualityMonitor initialized, log: {self._log_path}")

    def _load_history(self):
        """Load recent dialog texts from log for repetition detection."""
        if not os.path.exists(self._log_path):
            return
        try:
            with open(self._log_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    entry = json.loads(line)
                    text = entry.get("dialog_text", "")
                    if text:
                        self._recent_dialogs.append(text)
                    self._total_evaluated += 1
                    for key in self._score_sums:
                        self._score_sums[key] += entry.get("scores", {}).get(key, 0)
            # Keep only recent
            self._recent_dialogs = self._recent_dialogs[-self._history_size:]
            logger.info(f"Loaded {self._total_evaluated} historical dialog evaluations")
        except Exception as e:
            logger.warning(f"Failed to load dialog history: {e}")

    # ------------------------------------------------------------------
    # Individual metric scorers
    # ------------------------------------------------------------------

    def _score_data_grounding(self, dialog: List[List[str]],
                               fl_context: Dict[str, Any]) -> Tuple[float, List[str]]:
        """Score how well the dialog references real FL data.
        Returns (score 0-1, list of matched data points)."""
        full_text = " ".join(utt for _, utt in dialog).lower()
        matches = []

        # Check for specific FL values from context
        acc = fl_context.get("accuracy", 0)
        gain = fl_context.get("gain", 0)
        budget = fl_context.get("dp_budget", 1.0)
        rnd = fl_context.get("round", 0)

        # Check if actual numeric values appear
        acc_pct = f"{acc:.0%}".replace("%", "")  # "78"
        if acc_pct in full_text or f"{acc*100:.1f}" in full_text:
            matches.append(f"accuracy={acc:.0%}")

        gain_str = f"{abs(gain)*100:.1f}"
        if gain_str in full_text:
            matches.append(f"gain={gain:+.1%}")

        budget_str = f"{budget*100:.0f}"
        if budget_str in full_text or "budget" in full_text:
            matches.append(f"budget={budget:.0%}")

        if str(rnd) in full_text and ("round" in full_text or "ciclo" in full_text):
            matches.append(f"round={rnd}")

        # Check generic FL patterns
        pattern_hits = 0
        for pattern in _FL_DATA_PATTERNS:
            if re.search(pattern, full_text):
                pattern_hits += 1

        # Score: 0.4 from specific values, 0.6 from pattern coverage
        specific_score = min(1.0, len(matches) / 3.0)  # 3 values = perfect
        pattern_score = min(1.0, pattern_hits / 4.0)    # 4 patterns = perfect
        score = 0.4 * specific_score + 0.6 * pattern_score

        return round(score, 3), matches

    def _score_role_differentiation(self, dialog: List[List[str]],
                                     roles: Dict[str, str]) -> Tuple[float, Dict[str, float]]:
        """Score how well each speaker's vocabulary matches their role.
        Returns (score 0-1, per-speaker scores)."""
        if not roles:
            return 0.5, {}

        per_speaker = {}
        for speaker, utterance in dialog:
            role = roles.get(speaker, "researcher")
            vocab = _ROLE_VOCABULARY.get(role, set())
            if not vocab:
                per_speaker[speaker] = 0.5
                continue

            words = set(utterance.lower().split())
            # Also check 2-grams
            utt_lower = utterance.lower()
            hits = sum(1 for v in vocab if v in utt_lower)
            # Score: at least 1 role word = 0.5, 2 = 0.75, 3+ = 1.0
            per_speaker[speaker] = min(1.0, hits * 0.35) if hits > 0 else 0.0

        if not per_speaker:
            return 0.5, {}

        avg = sum(per_speaker.values()) / len(per_speaker)
        return round(avg, 3), {k: round(v, 3) for k, v in per_speaker.items()}

    def _score_memory_integration(self, dialog: List[List[str]],
                                   memories: Dict[str, str]) -> Tuple[float, List[str]]:
        """Score whether agent memories are reflected in the dialog.
        Returns (score 0-1, list of memory fragments found)."""
        if not memories:
            return 0.0, []  # No memories provided → can't score, neutral

        full_text = " ".join(utt for _, utt in dialog).lower()
        found = []

        for agent_name, mem_text in memories.items():
            if not mem_text:
                continue
            # Extract key phrases from memory (words > 4 chars)
            mem_words = set(w for w in mem_text.lower().split()
                           if len(w) > 4 and w not in {
                               "round", "accuracy", "modello", "della", "delle",
                               "negli", "nella", "hanno", "essere", "viene"})
            # Check how many memory keywords appear in dialog
            hits = sum(1 for w in mem_words if w in full_text)
            ratio = hits / max(len(mem_words), 1)
            if ratio > 0.1:
                found.append(f"{agent_name}: {hits}/{len(mem_words)} keywords")

        score = min(1.0, len(found) / max(len(memories), 1))
        return round(score, 3), found

    def _score_repetition(self, dialog: List[List[str]]) -> Tuple[float, float]:
        """Score novelty vs recent dialog history.
        Returns (novelty_score 0-1, max_similarity with any recent dialog)."""
        current_text = " ".join(utt for _, utt in dialog).lower()

        if not self._recent_dialogs:
            return 1.0, 0.0  # No history → fully novel

        # Use word-level Jaccard similarity
        current_words = Counter(current_text.split())
        max_sim = 0.0

        for past_text in self._recent_dialogs[-20:]:  # Check last 20
            past_words = Counter(past_text.split())
            intersection = sum((current_words & past_words).values())
            union = sum((current_words | past_words).values())
            if union > 0:
                sim = intersection / union
                max_sim = max(max_sim, sim)

        # Also check internal repetition (same phrases across turns)
        utterances = [utt.lower() for _, utt in dialog]
        internal_sim = 0.0
        if len(utterances) >= 2:
            for i in range(len(utterances)):
                for j in range(i + 1, len(utterances)):
                    w_i = Counter(utterances[i].split())
                    w_j = Counter(utterances[j].split())
                    inter = sum((w_i & w_j).values())
                    uni = sum((w_i | w_j).values())
                    if uni > 0:
                        internal_sim = max(internal_sim, inter / uni)

        # Novelty = 1 - max(external_similarity, internal_similarity)
        combined_sim = max(max_sim, internal_sim * 0.7)
        novelty = max(0.0, 1.0 - combined_sim)

        return round(novelty, 3), round(max_sim, 3)

    def _score_format_compliance(self, dialog: List[List[str]],
                                  expected_speakers: List[str] = None) -> Tuple[float, List[str]]:
        """Score format: turn count, alternation, non-empty utterances.
        Returns (score 0-1, list of issues)."""
        issues = []

        # Check turn count (expect 4, tolerate 3-6)
        n = len(dialog)
        if n < 3:
            issues.append(f"troppo corto: {n} battute (minimo 3)")
        elif n > 6:
            issues.append(f"troppo lungo: {n} battute (massimo 6)")

        turn_score = 1.0 if 3 <= n <= 6 else max(0.0, 1.0 - abs(n - 4) * 0.25)

        # Check alternation
        alternation_ok = True
        for i in range(1, len(dialog)):
            if dialog[i][0] == dialog[i - 1][0]:
                alternation_ok = False
                issues.append(f"speaker ripetuto: battuta {i} e {i+1}")
                break
        alt_score = 1.0 if alternation_ok else 0.5

        # Check non-empty utterances
        empty = sum(1 for _, utt in dialog if not utt.strip())
        if empty:
            issues.append(f"{empty} battute vuote")
        empty_score = 1.0 - (empty / max(n, 1))

        # Check expected speakers
        speaker_score = 1.0
        if expected_speakers:
            actual = set(s for s, _ in dialog)
            expected = set(expected_speakers)
            if actual != expected:
                missing = expected - actual
                if missing:
                    issues.append(f"speaker mancanti: {missing}")
                    speaker_score = len(actual & expected) / len(expected)

        score = 0.3 * turn_score + 0.3 * alt_score + 0.2 * empty_score + 0.2 * speaker_score
        return round(score, 3), issues

    # ------------------------------------------------------------------
    # Main evaluation entry point
    # ------------------------------------------------------------------

    def evaluate(self,
                 dialog: List[List[str]],
                 fl_context: Dict[str, Any],
                 roles: Dict[str, str] = None,
                 memories: Dict[str, str] = None,
                 expected_speakers: List[str] = None,
                 source: str = "llm",
                 lab_id: str = "",
                 ) -> Dict[str, Any]:
        """Evaluate a dialog and return quality scores.

        Args:
            dialog: list of [speaker_name, utterance] pairs
            fl_context: dict with round, accuracy, gain, dp_budget, lab_id
            roles: {speaker_name: role_type} mapping
            memories: {speaker_name: memory_text} for memory integration check
            expected_speakers: list of expected speaker names
            source: "llm" or "stub"
            lab_id: laboratory identifier

        Returns:
            Dict with scores, details, and metadata
        """
        if not dialog:
            return {"scores": {k: 0.0 for k in self._score_sums}, "error": "empty dialog"}

        # Compute all metrics
        data_score, data_matches = self._score_data_grounding(dialog, fl_context)
        role_score, role_details = self._score_role_differentiation(dialog, roles or {})
        mem_score, mem_found = self._score_memory_integration(dialog, memories or {})
        novelty_score, max_sim = self._score_repetition(dialog)
        format_score, format_issues = self._score_format_compliance(dialog, expected_speakers)

        # Weighted overall score
        # Memory gets lower weight if no memories were provided
        mem_weight = 0.15 if memories else 0.0
        remaining = 1.0 - mem_weight
        weights = {
            "data_grounding": 0.30 * remaining / 0.85,
            "role_differentiation": 0.25 * remaining / 0.85,
            "memory_integration": mem_weight,
            "repetition_score": 0.15 * remaining / 0.85,
            "format_compliance": 0.15 * remaining / 0.85,
        }

        scores = {
            "data_grounding": data_score,
            "role_differentiation": role_score,
            "memory_integration": mem_score,
            "repetition_score": novelty_score,
            "format_compliance": format_score,
        }

        overall = sum(scores[k] * weights[k] for k in scores)
        scores["overall_quality"] = round(overall, 3)

        # Quality tier
        if overall >= 0.7:
            tier = "good"
        elif overall >= 0.4:
            tier = "adequate"
        else:
            tier = "poor"

        result = {
            "timestamp": datetime.datetime.now().isoformat(),
            "round": fl_context.get("round", 0),
            "lab_id": lab_id or fl_context.get("lab_id", ""),
            "source": source,
            "scores": scores,
            "tier": tier,
            "details": {
                "data_matches": data_matches,
                "role_per_speaker": role_details,
                "memory_fragments": mem_found,
                "max_similarity": max_sim,
                "format_issues": format_issues,
            },
            "dialog_text": " | ".join(f"{s}: {u}" for s, u in dialog),
            "turn_count": len(dialog),
        }

        # Persist
        self._log_entry(result)
        self._update_stats(scores)

        # Add to history for future repetition checks
        dialog_text = " ".join(utt for _, utt in dialog).lower()
        self._recent_dialogs.append(dialog_text)
        if len(self._recent_dialogs) > self._history_size:
            self._recent_dialogs = self._recent_dialogs[-self._history_size:]

        logger.info(
            f"Dialog quality [{lab_id}] r{fl_context.get('round', '?')} "
            f"({source}): {tier} {overall:.2f} "
            f"[data={data_score:.2f} role={role_score:.2f} "
            f"mem={mem_score:.2f} novel={novelty_score:.2f} fmt={format_score:.2f}]"
        )

        return result

    def _log_entry(self, entry: Dict[str, Any]):
        """Append evaluation entry to JSONL log."""
        try:
            with open(self._log_path, "a") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.warning(f"Failed to log dialog quality: {e}")

    def _update_stats(self, scores: Dict[str, float]):
        """Update aggregate statistics."""
        self._total_evaluated += 1
        for key in self._score_sums:
            self._score_sums[key] += scores.get(key, 0)

        self._save_summary()

    def _save_summary(self):
        """Save aggregate summary to JSON."""
        n = self._total_evaluated
        if n == 0:
            return
        summary = {
            "total_evaluated": n,
            "average_scores": {k: round(v / n, 3) for k, v in self._score_sums.items()},
            "last_updated": datetime.datetime.now().isoformat(),
        }
        try:
            with open(self._summary_path, "w") as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Failed to save quality summary: {e}")

    # ------------------------------------------------------------------
    # Query methods (for API)
    # ------------------------------------------------------------------

    def get_summary(self) -> Dict[str, Any]:
        """Return aggregate quality stats."""
        n = self._total_evaluated
        if n == 0:
            return {"total_evaluated": 0, "average_scores": {}, "message": "No dialogs evaluated yet"}
        return {
            "total_evaluated": n,
            "average_scores": {k: round(v / n, 3) for k, v in self._score_sums.items()},
        }

    def get_recent(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Return the last N evaluation entries from the log."""
        entries = []
        if not os.path.exists(self._log_path):
            return entries
        try:
            with open(self._log_path, "r") as f:
                lines = f.readlines()
            for line in lines[-limit:]:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
        except Exception as e:
            logger.warning(f"Failed to read dialog log: {e}")
        return entries

    def get_round_scores(self, fl_round: int) -> List[Dict[str, Any]]:
        """Return all evaluations for a specific FL round."""
        results = []
        if not os.path.exists(self._log_path):
            return results
        try:
            with open(self._log_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    entry = json.loads(line)
                    if entry.get("round") == fl_round:
                        results.append(entry)
        except Exception as e:
            logger.warning(f"Failed to read round scores: {e}")
        return results
