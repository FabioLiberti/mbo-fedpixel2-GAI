# TODO Roadmap — mbo-fedpixel2-GAI

> Aggiornato: 2026-03-26 dopo v0.7.5
> Completati: LOW-1→5, FEATURE-1→3 (tutto fino a v0.7.5)
> Questo file traccia tutte le modifiche residue e il piano degli sviluppi futuri.

---

## LOW-1: Refactor MercatorumLabScene → BaseLabScene

**Stato**: COMPLETATO (v0.6.9)
**Priorità**: LOW
**Stima impatto**: ~400 righe eliminabili

MercatorumLabScene è l'unica scene che ancora estende `BaseScene` anziché `BaseLabScene`.
Blekinge e OPBG sono già state refactorizzate (v0.6.0).

### File coinvolti
- `frontend/src/phaser/scenes/Mercatorum/MercatorumLabScene.ts` — riscrivere come Blekinge/OPBG
- `frontend/src/phaser/scenes/Mercatorum/types.ts` — `IMercatorumLabScene` potrebbe essere rimossa (usare `ILabControlScene`)
- `frontend/src/phaser/scenes/Mercatorum/Textures.ts` — spostare logica condivisa in BaseLabScene
- `frontend/src/phaser/scenes/Mercatorum/Controls.ts` — spostare in BaseLabScene o LabControlsMenu
- `frontend/src/phaser/scenes/Mercatorum/Agents.ts` — sostituire con `createAgentsFromConfig()` ereditato

### Pattern da seguire (come BlekingeLabScene)
```
export class MercatorumLabScene extends BaseLabScene {
  public theme: LabTheme = { ... };
  constructor() { super('MercatorumLabScene'); }
  preload() { super.preload(); /* solo asset mercatorum-specifici */ }
  create() { /* come Blekinge: debug, textures, layout, agents, camera, controllers, controls, title */ }
  update() { this.updateAgents(); this.checkInteractions(); }
  // Solo metodi scene-specifici: createMercatorumBackground(), createInteractionZones(), handleZoneInteraction()
}
```

### Dettaglio `as any` rimuovibili dopo refactor
- `MercatorumLabScene.ts:155` — `this as any` per LabControlsMenu
- `Controls.ts:578-629` — 5× `(scene as any)` per accesso simpleLLMPanel

---

## LOW-2: Aggiornare test backend

**Stato**: COMPLETATO (v0.6.2 + v0.6.7)
**Priorità**: LOW

`backend/tests/test_researcher_agent.py` ha riferimenti obsoleti ai vecchi nomi e ruoli persona.

### Modifiche necessarie

#### File: `backend/tests/test_researcher_agent.py`

**Linea 40**: default role nel helper
```python
# PRIMA:
def create_test_agent(persona_name="Marco_Rossi", lab_id="mercatorum", role="phd_student"):
# DOPO:
def create_test_agent(persona_name="Marco_Rossi", lab_id="mercatorum", role="student"):
```

**Linea 216**: asserzione ruolo
```python
# PRIMA:
assert data["role"] == "phd_student"
# DOPO:
assert data["role"] == "student"
```

**Linee 228-238**: config dei 9 agenti (nomi e ruoli vecchi)
```python
# PRIMA:
agents_config = [
    ("mercatorum", "Marco_Rossi", "phd_student"),
    ("mercatorum", "Elena_Conti", "researcher"),
    ("mercatorum", "Luca_Bianchi", "phd_student"),
    ("blekinge", "Anna_Lindberg", "professor"),
    ("blekinge", "Erik_Johansson", "researcher"),
    ("blekinge", "Sara_Nilsson", "phd_student"),
    ("opbg", "Giulia_Romano", "researcher"),
    ("opbg", "Matteo_Ferri", "researcher"),
    ("opbg", "Chiara_Mancini", "phd_student"),
]
# DOPO (allineato a PERSONA_REGISTRY attuale):
agents_config = [
    ("mercatorum", "Elena_Conti",    "professor"),
    ("mercatorum", "Luca_Bianchi",   "privacy_specialist"),
    ("mercatorum", "Marco_Rossi",    "student"),
    ("mercatorum", "Sofia_Greco",    "researcher"),
    ("blekinge",   "Lars_Lindberg",  "professor_senior"),
    ("blekinge",   "Erik_Johansson", "student"),
    ("blekinge",   "Sara_Nilsson",   "sw_engineer"),
    ("blekinge",   "Nils_Eriksson",  "engineer"),
    ("opbg",       "Matteo_Ferri",   "doctor"),
    ("opbg",       "Marco_Romano",   "student_postdoc"),
    ("opbg",       "Lorenzo_Mancini","engineer"),
    ("opbg",       "Giulia_Conti",   "researcher"),
]
```

