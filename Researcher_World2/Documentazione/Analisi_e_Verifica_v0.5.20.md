# Analisi e verifica dell'ambiente — v0.5.20

**Data:** 14 novembre 2026
**Oggetto:** stato del progetto al commit `4929c7c` (v0.5.20), conservato nel tag `v0.5.20-v2-baseline`. È l'ultimo stato di `agent-laboratory-v2`, prima della rinomina in `agent-laboratory-v3`.
**Scopo:** fissare il punto di partenza di v3. Elenca ciò che oggi non funziona come previsto, con quale evidenza, e l'ordine di lavoro consigliato.

I percorsi dei file sono relativi a `Researcher_World2/agent-laboratory-v3/`. I numeri di riga si riferiscono al tag `v0.5.20-v2-baseline` e cambieranno man mano che il codice viene corretto.

## Giudizio in breve

L'impianto regge e l'applicazione si avvia, ma oggi non sono difendibili in un articolo né i numeri del federated learning, né i punteggi di qualità dei dialoghi, né le affermazioni sul comportamento cognitivo degli agenti. In più, alcune funzioni dell'interfaccia non hanno effetto. La struttura però c'è tutta, e la maggior parte delle correzioni è piccola e localizzata.

## Come è stata fatta la verifica

- Ogni prova è stata eseguita su una copia isolata della cartella `backend`, senza modificare il progetto. Eseguire i test sul posto scriverebbe un checkpoint FL che l'applicazione ricarica all'avvio.
- Ambiente: conda `mbo_gai`, Python 3.11, numpy 2.4, senza TensorFlow (FL in solo numpy). Modello LLM `qwen3.5:4b` via Ollama.
- Ogni rilievo è marcato come **riprodotto** (eseguito e osservato), **letto** (verificato nel codice ma non eseguito) oppure **da audit** (segnalato da una revisione del codice e non ricontrollato riga per riga).
- Gli script usati sono in `baseline_v2/verification/`; le istruzioni per rieseguirli sono in appendice.

## 1. Federated learning, controller, API

### Contesto

Il modello è una rete numpy 13→32→16→1 addestrata su Heart Disease UCI (303 righe), divise per età tra i tre laboratori:

| Laboratorio | Righe | Fascia d'età | Quota di positivi |
|---|---|---|---|
| mercatorum | 91 | 60 e oltre | 0,58 |
| blekinge | 125 | 50–59 | 0,48 |
| opbg | 87 | sotto i 50 | 0,30 |

Predire sempre la classe maggioritaria dà un'accuracy di 0,541: è il riferimento minimo per ogni confronto.

### Problemi critici (riprodotti)

1. **Il reset non azzera il FL.** Con i parametri fissati nel sorgente (rumore 2,0, budget ε totale 20, consumo dichiarato 2,42 per round) il budget di privacy si esaurisce dopo 9 round e i round successivi vengono saltati (`backend/simulation/controller.py:973`). Il checkpoint viene ricaricato a ogni avvio e a ogni reset (`controller.py:88`), quindi il FL resta fermo per sempre. È il motivo dei file `.bak` rinominati a mano, e rende irraggiungibile la `patience=20` introdotta nella v0.5.20: servono 21 round, se ne fanno 9.

2. **Con il rumore di default il modello quasi non impara.** Accuracy del modello globale su tutte le 303 righe, 10 seed, 9 round:

   | Configurazione | Media | Min–Max |
   |---|---|---|
   | Classe maggioritaria (riferimento) | 0,54 | — |
   | Default attuale (`noise_multiplier=2.0`) | 0,59 | 0,46–0,70 |
   | `noise_multiplier=1.0` | 0,75 | 0,67–0,78 |
   | `noise_multiplier=0.5` | 0,74 | 0,61–0,83 |
   | Privacy differenziale spenta | 0,63 | 0,54–0,81 |

   Senza privacy differenziale 9 round non bastano: un singolo run a 30 round arriva a 0,84. I checkpoint salvati mostrano lo stesso quadro (accuracy 0,50–0,69, loss che sale oltre 1,0).

