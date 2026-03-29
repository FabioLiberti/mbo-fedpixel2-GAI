# Federated Generative Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9%2B-blue)](https://www.typescriptlang.org/)
[![Phaser 3](https://img.shields.io/badge/Phaser-3.55.2%2B-orange)](https://phaser.io/)
[![Python](https://img.shields.io/badge/Python-3.11-green)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.85%2B-teal)](https://fastapi.tiangolo.com/)
[![Mesa](https://img.shields.io/badge/Mesa-1.1%2B-darkgreen)](https://mesa.readthedocs.io/)
[![Ollama](https://img.shields.io/badge/Ollama-qwen3.5%3A4b-purple)](https://ollama.ai/)

**Ricercatori autonomi con architettura cognitiva believable in un ecosistema di Federated Learning distribuito: simulazione multi-agente con dialoghi LLM-driven, navigazione A\*, interazioni role-aware e analytics in tempo reale.**

<p align="center">
  <img src="Researcher_World2/agent-laboratory-v2/frontend/public/logo192.png" width="680" alt="Federated Generative Agents" />
</p>

---

## Panoramica scientifica

Federated Generative Agents (FGA) esplora l'intersezione tra **Federated Learning** (McMahan et al., AISTATS 2017) e **agenti generativi believable** (Park et al., ACM UIST 2023). Il sistema simula un ecosistema di ricerca distribuito in cui agenti autonomi, dotati di ruoli professionali distinti (professor, researcher, privacy specialist, student, doctor), collaborano alla costruzione di modelli federati rispettando vincoli di privacy.

A differenza dei simulatori FL tradizionali che trattano i client come nodi passivi, FGA modella ogni partecipante come un agente con:

- **Autonomia decisionale**: gli agenti scelgono indipendentemente quando lavorare, interagire, spostarsi o riposarsi
- **Dialoghi contestuali**: le conversazioni riflettono la competenza professionale di ciascun ruolo e la relazione tra le coppie di agenti
- **Comportamento spaziale**: navigazione A* su griglia con pathfinding attraverso porte e corridoi, evitando muri e mobili
- **Dinamiche sociali emergenti**: pause caffe, riunioni spontanee, mentoring, audit di privacy — innescati dalla prossimita e dal ruolo

### Contributi principali

1. **Role-pair dialog system**: dialoghi specifici per ogni coppia di ruoli professionali con movimento contestuale verso le stanze pertinenti (Privacy Lab, Meeting Room, Server Room, Ufficio Prof.)
2. **Dialog Analytics**: sistema di tracking che registra ogni dialogo con posizioni degli agenti, prossimita, stanza, categoria e genera report aggregati
3. **Navigazione A* su tilemap**: pathfinding 4-direzionale su griglia 32px con distinzione walkable/blocked per porta, muro, mobile
4. **Integrazione LLM locale**: generazione dialoghi via Ollama (qwen3.5:4b) con cache, fallback deterministico round-robin e stripping automatico dei think-tag

---

## Architettura

```
                    FEDERATED GENERATIVE AGENTS
                              |
          +-------------------+-------------------+
          v                   v                   v
   +-------------+    +-------------+    +-------------+
   | Mercatorum  |    |  Blekinge   |    |    OPBG     |
   |   4 agenti  |    |   3 agenti  |    |   3 agenti  |
   | 6 stanze    |    |             |    |   IRCCS     |
   +------+------+    +------+------+    +------+------+
          |                   |                   |
          +-------------------+-------------------+
                              |
              +---------------v---------------+
              |        FRONTEND               |
              |  React 18 + Phaser 3 + TS     |
              |                               |
              |  BaseLabScene (zoom, grid,    |
              |    A* pathfinding, icons)     |
              |  Agent sprite (state machine, |
              |    autonomous behavior)       |
              |  DialogRenderer (bubbles,     |
              |    role-pair, analytics)      |
              |  LabControlsMenu (UI panel)  |
              +---------------+---------------+
                              |  REST API
              +---------------v---------------+
              |        BACKEND                |
              |  FastAPI + Mesa + Ollama      |
              |                               |
              |  SimulationController         |
              |  FedAvg (numpy fallback)      |
              |  LLM Connector (qwen3.5:4b)  |
              |  Cognitive pipeline           |
              +-------------------------------+
```

### Stack tecnologico

| Layer | Tecnologia | Dettaglio |
|---|---|---|
| **Frontend** | React 18.2, TypeScript 4.9, Phaser 3.55.2 | Pixel art 2D, zoom zone-based, state management con Zustand |
| **Backend** | FastAPI 0.85, Mesa 1.1, Python 3.11 | Simulazione multi-agente, REST API, FL orchestration |
| **LLM** | Ollama + qwen3.5:4b (4.7B params, Q4_K_M) | Generazione dialoghi, thinking, decisioni, reazioni |
| **FL** | FedAvg con numpy (TensorFlow opzionale) | Training federato distribuito tra 3 laboratori |
| **Ambiente** | Conda `mbo_gai` (/opt/miniconda3) | Python 3.11, porta backend 8091, porta frontend 3026 |

---

## Ambienti di laboratorio

### Universita Mercatorum Lab

Layout a **6 stanze** con tilemap procedurale e mobili pixel art:

| Stanza | Floor | Mobili | Funzione |
|---|---|---|---|
| **Ufficio Prof.** | Amber | Scrivania, librerie, lampada, quadro, tappeto | Mentoring, feedback, direzione ricerca |
| **Meeting Room** | Blue | Tavolo centrale, whiteboard, proiettore, sedie | Presentazioni, allineamento progetto |
| **Privacy Lab** | Purple | Scrivanie, server, stampante, libreria | DP analysis, PPML, audit privacy |
| **Break Room** | Warm | Divani, tavolino caffe, frigo, distributore | Pause, socializzazione |
| **Area Ricerca** | Teal | Scrivanie, libreria, stampante, lampada | Sviluppo, sperimentazione |
| **Server Room** | Green | Server rack (x4), UPS (x2), monitor, equipment | Monitoraggio training, diagnostica |

**Agenti**: Elena Conti (Professor), Luca Bianchi (Privacy Specialist), Sofia Greco (Researcher), Marco Rossi (Student)

### Blekinge University Lab
Design scandinavo minimalista. Specializzazione: algoritmi di aggregazione avanzati, ottimizzazione IoT.

### OPBG IRCCS Lab
Stile clinico child-friendly. Specializzazione: FL per dati medici sensibili, diagnosi pediatrica federata.

---

## Sistema di dialoghi

### Pipeline

```
Agent.makeDecision()
    |
    v  emit('agent-interaction')
DialogEventHandler.handleAgentInteraction()
    |
    +-- LLM available? --> Ollama qwen3.5:4b --> thinking + dialog
    |
    +-- Fallback (probabilistic):
        |-- 35%  Role-pair dialog (context-aware per coppia ruoli)
        |-- 10%  Greeting (10 coppie round-robin)
        |-- 10%  Coffee break --> move to Break Room
        |-- 10%  Meeting room --> move to Meeting Room
        |-- 10%  Server room --> move to Server Room
        |-- 25%  Topical (15 frasi per ruolo, round-robin)
    |
    v
DialogRenderer --> SpeechBubble (question: blue, response: teal)
    |
    v
DialogAnalytics --> record con timestamp, posizioni, prossimita, stanza
```

### Role-pair dialogs

Ogni coppia di ruoli ha **5 dialoghi specifici** con stanza destinazione:

| Coppia | Tema | Stanza |
|---|---|---|
| Professor + Privacy Specialist | Differential Privacy, PPML, epsilon budget | Privacy Lab |
| Professor + Researcher | Paper review, metodologia, risultati | Meeting Room |
| Professor + Student | Mentoring, feedback tesi, task assignment | Ufficio Prof. |
| Researcher + Privacy Specialist | Budget epsilon, DP integration, audit | Privacy Lab |
| Researcher + Student | Benchmark, coding collaborativo, training | Area Ricerca |
| Privacy Specialist + Student | Insegnamento DP, attacchi, clipping | Privacy Lab |

Il dialogo rispetta la gerarchia: il professore invita nel suo ufficio, il privacy specialist propone di analizzare al lab, il researcher guida lo studente in area ricerca.

### Persistenza e freeze

- **Durata bolla**: `8000 + text.length * 50` ms (max 18000ms)
- **Freeze agente**: l'agente si ferma finche il dialogo non scompare (`hasBubble` flag)
- **Avvicinamento**: se distanza > 50px, l'agente cammina verso l'interlocutore prima di parlare
- **Offset risposta**: la bolla di risposta e posizionata -80px (vs -40px per la domanda) per evitare sovrapposizione

---

## Dialog Analytics

Sistema di tracking integrato che registra ogni dialogo con metadati completi.

### Dati registrati per ogni dialogo

| Campo | Descrizione |
|---|---|
| `speakerId`, `speakerName`, `speakerRole` | Identita del parlante |
| `targetId`, `targetName`, `targetRole` | Identita del destinatario |
| `speakerPos`, `targetPos` | Coordinate (x, y) al momento del dialogo |
| `speakerRoom`, `targetRoom` | Stanza rilevata per ciascun agente |
| `distance` | Distanza in pixel tra i due agenti |
| `sameRoom` | Se i due agenti sono nella stessa stanza |
| `dialogCategory` | greeting, coffee_break, meeting_room, server_room, role_pair, topical, thinking, state_phrase, llm |
| `isResponse` | Se e una risposta a un dialogo precedente |
| `isLLM` | Se generato da LLM o da fallback |
| `destinationRoom` | Stanza destinazione se il dialogo innesca movimento |

### Report aggregato

Accessibile dal menu **Controlli Lab > Analytics > Report Dialoghi**:

- **Per categoria**: distribuzione percentuale dei tipi di dialogo
- **Per agente**: conteggio totale, come iniziatore vs target
- **Per coppia di ruoli**: frequenza, distanza media, % stessa stanza
- **Per stanza**: dove avvengono i dialoghi
- **Prossimita**: media, min, max, mediana distanza tra agenti
- **Movimenti innescati**: quante volte ogni stanza e stata destinazione
- **Ultimi 10 dialoghi**: timeline dettagliata

Anche disponibile da console browser: `window.dialogAnalytics.printReport()`

---

## Navigazione A*

Gli agenti navigano attraverso un **pathfinding A\*** su griglia 32px, derivata dal tilemap del furniture layer:

- **Walkable**: pavimento, porte, sedie, tappeti, lampade
- **Blocked**: muri, scrivanie, server, librerie, divani, frigoriferi, UPS, ecc.
- **BFS snap**: se un agente si trova in una cella bloccata, `nearestWalkable()` lo riposiziona
- **No fallback**: se A* non trova un percorso, l'agente resta fermo (no through-wall movement)

---

## Quick Start

### Prerequisiti

- **Node.js** v14+ e npm
- **Python 3.11** via Conda (`conda create -n mbo_gai python=3.11`)
- **Ollama** installato con modello `qwen3.5:4b`

### Setup

```bash
# 1. Installa modello LLM
ollama pull qwen3.5:4b
ollama serve   # lasciare attivo

# 2. Backend
conda activate mbo_gai
cd Researcher_World2/agent-laboratory-v2/backend
pip install -r requirements.txt
python -m uvicorn api.main:app --host 0.0.0.0 --port 8091 --reload

# 3. Frontend (in un altro terminale)
cd Researcher_World2/agent-laboratory-v2/frontend
npm install
npm start    # apre http://localhost:3026

# 4. Attivare LLM nel backend (una tantum)
curl -X POST "http://localhost:8091/llm/toggle?enabled=true"
```

### Verifica stato

```bash
curl http://localhost:11434/api/tags          # Ollama: modelli disponibili
curl http://localhost:8091/                    # Backend: status
curl http://localhost:8091/llm/status          # LLM: enabled + reachable
curl http://localhost:8091/simulation/state    # Simulazione: stato corrente
```

---

## Struttura del progetto

```
Researcher_World3_GAI/
+-- README.md
+-- Researcher_World2/
|   +-- agent-laboratory-v2/
|       +-- frontend/                         # React 18 + Phaser 3
|       |   +-- src/
|       |   |   +-- phaser/
|       |   |   |   +-- scenes/
|       |   |   |   |   +-- BaseLabScene.ts       # Zoom, grid, A*, state icons, analytics
|       |   |   |   |   +-- Mercatorum/            # 6-room layout con mobili
|       |   |   |   +-- sprites/
|       |   |   |   |   +-- Agent.ts               # State machine, autonomous behavior
|       |   |   |   +-- controllers/
|       |   |   |   |   +-- DialogEventHandler.ts  # Pipeline dialoghi LLM + fallback
|       |   |   |   |   +-- DialogRenderer.ts      # Bubble rendering, role-pair pairs
|       |   |   |   |   +-- DialogAnalytics.ts     # Tracking posizioni e prossimita
|       |   |   |   |   +-- GlobalAgentController.ts
|       |   |   |   +-- utils/
|       |   |   |   |   +-- pathfinder.ts          # A* pathfinding
|       |   |   |   |   +-- tilesetGenerator.ts    # Tileset procedurale (38 tile types)
|       |   |   |   +-- ui/
|       |   |   |       +-- SpeechBubble.ts        # Bolle dialogo (question/response)
|       |   |   |       +-- LabControlsMenu.ts     # Pannello controlli + analytics
|       |   |   +-- components/                # React UI components
|       |   |   +-- services/                  # API client
|       |   +-- public/assets/                 # Sprite, tileset, icone
|       +-- backend/
|           +-- api/main.py                    # FastAPI + REST endpoints
|           +-- ai/llm_connector.py            # Ollama connector + cache + fallback
|           +-- cognitive/prompts/             # LLM prompt engineering
|           +-- models/agents/                 # Mesa agent models
|           +-- simulation/                    # FL controller
+-- LLM_Generative_Agents/                    # Generative Agents (fork Stanford)
    +-- generative_agents/
        +-- reverie/backend_server/
        |   +-- persona/cognitive_modules/     # perceive, retrieve, plan, reflect, execute
        |   +-- persona/memory_structures/     # spatial, associative, scratch
        +-- environment/frontend_server/       # Django UI
```

---

## Stato di sviluppo

| Componente | Stato | Note |
|---|---|---|
| Frontend React + Phaser | Operativo | 3 scene lab, world map, zoom zone-based |
| Tilemap procedurale | Operativo | 38 tile types, 6 stanze Mercatorum con mobili |
| A* Pathfinding | Operativo | 4-dir, BFS snap, door/corridor navigation |
| Sistema dialoghi | Operativo | LLM + fallback, 6 role-pair, 5+ categorie |
| Dialog Analytics | Operativo | Tracking completo, report UI + console |
| Agent autonomy | Operativo | State machine, idle thoughts, coffee breaks |
| FedAvg | Operativo | numpy fallback (TensorFlow opzionale) |
| Ollama LLM | Operativo | qwen3.5:4b, cache 60s, think-tag stripping |
| Blekinge Lab | Base | Layout semplice, da arricchire |
| OPBG Lab | Base | Layout semplice, da arricchire |
| FedProx | Non implementato | Previsto per fase successiva |
| Pipeline cognitiva completa | Parziale | Thinking/decision/planning attivi, memory retrieval da completare |

---

## Riferimenti

- Park, J.S., O'Brien, J.C., Cai, C.J., Morris, M.R., Liang, P., Bernstein, M.S. (2023). *Generative Agents: Interactive Simulacra of Human Behavior*. ACM UIST 2023. DOI: 10.1145/3586183.3606763
- McMahan, B., Moore, E., Ramage, D., Hampson, S., Arcas, B.A. (2017). *Communication-Efficient Learning of Deep Networks from Decentralized Data*. AISTATS 2017.
- Li, T., Sahu, A.K., Zaheer, M., Sanjabi, M., Talwalkar, A., Smith, V. (2020). *Federated Optimization in Heterogeneous Networks*. MLSys 2020.
- Dwork, C., Roth, A. (2014). *The Algorithmic Foundations of Differential Privacy*. Foundations and Trends in Theoretical Computer Science, 9(3-4):211-407.

---

## Licenza

Questo progetto e rilasciato sotto licenza MIT. Vedi il file [LICENSE](LICENSE) per dettagli.

---

<p align="center">
  <small>&copy; 2025-2026 Fabio Liberti &mdash; Federated Generative Agents Research Project</small>
</p>
