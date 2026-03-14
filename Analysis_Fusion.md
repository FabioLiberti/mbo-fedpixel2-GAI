# Analysis & Fusion: Agent Laboratory v2 × Generative Agents

> Analisi comparativa e proposta di integrazione  
> Autore: Fabio Liberti  
> Data: Marzo 2026

---

## 1. Panoramica dei Due Sistemi

### 1.1 Agent Laboratory v2

**Agent Laboratory v2** è un simulatore di ecosistemi di ricerca in **federated learning distribuito**. Tre laboratori virtuali (Università Mercatorum, Blekinge University, OPBG IRCCS) ospitano ricercatori autonomi che collaborano attraverso algoritmi FL. Il focus è sul processo tecnico di addestramento federato, visualizzato in pixel art 2D con React + Phaser 3.

- **Stack tecnologico:** React 18 + TypeScript + Phaser 3 (frontend), Python FastAPI + Mesa (backend), TensorFlow (FL), Ollama/qwen3:0.6b (LLM)
- **Obiettivo primario:** Simulare la collaborazione distribuita tra laboratori in un contesto di federated learning
- **Metrica di successo:** Accuracy e loss di convergenza del modello federato
- **Repo GitHub:** `git@github.com:FabioLiberti/mbo-fedpixel.git`

### 1.2 Generative Agents

**Generative Agents** è un simulatore di **comportamento sociale umano credibile** in un villaggio virtuale ("Smallville"). Venticinque agenti autonomi pianificano le loro giornate, formano relazioni, organizzano eventi, si ricordano del passato e riflettono sulle proprie esperienze. È il fork del paper Stanford (Park et al., UIST 2023) migrato su Ollama locale.

- **Stack tecnologico:** Django (frontend/backend), Python (sistema cognitivo), Phaser.js (rendering), Ollama/qwen3:0.6b (LLM)
- **Obiettivo primario:** Simulare comportamento sociale believable attraverso architettura cognitiva completa
- **Metrica di successo:** Believability comportamentale degli agenti
- **Paper originale:** Park, J.S. et al., *Generative Agents: Interactive Simulacra of Human Behavior*, ACM UIST 2023

---

## 2. Confronto Diretto

| Dimensione | Agent Laboratory v2 | Generative Agents |
|---|---|---|
| **Obiettivo primario** | Simulare FL distribuito | Simulare comportamento sociale |
| **Metrica di successo** | Accuracy/loss convergenza | Believability comportamentale |
| **Numero agenti** | Multi-lab (non specificato) | 3 o 25 agenti |
| **Architettura cognitiva** | State machine (10 stati) + dialoghi LLM | Perceive → Retrieve → Plan → Reflect → Execute |
| **Memoria agenti** | Short-term (5 items) + long-term (2000 char) | 3 livelli: spatial, associative, scratch |
| **Retrieval memoria** | Non implementato semanticamente | Pesato: recency + importance + relevance |
| **Relazioni tra agenti** | Minimale, non persistente | Persistenti, influenzano i piani futuri |
| **Algoritmi specializzati** | FedAvg ✅ FedProx ❌ DP ❌ SecAgg ❌ | Retrieval con decadimento esponenziale |
| **Frontend** | Phaser 3 pixel art + React + WebSocket | Django + Phaser, replay/demo mode |
| **Backend** | FastAPI + Mesa + TensorFlow | Django + sistema cognitivo Python |
| **LLM locale** | qwen3:0.6b via Ollama | qwen3:0.6b via Ollama |
| **Production readiness** | 2/10 | ~7/10 |
| **Conformità al README** | 4/10 | ~95% |
| **Bug critici** | 4 critici, 6 alti | 2 critici (requirements, modello) |
| **Test** | Nessun test frontend/backend | Script multipli (quick_test, direct_test, test_simulation) |
| **Documentazione** | Directory docs/ assente | Documentazione italiana aggiuntiva presente |

---

## 3. Valutazioni per Area