3. **L'epsilon riportato non descrive il meccanismo eseguito.**
   - Il clipping è applicato al gradiente medio del batch, non a quello di ogni esempio (`backend/fl/federated.py:113`).
   - La contabilità conta un round come una sola interrogazione, mentre ogni round esegue 5 epoche di passi rumorosi (`federated.py:593`).
   - La formula usata vale solo per ε<1, e qui dà 2,42 per round.

   Il valore mostrato sottostima quindi il consumo reale: una stima a mano, valida solo come ordine di grandezza, dà ε nell'ordine delle decine dopo 9 round. Nel frattempo gli agenti ricevono in memoria frasi come "garantisce privacy formale".

4. **I run non sono riproducibili.** Il campionamento usa `hash(client_id)`, che Python randomizza a ogni processo (`federated.py:95`). Con lo stesso seed, tre processi danno accuracy al primo round di 0,376, 0,379 e 0,359. Fissando `PYTHONHASHSEED` i run tornano identici.

5. **Stop e start durante una chiamata LLM lenta lasciano due cicli di simulazione attivi.** Lo stop attende solo 2 secondi; lo start successivo riarma l'evento di stop e il vecchio thread riprende (`controller.py:880`). Riprodotto: due cicli vivi che eseguono passi sullo stesso modello.

### Problemi significativi

- **La selezione dei client è cosmetica**: ne vengono scelti 2 su 3, ma si allenano e si aggregano tutti e 3 (`controller.py:1096`). Riprodotto.
- **L'accuracy mostrata nel grafico non è quella del modello globale**: è la media delle accuracy di training locali prima dell'aggregazione (`federated.py:568`). Letto e confrontato con i valori reali.
- **Manca un set di test separato**: la valutazione usa gli stessi dati del training. L'ottimismo misurato è piccolo (+0,04, dentro la varianza), ma il difetto è strutturale. Riprodotto.
- **La "cross-evaluation" non è una matrice laboratorio×laboratorio**: è un duplicato esatto di `global_acc` (`federated.py:659–689`). Letto.
- **Configurazione ignorata**: `backend/config/simulation_config.json` dichiara privacy differenziale spenta con ε=1,0, ma il codice gira con privacy accesa, ε=20 e rumore 2,0 fissati nel sorgente (`controller.py:80–86`). `backend/config/constants.py` non è importato da nessun modulo e contiene valori diversi. Letto.
- **Il selettore FedAvg/FedProx non ha effetto**: vedi la sezione frontend.
- **Metrica di qualità dei dialoghi**: su 105 record, i dialoghi generati da template hanno media 0,71 e quelli realmente prodotti dal modello 0,69 (solo 19). Altri 11 record etichettati `llm` sono testo di template, perché l'etichetta registra l'interruttore e non chi ha generato il testo (`controller.py:715`). In 4 campioni letti, i numeri inventati dal modello non vengono penalizzati: un dialogo con un budget sbagliato ha ottenuto 0,88 ("good"). I dati sono in `baseline_v2/dialog_quality/`.
- **Memorie degli agenti**: 36 MB riscritti ogni 500 passi e mai ricaricati; all'avvio si riparte sempre dalla memoria iniziale (`controller.py:109–140`). Letto.
- **Errori nel ciclo inghiottiti**: un'eccezione ferma la simulazione senza traccia dell'errore (`controller.py:1169`). Letto.

### Minori

- **Documentazione disallineata**: il README parla di 3 agenti per laboratorio e di "dati sintetici", l'API dichiara la versione 0.3.0, la roadmap cita la v0.8.5. Il backend crea in realtà 12 agenti, 4 per laboratorio, con 9 ruoli.
- **Versioni riusate**: la numerazione v0.5.x compare due volte nella storia dei commit.
- **File superflui tracciati**: 15 file di backup (`*.py_` e simili) e 7 copie dello stesso PNG da 2,4 MB.
- **Dipendenze non bloccate**: `mesa>=1.1.1` romperebbe un'installazione pulita, e il Dockerfile usa Python 3.9 mentre l'ambiente è 3.11.
- **Accesso aperto**: CORS `*` e host `0.0.0.0` senza autenticazione; accettabile solo in locale.

