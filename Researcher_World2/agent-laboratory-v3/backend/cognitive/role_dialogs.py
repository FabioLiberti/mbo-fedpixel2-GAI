# Path: backend/cognitive/role_dialogs.py
#
# Conversations between two agents written from templates, personalised by the
# kind of agent that speaks and grounded in the real state of the federation.
#
# Each kind of agent has its own voice:
#   - student:     asks, wants to understand, offers to try things
#   - professor:   guides, explains the theory, asks for evidence
#   - researcher:  brings the numbers, compares, proposes experiments
#   - privacy:     defends the protection of the data
#   - doctor:      thinks of the patients and of clinical reliability
#   - engineer:    thinks of how the system runs
#
# A conversation has four turns: A opens on what concerns its kind of agent in
# the present situation, B answers from its own point of view, A follows up
# (on the consortium's last decision when there is one), B closes with what it
# will do next. Every number in the text is a real figure of the current run.

import random
import zlib
from typing import Any, Dict, List

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

# How each kind of agent speaks, for the LLM prompt
ROLE_VOICE = {
    "student": "fa domande, vuole capire il perché dei numeri, si offre di provare",
    "professor": "guida la discussione, spiega la teoria, chiede prove prima di cambiare",
    "researcher": "porta i numeri, confronta i round, propone esperimenti",
    "privacy": "difende la protezione dei dati, ragiona su rumore ed epsilon",
    "doctor": "pensa ai pazienti e all'affidabilità clinica del modello",
    "engineer": "pensa a come gira il sistema: tempi, epoche, comunicazione tra nodi",
}


def family(role: str) -> str:
    return ROLE_FAMILY.get(role, "researcher")


def situation(ctx: Dict[str, Any]) -> str:
    """How the federation is doing: good, rising, falling or stalled."""
    recent = ctx.get("recent_mean", ctx.get("accuracy", 0.0))
    trend = ctx.get("trend", 0.0)
    if recent >= 0.85:
        return "good"
    if trend > 0.02:
        return "rising"
    if trend < -0.02:
        return "falling"
    return "stalled"


# ---------------------------------------------------------------------------
# Opening turn: what this kind of agent notices in each situation
# ---------------------------------------------------------------------------