#### File: `backend/ai/test_llm_advanced_integration.py`
- Linea 79: `phd_agent_id = "test_phd_student"` → aggiornare se necessario

---

## LOW-3: Aggiornare generate_personas.py

**Stato**: COMPLETATO (già aggiornato in precedenza)
**Priorità**: LOW

Lo script `backend/config/personas/generate_personas.py` ha ancora i nomi persona vecchi.
I ruoli sono stati aggiornati in v0.6.1 ma i nomi persona no.

### Mapping nomi vecchi → nuovi

| Lab | Vecchio | Nuovo | Note |
|-----|---------|-------|------|
| blekinge | Anna_Lindberg | Lars_Lindberg | professor_senior |
| blekinge | (mancante) | Nils_Eriksson | engineer — da aggiungere |
| opbg | Giulia_Romano | Giulia_Conti | researcher |
| opbg | Chiara_Mancini | Marco_Romano | student_postdoc |
| opbg | (mancante) | Lorenzo_Mancini | engineer — da aggiungere |
| mercatorum | (mancante) | Sofia_Greco | researcher — da aggiungere |

### Azione
Riscrivere il dizionario `PERSONAS` in `generate_personas.py` con i 12 agenti attuali,
allineandolo esattamente a `PERSONA_REGISTRY` in `environment.py` e ai file `scratch.json` esistenti.

---

## LOW-4: Ridurre ulteriormente `as any` nel frontend

**Stato**: COMPLETATO (54→9, v0.6.8)
**Priorità**: LOW

### Distribuzione attuale (54 occorrenze in 17 file)

| File | Count | Pattern principale |
|------|-------|--------------------|
| LabControlsMenu.ts | 7 | `(this.scene.agentsLegend as any)` |
| LLMControlPanel.ts | 7 | `(this.scene as any).agentController` |
| LLMDialogIntegrator.ts | 7 | `(this.scene as any).agents`, `(this as any)._wasEnabled` |
| Controls.ts (Mercatorum) | 5 | `(scene as any).simpleLLMPanel` |
| Agent.ts | 5 | `this.scene as any` per .time, .game, .cameras |
| SimpleLLMPanelController.ts | 5 | `(this.scene as any).agentController` |
| DialogRenderer.ts | 3 | `(bubble as any).hide()`, `(child as any).getId()` |
| DialogState.ts | 3 | `agents[0] as any`, `(this.scene as any).flController` |
| GlobalAgentController.ts | 2 | `this.scene as any` |
| LLMPanelRenderer.ts | 2 | `this.scene as any` per GeometryMask |
| SimpleLLMPanelView.ts | 2 | `this.scene as any` |
| Altro (5 file) | 1 cad. | vari |

### Strategia suggerita
1. Creare `IAgentScene` interface in un file condiviso che estende `Phaser.Scene`:
   ```typescript
   export interface IAgentScene extends Phaser.Scene {
     agents: Agent[];
     agentController: GlobalAgentController | null;
     agentsLegend: AgentsLegend | null;
     flController?: FLController;
   }
   ```
2. Tipare i componenti UI (`LLMControlPanel`, `SimpleLLMPanelController`, etc.) con `IAgentScene` invece di `Phaser.Scene`
3. Per `Agent.ts`: il tipo `this.scene` è `Phaser.Scene` ma i metodi Phaser (`.time`, `.cameras`, `.game`) non sono riconosciuti perché Agent estende `Phaser.GameObjects.Sprite` il cui `.scene` è tipato come `Scene` base. Soluzione: cast esplicito `(this.scene as Phaser.Scene)` è più sicuro di `as any`

---

## LOW-5: Build frontend ottimizzata