## 2. Frontend

### Rilievi confermati

- **Le bolle di pensiero della v0.5.19 non possono apparire.** Ci sono due rotture indipendenti:
  - `frontend/src/components/LLMDialogPanel.tsx:4` e `frontend/src/components/FLStatusConnector.tsx:3` importano l'istanza di gioco da un secondo modulo (`utils/gameInstance.ts`) che nessuno inizializza; l'istanza vera è creata in `phaser/game.ts:81`. L'inoltro a Phaser quindi non parte mai.
  - `frontend/src/phaser/controllers/DialogState.ts:191` cerca l'identificativo dello sprite con `getData('id')`, ma nessun punto del codice chiama `setData`.

  Per la prima rottura restano spenti anche gli effetti visivi del FL.
- **Il selettore FedAvg/FedProx non ha effetto** (riprodotto). Il frontend manda i valori nel corpo JSON (`components/SimulationContainer.tsx:586–590`), il backend li legge come parametri di query (`backend/api/main.py:244–245`): risponde 200 e imposta sempre fedavg con mu 0,01.
- **Dopo Pausa non si può riprendere** (riprodotto). Nessun punto del frontend invia `resume`; "Avvia" riceve `already_running` e la simulazione resta in pausa.
- **Ogni comando parte due volte**, via WebSocket e via REST (`frontend/src/App.tsx:293`), reset compreso. Letto.
- **Le scene dei laboratori non vengono mai smontate.** Nessuna chiama `super.create()`, quindi il gestore di chiusura della scena base (`phaser/scenes/BaseLabScene.ts:216`) non viene mai registrato. A ogni rientro in un laboratorio i listener si accumulano e generano chiamate LLM e bolle duplicate. Letto.
- **"Genera Messaggio LLM" risponde sempre 422** (riprodotto): invia `agentId` numerico dove il backend vuole una stringa.
- **Interazioni di prossimità senza freno.** `BaseLabScene.ts:292–323` emette un'interazione a ogni fotogramma, con probabilità 0,3, per ogni coppia di agenti entro 32 px; ciascuna può innescare 4 chiamate LLM. Il percorso nel codice è confermato, la frequenza reale non è stata misurata. È un candidato plausibile per la saturazione di Ollama che le v0.5.16–18 hanno compensato riducendo contesto e token.

### Da audit, non ricontrollato riga per riga

- Circa 8.000 righe su 28.000 sono irraggiungibili o mai eseguite (il vecchio pannello LLM in Phaser non è mai stato cancellato).
- Le tre scene dei laboratori sono copie quasi identiche.
- Phaser non usa la posizione e lo stato inviati dal backend: il movimento degli sprite è casuale e locale. La scena quindi non mostra la simulazione.

Il controllo dei tipi (`tsc --noEmit`) passa senza errori. Non esiste alcun test del frontend.

## 3. Pipeline cognitiva

### Rilievi confermati

