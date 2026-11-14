# Agent Laboratory 

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.7%2B-blue)](https://www.typescriptlang.org/)
[![Phaser 3](https://img.shields.io/badge/Phaser-3.55.2%2B-orange)](https://phaser.io/)
[![Python](https://img.shields.io/badge/Python-3.9%2B-green)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.85%2B-teal)](https://fastapi.tiangolo.com/)

**Un simulatore interattivo di ecosistemi di ricerca in federated learning con laboratori virtuali in pixel art 2D e agenti autonomi.**

<p align="center">
  <img src="frontend/public/logo192.png" width="680" alt="Agent Laboratory Interface" />
</p>

## 🔬 Panoramica

Agent Laboratory è un simulatore avanzato che modella un ecosistema di ricerca nel dominio del federated learning attraverso tre laboratori virtuali distinti. I ricercatori virtuali (agenti autonomi) interagiscono, collaborano e conducono ricerche in un ambiente dinamico guidato da algoritmi di machine learning reali.

Il federated learning è implementato in due dimensioni distinte:
1. **Come oggetto di studio**: Gli agenti ricercano e ottimizzano algoritmi FL
2. **Come meccanismo strutturale**: La conoscenza è distribuita tra i laboratori e condivisa attraverso protocolli privacy-preserving

### Caratteristiche principali:

- **Simulazione Multi-agente**: State machine avanzate per comportamenti autonomi
- **Visualizzazione Pixel-Art**: Rendering dettagliato dei laboratori in stile pixel art 2D
- **Algoritmi FL reali**: Implementazione scientificamente rilevante di FedAvg, FedProx, Differential Privacy
- **Monitoraggio in tempo reale**: Metriche di convergenza, efficienza e privacy-preservation
- **Interazione dinamica**: Pattern emergenti di collaborazione e scoperta

## 🏗️ Architettura & Stack Tecnologico

```
┌───────────────────────────────────────┐
│ Frontend (Browser)                     │
│ ┌──────────────────┐ ┌──────────────┐ │
│ │ Phaser 3 Game    │ │ React UI     │ │
│ │ - Rendering      │ │ - Controls   │ │
│ │ - Animazioni     │ │ - Dashboard  │ │
│ │ - Input          │ │ - Analytics  │ │
│ └────────┬─────────┘ └──────┬───────┘ │
└───────────┼──────────────────┼─────────┘
            │                  │
            ▼                  ▼
┌───────────────────────────────────────┐
│ Backend Server                         │
│ ┌──────────────────┐ ┌──────────────┐ │
│ │ Agent System     │ │ FL Engine    │ │
│ │ - Mesa           │ │ - TensorFlow │ │
│ │ - Comportamenti  │ │ - Algoritmi  │ │
│ │ - Sinergie       │ │ - Metriche   │ │
│ └──────────────────┘ └──────────────┘ │
└───────────────────────────────────────┘
```

### Frontend
- **Framework**: React 18.0+ con TypeScript 4.7+
- **Rendering 2D**: Phaser 3.55.2+ con PixelPerfect scaling
- **UI Components**: Dashboard analitiche e controlli simulazione
- **Comunicazione**: Axios per API REST, Socket.io per WebSocket

### Backend
- **Framework**: Python 3.9+ con FastAPI 0.85+
- **Simulazione Multi-Agente**: Mesa 1.1.1+
- **Machine Learning**: TensorFlow 2.9+ / PyTorch 1.12+
- **Comunicazione**: WebSocket per sincronizzazione bidirezionale a bassa latenza

## 🔗 Ambienti di Laboratorio

Il simulatore presenta tre laboratori virtuali, ciascuno con un tema visivo, caratteristiche funzionali e specializzazioni FL uniche:

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
  - **Layout**: Area centrale sicura per dati sensibili, postazioni con doppi monitor, letti ospedalieri pixel art
</details>

## 🧬 Sistema degli Agenti

Gli agenti autonomi rappresentano ricercatori con diverse specializzazioni e comportamenti:

```typescript
enum AgentState {
  WORKING,
  MEETING,
  RESTING,
  MOVING,
  DISCUSSING,
  PRESENTING
}
```

### Categorie principali:

1. **Ruoli Accademici**: Professor, Researcher (Post-Doc), PhD Student
2. **Ruoli Tecnici**: ML Engineer, Data Engineer, Privacy Specialist
3. **Ruoli Medici**: Medical Doctor, Biomedical Engineer

Ogni agente gestisce:
- Routine lavorative (cicli di lavoro/pausa/discussione)
- Necessità (riposo, socializzazione, focus)
- Stati emotivi (concentrazione, frustrazione, entusiasmo)
- Relazioni con altri agenti

## 🚀 Quick Start

### Prerequisiti
- Node.js (v14+)
- Python 3.9+
- npm o yarn

### Installazione rapida (con Docker)

```bash
# Clona il repository
git clone https://github.com/yourusername/agent-laboratory.git
cd agent-laboratory

# Avvia con Docker
docker-compose up
```

### Installazione manuale

<details>
  <summary><b>Backend Setup</b></summary>

```bash
cd agent-laboratory/backend

# Crea ambiente virtuale Python
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# Installa dipendenze
pip install -r requirements.txt

# Avvia il server backend
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```
</details>

<details>
  <summary><b>Frontend Setup</b></summary>

```bash
cd agent-laboratory/frontend

# Installa dipendenze
npm install

# Avvia il server di sviluppo
npm start
```
</details>

L'applicazione sarà disponibile su `http://localhost:3000`

## 📊 Federated Learning nel Simulatore

### Meccanismi FL implementati

Agent Laboratory implementa algoritmi FL avanzati per simulare scenari reali di ricerca collaborativa:

- **FedAvg (Federated Averaging)**: Aggiornamento dei modelli globali attraverso la media pesata dei contributi locali
- **FedProx**: Estensione di FedAvg ottimizzata per dataset non-IID con termini di regolarizzazione di prossimità
- **Differential Privacy**: Aggiunta di rumore calibrato durante l'aggregazione per garantire privacy ε-δ
- **Secure Aggregation**: Protocolli crittografici per somma sicura multi-parte senza rivelare i contributi individuali

```python
# Esempio di implementazione FedAvg
def federated_averaging(local_models, weights):
    """
    Implementa l'algoritmo Federated Averaging (FedAvg)
    
    Args:
        local_models: Lista di modelli locali dai client
        weights: Peso relativo di ogni modello
        
    Returns:
        global_model: Modello globale aggregato
    """
    global_model = {}
    for layer_name in local_models[0].keys():
        global_model[layer_name] = sum(
            model[layer_name] * w for model, w in zip(local_models, weights)
        ) / sum(weights)
    return global_model
```

### Visualizzazione del processo FL

La simulazione visualizza in tempo reale:
- Trasferimento di conoscenza tra laboratori (linee animate con particelle)
- Metriche di convergenza (grafici di loss e accuracy)
- Budget di privacy rimanente (indicatori visuali)
- Efficienza di comunicazione (consumo di risorse)

## 🧩 Struttura del Progetto

```
agent-laboratory/
├── frontend/
│   ├── src/
│   │   ├── phaser/
│   │   │   ├── scenes/       # Laboratori virtuali
│   │   │   ├── sprites/      # Agenti e oggetti interattivi
│   │   │   ├── fl/           # Controller federated learning
│   │   │   └── ui/           # Elementi UI in-game
│   │   ├── components/       # Componenti React
│   │   └── services/         # Comunicazione API e WebSocket
│   └── public/
│       └── assets/           # Sprite, tileset, config
├── backend/
│   ├── api/                  # API FastAPI
│   ├── models/
│   │   ├── agents/           # Definizioni agenti
│   │   └── environment.py    # Ambiente simulazione
│   ├── fl/                   # Implementazione federated learning
│   └── simulation/           # Controller simulazione
└── docs/                     # Documentazione
```

## 🔥 Esempi di Implementazione

### State Machine per comportamenti autonomi

```typescript
class ResearcherAgent {
  private state: AgentState;
  private needs: NeedsMap;
  private personality: PersonalityTraits;
  private expertise: ExpertiseAreas;
  private relationships: Map<string, number>;

  update(deltaTime: number): void {
    // Aggiorna bisogni e stato
    this.updateNeeds(deltaTime);
    
    // Decide se cambiare stato
    if (this.shouldChangeState()) {
      this.selectNewState();
    }
    
    // Esegue comportamento basato su stato
    this.executeCurrentBehavior(deltaTime);
    
    // Muove l'agente nell'ambiente
    this.updateMovement(deltaTime);
    
    // Cerca interazioni possibili
    this.checkForInteractions();
  }
}
```

### Comunicazione WebSocket per sincronizzazione

```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Ricevi aggiornamenti dal client
            data = await websocket.receive_json()
            
            # Aggiorna stato simulazione
            simulation_controller.update(data)
            
            # Invia nuovi stati agli agenti
            agents_state = simulation_controller.get_agents_state()
            await websocket.send_json(agents_state)
            
            # Aggiorna stato FL se necessario
            if simulation_controller.fl_iteration_complete:
                fl_metrics = fl_engine.get_metrics()
                await websocket.send_json({"type": "fl_update", "data": fl_metrics})
    except WebSocketDisconnect:
        simulation_controller.disconnect_client()
```

## 🔧 Sviluppo Avanzato

### Integrazione di nuovi algoritmi FL

Per estendere il simulatore con nuovi algoritmi FL:

1. Implementa l'algoritmo nella directory `backend/fl/algorithms/`:

```python
# backend/fl/algorithms/fed_custom.py
from .base import FederatedAlgorithm

class FedCustom(FederatedAlgorithm):
    def __init__(self, params):
        super().__init__()
        self.custom_param = params.get('custom_param', 0.01)
        
    def aggregate(self, local_updates, client_metrics):
        # Implementa logica di aggregazione custom
        global_model = self._initialize_global_model()
        
        # Algoritmo personalizzato
        for client_id, update in local_updates.items():
            # Logica di aggregazione custom
            pass
            
        return global_model
```

2. Registra l'algoritmo nel factory:

```python
# backend/fl/algorithms/__init__.py
from .fed_avg import FedAvg
from .fed_prox import FedProx
from .fed_custom import FedCustom

ALGORITHMS = {
    'fedavg': FedAvg,
    'fedprox': FedProx,
    'fedcustom': FedCustom
}

def create_algorithm(algorithm_name, params=None):
    if params is None:
        params = {}
    
    if algorithm_name not in ALGORITHMS:
        raise ValueError(f"Unknown algorithm: {algorithm_name}")
        
    return ALGORITHMS[algorithm_name](params)
```

### Personalizzazione del comportamento degli agenti

Estendi il framework di comportamento autonomo implementando nuovi stati:

```typescript
// frontend/src/phaser/sprites/ResearcherAgent.ts
import { AgentState, PersonalityTrait } from '../types/AgentTypes';

interface BehaviorConfig {
  probability: number;
  duration: [number, number]; // [min, max] in ms
  prerequisites?: (agent: ResearcherAgent) => boolean;
}

export class SpecialistResearcher extends ResearcherAgent {
  constructor(scene, x, y, config) {
    super(scene, x, y, config);
    
    // Override del behavior map con comportamenti specialistici
    this.behaviorMap = {
      [AgentState.WORKING]: {
        probability: 0.6,
        duration: [8000, 15000],
        prerequisites: (agent) => agent.needs.energy > 0.3
      },
      [AgentState.COLLABORATING]: {
        probability: 0.4,
        duration: [5000, 12000],
        prerequisites: (agent) => 
          agent.needs.social > 0.5 && 
          agent.findCollaborators().length > 0
      },
      // Stati personalizzati
      [AgentState.RESEARCHING_PRIVACY]: {
        probability: 0.3,
        duration: [10000, 20000],
        prerequisites: (agent) => 
          agent.expertise.includes('privacy') &&
          agent.needs.curiosity > 0.7
      }
    };
  }
  
  // Comportamenti specializzati
  protected executePrivacyResearch(deltaTime: number): void {
    // Implementa comportamento specializzato
    this.generatePrivacyMetrics();
    this.updateKnowledgeBase('privacy', 0.02 * deltaTime);
    
    // Visualizza effetti
    this.scene.flController.visualizeSecureComputation(this);
  }
}
```

## 📝 Licenza

Questo progetto è rilasciato sotto licenza MIT. Vedi il file [LICENSE](LICENSE) per maggiori dettagli.

---

<p align="center">
  <small>© 2025 Agent Laboratory Team</small>
</p>
