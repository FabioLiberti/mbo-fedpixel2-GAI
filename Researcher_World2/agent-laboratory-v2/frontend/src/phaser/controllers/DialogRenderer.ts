// frontend/src/phaser/controllers/DialogRenderer.ts
//
// All visual rendering: bubble creation/destruction, particle effects,
// position tracking, and queue processing.

import Phaser from 'phaser';
import { FLDialogType as DialogType, CognitiveProcessType } from '../types/DialogTypes';
import { SpeechBubble } from '../ui/SpeechBubble';
import { ThoughtBubble } from '../ui/ThoughtBubble';
import { DecisionBubble } from '../ui/DecisionBubble';
import type { DialogState, DialogConfig } from './DialogState';

export class DialogRenderer {
  private state: DialogState;
  private presetIndexes: Map<string, number> = new Map();

  constructor(state: DialogState) {
    this.state = state;
  }

  private get scene(): Phaser.Scene {
    return this.state.scene;
  }

  // ── Queue processing ──────────────────────────────────────────────

  processDialogQueue(): void {
    const s = this.state;
    if (s.dialogQueue.length === 0) {
      s.isProcessingQueue = false;
      return;
    }

    s.isProcessingQueue = true;

    // Sort by priority (highest first)
    s.dialogQueue.sort((a, b) => {
      const pa = a.priority ?? 5;
      const pb = b.priority ?? 5;
      return pb - pa;
    });

    const dialog = s.dialogQueue.shift();
    if (!dialog) {
      s.isProcessingQueue = false;
      return;
    }

    const sourcePosition = this.getAgentPosition(dialog.sourceId);

    if (!sourcePosition && dialog.sourceId.startsWith('cognitive_')) {
      const center = {
        x: this.scene.cameras.main.centerX,
        y: this.scene.cameras.main.centerY,
      };
      this.showCognitiveProcess(dialog, center, null);
    } else if (!sourcePosition) {
      console.warn(`[DialogRenderer] Agent not found: ${dialog.sourceId}`);
      this.processDialogQueue();
      return;
    } else {
      let targetPosition: { x: number; y: number } | null = null;
      if (dialog.targetId) {
        targetPosition = this.getAgentPosition(dialog.targetId);
        if (!targetPosition && s.debugMode) {
          console.warn(`[DialogRenderer] Target agent not found: ${dialog.targetId}`);
        }
      }

      if (dialog.cognitiveType) {
        this.showCognitiveProcess(dialog, sourcePosition, targetPosition);
      } else {
        this.showSpeechBubble(dialog, sourcePosition, targetPosition);
      }

      if (dialog.showEffect) {
        this.showDialogEffect(dialog.type, sourcePosition, targetPosition);
      }
    }

    const duration = dialog.duration || Math.min(8000 + dialog.text.length * 50, 18000);

    this.scene.time.delayedCall(duration, () => {
      this.removeBubble(dialog.sourceId);
      if (dialog.callback) dialog.callback();
      this.scene.time.delayedCall(300, () => this.processDialogQueue());
    });
  }

  // ── Cognitive process bubble ──────────────────────────────────────

  private showCognitiveProcess(
    dialog: DialogConfig,
    sourcePos: { x: number; y: number },
    _targetPos: { x: number; y: number } | null,
  ): void {
    const s = this.state;
    if (s.activeBubbles.has(dialog.sourceId)) this.removeBubble(dialog.sourceId);

    try {
      let bubble;
      const baseOpts = { width: 140, padding: 6, isLLMGenerated: dialog.isLLMDialog || false };

      switch (dialog.cognitiveType) {
        case CognitiveProcessType.THINKING:
          bubble = new ThoughtBubble(this.scene, sourcePos.x, sourcePos.y - 40, dialog.text, dialog.type, baseOpts);
          break;
        case CognitiveProcessType.DECISION:
          bubble = new DecisionBubble(this.scene, sourcePos.x, sourcePos.y - 40, dialog.text, dialog.type, baseOpts);
          break;
        case CognitiveProcessType.PLANNING:
          bubble = new DecisionBubble(this.scene, sourcePos.x, sourcePos.y - 40, dialog.text, dialog.type, {
            width: 160, padding: 8, isLLMGenerated: dialog.isLLMDialog || false, isPlan: true,
          });
          break;
        default:
          bubble = new ThoughtBubble(this.scene, sourcePos.x, sourcePos.y - 40, dialog.text, dialog.type, {
            width: 140, padding: 6, isLLMGenerated: dialog.isLLMDialog || false,
          });
      }

      if (!s.showLLMDialogs && dialog.isLLMDialog && 'hide' in bubble && typeof bubble.hide === 'function') {
        bubble.hide();
      }

      s.activeBubbles.set(dialog.sourceId, bubble);
      if (s.debugMode) {
        console.log(`[DialogRenderer] Cognitive bubble: ${dialog.cognitiveType} for ${dialog.sourceId}`);
      }
    } catch (e) {
      console.error('[DialogRenderer] showCognitiveProcess error:', e);
    }
  }

