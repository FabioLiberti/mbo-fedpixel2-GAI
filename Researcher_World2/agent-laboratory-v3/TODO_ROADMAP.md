# TODO Roadmap — mbo-fedpixel2-GAI

> Aggiornato: 2026-03-26 dopo v0.8.5
> Tutte le feature pianificate (LOW-1→5, FEATURE-1→9) sono state completate.

---

## Versioni rilasciate

| Versione | Descrizione |
|----------|-------------|
| v0.6.0–v0.6.3 | Refactor BaseLabScene, test backend, tilemap runtime |
| v0.6.4–v0.6.5 | Cognitive pipeline stub→LLM, memoria a lungo termine, conversazione multi-turno |
| v0.6.7–v0.6.9 | Refactor Mercatorum→BaseLabScene, riduzione `as any` (54→9), build ottimizzata |
| v0.7.0 | Dataset Heart Disease UCI (303 righe, 13 feature), partizioni non-IID per età |
| v0.7.1 | Sparkline canvas (accuracy/loss history) nel pannello FL |
| v0.7.2 | Milestone popup (accuracy ≥ 80%) con breakdown per-lab |
| v0.7.3 | Persistenza modello (checkpoint .npz/.json), local-vs-global, cross-eval, agent awareness |
| v0.7.4 | Frontend Lab Performance e Cross-Evaluation panels |
| v0.7.5 | DP-SGD: gradient clipping + rumore gaussiano, epsilon accounting, barra privacy budget |
| v0.8.0 | Dialoghi FL tra agenti post-round (stub + LLM), badge nel LLMDialogPanel |
| v0.8.1 | Dialoghi arricchiti: prompt con ricordi agenti, ruoli contestuali, LLM parallelo |
| v0.8.2 | Toggle FedAvg/FedProx da UI: dropdown + slider mu + endpoint REST |
| v0.8.3 | Visualizzazione distribuzione Non-IID: istogramma età, samples, positive ratio per lab |
| v0.8.4 | Export metriche FL (JSON) + convergence detection con badge UI |
| v0.8.5 | Effetti visivi Phaser FL: glow agenti, pulse indicatori, dash animati, particelle |

---

## Feature completate — dettaglio

### LOW-1→5: Refactoring e qualità (v0.6.0–v0.6.9)

- **LOW-1** MercatorumLabScene → BaseLabScene (~400 righe eliminate)
- **LOW-2** Test backend allineati a PERSONA_REGISTRY (12 agenti, ruoli aggiornati)
- **LOW-3** generate_personas.py allineato ai nomi attuali
- **LOW-4** `as any` ridotti da 54 a 9 occorrenze, creata `IAgentScene` interface
- **LOW-5** Build frontend: 0 warning, 0 errori, bundle 568KB gzip

### FEATURE-1: Cognitive pipeline — stub → LLM (v0.6.4–v0.6.5)

Pipeline completo perceive→retrieve→plan→reflect→execute con doppio percorso (stub/LLM).
20+ prompt FL-specifici, memoria a lungo termine, conversazione multi-turno (min 3 turni), toggle runtime.

### FEATURE-2: FL training avanzato (v0.7.0–v0.7.5)

- Dataset Heart Disease UCI con partizioni non-IID per età (opbg <50, blekinge 50-59, mercatorum ≥60)
- NN numpy-only 13→32→16→1, sparkline, milestone popup, persistenza checkpoint
- Local-vs-global evaluation, cross-evaluation, agent awareness templates
- DP-SGD: gradient clipping L2 + rumore gaussiano, sigma=2.0, eps_total=20, ~8 round budget

### FEATURE-3: Tilemap reali (v0.6.3)

Tileset generati a runtime (24 tile types), 3 temi colore, grid pathfinding automatica.

### FEATURE-4: Toggle FedAvg/FedProx da UI (v0.8.2)

Dropdown nel pannello FL + slider mu (0.001→0.1) + `POST /fl/algorithm` endpoint.

### FEATURE-5: Dialoghi LLM tra agenti sul FL (v0.8.0–v0.8.1)

Conversazioni post-round tra coppie di agenti per lab, prompt arricchiti con ricordi FL + ruoli, LLM parallelo via ThreadPoolExecutor, badge viola nel LLMDialogPanel.

### FEATURE-6: Visualizzazione distribuzione Non-IID (v0.8.3)

Sezione "Data Distribution" nel pannello FL: per ogni lab n_samples, age mean±std, positive ratio, mini bar-chart istogramma 5 bin. `GET /fl/data-distribution` endpoint.

### FEATURE-7: Effetti visivi Phaser durante fasi FL (v0.8.5)

- Glow ellipse pulsante sotto sprite agenti (colore per stato FL)
- Indicatore colorato sopra agenti con pulse tween per stato
- Linee tratteggiate animate (dash offset scorrevole) sulle connessioni attive
- Particelle lungo connessioni attive con lifespan calibrato su distanza
- Scene update hook per tracking posizioni senza evento `move`

### FEATURE-8: Export metriche FL (v0.8.4)

Bottone "Export Metrics" nel pannello FL → download JSON con history completa per round (accuracy, loss, per-client, local-vs-global, cross-eval, DP). `GET /fl/export` endpoint.

### FEATURE-9: Convergence detection (v0.8.4)

`check_convergence(patience=3)` — plateau accuracy + budget exhausted. Badge nel pannello FL: "Training" (blu), "Converged" (verde), "Budget Exhausted" (rosso). `GET /fl/convergence` endpoint. Convergence info nel broadcast WebSocket.

---

## Riepilogo

| ID | Tipo | Descrizione | Stato |
|----|------|-------------|-------|
| LOW-1 | Refactor | ~~MercatorumLabScene → BaseLabScene~~ | COMPLETATO |
| LOW-2 | Fix | ~~Test backend nomi/ruoli~~ | COMPLETATO |
| LOW-3 | Fix | ~~generate_personas.py~~ | COMPLETATO |
| LOW-4 | Quality | ~~Ridurre `as any` (54→9)~~ | COMPLETATO |
| LOW-5 | Verifica | ~~Build frontend pulita~~ | COMPLETATO |
| FEATURE-1 | Feature | ~~Cognitive pipeline stub → LLM~~ | COMPLETATO |
| FEATURE-2 | Feature | ~~FL dataset reale + DP-SGD~~ | COMPLETATO |
| FEATURE-3 | Feature | ~~Tilemap reali~~ | COMPLETATO |
| FEATURE-4 | Feature | ~~Toggle FedAvg/FedProx da UI~~ | COMPLETATO |
| FEATURE-5 | Feature | ~~Dialoghi LLM tra agenti~~ | COMPLETATO |
| FEATURE-6 | Feature | ~~Distribuzione Non-IID~~ | COMPLETATO |
| FEATURE-7 | Feature | ~~Effetti visivi Phaser FL~~ | COMPLETATO |
| FEATURE-8 | Feature | ~~Export metriche FL~~ | COMPLETATO |
| FEATURE-9 | Feature | ~~Convergence detection~~ | COMPLETATO |