### 3.1 Agent Laboratory v2

| Area | Voto | Note |
|---|---|---|
| Architettura Frontend | 7.5/10 | Ben strutturato, buon uso di Phaser + React |
| Architettura Backend | 4/10 | Metodi mancanti, dipendenze non dichiarate |
| Federated Learning | 3/10 | Solo FedAvg funziona; FedProx broken, DP e SA assenti |
| Sistema Agenti | 6/10 | Buon design ma environment incompleto |
| Integrazione LLM | 7/10 | Memoria multi-livello e fallback presenti |
| Visualizzazione | 8/10 | Eccellente pixel art, effetti FL, dialog bubbles |
| Qualità Codice | 5/10 | File backup, no test, file monolitici |
| Aderenza al README | 4/10 | Diverse feature dichiarate non implementate |
| Production Readiness | 2/10 | Bug critici, no auth, no test, dipendenze mancanti |

### 3.2 Generative Agents

| Area | Voto | Note |
|---|---|---|
| Architettura cognitiva | 9/10 | 5 stadi completi, fedele al paper originale |
| Sistema di memoria | 9/10 | 3 livelli con retrieval semantico pesato |
| Stabilità | 7/10 | Funzionante, ~95% conformità README |
| Scalabilità agenti | 7/10 | Testato fino a 25 agenti |
| Qualità LLM | 4/10 | qwen3:0.6b insufficiente per ragionamento complesso |
| Frontend | 5/10 | Bug rendering Phaser, workaround necessari |
| Sicurezza | 3/10 | CSRF disabilitato, Django 2.2 obsoleto, API key esposta |
| Production Readiness | 5/10 | Funzionante ma non production-grade |

---

## 4. Quale è il Migliore?

La risposta dipende dall'asse valutativo:

### Per stabilità e completezza → **Generative Agents**

- Conformità al README del ~95%
- Architettura cognitiva completamente implementata (5 stadi)
- Sistema di memoria con retrieval semantico reale
- Simulazioni pre-caricate funzionanti (3 e 25 agenti)
- Script di test multipli e documentazione aggiuntiva italiana
- È la trasposizione locale di un paper accademico pubblicato su ACM UIST 2023

### Per visione architetturale e dominio di ricerca → **Agent Laboratory v2**

- Visualizzazione FL eccellente (8/10): effetti particellari, linee animate tra lab
- Design concettuale originale con tre laboratori federati
- Più vicino al dominio specifico della ricerca (FL + agenti + simulazione)
- Frontend con pixel art di qualità superiore
- Struttura multi-laboratorio con scenari accademici realistici

---

## 5. Quale è il Più Completo?

**Generative Agents è più completo** come sistema funzionante end-to-end.

Agent Laboratory v2 è più ambizioso concettualmente ma presenta lacune implementative che ne impediscono il funzionamento reale:

```
Bug critici Agent Laboratory v2:
  1. TensorFlow mancante da requirements.txt → import fallisce
  2. FedProx bypassed con "or True" → mai eseguito
  3. get_lab_ids(), get_lab_agents(), get_agent_by_id() → metodi inesistenti
  4. Porta Dockerfile (8000) vs codice (8091) → mismatch
```

Generative Agents ha invece solo 2 problemi critici (requirements non aggiornato, modello LLM troppo piccolo) e funziona correttamente nella sua funzione principale.

---

## 6. Integrazione: È Possibile?

**Sì, e l'integrazione sarebbe scientificamente molto ricca.**

I due sistemi si completano esattamente sulle dimensioni che mancano a ciascuno. Sono progettati per rispondere a domande diverse ma complementari.

### 6.1 Cosa porta ciascun sistema nell'integrazione

**Da Generative Agents:**
- Architettura cognitiva matura (Perceive → Plan → Reflect) applicabile ai ricercatori di Agent Laboratory
- Sistema di memoria a 3 livelli con retrieval semantico — molto più robusto dei 2000 char di Agent Laboratory
- Relazioni persistenti tra agenti (assenti in Agent Laboratory)
- Believability comportamentale: routine, eventi sociali, pianificazione oraria
- Meccanismo di "poignancy" per pesare l'importanza degli eventi nella memoria