**Stato**: COMPLETATO (v0.6.8 — 0 warning, 0 errori, bundle 568KB gzip)
**Priorità**: LOW

### Azione
```bash
export PATH="/opt/homebrew/bin:$PATH"
cd frontend && npx react-scripts build 2>&1 | tail -20
```
Verificare che:
- No warning TS significativi
- Bundle size ragionevole (attuale non verificato dopo cleanup di 22k+ righe)
- No riferimenti a file eliminati

---

## FEATURE-1: Cognitive pipeline — stub → LLM

**Stato**: COMPLETATO (v0.6.4 + v0.6.5)
**Priorità**: FEATURE

### Implementazione
Il pipeline cognitivo (perceive→retrieve→plan→reflect→execute) è **completo e funzionante**.
Ogni step ha due percorsi:
- `USE_STUBS=True` (default): valori deterministici FL-specifici, veloce, no Ollama
- `USE_STUBS=False`: chiamate reali a qwen3.5:4b via Ollama con prompt FL-specializzati

Toggle runtime: endpoint REST `set_llm_enabled(bool)` + pulsante frontend.

### Miglioramenti implementati
1. **Qualità prompt (v0.6.4)**: 20+ funzioni con contesto FL (ruolo, lab, specializzazione), prompt in italiano, 9 profili ruolo, 3 descrizioni lab, system prompt FL riutilizzabile, 30+ emoji keyword
2. **Memoria a lungo termine (v0.6.5)**: insight riflessione recuperati prima di `_determine_action()` e iniettati nel contesto conversazione (`agent_chat_v2`); completamento FL task inietta evento ad alta poignancy + boost importance trigger per attivare riflessione
3. **Conversazione multi-turno (v0.6.5)**: minimo 3 turni enforced (`_MIN_CHAT_TURNS`), contesto arricchito con specializzazioni FL, 3 fasi di risposta (early/mid/late) negli stub
4. **Emoji pronunciatio (v0.6.4)**: 30+ keyword FL/IT nella mappa emoji, prompt LLM in italiano

---

## FEATURE-2: FL training — miglioramenti

**Stato**: COMPLETATO (v0.7.0 → v0.7.5)
**Priorità**: FEATURE

### Implementazione
- **v0.7.0**: Dataset Heart Disease UCI (303 righe, 13 feature, target binario) al posto di XOR sintetico
  - Partizioni non-IID per età: opbg <50 (pediatrico), blekinge 50-59, mercatorum ≥60
  - Lazy-loading con cache, normalizzazione min-max, imputation NaN→mediana
  - NN input dim: 10→13, metriche per-client accumulate
- **v0.7.1**: Sparkline canvas (200×60px) per accuracy (verde) e loss (rosso) nel pannello FL
  - FLStatusData esteso con accuracyHistory, lossHistory, perClient
  - History passato sia dal backend reale che dal fallback locale
- **v0.7.2**: Milestone popup quando accuracy ≥ 80%
  - Overlay centrato con breakdown per-lab (accuracy + loss per client)
  - Auto-dismiss dopo 8s o click, trigger una sola volta per simulazione
- **v0.7.3**: Persistenza modello + local-vs-global + cross-eval + agent awareness bias
  - Checkpoint .npz (pesi) + .json (stato/metriche) con auto-save e auto-load
  - Valutazione local-vs-global per ogni lab, cross-evaluation globale
  - Template ruolo-specifici iniettati in memoria agenti (professor, privacy_specialist, student, researcher)
- **v0.7.4**: Frontend Lab Performance e Cross-Evaluation panels + test e2e
- **v0.7.5**: DP-SGD privacy budget
  - Gradient clipping per L2 norm + rumore gaussiano calibrato in numpy_train
  - Epsilon accounting via Gaussian mechanism (sigma=2.0, eps_total=20, ~8 round di budget)
  - Barra Privacy Budget nel pannello FL con percentuale e epsilon consumato
  - Sigma per lab in Lab Performance, riga privacy nel milestone popup
  - Template privacy_specialist aggiornato con insight su epsilon budget
  - Persistenza DP state in checkpoint

---

## FEATURE-3: Tilemap reali con Tiled

**Stato**: COMPLETATO (v0.6.3)
**Priorità**: FEATURE (estetica)