  // ── Speech bubble ─────────────────────────────────────────────────

  private showSpeechBubble(
    dialog: DialogConfig,
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number } | null,
  ): void {
    const s = this.state;
    if (s.activeBubbles.has(dialog.sourceId)) this.removeBubble(dialog.sourceId);

    try {
      // Offset response bubbles higher to avoid overlapping with question bubble
      const yOffset = dialog.isResponse ? -80 : -40;
      const bubble = new SpeechBubble(
        this.scene, sourcePos.x, sourcePos.y + yOffset, dialog.text, dialog.type, {
          width: 130, padding: 6,
          targetPos: targetPos ? { x: targetPos.x, y: targetPos.y } : undefined,
          isLLMDialog: dialog.isLLMDialog || false,
          isResponse: dialog.isResponse || false,
        },
      );

      if (!s.showLLMDialogs && dialog.isLLMDialog) bubble.hide();

      s.activeBubbles.set(dialog.sourceId, bubble);
      this.setAgentBubbleFlag(dialog.sourceId, true);
      if (s.debugMode) {
        console.log(`[DialogRenderer] Speech bubble for ${dialog.sourceId}${dialog.isLLMDialog ? ' (LLM)' : ''}`);
      }
    } catch (e) {
      console.error('[DialogRenderer] showSpeechBubble error:', e);
    }
  }

  // ── Bubble management ─────────────────────────────────────────────

  /** Notify an Agent sprite that its bubble appeared / disappeared. */
  private setAgentBubbleFlag(agentId: string, active: boolean): void {
    try {
      const child = this.scene.children.getChildren()
        .find((c: any) => c.getId && c.getId() === agentId);
      if (child && 'setBubbleActive' in child) {
        (child as any).setBubbleActive(active);
      }
    } catch { /* ignore */ }
  }

  removeBubble(agentId: string): void {
    const bubble = this.state.activeBubbles.get(agentId);
    if (bubble) {
      bubble.destroy();
      this.state.activeBubbles.delete(agentId);
      this.setAgentBubbleFlag(agentId, false);
      if (this.state.debugMode) console.log(`[DialogRenderer] Bubble removed: ${agentId}`);
    }
  }

  removeAllBubbles(): void {
    this.state.activeBubbles.forEach((b) => b.destroy());
    this.state.activeBubbles.clear();
    this.state.dialogQueue = [];
    this.state.isProcessingQueue = false;
    if (this.state.debugMode) console.log('[DialogRenderer] All bubbles removed');
  }

  // ── Position tracking ─────────────────────────────────────────────

  getAgentPosition(agentId: string): { x: number; y: number } | null {
    try {
      if (agentId.startsWith('cognitive_')) {
        return { x: this.scene.cameras.main.centerX, y: this.scene.cameras.main.centerY };
      }
      const agent = this.scene.children.getChildren()
        .find((child: Phaser.GameObjects.GameObject) =>
          (child.getData && child.getData('id') === agentId) ||
          ('getId' in child && typeof (child as { getId: () => string }).getId === 'function' && (child as { getId: () => string }).getId() === agentId)
        );
      if (agent && 'x' in agent && 'y' in agent) {
        return { x: agent.x as number, y: agent.y as number };
      }
    } catch (e) {
      console.error(`[DialogRenderer] getAgentPosition(${agentId}):`, e);
    }
    return null;
  }

  update(_time: number, _delta: number): void {
    this.state.activeBubbles.forEach((bubble, agentId) => {
      if (agentId.startsWith('cognitive_')) return;
      const pos = this.getAgentPosition(agentId);
      if (pos && bubble.updatePosition) {
        bubble.updatePosition(pos.x, pos.y - 40);
      }
    });
  }

  // ── Visual effects ────────────────────────────────────────────────

  private showDialogEffect(
    type: DialogType,
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number } | null,
  ): void {
    try {
      if (!targetPos) return;
      switch (type) {
        case DialogType.MODEL:   this.showModelEffect(sourcePos.x, sourcePos.y); break;
        case DialogType.DATA:    this.showDataEffect(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y); break;
        case DialogType.PRIVACY: this.showPrivacyEffect(sourcePos.x, sourcePos.y); break;
        case DialogType.RESEARCH: this.showResearchEffect(sourcePos.x, sourcePos.y); break;
      }
    } catch (e) {
      console.warn('[DialogRenderer] showDialogEffect error:', e);
    }
  }

  private showModelEffect(x: number, y: number): void {
    const particles = this.scene.add.particles(x, y, 'model-particle', {
      lifespan: 2000, speed: { min: 60, max: 100 }, scale: { start: 0.6, end: 0 },
      blendMode: 'ADD', tint: 0x00ff88,
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 40), quantity: 32 },
    });
    this.scene.time.delayedCall(2000, () => {
      particles.stop();
      this.scene.time.delayedCall(1500, () => particles.destroy());
    });
  }

  private showPrivacyEffect(x: number, y: number): void {
    const particles = this.scene.add.particles(x, y, 'privacy-particle', {
      lifespan: 800, speed: 60, scale: { start: 0.6, end: 0 }, blendMode: 'ADD', tint: 0xaa44ff,
    });
    const shield = this.scene.add.graphics();
    shield.lineStyle(2, 0xaa44ff, 0.8);
    shield.strokeCircle(x, y, 30);
    this.scene.tweens.add({
      targets: shield, alpha: { from: 0.8, to: 0 }, duration: 1800, ease: 'Power2',
      onComplete: () => { shield.destroy(); particles.stop(); this.scene.time.delayedCall(1000, () => particles.destroy()); },
    });
  }

  private showResearchEffect(x: number, y: number): void {
    const particles = this.scene.add.particles(x, y, 'research-particle', {
      lifespan: 1000, speed: { min: 80, max: 120 }, scale: { start: 0.2, end: 0.5 },
      blendMode: 'ADD', tint: 0xff8800,
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 100), quantity: 24 },
      angle: { min: 0, max: 360 }, gravityX: 0, gravityY: 0,
    });
    this.scene.time.delayedCall(2000, () => {
      particles.stop();
      this.scene.time.delayedCall(1000, () => particles.destroy());
    });
  }

  private showDataEffect(sx: number, sy: number, tx: number, ty: number): void {
    const angle = Phaser.Math.Angle.Between(sx, sy, tx, ty);
    const distance = Phaser.Math.Distance.Between(sx, sy, tx, ty);
    const lifespan = Math.min(distance * 10, 2000);
    const particles = this.scene.add.particles(sx, sy, 'data-particle', {
      lifespan, speed: 100, quantity: 2, frequency: 100,
      blendMode: 'ADD', tint: 0x0088ff, angle: Phaser.Math.RadToDeg(angle),
    });
    this.scene.time.delayedCall(lifespan + 500, () => {
      particles.stop();
      this.scene.time.delayedCall(1000, () => particles.destroy());
    });
  }

  // ── Preset dialogs ────────────────────────────────────────────────

  getPresetDialog(role: string, _interactionType: string): string {
    const dialogs: Record<string, string[]> = {
      professor: [
        "Analizziamo questo approccio di ricerca.",
        "Sto lavorando a un nuovo modello teorico.",
        "Cosa ne pensi della privacy differenziale?",
        "Hai visto l'ultimo paper sul federated learning?",
        "Questo algoritmo mostra proprietà di convergenza promettenti.",
        "Dobbiamo confrontare FedAvg con FedProx sui nostri dati.",
        "La distribuzione non-IID è il vero problema qui.",
        "Ho rivisto i risultati: il modello converge dopo 15 round.",
        "Propongo di aggiungere un vincolo di regolarizzazione.",
        "I risultati del team di Blekinge confermano la nostra ipotesi.",
        "Serve più ricerca sull'aggregazione robusta.",
        "La letteratura recente suggerisce un approccio diverso.",
        "Organizziamo un seminario sui risultati ottenuti.",
        "Il budget computazionale è un vincolo da considerare.",
        "Confrontiamo i nostri risultati con il benchmark LEAF.",
      ],
      researcher: [
        "Sto ottimizzando la selezione dei client.",
        "I miei esperimenti mostrano un comportamento non-IID interessante.",
        "Collaboriamo sulle tecniche di compressione del modello.",
        "L'efficienza della comunicazione è la sfida principale.",
        "Ho trovato un modo per ridurre il budget di privacy.",
        "Il gradient clipping migliora la stabilità del training.",
        "Sto testando diverse strategie di partizionamento dati.",
        "I client con pochi dati rallentano la convergenza.",
        "Ho implementato la quantizzazione dei gradienti.",
        "L'accuracy locale è buona ma quella globale cala.",
        "Serve un meccanismo di selezione client più intelligente.",
        "I risultati preliminari sono promettenti, servono più round.",
        "Sto documentando l'impatto dell'eterogeneità sui risultati.",
        "La comunicazione tra nodi è il collo di bottiglia.",
        "Ho trovato un bug nel calcolo della media pesata.",
      ],
      student_postdoc: [
        "Sto implementando un nuovo metodo di aggregazione.",
        "Potresti rivedere il mio design sperimentale?",
        "L'eterogeneità dei dati sta causando problemi.",
        "La mia revisione della letteratura ha trovato alcune lacune.",
        "Sto cercando di riprodurre quei risultati benchmark.",
        "Il dataset che uso ha una distribuzione molto sbilanciata.",
        "Ho preparato i grafici per la presentazione.",
        "La loss non scende dopo il round 20, possibile overfitting.",
        "Sto scrivendo la sezione metodologica del paper.",
        "I test statistici confermano la significatività dei risultati.",
      ],
      student: [
        "Sto implementando un nuovo metodo di aggregazione.",
        "Potresti rivedere il mio design sperimentale?",
        "L'eterogeneità dei dati sta causando problemi.",
        "La mia revisione della letteratura ha trovato alcune lacune.",
        "Sto cercando di riprodurre quei risultati benchmark.",
        "Il dataset che uso ha una distribuzione molto sbilanciata.",
        "Ho preparato i grafici per la presentazione.",
        "La loss non scende dopo il round 20, possibile overfitting.",
        "Sto scrivendo la sezione metodologica del paper.",
        "I test statistici confermano la significatività dei risultati.",
        "Posso occuparmi dell'implementazione del client sampling.",
        "Ho bisogno di chiarimenti sul protocollo di aggregazione.",
        "Il codice di training è pronto per i test su larga scala.",
        "Sto studiando le tecniche di differential privacy.",
        "Il mio primo esperimento FL è andato bene!",
      ],
      doctor: [
        "La privacy dei pazienti deve essere la nostra priorità.",
        "Questo modello diagnostico mostra risultati promettenti.",
        "Abbiamo bisogno di dati medici più diversificati.",
        "Le implicazioni etiche sono significative.",
        "Il federated learning potrebbe trasformare la ricerca clinica.",
        "I dati ospedalieri non possono lasciare la struttura.",
        "Il modello federato rispetta le normative GDPR.",
        "Servono più ospedali nel consorzio per migliorare l'accuracy.",
        "L'anonimizzazione deve essere verificata prima del training.",
        "I risultati clinici sono coerenti con la letteratura.",
        "Il comitato etico ha approvato il protocollo federato.",
        "La sensibilità del modello diagnostico è al 94%.",
        "Dobbiamo validare su una coorte esterna.",
        "I dati pediatrici richiedono un trattamento speciale.",
        "Il consenso informato copre anche l'uso federato dei dati.",
      ],
      engineer: [
        "Ho ottimizzato il throughput del sistema.",
        "La pipeline di deployment è quasi pronta.",
        "Facciamo un benchmark rispetto alla baseline.",
        "Servono risorse allocate in modo più efficiente.",
        "Ho implementato l'algoritmo di compressione.",
        "Il server di aggregazione regge 50 client simultanei.",
        "La latenza media per round è scesa a 3 secondi.",
        "Ho configurato il monitoraggio delle metriche.",
        "Il sistema di logging cattura ogni step del training.",
        "L'infrastruttura è pronta per scalare a 100 nodi.",
        "Ho implementato il checkpointing automatico.",
        "La containerizzazione facilita il deployment.",
        "Il load balancer distribuisce bene i carichi.",
        "Serve un meccanismo di fault tolerance più robusto.",
        "Ho aggiunto il supporto per GPU multi-nodo.",
      ],
      privacy_specialist: [
        "Questo approccio perde troppe informazioni.",
        "Analizziamo le garanzie di privacy.",
        "Dobbiamo aumentare il parametro di rumore.",
        "La superficie di attacco può essere ridotta.",
        "Ho sviluppato un nuovo protocollo di aggregazione sicura.",
        "Il budget epsilon è quasi esaurito per questo round.",
        "L'attacco di membership inference è stato mitigato.",
        "La composizione del rumore segue il teorema di Dwork.",
        "Ho verificato la conformità con il framework NIST.",
        "Il meccanismo di clipping protegge dai contributi anomali.",
        "Serve un audit formale della pipeline di aggregazione.",
        "Il secure aggregation cifra i gradienti prima dell'invio.",
        "La differential privacy locale offre garanzie più forti.",
        "Ho simulato un attacco di model inversion: siamo protetti.",
        "Il rapporto tra privacy e utilità è accettabile con epsilon 1.0.",
      ],
    };
    const roleKey = role.toLowerCase();
    const roleDialogs = dialogs[roleKey] || dialogs.researcher;

    // Round-robin: cycle through all phrases before repeating
    const idx = this.presetIndexes.get(roleKey) ?? 0;
    const dialog = roleDialogs[idx % roleDialogs.length];
    this.presetIndexes.set(roleKey, idx + 1);
    return dialog;
  }

  // ── Greeting pairs ───────────────────────────────────────────────

  private static GREETINGS: { opener: string; reply: string }[] = [
    { opener: 'Ciao! Come procede il lavoro?', reply: 'Bene, grazie! Sto facendo progressi.' },
    { opener: 'Buongiorno! Novità sul progetto?', reply: 'Sì, ho qualche aggiornamento interessante.' },
    { opener: 'Ehi, tutto bene?', reply: 'Sì, sto analizzando i dati del round precedente.' },
    { opener: 'Ciao! Hai un momento?', reply: 'Certo, dimmi pure.' },
    { opener: 'Salve! Come va l\'esperimento?', reply: 'Sta procedendo, i risultati sono incoraggianti.' },
    { opener: 'Ciao collega! Che fai di bello?', reply: 'Sto ottimizzando alcuni parametri. Tu?' },
    { opener: 'Buongiorno! Pronto per la riunione?', reply: 'Quasi, devo finire un\'analisi.' },
    { opener: 'Ehi! Hai visto i nuovi dati?', reply: 'Non ancora, me li mostri?' },
    { opener: 'Ciao! Come stai oggi?', reply: 'Bene! Ho avuto un\'idea sul modello.' },
    { opener: 'Salve! Possiamo parlare un attimo?', reply: 'Certo, di cosa si tratta?' },
  ];
  private greetingIndex: number = 0;

  getGreetingPair(): { opener: string; reply: string } {
    const pair = DialogRenderer.GREETINGS[this.greetingIndex % DialogRenderer.GREETINGS.length];
    this.greetingIndex++;
    return pair;
  }

  // ── Coffee break pairs ────────────────────────────────────────────

  private static COFFEE_BREAKS: { opener: string; reply: string }[] = [
    { opener: 'Andiamo a prendere un caffè?', reply: 'Ottima idea, ne ho bisogno!' },
    { opener: 'Pausa caffè? Ho bisogno di staccare un attimo.', reply: 'Volentieri, andiamo!' },
    { opener: 'Ti va un caffè? Devo sgranchirmi le gambe.', reply: 'Sì dai, parliamo dei risultati intanto.' },
    { opener: 'Che ne dici di una pausa?', reply: 'Perfetto, stavo per proporlo anch\'io.' },
    { opener: 'Caffè? Ho qualcosa di interessante da raccontarti.', reply: 'Certo, sono curioso. Andiamo!' },
  ];
  private coffeeIndex: number = 0;

  getCoffeeBreakPair(): { opener: string; reply: string } {
    const pair = DialogRenderer.COFFEE_BREAKS[this.coffeeIndex % DialogRenderer.COFFEE_BREAKS.length];
    this.coffeeIndex++;
    return pair;
  }
}