- **Gli agenti non seguono l'agenda e restano bloccati in conversazione** (riprodotto). In 10 giorni simulati ogni agente ha cambiato azione da 2 a 5 volte e tutti e 12 sono rimasti "in conversazione" fino alla fine, alcuni dal primo passo. La causa è il confronto esatto dell'orario in `backend/cognitive/memory/scratch.py:393`: con passi da 10 minuti non coincide quasi mai.
- **Superata la soglia, la memoria degli eventi si svuota quasi del tutto** (riprodotto: da oltre 200 nodi a 0–4). La scadenza è in tempo simulato ma viene confrontata con l'orologio reale (`backend/cognitive/memory/associative_memory.py:190`).
- **Dopo lo svuotamento gli identificativi dei nodi vengono riusati** (riprodotto). Il nuovo identificativo è calcolato dal numero di nodi presenti (`associative_memory.py:292`): una riflessione sopravvissuta viene sovrascritta e il salvataggio fallisce con `KeyError`, che il controller inghiotte.
- **Gli errori del modello diventano contenuto di memoria** (riprodotto). Con LLM attivo e Ollama irraggiungibile, 12 agenti su 12 hanno la stringa "OLLAMA ERROR" dentro piani e pensieri: la chiamata non solleva eccezioni, restituisce una stringa d'errore (`backend/cognitive/prompts/gpt_structure.py`). Non esiste un contatore dei fallimenti.
- **La rilevanza nel recupero dei ricordi è calcolata su vettori casuali.** Il modello di embedding `nomic-embed-text` non è installato in Ollama sulla macchina di verifica, e il ripiego genera vettori pseudo-casuali. In più reimposta il generatore numpy globale usato anche dal FL: è una seconda fonte di non riproducibilità oltre a `hash()`.
- **Origine dei dialoghi di template etichettati `llm`**: il parser non trova battute nella stringa d'errore e ripiega sul template in silenzio (`backend/cognitive/converse.py:451–484`). Letto.
- **Due difetti di prompt** (letti):
  - i ricordi recuperati non entrano nel prompt delle conversazioni spontanee (`backend/cognitive/prompts/run_gpt_prompt.py:920–933`);
  - il ruolo passato al modello è quello FL ("client", "aggregator"), non professore, medico o studente (`run_gpt_prompt.py:167`).

### Da audit, non ricontrollato

- Nessun dialogo prodotto dal modello è mai stato valutato con le formule attuali della metrica: tutte le righe successive alla v0.5.15 sono template.
- Ci sono corse tra thread sugli stati di agenti diversi.
- Nel connettore delle route `/ai/*` il limite di token non viene applicato.

## 4. Test automatici

- Backend: 50 test passati, 14 falliti, 1 file non importabile (`tests/test_llm_wrapper.py` importa una funzione rimossa). I test si aspettano 9 agenti, il backend ne crea 12.
- `pytest` non è installato nell'ambiente `mbo_gai`.
- Frontend: nessun test.

Questi numeri sono il riferimento con cui confrontare v3 dopo ogni correzione.

## 5. Stato rispetto alla specifica FENITH

Della specifica `Documentazione/FGA_FENITH_Reframing_Spec_v2.md` (6 scene, 12 profili agente con tratti e soglie decisionali, matrice di poignancy, timeline di 40 giornate, eventi FL presi da risultati reali) nel codice non c'è ancora nulla: i 21 commit del branch `fenith-reframe` riguardano la qualità dei dialoghi e le prestazioni.

## 6. Ordine di lavoro consigliato

### Fase 1 — Ripristino funzionale

Correzioni di poche righe ciascuna.

- Ponte React–Phaser e ricerca dell'identificativo dello sprite.
- Comando `resume`, parametri di `/fl/algorithm`, un solo canale per i comandi.
- Reset del FL: ogni esperimento in una cartella con un proprio identificativo, e il reset ne apre una nuova. Token di stop per thread al posto dell'evento condiviso.
- Confronto dell'orario con `>=`, scadenze in tempo simulato, identificativi dei nodi monotoni.
- Stato esplicito di ogni chiamata LLM (riuscita, errore, troncata, ripiego) ed etichetta `source` che registra chi ha davvero generato il testo.
- Errori del ciclo registrati con la traccia completa.

### Fase 2 — Validità scientifica