OPEN = {
    "student": {
        "rising": [
            "{other}, al round {round} siamo al {acc}: perché il modello ha iniziato a migliorare proprio adesso?",
            "{other}, l'accuracy è salita al {acc}. È merito dei dati degli altri laboratori?",
        ],
        "stalled": [
            "{other}, siamo fermi attorno al {recent} da qualche round. Ho sbagliato qualcosa io?",
            "{other}, non capisco: {round} round e l'accuracy resta al {acc}. Cosa la blocca?",
        ],
        "falling": [
            "{other}, l'accuracy è scesa al {acc}. È normale che peggiori da un round all'altro?",
            "{other}, dal {previous} siamo calati al {recent}: devo preoccuparmi?",
        ],
        "good": [
            "{other}, siamo al {acc}! Posso considerare il modello pronto?",
            "{other}, con il {acc} di accuracy cosa mi resta da imparare su questo modello?",
        ],
    },
    "professor": {
        "rising": [
            "{other}, il {acc} al round {round} è incoraggiante, ma voglio capire quanto è solido.",
            "{other}, la curva sale: dal {previous} al {recent}. Vediamo se regge sui dati mai visti.",
        ],
        "stalled": [
            "{other}, l'accuracy è ferma al {recent}. Prima di cambiare qualcosa voglio un'ipotesi chiara.",
            "{other}, da tre round non ci muoviamo dal {recent}: che cosa ci sta frenando secondo te?",
        ],
        "falling": [
            "{other}, dal {previous} al {recent}: un calo così va spiegato, non subìto.",
            "{other}, il modello è peggiorato fino al {acc}. Ragioniamo sulle cause, una per volta.",
        ],
        "good": [
            "{other}, il {acc} è un buon risultato. Ora chiediamoci su chi funziona meno bene.",
            "{other}, siamo al {recent} stabile: è il momento di guardare all'equità tra i laboratori.",
        ],
    },
    "researcher": {
        "rising": [
            "{other}, ho i numeri del round {round}: {acc} globale, {gain} rispetto al nostro modello locale.",
            "{other}, media degli ultimi tre round al {recent}, contro il {previous} di prima.",
        ],
        "stalled": [
            "{other}, i dati dicono {recent} di media da tre round, con rumore {noise}: siamo su un plateau.",
            "{other}, round {round}: {acc}. Rispetto a tre round fa lo scarto è nullo.",
        ],
        "falling": [
            "{other}, registro un calo: da {previous} a {recent}. Con rumore a {noise} la varianza è alta.",
            "{other}, il round {round} chiude al {acc}, sotto la media precedente del {previous}.",
        ],
        "good": [
            "{other}, round {round}: {acc} sul test, e il globale batte il nostro locale di {gain}.",
            "{other}, siamo al {recent} di media. Proporrei di misurare anche le classi meno rappresentate.",
        ],
    },
    "privacy": {
        "rising": [
            "{other}, l'accuracy sale al {acc} con rumore a {noise}: la protezione sta reggendo.",
            "{other}, bene il {acc}, ma ricordo a tutti che il rumore a {noise} è ciò che tutela i pazienti.",
        ],
        "stalled": [
            "{other}, so che il {recent} non soddisfa, ma non vorrei che la soluzione fosse togliere protezione.",
            "{other}, siamo fermi al {recent}. Prima di toccare il rumore ({noise}) proviamo altre strade.",
        ],
        "falling": [
            "{other}, il calo al {acc} non mi sorprende: con rumore a {noise} qualche oscillazione è il prezzo.",
            "{other}, l'accuracy scende al {recent}. Capisco la pressione, ma i dati restano sensibili.",
        ],
        "good": [
            "{other}, con il {acc} possiamo permetterci più protezione: il rumore è solo a {noise}.",
            "{other}, il modello è al {recent}. È il momento giusto per rafforzare la privacy.",
        ],
    },
    "doctor": {
        "rising": [
            "{other}, il {acc} è un passo avanti, ma in corsia un errore su cinque è ancora troppo.",
            "{other}, il modello migliora ({acc}). Mi chiedo se vale anche per i nostri {demo}.",
        ],
        "stalled": [
            "{other}, fermi al {recent}: così non posso proporlo ai colleghi in reparto.",
            "{other}, da clinico il {recent} non mi basta. Cosa possiamo fare senza esporre i pazienti?",
        ],
        "falling": [
            "{other}, il calo al {acc} mi preoccupa: un modello instabile in clinica non si può usare.",
            "{other}, dal {previous} al {recent}. Se fosse una terapia la sospenderei per capire.",
        ],
        "good": [
            "{other}, il {acc} comincia a essere interessante per uno screening sui {demo}.",
            "{other}, con il {recent} stabile potremmo pensare a una validazione clinica.",
        ],
    },
    "engineer": {
        "rising": [
            "{other}, round {round} chiuso senza intoppi: {acc}, con {epochs} epoche locali per nodo.",
            "{other}, i tre nodi hanno consegnato i pesi in tempo e siamo al {acc}.",
        ],
        "stalled": [
            "{other}, il sistema gira bene ma l'accuracy è al {recent}: forse {epochs} epoche locali sono poche.",
            "{other}, dal lato tecnico è tutto regolare. Il {recent} fermo non dipende dall'infrastruttura.",
        ],
        "falling": [
            "{other}, ho controllato i log: nessun nodo ha fallito, eppure siamo scesi al {acc}.",
            "{other}, il calo al {recent} non viene dalla rete. Guarderei rumore ({noise}) ed epoche ({epochs}).",
        ],
        "good": [
            "{other}, {acc} con {epochs} epoche locali: potremmo anche alleggerire il carico sui nodi.",
            "{other}, il sistema è stabile e il modello è al {recent}. Possiamo pensare a scalare.",
        ],
    },
}

# ---------------------------------------------------------------------------
# Second turn: the other agent answers from its own point of view
# ---------------------------------------------------------------------------

