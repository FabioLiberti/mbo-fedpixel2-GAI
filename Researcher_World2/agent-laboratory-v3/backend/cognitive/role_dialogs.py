# Path: backend/cognitive/role_dialogs.py
#
# The point of view of each kind of agent.
#
# Nothing an agent says is pre-written: every line is produced by the model
# from the real figures of the run. What is fixed is only the perspective from
# which each kind of agent looks at those figures, given to the model as part
# of the prompt:
#   - student:     asks, wants to understand, offers to try things
#   - professor:   guides, explains the theory, asks for evidence
#   - researcher:  brings the numbers, compares, proposes experiments
#   - privacy:     defends the protection of the data
#   - doctor:      thinks of the patients and of clinical reliability
#   - engineer:    thinks of how the system runs

ROLE_FAMILY = {
    "student": "student",
    "student_postdoc": "student",
    "professor": "professor",
    "professor_senior": "professor",
    "researcher": "researcher",
    "privacy_specialist": "privacy",
    "doctor": "doctor",
    "engineer": "engineer",
    "sw_engineer": "engineer",
}

FAMILY_LABEL = {
    "student": "studente",
    "professor": "professore",
    "researcher": "ricercatore",
    "privacy": "specialista di privacy",
    "doctor": "medico",
    "engineer": "ingegnere",
}

# How each kind of agent looks at the results, for the prompt
ROLE_VOICE = {
    "student": "fa domande, vuole capire il perché dei numeri, si offre di provare",
    "professor": "guida la discussione, spiega la teoria, chiede prove prima di cambiare",
    "researcher": "porta i numeri, confronta i round, propone esperimenti",
    "privacy": "difende la protezione dei dati, ragiona sul rumore di privacy",
    "doctor": "pensa ai pazienti e all'affidabilità clinica del modello",
    "engineer": "pensa a come gira il sistema: tempi, epoche locali, comunicazione tra nodi",
}


def family(role: str) -> str:
    """Kind of agent for a role (e.g. student_postdoc -> student)."""
    return ROLE_FAMILY.get(role, "researcher")