- Privacy differenziale: come tampone, rumore a 0,5–1,0 ed epsilon etichettato "nominale"; poi clipping per esempio e contabilità RDP.
- Set di test separato, confronto con l'addestramento centralizzato e con quello solo locale, AUC e F1 (opbg ha solo il 30% di positivi).
- Seed stabili: hash deterministico (`zlib.crc32`) per il campionamento, nessuna reimpostazione del generatore globale.
- Embedding obbligatori all'avvio (serve `ollama pull nomic-embed-text`).
- Metrica dei dialoghi rifatta sulla precisione dei numeri citati, con statistiche del modello separate da quelle dei template e validazione su un campione valutato a mano.
- Identificativo di run nei log ed esecuzione senza interfaccia: N seed per configurazione ed esportazione CSV, per generare le tabelle dell'articolo.

### Fase 3 — Pulizia

- Rimozione del codice morto del frontend.
- Una sola scena di laboratorio guidata dai dati, con smontaggio vero.
- Test riallineati a 12 agenti, `pytest` nell'ambiente, controlli automatici a ogni push (test e controllo dei tipi).
- Una sola fonte di configurazione: parametri FL letti dal JSON, `constants.py` collegato o rimosso.
- Documentazione e numeri di versione riallineati.

### Fase 4 — FENITH

1. **Sprite guidati da posizione e stato del backend.** Oggi la scena non mostra la simulazione.
2. **Profili agente come dati.** Oggi ruoli e template sono scritti nel sorgente; per 6 dei 12 agenti i template di riflessione ricadono su quello generico del ricercatore. Portare tratti, soglie decisionali e matrice di poignancy in file di configurazione è la priorità più alta della specifica e sblocca il resto.
3. **Modalità replay del FL.** Un secondo motore FL, dietro la stessa interfaccia, che inietta i risultati reali del progetto FL-EHDS. Gli agenti discuterebbero numeri veri, e il problema di credibilità di un modello su 303 righe si chiude.
4. **Timeline a eventi** (le 40 giornate) e **registro delle decisioni** degli agenti con le relative soglie: è il risultato che serve per le domande di ricerca RQ2 e RQ3.
5. **Nuove scene e dialoghi tra scene**, solo dopo.

## Appendice — Rieseguire le verifiche

Gli script non modificano il progetto, ma vanno eseguiti su una copia della cartella `backend`: alcuni scrivono checkpoint. Dalla radice del repository, con l'ambiente `mbo_gai` attivo:

```bash
COPIA=$(mktemp -d)/backend
rsync -a --exclude checkpoints --exclude logs --exclude __pycache__ \
  Researcher_World2/agent-laboratory-v3/backend/ "$COPIA/"
V=Researcher_World2/agent-laboratory-v3/baseline_v2/verification

python $V/fl_experiment.py "$COPIA"            # sezione 1: accuracy reale, rumore, set di test, selezione client, riproducibilità
python $V/controller_checks.py "$COPIA"        # sezione 1: reset e checkpoint, doppio ciclo dopo stop+start
python $V/cognitive_checks.py "$COPIA" schedule   # sezione 3: agenda e blocco in conversazione
python $V/cognitive_checks.py "$COPIA" prune      # sezione 3: svuotamento della memoria e riuso degli identificativi
python $V/cognitive_checks.py "$COPIA" sentinel   # sezione 3: da eseguire con Ollama non raggiungibile (ad esempio spento)
```

Per i test del backend, sempre sulla copia: `pip install pytest` e poi `python -m pytest tests --continue-on-collection-errors` dalla cartella copiata.

### Dati di riferimento

`baseline_v2/dialog_quality/` contiene i log di qualità dei dialoghi prodotti da v2, congelati:

| File | Contenuto |
|---|---|
| `dialog_scores.jsonl` | 105 record, fino alla v0.5.20 |
| `dialog_scores_BASELINE_pre_fase0.jsonl` | 20 record, prima degli interventi sulla qualità dei dialoghi |
| `quality_summary.json` | medie aggregate sui 105 record (qualità complessiva 0,697) |

L'applicazione continua a scrivere i log correnti in `backend/logs/dialog_quality/`, che resta fuori da git.