REPLY = {
    "student": {
        "rising": ["Quindi ogni round aggiunge qualcosa che da soli non avremmo? Vorrei vedere il contributo di ciascun laboratorio."],
        "stalled": ["Potrei provare io a rifare l'addestramento locale con più epoche, per vedere se cambia qualcosa?"],
        "falling": ["Allora non è un errore nostro? Vorrei capire come si distingue il rumore da un problema vero."],
        "good": ["Mi piacerebbe provare il modello su casi nuovi, per vedere dove sbaglia ancora."],
    },
    "professor": {
        "rising": ["È l'effetto dell'aggregazione: il modello globale vede distribuzioni che nessun laboratorio ha da solo."],
        "stalled": ["Un plateau al {recent} con rumore {noise} è atteso: il rumore copre il segnale dei gradienti."],
        "falling": ["Con rumore {noise} le oscillazioni sono fisiologiche: conta la media su più round, non il singolo valore."],
        "good": ["Al {recent} la domanda cambia: non più quanto è accurato, ma per chi lo è meno."],
    },
    "researcher": {
        "rising": ["I numeri lo confermano: {previous} tre round fa, {recent} adesso. Il guadagno sul locale è {gain}."],
        "stalled": ["Confermo il plateau: scarto sotto un punto negli ultimi tre round. Proporrei un test con rumore più basso."],
        "falling": ["Dai miei conti il calo è dentro la varianza attesa, ma se continua un altro round va indagato."],
        "good": ["Sul test siamo al {acc}. Vorrei però misurare separatamente i tre laboratori."],
    },
    "privacy": {
        "rising": ["E sta salendo senza che un solo dato abbia lasciato i laboratori: il rumore a {noise} funziona."],
        "stalled": ["Capisco, ma ridurre il rumore da {noise} ha un costo: ogni round consumerebbe più privacy."],
        "falling": ["Il rumore a {noise} spiega le oscillazioni. Preferisco un modello un po' incerto a dati esposti."],
        "good": ["Con il {recent} c'è margine: proporrei di alzare il rumore sopra {noise}."],
    },
    "doctor": {
        "rising": ["Bene, ma voglio vederlo reggere sui nostri {demo} prima di parlarne in reparto."],
        "stalled": ["Per un uso clinico il {recent} è poco: servirebbe almeno una decina di punti in più."],
        "falling": ["In medicina un risultato che oscilla così non si porta al paziente: prima va stabilizzato."],
        "good": ["Il {acc} è un livello che in clinica si comincia a prendere sul serio."],
    },
    "engineer": {
        "rising": ["E i tempi reggono: {epochs} epoche locali per round, nessun nodo in ritardo."],
        "stalled": ["Lato sistema possiamo salire da {epochs} epoche locali: costa tempo, non privacy."],
        "falling": ["Dai log non vedo guasti. Se serve posso far girare un round di controllo con gli stessi pesi."],
        "good": ["Con il modello al {recent} potremmo ridurre le epoche da {epochs} e risparmiare calcolo."],
    },
}

# ---------------------------------------------------------------------------
# Third turn: A follows up. With a decision of the consortium to talk about...
# ---------------------------------------------------------------------------

FOLLOW_DECISION = {
    "student": "E la decisione del round {d_round} di {d_text}? Ha funzionato: {d_effect}.",
    "professor": "Teniamo a mente la scelta del round {d_round}, {d_text}: {d_effect}. È un dato, non un'opinione.",
    "researcher": "Ho misurato l'effetto della decisione del round {d_round} ({d_text}): {d_effect}.",
    "privacy": "Ricordo che al round {d_round} abbiamo deciso di {d_text}: {d_effect}. Ogni scelta ha un prezzo.",
    "doctor": "Dopo la decisione del round {d_round} di {d_text} il quadro è cambiato: {d_effect}.",
    "engineer": "Dal round {d_round}, quando abbiamo deciso di {d_text}, il sistema ha dato: {d_effect}.",
}

# ...and without one
FOLLOW = {
    "student": ["E alla prossima riunione del consorzio cosa conviene proporre?",
                "Quindi che cosa dovrei guardare nei prossimi round?"],
    "professor": ["Al round {next_decision} il consorzio decide: arriviamoci con una proposta motivata.",
                  "Voglio una proposta per il round {next_decision}, e i numeri che la sostengono."],
    "researcher": ["Al round {next_decision} si vota: porterò il confronto tra gli ultimi sei round.",
                   "Preparo i dati per la decisione del round {next_decision}."],
    "privacy": ["Al round {next_decision} si decide sui parametri: chiederò di non ridurre il rumore alla leggera.",
                "Per il round {next_decision} porterò il conto della privacy consumata finora."],
    "doctor": ["Al round {next_decision} dirò la mia: il modello deve servire ai pazienti, non alle classifiche.",
               "Quando si decide, al round {next_decision}, chiederò garanzie per i nostri {demo}."],
    "engineer": ["Per il round {next_decision} posso preparare una prova con un'epoca locale in più.",
                 "Al round {next_decision} proporrò la configurazione che pesa meno sui nodi."],
}

