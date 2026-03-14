# Generative Agents - Spiegazione Completa del Sistema

## Panoramica Generale

Questo progetto implementa il sistema "Generative Agents" sviluppato da Stanford University, che simula agenti virtuali con comportamenti umani credibili in un ambiente 2D. Gli agenti vivono in una cittadina virtuale chiamata "Smallville" e mostrano comportamenti emergenti attraverso interazioni sociali complesse.

## Architettura del Sistema

### 1. **Backend Server (Reverie)**
**Posizione:** `/reverie/backend_server/`

Il cuore del sistema di simulazione che gestisce:
- **File principale:** `reverie.py` - Contiene la classe `ReverieServer`
- **Gestione degli agenti:** Coordina il ciclo cognitivo di ogni persona
- **Stato del mondo:** Mantiene la rappresentazione dell'ambiente
- **Integrazione LLM:** Interfaccia con modelli di linguaggio per la generazione di comportamenti

### 2. **Frontend Server (Django)**
**Posizione:** `/environment/frontend_server/`

Interfaccia web per visualizzazione in tempo reale:
- **Framework:** Django con Phaser.js per il rendering 2D
- **Visualizzazione:** Mappa interattiva con sprite degli agenti
- **Controlli:** Gestione del tempo di simulazione e ispezione dello stato
- **Log Viewer:** Sistema di monitoraggio delle azioni (con indicatori LLM/FAKE)

## Come Funzionano gli Agenti

### Ciclo Cognitivo (implementato in `persona.py`)

Ogni agente segue un ciclo cognitivo sofisticato:

1. **PERCEIVE (Percezione)**
   - Osserva l'ambiente circostante (raggio di visione configurabile)
   - Rileva altri agenti nelle vicinanze
   - Identifica oggetti interagibili nell'ambiente

2. **RETRIEVE (Recupero)**
   - Accede ai ricordi rilevanti basati sulle percezioni
   - Utilizza memoria associativa per trovare esperienze simili
   - Considera l'importanza e la recenza dei ricordi

3. **PLAN (Pianificazione)**
   - **Pianificazione a lungo termine:** Schedule giornaliere complete
   - **Pianificazione a breve termine:** Azioni minute per minuto
   - **Decomposizione:** Suddivide attività complesse in azioni atomiche

4. **EXECUTE (Esecuzione)**
   - Determina movimenti specifici nell'ambiente
   - Gestisce interazioni con oggetti
   - Coordina conversazioni con altri agenti

5. **REFLECT (Riflessione)**
   - Genera insight e consolidamento della memoria
   - Valuta l'importanza degli eventi
   - Forma nuove connessioni tra ricordi

### Tipi di Azioni degli Agenti

**Azioni Quotidiane:**
- Routine mattutine (svegliarsi, fare colazione)
- Attività lavorative (cucinare al caffè, dipingere)
- Interazioni sociali (conversazioni, pianificazione eventi)
- Routine serali (cena, relax, andare a dormire)

**Comportamenti Emergenti:**
- Pianificazione spontanea di eventi (feste di San Valentino)
- Formazione di amicizie e relazioni
- Condivisione di informazioni tra agenti
- Coordinazione di attività di gruppo

## Sistema di Memoria

### 1. **Memoria Spaziale (`spatial_memory.py`)**
```
Struttura gerarchica:
Mondo → Settore → Arena → Oggetti di Gioco
Esempio: "the Ville" → "Hobbs Cafe" → "kitchen" → "coffee machine"
```

### 2. **Memoria Associativa (`associative_memory.py`)**
- **Stream di memoria a lungo termine** con timestamp
- **Recupero basato su similarità** usando embeddings
- **Scoring di rilevanza** per la selezione dei ricordi
- **Gestione della dimenticanza** basata su importanza e tempo

### 3. **Memoria Scratch (`scratch.py`)**
- **Memoria di lavoro a breve termine**
- Obiettivi correnti e piani attivi
- Contesto conversazionale
- Stato emotivo e sociale

## Integrazione LLM e AI

### Configurazione Originale
- **Modelli:** OpenAI GPT (text-davinci-002/003, ChatGPT)
- **Template:** Prompt strutturati in `/persona/prompt_template/`

### Versione Modificata (Ollama)
- **LLM Locale:** Integrazione con Ollama per esecuzione offline
- **Modelli Leggeri:** qwen3:0.6b per efficienza
- **Embeddings:** nomic-embed-text per similarità semantica
- **Caching:** Meccanismi di cache per prestazioni ottimizzate

### Utilizzi dell'LLM

1. **Pianificazione Giornaliera**
   ```
   Esempio: "Isabella Rodriguez dovrebbe svegliarsi alle 7:00, 
   fare colazione alle 7:30, andare a lavoro alle 8:00..."
   ```

2. **Generazione Dialoghi**
   ```
   Conversazioni naturali tra agenti basate su:
   - Personalità e relazioni
   - Contesto situazionale
   - Storia conversazionale
   ```

3. **Decomposizione Azioni**
   ```
   "Preparare il caffè" diventa:
   - Andare alla macchina del caffè
   - Prendere i chicchi
   - Macinare i chicchi
   - Preparare la bevanda
   ```