### Implementazione
- Tileset generati a runtime via canvas (`tilesetGenerator.ts`) con 24 tile types tematizzati
- 3 temi colore: THEME_MERCATORUM (terracotta), THEME_BLEKINGE (scandinavo), THEME_OPBG (ospedaliero)
- `BaseLabScene.createLabTilemap()` crea blank tilemap + layers programmaticamente
- Ogni scena definisce il proprio layout con callback (muri, scrivanie, librerie, server, etc.)
- Grid pathfinding aggiornata automaticamente dal furniture layer

---

## FEATURE-4: Toggle FedAvg / FedProx da UI

**Stato**: DA FARE
**Priorità**: MEDIA
**Complessità**: Bassa

Il backend supporta già FedAvg e FedProx (parametro `algorithm` + termine prossimale `mu`), ma il frontend non permette di scegliere l'algoritmo.

### Cosa fare
- Aggiungere un dropdown/radio nel pannello FL (sotto il toggle On/Off) con opzioni "FedAvg" e "FedProx"
- Endpoint REST per cambiare algoritmo a runtime (`POST /fl/algorithm`)
- Mostrare `mu` corrente nel pannello quando FedProx è attivo
- Opzionale: slider per regolare `mu` (0.001 → 0.1)

### File coinvolti
- `backend/api/main.py` — nuovo endpoint
- `backend/fl/federated.py` — `set_algorithm()` method
- `frontend/src/components/FLStatusPanel.tsx` — dropdown + display mu
- `frontend/src/components/SimulationContainer.tsx` — passare scelta al backend

---

## FEATURE-5: Dialoghi LLM tra agenti sul FL

**Stato**: DA FARE
**Priorità**: ALTA
**Complessità**: Alta

Gli agenti hanno template di awareness iniettati in memoria (v0.7.3), ma non generano ancora dialoghi visibili tra loro basati sui risultati FL.

### Cosa fare
1. **Trigger conversazione post-round**: dopo ogni FL round, selezionare 2 agenti dello stesso lab con ruoli diversi e avviare una conversazione LLM (via Qwen/Ollama) dove discutono i risultati
2. **Contesto conversazione**: iniettare nel prompt i dati FL del round (accuracy, gain, bias, epsilon) come contesto, insieme ai ricordi FL degli agenti
3. **Visualizzazione**: i dialoghi appaiono nelle bolle sopra gli sprite nella scena Phaser + nel LLMDialogPanel React
4. **Cross-lab (opzionale)**: agenti di lab diversi si incontrano nella WorldMap e discutono differenze nei risultati

### File coinvolti
- `backend/simulation/controller.py` — orchestrazione dialoghi post-round
- `backend/cognitive/plan.py` — trigger conversazione FL-aware
- `backend/cognitive/prompts/gpt_structure.py` — prompt specifici per dialogo FL
- `frontend/src/components/LLMDialogPanel.tsx` — rendering dialoghi
- `frontend/src/phaser/sprites/Agent.ts` — trigger bolle dialogo

---

## FEATURE-6: Visualizzazione distribuzione Non-IID

**Stato**: DA FARE
**Priorità**: MEDIA
**Complessità**: Media

Mostrare nel pannello FL la composizione demografica di ogni lab per rendere visivamente evidente il bias nei dati.

### Cosa fare
1. **Mini bar-chart** per ogni lab: distribuzione età (istogramma) + percentuale target positivo
2. **Endpoint backend**: `GET /fl/data-distribution` che ritorna per ogni lab: n_samples, age_mean, age_std, positive_ratio, age_histogram
3. **Pannello "Data Distribution"** nel FLStatusPanel (sotto Cross-Evaluation): 3 righe con barre colorate
4. **Sparkline opzionale**: canvas mini-chart con distribuzione età sovrapposta per i 3 lab

### File coinvolti
- `backend/fl/federated.py` — `get_data_distribution()` method
- `backend/api/main.py` — endpoint REST
- `frontend/src/components/FLStatusPanel.tsx` — sezione Data Distribution
- `frontend/src/components/FLStatusPanel.css` — stili barre distribuzione

---

## FEATURE-7: Effetti visivi Phaser durante fasi FL