# ---------------------------------------------------------------------------
# Fourth turn: B closes with what it will do
# ---------------------------------------------------------------------------

CLOSE = {
    "student": ["Intanto rifaccio i conti sul nostro modello locale e te li porto.",
                "Va bene, preparo un riepilogo dei round per capire meglio l'andamento."],
    "professor": ["D'accordo. Portatemi i dati e decidiamo insieme, un parametro alla volta.",
                  "Bene: una modifica per volta, e ne misuriamo l'effetto prima della successiva."],
    "researcher": ["Lancio subito il confronto e condivido la tabella con gli altri laboratori.",
                   "Metto a confronto locale e globale su tutti e tre i laboratori e vi aggiorno."],
    "privacy": ["Io preparo il conto del rumore: qualunque scelta deve restare difendibile.",
                "Verifico che ogni proposta rispetti i limiti che ci siamo dati sui dati dei pazienti."],
    "doctor": ["Io sento i colleghi in reparto: senza la loro fiducia il modello resta in laboratorio.",
               "Raccolgo qualche caso clinico tipico per provare il modello sul concreto."],
    "engineer": ["Preparo l'ambiente per il prossimo round e controllo i tempi dei tre nodi.",
                 "Aggiorno la configurazione e tengo d'occhio i log del prossimo round."],
}


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def _pct(value) -> str:
    try:
        return f"{float(value):.0%}"
    except (TypeError, ValueError):
        return "n/d"


def _address(name: str, role: str) -> str:
    """How one agent addresses another: a professor by title and surname, the others by first name."""
    parts = name.split()
    if family(role) == "professor" and len(parts) > 1:
        return f"prof. {parts[-1]}"
    return parts[0] if parts else name


def _decision_effect(decision: Dict[str, Any]) -> str:
    before, after = decision.get("accuracy_before"), decision.get("accuracy_after")
    if before is None or after is None:
        return "l'effetto è ancora in misurazione"
    return f"l'accuracy media è passata dal {_pct(before)} al {_pct(after)}"


def values(ctx: Dict[str, Any]) -> Dict[str, str]:
    """The real figures of the run, formatted for the templates."""
    decision = ctx.get("last_decision") or {}
    gain = ctx.get("gain", 0.0) or 0.0
    return {
        "round": str(ctx.get("round", 0)),
        "acc": _pct(ctx.get("accuracy", 0.0)),
        "recent": _pct(ctx.get("recent_mean", ctx.get("accuracy", 0.0))),
        "previous": _pct(ctx.get("previous_mean", ctx.get("accuracy", 0.0))),
        "gain": f"{gain * 100:+.0f} punti",
        "noise": f"{float(ctx.get('noise', 1.0)):.2f}",
        "epochs": str(ctx.get("epochs", 5)),
        "demo": str(ctx.get("demo_short") or ctx.get("demo", "pazienti")),
        "next_decision": str(ctx.get("next_decision_round", "")),
        "d_round": str(decision.get("round", "")),
        "d_text": str(decision.get("option_text", "")),
        "d_effect": _decision_effect(decision) if decision else "",
    }


def generate(name_a: str, name_b: str, role_a: str, role_b: str, ctx: Dict[str, Any]) -> List[List[str]]:
    """Four turns between A and B, each in the voice of its kind of agent."""
    fam_a, fam_b = family(role_a), family(role_b)
    sit = situation(ctx)
    v = values(ctx)
    # Same round and same pair: same conversation (stable across processes)
    rng = random.Random(zlib.crc32(f"{ctx.get('round', 0)}|{name_a}|{name_b}".encode("utf-8")))

    opening = rng.choice(OPEN[fam_a][sit]).format(other=_address(name_b, role_b), **v)
    reply = rng.choice(REPLY[fam_b][sit]).format(**v)

    decision = ctx.get("last_decision")
    if decision and decision.get("changed"):
        follow = FOLLOW_DECISION[fam_a].format(**v)
    else:
        follow = rng.choice(FOLLOW[fam_a]).format(**v)
    closing = rng.choice(CLOSE[fam_b]).format(**v)

    # A sentence starts with a capital letter even when it starts with "prof."
    opening = opening[0].upper() + opening[1:]
    return [[name_a, opening], [name_b, reply], [name_a, follow], [name_b, closing]]
