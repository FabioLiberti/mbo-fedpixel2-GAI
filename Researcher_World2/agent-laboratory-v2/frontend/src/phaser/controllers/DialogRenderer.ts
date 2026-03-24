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

    const duration = dialog.duration || Math.min(2000 + dialog.text.length * 30, 8000);

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
      const baseOpts = { width: 180, padding: 8, isLLMGenerated: dialog.isLLMDialog || false };

      switch (dialog.cognitiveType) {
        case CognitiveProcessType.THINKING:
          bubble = new ThoughtBubble(this.scene, sourcePos.x, sourcePos.y - 40, dialog.text, dialog.type, baseOpts);
          break;
        case CognitiveProcessType.DECISION:
          bubble = new DecisionBubble(this.scene, sourcePos.x, sourcePos.y - 40, dialog.text, dialog.type, baseOpts);
          break;
        case CognitiveProcessType.PLANNING:
          bubble = new DecisionBubble(this.scene, sourcePos.x, sourcePos.y - 40, dialog.text, dialog.type, {
            width: 200, padding: 10, isLLMGenerated: dialog.isLLMDialog || false, isPlan: true,
          });
          break;
        default:
          bubble = new ThoughtBubble(this.scene, sourcePos.x, sourcePos.y - 40, dialog.text, dialog.type, {
            width: 160, padding: 8, isLLMGenerated: dialog.isLLMDialog || false,
          });
      }

      if (!s.showLLMDialogs && dialog.isLLMDialog && typeof (bubble as any).hide === 'function') {
        (bubble as any).hide();
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
      const bubble = new SpeechBubble(
        this.scene, sourcePos.x, sourcePos.y - 40, dialog.text, dialog.type, {
          width: 160, padding: 8,
          targetPos: targetPos ? { x: targetPos.x, y: targetPos.y } : undefined,
          isLLMDialog: dialog.isLLMDialog || false,
        },
      );

      if (!s.showLLMDialogs && dialog.isLLMDialog) bubble.hide();

      s.activeBubbles.set(dialog.sourceId, bubble);
      if (s.debugMode) {
        console.log(`[DialogRenderer] Speech bubble for ${dialog.sourceId}${dialog.isLLMDialog ? ' (LLM)' : ''}`);
      }
    } catch (e) {
      console.error('[DialogRenderer] showSpeechBubble error:', e);
    }
  }

  // ── Bubble management ─────────────────────────────────────────────

  removeBubble(agentId: string): void {
    const bubble = this.state.activeBubbles.get(agentId);
    if (bubble) {
      bubble.destroy();
      this.state.activeBubbles.delete(agentId);
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
          ((child as any).getId && (child as any).getId() === agentId)
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
      ],
      researcher: [
        "Sto ottimizzando la selezione dei client.",
        "I miei esperimenti mostrano un comportamento non-IID interessante.",
        "Collaboriamo sulle tecniche di compressione del modello.",
        "L'efficienza della comunicazione è la sfida principale.",
        "Ho trovato un modo per ridurre il budget di privacy.",
      ],
      phd_student: [
        "Sto implementando un nuovo metodo di aggregazione.",
        "Potresti rivedere il mio design sperimentale?",
        "L'eterogeneità dei dati sta causando problemi.",
        "La mia revisione della letteratura ha trovato alcune lacune.",
        "Sto cercando di riprodurre quei risultati benchmark.",
      ],
      student: [
        "Sto implementando un nuovo metodo di aggregazione.",
        "Potresti rivedere il mio design sperimentale?",
        "L'eterogeneità dei dati sta causando problemi.",
        "La mia revisione della letteratura ha trovato alcune lacune.",
        "Sto cercando di riprodurre quei risultati benchmark.",
      ],
      doctor: [
        "La privacy dei pazienti deve essere la nostra priorità.",
        "Questo modello diagnostico mostra risultati promettenti.",
        "Abbiamo bisogno di dati medici più diversificati.",
        "Le implicazioni etiche sono significative.",
        "Il federated learning potrebbe trasformare la ricerca clinica.",
      ],
      engineer: [
        "Ho ottimizzato il throughput del sistema.",
        "La pipeline di deployment è quasi pronta.",
        "Facciamo un benchmark rispetto alla baseline.",
        "Servono risorse allocate in modo più efficiente.",
        "Ho implementato l'algoritmo di compressione.",
      ],
      privacy_specialist: [
        "Questo approccio perde troppe informazioni.",
        "Analizziamo le garanzie di privacy.",
        "Dobbiamo aumentare il parametro di rumore.",
        "La superficie di attacco può essere ridotta.",
        "Ho sviluppato un nuovo protocollo di aggregazione sicura.",
      ],
    };
    const roleDialogs = dialogs[role.toLowerCase()] || dialogs.researcher;
    return roleDialogs[Math.floor(Math.random() * roleDialogs.length)];
  }
}
