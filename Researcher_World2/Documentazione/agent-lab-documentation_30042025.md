# Agent Laboratory - Documentazione di Progetto

## Indice
1. [Introduzione](#introduzione)
2. [Concept del Progetto](#concept-del-progetto)
3. [Architettura Tecnica](#architettura-tecnica)
4. [Ambienti di Laboratorio](#ambienti-di-laboratorio)
5. [Sistema degli Agenti](#sistema-degli-agenti)
6. [Federated Learning nel Simulatore](#federated-learning-nel-simulatore)
7. [Stack Tecnologico](#stack-tecnologico)
8. [Struttura del Progetto](#struttura-del-progetto)
9. [Roadmap di Sviluppo](#roadmap-di-sviluppo)
10. [Proposte di Miglioramento](#proposte-di-miglioramento)

## Introduzione

Agent Laboratory è un simulatore interattivo che modella un ecosistema di ricerca sul federated learning attraverso tre laboratori virtuali rappresentati in grafica pixel art 2D. Questo documento fornisce una panoramica tecnica completa del progetto, descrivendo l'architettura, i componenti principali, lo stato attuale dell'implementazione e le direzioni future di sviluppo.

## Concept del Progetto

Il simulatore rappresenta un ambiente di ricerca dinamico dove personaggi (agenti) si muovono e interagiscono autonomamente. Il federated learning è sia l'oggetto di studio dei ricercatori virtuali che il meccanismo strutturale che governa le interazioni e la condivisione di conoscenza tra i laboratori.

L'obiettivo principale è creare un ambiente simulato che:
- Illustri i principi del federated learning in modo visivo e interattivo
- Modelli comportamenti realistici di ricercatori in diversi contesti
- Fornisca uno strumento educativo per comprendere metodologie di ricerca collaborative
- Dimostri la privacy-preservation nei sistemi di apprendimento federato

## Architettura Tecnica

### Panoramica dell'Architettura

Agent Laboratory implementa un'architettura ibrida che combina tecnologie ottimizzate per:
- Frontend grafico per visualizzazione pixel2D
- Backend specializzato per algoritmi AI e federated learning
- Sistema di comunicazione per sincronizzazione tra visualizzazione e logica

![Diagramma Architetturale](https://placeholder-for-architecture-diagram.com)

### Frontend

- **React + TypeScript**: Framework principale per l'interfaccia utente
- **Phaser 3**: Motore di rendering per la visualizzazione pixel2D
- **Componenti UI**: Dashboard, controlli e pannelli informativi

Il frontend gestisce la visualizzazione grafica dei laboratori, l'animazione degli agenti, gli effetti visivi delle interazioni e fornisce un'interfaccia per monitorare e controllare la simulazione.

### Backend

- **Python**: Linguaggio principale per algoritmi avanzati
- **Mesa**: Framework per modellazione e simulazione multi-agente
- **TensorFlow/PyTorch**: Implementazione algoritmi federated learning
- **FastAPI**: API backend performante
- **WebSocket**: Comunicazione bidirezionale a bassa latenza

Il backend è responsabile della simulazione del comportamento degli agenti, dell'implementazione degli algoritmi di federated learning, e della gestione dello stato globale della simulazione.

## Ambienti di Laboratorio

Il simulatore include tre laboratori virtuali, ciascuno con un proprio tema visivo, caratteristiche funzionali e specializzazione in federated learning.

### 1. Università Mercatorum Lab

**Tema Visivo**: 
- Stile italiano classico con elementi moderni
- Architettura con colonne e archi in stile romano
- Palette colori: tonalità terracotta, blu navy, crema

**Caratteristiche Funzionali**:
- Grande area centrale con tavolo per meeting collaborativi
- Workstation individuali disposte lungo il perimetro
- Area dedicata alla visualizzazione di dati finanziari

**Specializzazione FL**:
- Business intelligence e analisi finanziaria federata
- Privacy-preserving analytics per dati aziendali sensibili
- Framework regolatori e compliance GDPR

### 2. Blekinge University Lab

**Tema Visivo**:
- Design scandinavo minimalista high-tech
- Architettura moderna con ampie superfici bianche e legno chiaro
- Palette colori: bianco, azzurro ghiaccio, grigio chiaro, accenti gialli

**Caratteristiche Funzionali**:
- Layout open space con isole di lavoro collaborative
- Parete di schermi per visualizzazione algoritmi e dati
- "Innovation corner" con lavagne digitali

**Specializzazione FL**:
- Algoritmi di aggregazione avanzati (oltre FedAvg)
- Ottimizzazione per dispositivi IoT e edge computing
- Quantizzazione e compressione per ridurre comunicazione

### 3. OPBG IRCCS Lab (Ospedale Pediatrico Bambino Gesù)

**Tema Visivo**:
- Laboratorio clinico con elementi ospedalieri
- Design pulito con dettagli child-friendly
- Palette colori: bianco, verde acqua, rosa pallido, blu cielo

**Caratteristiche Funzionali**:
- Area centrale sicura per dati sensibili
- Postazioni con doppi monitor per analisi medicali
- Piccola area con letti ospedalieri pixelati per simulazione clinica

**Specializzazione FL**:
- Federated learning per dati medici altamente sensibili
- Diagnosi collaborativa preservando privacy dei pazienti
- Modelli personalizzati per casi pediatrici rari

## Sistema degli Agenti

### Tipologie di Personaggi Autonomi

#### Ruoli Accademici

1. **PhD Student**
   - Visualizzazione: Giovane, abiti casual, spesso con laptop
   - Comportamento: Movimento energico, alterna lavoro intenso e confronto
   - Specializzazioni: Data Science, Privacy Engineering, Optimization Theory

2. **Researcher (Post-Doc)**
   - Visualizzazione: Business casual, tablet o notebook alla mano
   - Comportamento: Metodico, alterna ricerca individuale e collaborazione
   - Specializzazioni: Secure Aggregation, Non-IID Data Handling, Communication Efficiency

3. **Professor**
   - Visualizzazione: Abbigliamento formale, gesticola mentre spiega
   - Comportamento: Movimento deliberato, inizia discussioni, supervisiona
   - Specializzazioni: FL Systems Architecture, Theoretical Guarantees, Privacy Economics

#### Ruoli Tecnici

4. **ML Engineer**
   - Visualizzazione: Look tech-casual, spesso con device multipli
   - Comportamento: Pragmatico, alterna coding e testing
   - Specializzazioni: Model Optimization, Systems Integration, Empirical Evaluation

5. **Data Engineer**
   - Visualizzazione: Casual con elementi tecnici, spesso con dashboard
   - Comportamento: Metodico, focalizzato su specifiche workstation
   - Specializzazioni: Data Pipeline Design, Heterogeneous Data Integration, Quality Assurance

6. **Privacy Specialist**
   - Visualizzazione: Look professionale sobrio, spesso isolato
   - Comportamento: Cauto, controlla frequentemente sicurezza sistemi
   - Specializzazioni: Differential Privacy Implementation, Attack Simulation, Compliance Verification

#### Ruoli Medici (OPBG)

7. **Medical Doctor**
   - Visualizzazione: Camice bianco pixel art, stetoscopio
   - Comportamento: Alterna analisi dati e consultazioni virtuali
   - Specializzazioni: Clinical Data Interpretation, Diagnostic Model Evaluation

8. **Biomedical Engineer**
   - Visualizzazione: Camice con elementi tecnici, device medicali
   - Comportamento: Ponte tra medici e tecnici, movimento tra aree
   - Specializzazioni: Medical Imaging in FL, Biosignal Processing

### Sistema di Autonomia e Interazione

Gli agenti operano secondo un sistema di stati e comportamenti autonomi:

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

Ogni agente gestisce:
- **Routine Lavorative**: Cicli di lavoro, pausa, discussione
- **Necessità**: Riposo, socializzazione, focus, risorse
- **Stati Emotivi**: Concentrazione, frustrazione, entusiasmo, stanchezza

Le interazioni emergenti includono:
- **Formazione Gruppi**: Basata su interessi comuni e relazioni
- **Knowledge Sharing**: Condivisione selettiva basata su trust
- **Collaborazioni**: Formate organicamente per progetti complementari
- **Conferenze Spontanee**: Presentazioni generate dai progressi significativi

La comunicazione visiva tra agenti viene rappresentata attraverso:
- **Bolle Dialogo**: Con icone tematiche per tipo di discussione
- **Indicatori Stato**: Piccole icone sopra i personaggi
- **Link Visuali**: Linee che connettono collaboratori

## Federated Learning nel Simulatore

Il federated learning è implementato nel simulatore in due modi distinti:

### 1. Come Oggetto di Ricerca

- I ricercatori virtuali studiano e migliorano algoritmi FL
- Progetti di ricerca su privacy, efficienza, convergenza
- Pubblicazioni e progressi visualizzati in-game
- Sfide basate su problemi reali del FL

### 2. Come Meccanismo Strutturale

- Conoscenza distribuita nei "knowledge vaults" dei ricercatori
- Condivisione mediante meccanismi privacy-preserving
- Aggregazione di contributi senza centralizzazione
- Privacy budget come risorsa gestionale

Gli algoritmi FL implementati includono:
- **FedAvg** (Federated Averaging)
- **FedProx** per dati non-IID
- Algoritmi con **differential privacy**
- Protocolli di **secure aggregation**

## Stack Tecnologico

### Frontend

- **Phaser 3**
  - Versione: 3.55.2+
  - Funzione: Motore di rendering principale per visualizzazione pixel2D
  - Componenti: Texture Packer, Tilemap, Animation Manager, Particle System

- **React**
  - Versione: 18.0+
  - Componenti: SimulationContainer, ControlPanel, AnalyticsDashboard, AgentInspector

- **TypeScript**
  - Versione: 4.7+
  - Benefici: Type checking, modularità migliorata, documentazione integrata

### Backend

- **Python**
  - Versione: 3.9+
  - Ambiti: Implementazione algoritmi FL, simulazione comportamento agenti

- **Mesa**
  - Versione: 1.1.1+
  - Funzionalità: Modello agenti, schedulazione interazioni, raccolta dati

- **TensorFlow/PyTorch**
  - Versione: TensorFlow 2.9+ o PyTorch 1.12+
  - Implementazioni: FedAvg, FedProx, Differential Privacy, Secure Aggregation

- **FastAPI**
  - Versione: 0.85+
  - Endpoint: Configurazione simulazione, risultati FL, monitoraggio agenti

- **WebSocket**
  - Implementazione: Socket.IO o FastAPI WebSockets
  - Scambi: Aggiornamenti agenti, eventi interazione, progressi training FL

## Struttura del Progetto

La struttura del progetto è organizzata in modo modulare, con divisione chiara tra frontend e backend:

```
agent-laboratory/
├── frontend/
│   ├── src/
│   │   ├── components/       # Componenti React UI
│   │   ├── phaser/           # Implementazione gioco Phaser
│   │   │   ├── scenes/       # Scene dei laboratori
│   │   │   ├── sprites/      # Agenti e oggetti interattivi
│   │   │   ├── fl/           # Controller federated learning
│   │   │   ├── controllers/  # Controller degli agenti
│   │   │   └── ui/           # Elementi UI in-game
│   │   ├── services/         # Comunicazione API e WebSocket
│   │   └── utils/            # Utility varie
│   └── public/
│       └── assets/           # Asset grafici e configurazioni
│
└── backend/
    ├── api/                  # API FastAPI
    ├── models/
    │   ├── agents/           # Definizioni agenti
    │   └── environment.py    # Ambiente simulazione
    ├── fl/                   # Implementazione federated learning
    └── simulation/           # Controller simulazione
```

## Roadmap di Sviluppo

Lo sviluppo del progetto è pianificato in fasi incrementali:

### Fase 1: Ambienti e Personaggi Base (4-6 settimane)
- Implementazione grafica dei tre laboratori
- Sistema di movimento base e collisioni
- Personaggi con comportamenti autonomi semplici
- UI di base e sistema di camera

### Fase 2: Sistema di Autonomia Avanzata (4-6 settimane)
- Implementazione completa stati e decisioni
- Sistema di relazioni e interazioni
- Routine e comportamenti emergenti
- Visualizzazione comunicazione

### Fase 3: Meccaniche FL (6-8 settimane)
- Simulazione processi federated learning
- Visualizzazione training e convergenza
- Sistema di progetti di ricerca
- Meccaniche di privacy-preservation

### Estensioni Future
- Integrazione di LLM per processi cognitivi avanzati
- Espansione a ulteriori domini applicativi
- Sistema di conferenze e comunità scientifica
- Modalità multiplayer collaborativa

## Proposte di Miglioramento

Sulla base dell'analisi dell'interfaccia attuale, sono state identificate diverse aree di miglioramento:

### Miglioramenti dell'Interfaccia Utente
1. **Dashboard più informativo**
   - Metriche in tempo reale di convergenza algoritmi FL
   - Statistiche di interazione tra agenti
   - Monitoraggio uso risorse computazionali

2. **Rappresentazione visiva delle connessioni FL**
   - Linee animate tra laboratori durante trasferimento conoscenze
   - Effetti visivi per illustrare il processo federato

3. **Timeline interattiva**
   - Visualizzazione evoluzione simulazione nel tempo
   - Funzionalità per tornare a punti specifici della simulazione

4. **Modalità focus per singolo laboratorio**
   - Possibilità di ingrandire e osservare in dettaglio un laboratorio
   - Filtri per visualizzare solo certi tipi di interazioni

### Arricchimento della Simulazione
1. **Indicatori di stato agenti**
   - Icone o aure colorate per indicare stato attuale
   - Visualizzazione delle specializzazioni attive

2. **Eventi casuali**
   - Introduzione di eventi imprevisti (problemi di privacy, breakthrough)
   - Sfide dinamiche che richiedono adattamento

3. **Visualizzazione del progresso scientifico**
   - Grafici per monitorare avanzamento delle conoscenze
   - Pubblicazioni virtuali generate dai risultati

### Funzionalità Avanzate
1. **Strumenti di configurazione avanzata**
   - Pannello per modificare parametri algoritmi FL
   - Personalizzazione comportamento agenti

2. **Modalità esportazione dati**
   - Export risultati in formati standard (CSV, JSON)
   - Generazione report automatici

3. **Scenari predefiniti**
   - Simulazione condizioni specifiche (dati non-IID, problemi privacy)
   - Challenge mode con obiettivi da raggiungere

4. **Modalità comparativa**
   - Esecuzione simulazioni parallele con parametri diversi
   - Strumenti per confronto risultati

### Miglioramenti Tecnici
1. **Ottimizzazione performance**
   - Miglioramento fluidità con numero maggiore di agenti
   - Tecniche di rendering efficienti per dispositivi meno potenti

2. **Supporto multi-dispositivo**
   - Interfaccia responsive per tablet e dispositivi mobili
   - Controlli adattati per input touch

3. **Integrazione con strumenti ML reali**
   - Collegamento con librerie ML per testare algoritmi esistenti
   - Import/export modelli da/verso framework standard

### Elementi Educativi
1. **Tutorial integrato**
   - Guide interattive sui concetti di federated learning
   - Walkthrough progressivo delle funzionalità

2. **Annotazioni esplicative**
   - Tooltip e popup informativi sui processi in atto
   - Glossario termini tecnici accessibile

3. **Livelli di complessità**
   - Modalità semplificata per scopi didattici
   - Modalità avanzata per ricercatori

---

Documento preparato per il progetto Agent Laboratory  
Data: 30 Aprile 2025  
Versione: 1.0