**Stato**: DA FARE
**Priorità**: BASSA
**Complessità**: Media

Animazioni di particelle e connessioni durante le fasi FL nelle scene di gioco.

### Cosa fare
1. **Training**: glow/pulse sugli agenti che stanno addestrando il modello locale
2. **Sending**: particelle che si muovono dagli agenti verso un punto centrale (server)
3. **Aggregating**: effetto merge/convergenza al centro della scena
4. **Receiving**: particelle dal centro verso gli agenti (distribuzione modello globale)
5. **WorldMap**: linee animate tra i lab durante sending/receiving

### File coinvolti
- `frontend/src/phaser/fl/FLVisualEffects.ts` — già esiste come skeleton, da implementare
- `frontend/src/phaser/fl/FLController.ts` — trigger effetti per fase
- `frontend/src/phaser/sprites/Agent.ts` — glow effect sugli sprite

---

## FEATURE-8: Export metriche FL

**Stato**: DA FARE
**Priorità**: BASSA
**Complessità**: Bassa

Bottone per scaricare un report completo delle metriche FL.

### Cosa fare
1. **Bottone "Export"** nel pannello FL (icona download)
2. **Formato JSON**: history completa (accuracy, loss, epsilon, local-vs-global, cross-eval per round)
3. **Formato CSV opzionale**: tabella round × metrica per analisi in Excel/Pandas
4. **Endpoint backend**: `GET /fl/export` che ritorna il JSON completo

### File coinvolti
- `backend/api/main.py` — endpoint export
- `frontend/src/components/FLStatusPanel.tsx` — bottone download
- Nessun file nuovo necessario (logica minima)

---

## FEATURE-9: Convergence detection e auto-stop

**Stato**: DA FARE
**Priorità**: BASSA
**Complessità**: Bassa

Rilevamento automatico della convergenza del modello FL e stop del training.

### Cosa fare
1. **Early stopping**: se accuracy non migliora per N round consecutivi (patience=3), fermare il training
2. **Budget exhausted stop**: quando epsilon si esaurisce, fermare automaticamente il DP-SGD (già parziale: il training continua senza noise)
3. **Notifica UI**: popup o badge nel pannello FL che indica "Converged" o "Budget Exhausted — training without DP"
4. **Opzionale**: learning rate decay quando si avvicina alla convergenza

### File coinvolti
- `backend/fl/federated.py` — logica convergence detection in `aggregate_models()`
- `frontend/src/components/FLStatusPanel.tsx` — badge/notifica convergenza

---

## Riepilogo priorità

| ID | Tipo | Descrizione | Complessità | Stato |
|----|------|-------------|-------------|-------|
| LOW-1 | Refactor | ~~MercatorumLabScene → BaseLabScene~~ | Media | COMPLETATO |
| LOW-2 | Fix | ~~Test backend aggiornamento nomi/ruoli~~ | Bassa | COMPLETATO |
| LOW-3 | Fix | ~~generate_personas.py nomi vecchi~~ | Bassa | COMPLETATO |
| LOW-4 | Quality | ~~Ridurre `as any` (54→9)~~ | Media | COMPLETATO |
| LOW-5 | Verifica | ~~Build frontend pulita~~ | Bassa | COMPLETATO |
| FEATURE-1 | Feature | ~~Cognitive pipeline stub → LLM~~ | Alta | COMPLETATO |
| FEATURE-2 | Feature | ~~FL dataset reale + DP-SGD + visualizzazione~~ | Alta | COMPLETATO |
| FEATURE-3 | Feature | ~~Tilemap reali con Tiled~~ | Media | COMPLETATO |
| **FEATURE-4** | Feature | Toggle FedAvg / FedProx da UI | Bassa | DA FARE |
| **FEATURE-5** | Feature | Dialoghi LLM tra agenti sul FL | Alta | DA FARE |
| **FEATURE-6** | Feature | Visualizzazione distribuzione Non-IID | Media | DA FARE |
| **FEATURE-7** | Feature | Effetti visivi Phaser durante fasi FL | Media | DA FARE |
| **FEATURE-8** | Feature | Export metriche FL (JSON/CSV) | Bassa | DA FARE |
| **FEATURE-9** | Feature | Convergence detection e auto-stop | Bassa | DA FARE |