**Da Agent Laboratory v2:**
- Layer FL distribuito (FedAvg funzionante, struttura multi-laboratorio)
- Visualizzazione specializzata per metriche di convergenza in tempo reale
- Ruoli accademici con specializzazioni (ML Engineer, Privacy Specialist, Medical Researcher)
- Integrazione Mesa per scheduling degli agenti su griglia spaziale
- Dialog bubbles e thought bubbles per la visualizzazione cognitiva

### 6.2 Schema Architetturale dell'Integrazione

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEDERATED GENERATIVE AGENTS                  │
│              (Agent Laboratory × Generative Agents)             │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │  Mercatorum │    │  Blekinge   │    │    OPBG     │
   │     Lab     │    │     Lab     │    │    IRCCS    │
   └─────────────┘    └─────────────┘    └─────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
              ┌───────────────▼───────────────┐
              │       LAYER COGNITIVO         │
              │   (da Generative Agents)      │
              │                               │
              │  PERCEIVE → RETRIEVE → PLAN   │
              │         ↓                     │
              │       REFLECT → EXECUTE       │
              └───────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │         MEMORIA 3 LIVELLI     │
              │   (da Generative Agents)      │
              │                               │
              │  Spatial    → Topologia lab   │
              │  Associative → Esperienza FL  │
              │  Scratch    → Task corrente   │
              └───────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │        LAYER FL OPERATIVO     │
              │    (da Agent Laboratory v2)   │
              │                               │
              │  Training → Sending →         │
              │  Aggregating → Receiving      │
              │                               │
              │  Metriche FL come "eventi     │
              │  ricordabili" nella memoria   │
              └───────────────────────────────┘
```

### 6.3 Mapping Concettuale tra i Sistemi

| Concetto Generative Agents | Equivalente in Agent Laboratory v2 | Fusione proposta |
|---|---|---|
| Smallville (villaggio) | Tre laboratori federati | Ecosistema accademico distribuito |
| Evento giornaliero | Round FL (training cycle) | Round FL come evento pianificabile |
| Relazione sociale | Collaborazione inter-laboratorio | Partnership FL con storia persistente |
| Poignancy (importanza evento) | Variazione delta accuracy/loss | Metriche FL come peso mnemonico |
| Piano giornaliero | Schedule training round | Agenda FL-cognitiva dell'agente |
| Riflessione serale | Post-round analysis | Self-evaluation del contributo FL |
| Spatial memory (luoghi) | Topologia rete FL | Mappa dei nodi federati |

### 6.4 Implementazione: Fasi Suggerite

**Fase 1 — Stabilizzazione (prerequisito)**
- Fixare i 4 bug critici di Agent Laboratory v2
- Aggiornare requirements.txt (TensorFlow, rimuovere PyTorch non usato)
- Implementare i metodi mancanti in `environment.py`
- Allineare la porta Dockerfile/codice

**Fase 2 — Sostituzione del layer cognitivo**
- Sostituire la state machine a 10 stati di Agent Laboratory con la pipeline Perceive→Plan→Reflect di Generative Agents
- Portare il sistema di memoria a 3 livelli (spatial, associative, scratch) nei `ResearcherAgent`
- Introdurre il retrieval pesato (recency + importance + relevance)

**Fase 3 — Integrazione FL-cognitiva**
- Modellare ogni round FL come "evento" nell'Associative Memory dell'agente
- Pesare la "poignancy" degli eventi FL in base alla variazione di accuracy/loss
- Permettere agli agenti di pianificare autonomamente la partecipazione ai round FL
- Implementare la riflessione post-round: l'agente valuta il proprio contributo

**Fase 4 — Emergenza comportamentale**
- Abilitare le relazioni persistenti inter-laboratorio basate sulla storia FL condivisa
- Implementare la formazione spontanea di coalizioni tra lab con modelli complementari
- Aggiungere la pianificazione collaborativa: agenti che propongono e negoziano round FL

---

## 7. Connessione con la Ricerca FedAgent-Hospital

Questa integrazione è precisamente allineata con l'ipotesi **FedAgent-Hospital** in sviluppo, che combina:

- **Agent Hospital / MedAgent-Zero:** evoluzione autonoma delle capacità mediche degli agenti tramite esperienza accumulata (SEAL framework: dual knowledge base di casi e esperienze)
- **Generative Agents:** architettura cognitiva believable con memoria persistente e riflessione
- **Agent Laboratory v2:** training federato distribuito tra laboratori con privacy preserving

```
FedAgent-Hospital = 
    MedAgent-Zero (evoluzione autonoma per esperienza)
  + Generative Agents (architettura cognitiva + memoria)  
  + Agent Laboratory v2 (FL distribuito + visualizzazione)
