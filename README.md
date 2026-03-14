# Federated Generative Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.7%2B-blue)](https://www.typescriptlang.org/)
[![Phaser 3](https://img.shields.io/badge/Phaser-3.55.2%2B-orange)](https://phaser.io/)
[![Python](https://img.shields.io/badge/Python-3.9%2B-green)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.85%2B-teal)](https://fastapi.tiangolo.com/)
[![Django](https://img.shields.io/badge/Django-4.0%2B-darkgreen)](https://www.djangoproject.com/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.9%2B-orange)](https://www.tensorflow.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-purple)](https://ollama.ai/)

**Fusione di Agent Laboratory v2 e Generative Agents: ricercatori autonomi con architettura cognitiva believable in un ecosistema di federated learning distribuito.**

<p align="center">
  <img src="Researcher_World2/agent-laboratory-v2/frontend/public/logo192.png" width="680" alt="Federated Generative Agents" />
</p>

## 🔬 Panoramica

Federated Generative Agents integra due sistemi complementari in un unico framework di ricerca:

- **Agent Laboratory v2**: Simulatore di ecosistemi di ricerca in federated learning distribuito tra tre laboratori virtuali (Università Mercatorum, Blekinge University, OPBG IRCCS) con visualizzazione pixel art 2D
- **Generative Agents**: Fork locale del paper Stanford (Park et al., ACM UIST 2023) con architettura cognitiva a 5 stadi e memoria associativa con retrieval semantico

L'obiettivo è creare ricercatori autonomi che:
1. **Percepiscono** l'ambiente del laboratorio e i risultati FL (Perceive)
2. **Recuperano** esperienze passate dalla memoria associativa (Retrieve)
3. **Pianificano** la partecipazione ai round di federated learning (Plan)
4. **Riflettono** sul proprio contributo alla convergenza del modello (Reflect)
5. **Eseguono** training locale, aggregazione e collaborazione inter-laboratorio (Execute)

### Caratteristiche principali:

- **Architettura cognitiva a 5 stadi** da Generative Agents applicata ai ricercatori FL
- **Memoria a 3 livelli** con retrieval semantico pesato (recency + importance + relevance)
- **Federated Learning distribuito** con FedAvg tra tre laboratori virtuali
- **Visualizzazione pixel art 2D** con React + Phaser 3 e WebSocket real-time
- **LLM locale** via Ollama (nessuna dipendenza da API cloud)
- **Comportamento emergente**: relazioni, coalizioni e negoziazione tra agenti

## 🏗️ Architettura & Stack Tecnologico

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEDERATED GENERATIVE AGENTS                  │
│              (Agent Laboratory × Generative Agents)             │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │  Mercatorum  │    │  Blekinge   │    │    OPBG     │
   │     Lab      │    │     Lab     │    │    IRCCS    │
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
              │       MEMORIA 3 LIVELLI       │
              │                               │
              │  Spatial    → Topologia lab   │
              │  Associative → Esperienza FL  │
              │  Scratch    → Task corrente   │
              └───────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │      LAYER FL OPERATIVO       │
              │   (da Agent Laboratory v2)    │
              │                               │
              │  Training → Sending →         │
              │  Aggregating → Receiving      │
              └───────────────────────────────┘
```

### Frontend (da Agent Laboratory v2)
- **Framework**: React 18.0+ con TypeScript 4.7+
- **Rendering 2D**: Phaser 3.55.2+ con PixelPerfect scaling
- **UI Components**: Dashboard analitiche e controlli simulazione
- **Comunicazione**: Socket.io per WebSocket bidirezionale

### Backend Cognitivo (da Generative Agents)
- **Pipeline cognitiva**: Perceive → Retrieve → Plan → Reflect → Execute
- **Memoria**: Spatial memory (tree), Associative memory (embeddings), Scratch (working)
- **Retrieval**: Cosine similarity con pesi recency + importance + relevance
- **LLM**: Ollama locale con qwen3.5:4b (default) e supporto multi-modello (llama3, mistral, gemma)

### Backend FL (da Agent Laboratory v2)
- **Framework**: Python 3.9+ con FastAPI 0.85+
- **Simulazione Multi-Agente**: Mesa 1.1.1+
- **Machine Learning**: TensorFlow 2.9+
- **Algoritmi**: FedAvg implementato, FedProx in sviluppo

## 🔗 Ambienti di Laboratorio

Il simulatore presenta tre laboratori virtuali, ciascuno con tema visivo e specializzazione FL unici:

### 1. Università Mercatorum Lab
<details>
  <summary><b>Dettagli</b></summary>

  - **Tema Visivo**: Stile italiano classico con elementi moderni
  - **Palette Colori**: Tonalità terracotta, blu navy, crema
  - **Specializzazione FL**: Business intelligence, analytics finanziaria federata, compliance GDPR
  - **Layout**: Grande area centrale per meeting collaborativi, workstation individuali perimetrali
</details>

### 2. Blekinge University Lab
<details>
  <summary><b>Dettagli</b></summary>

  - **Tema Visivo**: Design scandinavo minimalista high-tech
  - **Palette Colori**: Bianco, azzurro ghiaccio, grigio chiaro, accenti gialli
  - **Specializzazione FL**: Algoritmi di aggregazione avanzati, ottimizzazione per IoT, quantizzazione
  - **Layout**: Open space con isole collaborative, parete di schermi per visualizzazione
</details>

### 3. OPBG IRCCS Lab
<details>
  <summary><b>Dettagli</b></summary>

  - **Tema Visivo**: Laboratorio clinico con elementi ospedalieri child-friendly
  - **Palette Colori**: Bianco, verde acqua, rosa pallido, blu cielo
  - **Specializzazione FL**: FL per dati medici sensibili, diagnosi collaborativa, modelli personalizzati pediatrici
  - **Layout**: Area centrale sicura per dati sensibili, postazioni con doppi monitor
</details>

## 🧠 Architettura Cognitiva degli Agenti

Gli agenti combinano la state machine di Agent Laboratory con la pipeline cognitiva di Generative Agents:

```
                    ┌─────────────────────┐
                    │   PERCEIVE          │
                    │   - Eventi FL       │
                    │   - Agenti vicini   │
                    │   - Metriche round  │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │   RETRIEVE          │
                    │   - Memoria assoc.  │
                    │   - Cosine sim.     │
                    │   - Top-N ranked    │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │   PLAN              │
                    │   - Schedule giorn. │
                    │   - Round FL        │
                    │   - Collaborazioni  │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │   REFLECT           │
                    │   - Insight FL      │
                    │   - Auto-valutaz.   │
                    │   - Consolidamento  │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │   EXECUTE           │
                    │   - Training locale │
                    │   - Aggregazione    │
                    │   - Comunicazione   │
                    └─────────────────────┘
```

### Mapping FL → Memoria Cognitiva

| Evento FL | ConceptNode | Poignancy |
|---|---|---|
| Round completato con accuracy +5% | `("Lab X", "completed", "round N with acc 0.87")` | 5/10 |
| Convergenza raggiunta | `("Global model", "converged", "at round N")` | 9/10 |
| Collaborazione inter-lab | `("Lab X", "shared model with", "Lab Y")` | 6/10 |
| Fallimento round | `("Lab X", "failed", "round N due to timeout")` | 8/10 |

## 🚀 Quick Start

### Prerequisiti
- Node.js (v14+)
- Python 3.9+
- Ollama installato con almeno un modello (consigliato: `llama3:8b`)
- npm o yarn

### Setup Ollama

```bash
# Installa modello LLM
ollama pull llama3:8b

# Installa modello embeddings
ollama pull nomic-embed-text

# Verifica
ollama list
```

### Installazione

<details>
  <summary><b>Agent Laboratory v2 — Backend</b></summary>

```bash
cd Researcher_World2/agent-laboratory-v2/backend

# Crea ambiente virtuale Python
python -m venv venv
source venv/bin/activate  # Linux/Mac

# Installa dipendenze
pip install -r requirements.txt

# Avvia il server backend
uvicorn api.main:app --host 0.0.0.0 --port 8091 --reload
```
</details>

<details>
  <summary><b>Agent Laboratory v2 — Frontend</b></summary>

```bash
cd Researcher_World2/agent-laboratory-v2/frontend

# Installa dipendenze
npm install

# Avvia il server di sviluppo
npm start
```
</details>

<details>
  <summary><b>Generative Agents — Backend</b></summary>

```bash
cd LLM_Generative_Agents/generative_agents/reverie/backend_server

# Crea ambiente virtuale Python
python -m venv venv
source venv/bin/activate

# Installa dipendenze
pip install -r ../../requirements.txt

# Avvia il server
python reverie.py
```
</details>

<details>
  <summary><b>Generative Agents — Frontend</b></summary>

```bash
cd LLM_Generative_Agents/generative_agents/environment/frontend_server

# Avvia Django
python manage.py runserver

# Apri http://localhost:8000/fixed_simulator/
```
</details>

## 📊 Stato di Sviluppo

### Agent Laboratory v2

| Area | Stato | Voto |
|---|---|---|
| Frontend React + Phaser | Funzionante | 8/10 |
| WebSocket bidirezionale | Funzionante | 7/10 |
| FedAvg | Funzionante | 7/10 |
| FedProx | Bypassed | 0/10 |
| Metodi environment.py | Incompleti | 3/10 |
| Sistema agenti | Design buono, env incompleto | 6/10 |

### Generative Agents

| Area | Stato | Voto |
|---|---|---|
| Pipeline cognitiva 5 stadi | Completa | 9/10 |
| Memoria 3 livelli + retrieval | Completa | 9/10 |
| Ollama integration | Funzionante | 8/10 |
| Fixed simulator UI | Funzionante | 9/10 |
| Phaser renderer | Rotto | 2/10 |
| Multi-model support | Implementato | 7/10 |

### Fusione — Roadmap

- [ ] **Fase 0**: Decisioni architetturali (comunicazione, clock, grid system)
- [ ] **Fase 1**: Stabilizzazione Agent Lab v2 (fix 4 bug critici)
- [ ] **Fase 2**: Innesto layer cognitivo GA nei ricercatori AL
- [ ] **Fase 3**: FL come evento cognitivo nella memoria associativa
- [ ] **Fase 4**: Comportamento emergente e coalizioni inter-lab

## 🧩 Struttura del Progetto

```
Researcher_World3_GAI/
├── Analysis_Fusion.md              # Analisi comparativa e piano di fusione
├── README.md                       # Questo file
├── Researcher_World2/              # Agent Laboratory v2
│   └── agent-laboratory-v2/
│       ├── frontend/               # React 18 + Phaser 3 + TypeScript
│       │   ├── src/
│       │   │   ├── phaser/         # Scene laboratori, sprite, animazioni
│       │   │   ├── components/     # Componenti React UI
│       │   │   └── services/       # WebSocket + API client
│       │   └── public/assets/      # Sprite pixel art e tileset
│       └── backend/
│           ├── api/                # FastAPI server + WebSocket
│           ├── models/agents/      # ResearcherAgent (state machine)
│           ├── fl/                 # FedAvg, FedProx (in sviluppo)
│           ├── ai/                 # Ollama LLM connector + memoria
│           └── simulation/         # Controller orchestrazione
└── LLM_Generative_Agents/         # Generative Agents (fork Stanford)
    └── generative_agents/
        ├── reverie/backend_server/
        │   ├── persona/
        │   │   ├── cognitive_modules/   # perceive, retrieve, plan, reflect, execute
        │   │   ├── memory_structures/   # spatial, associative, scratch
        │   │   └── prompt_template/     # Ollama wrapper + prompt engineering
        │   ├── reverie.py              # Orchestratore simulazione
        │   └── maze.py                 # Rappresentazione mondo + pathfinding
        └── environment/frontend_server/
            ├── templates/              # Django views (fixed_simulator)
            ├── static_dirs/            # Asset 2D villaggio
            └── storage/                # Template simulazioni (3 e 25 agenti)
```

## 🔗 Riferimenti

- Park, J.S. et al., *Generative Agents: Interactive Simulacra of Human Behavior*, ACM UIST 2023
- McMahan, B. et al., *Communication-Efficient Learning of Deep Networks from Decentralized Data*, AISTATS 2017
- Li, T. et al., *Federated Optimization in Heterogeneous Networks* (FedProx), MLSys 2020

## 📝 Licenza

Questo progetto è rilasciato sotto licenza MIT. Vedi il file [LICENSE](LICENSE) per maggiori dettagli.

---

<p align="center">
  <small>© 2025-2026 Fabio Liberti — Federated Generative Agents Research Project</small>
</p>