4. **Riflessione e Insight**
   ```
   "Isabella ha notato che Klaus visita spesso il caffè.
   Forse dovrebbe invitarlo alla festa."
   ```

## Ambiente di Simulazione

### Rappresentazione del Mondo
- **Griglia 2D:** 70x40 tiles per la mappa "the_ville"
- **Rilevamento collisioni:** Pathfinding automatico
- **Oggetti interagibili:** Letti, tavoli, macchine del caffè, ecc.
- **Progressione temporale:** 10 secondi reali = 1 step di simulazione

### Struttura dell'Ambiente
```
the_ville/
├── Hobbs Cafe (settore pubblico)
│   ├── main room (zona principale)
│   ├── kitchen (cucina)
│   └── bathroom (bagno)
├── Case degli Agenti (settori privati)
│   ├── Isabella Rodriguez's house
│   ├── Klaus Mueller's apartment
│   └── Maria Lopez's apartment
└── Aree Comuni
    ├── Johnson Park
    └── Oak Hill College
```

## Flusso di Sviluppo e Esecuzione

### 1. **Inizializzazione**
```bash
# Avvio del sistema completo
python reverie.py
# Selezione: fork da simulazione base
# Configurazione: agenti, durata, parametri
```

### 2. **Esecuzione Simulazione**
- **Server Environment:** Django (porta 8000)
- **Server Reverie:** Backend simulazione (porta interna)
- **Comunicazione:** File JSON per scambio stato

### 3. **File di Stato**
```
/storage/{nome_simulazione}/
├── environment/{step}.json    # Stato mondo per frontend
├── movement/{step}.json       # Comandi movimento agenti
├── personas/                  # Dati persistenti agenti
└── reverie/                  # Log e stati interni
```

## Componenti Tecnici Avanzati

### 1. **Sistema di Pathfinding**
- **A* Algorithm** per navigazione ottimale
- **Evitamento collisioni** tra agenti
- **Gestione code** per accesso a oggetti condivisi

### 2. **Gestione Conversazioni**
- **Turni di dialogo** strutturati
- **Memoria conversazionale** persistente
- **Interruzioni e riprese** naturali

### 3. **Sistema di Eventi**
- **Trigger temporali** per routine giornaliere
- **Eventi sociali** pianificati spontaneamente
- **Propagazione informazioni** attraverso conversazioni

## Parametri di Configurazione

### Parametri Cognitivi
```python
vision_r = 4          # Raggio di visione agente
attention_bandwidth = 3  # Limitazione capacità cognitiva
retention = 5         # Durata memoria a breve termine
```

### Parametri LLM
```python
temperature = 0.7     # Creatività nelle risposte
max_tokens = 150     # Lunghezza massima output
caching = True       # Abilitazione cache risposte
```

## Comportamenti Emergenti Osservati

### 1. **Coordinazione Sociale**
- Agenti che organizzano spontaneamente eventi
- Formazione di gruppi sociali
- Condivisione di informazioni rilevanti

### 2. **Adattamento Ambientale**
- Apprendimento di routine ottimali
- Evitamento di conflitti spaziali
- Utilizzo efficiente delle risorse condivise

### 3. **Sviluppo Relazionale**
- Consolidamento di amicizie attraverso interazioni ripetute
- Formazione di preferenze sociali
- Memoria di episodi sociali significativi

## Estensioni e Personalizzazioni

### 1. **Aggiunta Nuovi Agenti**
- Creazione profilo personalità in `/personas/`
- Definizione routine iniziali
- Configurazione relazioni sociali

### 2. **Espansione Ambiente**
- Modifica mappe in formato tile-based
- Aggiunta nuovi oggetti interagibili
- Definizione nuove aree pubbliche/private

### 3. **Personalizzazione Comportamenti**
- Modifica template prompt per personalità specifiche
- Aggiunta nuovi tipi di azioni
- Implementazione meccaniche sociali avanzate

## Problemi Tecnici e Soluzioni

### 1. **Gestione Errori Spaziali**
Risolti KeyError per aree mancanti con fallback a posizione corrente agente.

### 2. **Ottimizzazione Prestazioni**
- Cache delle risposte LLM
- Batch processing delle richieste
- Riduzione frequenza aggiornamenti non critici

### 3. **Stabilità Simulazione**
- Gestione eccezioni per continuità esecuzione
- Fallback per situazioni impreviste
- Recovery automatico da stati inconsistenti

## Conclusioni

Questo sistema rappresenta un'implementazione avanzata di agenti generativi che dimostrano comportamenti sociali credibili. L'architettura modulare permette facili estensioni e personalizzazioni, mentre l'integrazione con LLM locali (Ollama) rende il sistema accessibile per ricerca e sperimentazione senza dipendenze da servizi cloud esterni.

Il valore principale risiede nella dimostrazione di come comportamenti sociali complessi possano emergere dall'interazione di architetture cognitive individuali ben progettate, aprendo possibilità per applicazioni in simulazioni sociali, gaming, e ricerca comportamentale.