```

In questo scenario integrato, i doctor agent dell'OPBG IRCCS:
1. **Percepiscono** i casi clinici in arrivo (Perceive)
2. **Recuperano** casi simili dalla memoria associativa e dall'Experience Base (Retrieve)
3. **Pianificano** la diagnosi e decidono se richiedere dati aggiuntivi via FL (Plan)
4. **Riflettono** sull'esito diagnostico aggiornando la loro base di esperienza (Reflect)
5. **Partecipano** al round FL condividendo il modello aggiornato con Mercatorum e Blekinge (Execute)

Il tutto con **privacy differenziale** (da implementare in Agent Laboratory v2) e **believability cognitiva** (da Generative Agents).

---

## 8. Bug Prioritari da Risolvere Prima dell'Integrazione

### Agent Laboratory v2 — Critici

```python
# BUG 1: TensorFlow mancante
# requirements.txt → aggiungere:
tensorflow>=2.9.0

# BUG 2: FedProx mai eseguito
# federated.py:184 → da:
if self.algorithm == "fedavg" or True:
# a:
if self.algorithm == "fedavg":

# BUG 3: Metodi mancanti in environment.py → implementare:
def get_lab_ids(self): ...
def get_lab_agents(self, lab_id): ...
def get_agent_by_id(self, agent_id): ...
def get_nearby_agents(self, agent, radius): ...

# BUG 4: Porta → allineare Dockerfile (8000 → 8091) o main.py (8091 → 8000)
```

### Generative Agents — Critici

```bash
# BUG C1: requirements.txt non aggiornato
pip install ollama  # da aggiungere al requirements.txt

# BUG C2: Modello LLM insufficiente
# Sostituire qwen3:0.6b con almeno:
ollama pull llama3:8b
# o per uso medico:
ollama pull meditron:7b

# BUG C3: Embedding semantici
ollama pull nomic-embed-text
```

---

## 9. Riepilogo Finale

| Domanda | Risposta |
|---|---|
| Cosa fa Agent Laboratory v2? | Simula FL distribuito tra 3 lab accademici con agenti e visualizzazione pixel art |
| Cosa fa Generative Agents? | Simula comportamento sociale believable con architettura cognitiva a 5 stadi |
| Quale è il migliore? | Per stabilità: Generative Agents. Per visione e dominio: Agent Laboratory v2 |
| Quale è il più completo? | Generative Agents (~95% README), Agent Laboratory v2 ha 4 bug critici bloccanti |
| È possibile integrarli? | Sì: Generative Agents fornisce il layer cognitivo, Agent Laboratory v2 il layer FL |
| Collegamento con FedAgent-Hospital? | L'integrazione realizza esattamente l'ipotesi FedAgent-Hospital in sviluppo |

---

*Documento generato nell'ambito del progetto di ricerca su Federated Learning + AI Agents + Simulations*  
*Riferimenti: Park et al. (UIST 2023), Agent Hospital/MedAgent-Zero (2024), Stanford CS 222*
