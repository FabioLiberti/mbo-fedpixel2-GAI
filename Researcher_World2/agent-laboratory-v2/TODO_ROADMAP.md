# TODO Roadmap — mbo-fedpixel2-GAI

> Generato: 2026-03-26 dopo v0.6.1
> Completati: HIGH + MEDIUM priority
> Questo file traccia tutte le modifiche residue per evitare perdita di contesto.

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

**Stato**: COMPLETATO (v0.7.0 + v0.7.1 + v0.7.2)
**Priorità**: FEATURE

### Implementazione
- **v0.7.0**: Dataset Heart Disease UCI (303 righe, 13 feature, target binario) al posto di XOR sintetico
  - Partizioni non-IID per età: mercatorum <50, blekinge 50-59, opbg ≥60
  - Lazy-loading con cache, normalizzazione min-max, imputation NaN→mediana
  - NN input dim: 10→13, metriche per-client accumulate
- **v0.7.1**: Sparkline canvas (200×60px) per accuracy (verde) e loss (rosso) nel pannello FL
  - FLStatusData esteso con accuracyHistory, lossHistory, perClient
  - History passato sia dal backend reale che dal fallback locale
- **v0.7.2**: Milestone popup quando accuracy ≥ 80%
  - Overlay centrato con breakdown per-lab (accuracy + loss per client)
  - Auto-dismiss dopo 8s o click, trigger una sola volta per simulazione

### Miglioramenti futuri possibili
1. **Persistenza modello**: i pesi esistono solo in memoria — salvare/caricare checkpoint
2. **Privacy budget**: inizializzato a 1.0 ma mai consumato — implementare DP-SGD o accounting
3. **Communication overhead**: tracciato come metrica ma non implementato realmente
4. **Agent reasoning su FL**: gli agenti non ragionano sulle scelte FL (iperparametri, strategie) — collegare cognitive pipeline a decisioni FL

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

## Riepilogo priorità

| ID | Tipo | Descrizione | Complessità |
|----|------|-------------|-------------|
| LOW-1 | Refactor | ~~MercatorumLabScene → BaseLabScene~~ COMPLETATO | Media |
| LOW-2 | Fix | ~~Test backend aggiornamento nomi/ruoli~~ COMPLETATO | Bassa |
| LOW-3 | Fix | ~~generate_personas.py nomi vecchi~~ COMPLETATO | Bassa |
| LOW-4 | Quality | ~~Ridurre `as any` (54→9)~~ COMPLETATO | Media |
| LOW-5 | Verifica | ~~Build frontend pulita~~ COMPLETATO | Bassa |
| FEATURE-1 | Feature | ~~Miglioramento prompt cognitivi~~ COMPLETATO | Alta |
| FEATURE-2 | Feature | ~~FL dataset reale + visualizzazione~~ COMPLETATO | Alta |
| FEATURE-3 | Feature | ~~Tilemap reali con Tiled~~ COMPLETATO | Media |
