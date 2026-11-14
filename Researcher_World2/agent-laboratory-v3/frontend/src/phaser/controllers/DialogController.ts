// frontend/src/phaser/controllers/DialogController.ts
//
// Thin orchestrator that composes DialogState, DialogRenderer, and
// DialogEventHandler.  All external consumers import this file —
// the public API surface is unchanged from the monolithic version.

import Phaser from 'phaser';
import { CognitiveProcessType } from '../types/DialogTypes';
import { LabTheme } from '../scenes/BaseLabScene';
import { DialogState, DialogConfig } from './DialogState';
import { DialogRenderer } from './DialogRenderer';
import { DialogEventHandler, DialogCreator } from './DialogEventHandler';

export class DialogController implements DialogCreator {
  private state: DialogState;
  private renderer: DialogRenderer;
  private eventHandler: DialogEventHandler;

  constructor(scene: Phaser.Scene, labTheme?: LabTheme) {
    this.state = new DialogState(scene, labTheme);
    this.renderer = new DialogRenderer(this.state);
    this.eventHandler = new DialogEventHandler(this.state, this.renderer, this);

    // Kick-off
    this.state.checkLLMAvailability();
    this.eventHandler.registerEvents();
  }

  // ── Public API (backward-compatible) ──────────────────────────────

  createDialog(config: DialogConfig): void {
    this.state.dialogQueue.push(config);

    // Emit counter event
    if (config.isLLMDialog !== undefined) {
      this.state.scene.game.events.emit('dialog-created', {
        type: config.isLLMDialog ? 'llm' : 'standard',
        isLLMGenerated: config.isLLMDialog,
      });
    } else {
      this.state.scene.game.events.emit('dialog-created', { type: 'standard' });
    }

    if (this.state.debugMode) {
      console.log(`[DialogController] Dialog queued: ${config.type} from ${config.sourceId} to ${config.targetId || 'broadcast'}`);
    }

    if (!this.state.isProcessingQueue) {
      this.renderer.processDialogQueue();
    }
  }

  createCognitiveProcess(config: DialogConfig): void {
    if (!config.cognitiveType) config.cognitiveType = CognitiveProcessType.THINKING;
    if (!config.sourceId || config.sourceId === 'system') {
      config.sourceId = `cognitive_${this.state.cognitiveProcessCounter++}`;
    }

    this.state.dialogQueue.push(config);

    if (config.isLLMDialog !== undefined) {
      this.state.scene.game.events.emit('dialog-created', {
        type: config.isLLMDialog ? 'llm' : 'standard',
        isLLMGenerated: config.isLLMDialog,
      });
    } else {
      this.state.scene.game.events.emit('dialog-created', { type: 'standard' });
    }

    if (this.state.debugMode) {
      console.log(`[DialogController] Cognitive process queued: ${config.cognitiveType} for ${config.sourceId}`);
    }

    if (!this.state.isProcessingQueue) {
      this.renderer.processDialogQueue();
    }
  }

  // ── Delegated public methods ──────────────────────────────────────

  trackAgent(agentId: string, _agentData: any): void {
    if (this.state.debugMode) console.log(`[DialogController] Tracking agent: ${agentId}`);
  }

  toggleLLMDialogs(visible: boolean): void {
    this.state.showLLMDialogs = visible;
    this.state.activeBubbles.forEach((bubble: any) => {
      if (bubble.isLLMDialog || bubble.isLLMGenerated) {
        if (visible && typeof bubble.show === 'function') bubble.show();
        else if (!visible && typeof bubble.hide === 'function') bubble.hide();
      }
    });
    if (this.state.debugMode) console.log(`[DialogController] LLM dialogs ${visible ? 'shown' : 'hidden'}`);
  }

  getDialogStatistics() { return this.state.getDialogStatistics(); }
  resetDialogStatistics() { this.state.resetDialogStatistics(); }
  setDebugMode(enabled: boolean) { this.state.setDebugMode(enabled); }

  removeBubble(agentId: string) { this.renderer.removeBubble(agentId); }
  removeAllBubbles() { this.renderer.removeAllBubbles(); }

  update(time: number, delta: number) { this.renderer.update(time, delta); }

  // ── Cleanup ───────────────────────────────────────────────────────

  destroy(): void {
    this.state.activeBubbles.forEach((b) => b.destroy());
    this.eventHandler.unregisterEvents();
    this.state.activeBubbles.clear();
    this.state.dialogQueue = [];
    this.state.isProcessingQueue = false;
    this.state.dialogSources.clear();
    this.state.saveDialogCounters();
    if (this.state.debugMode) console.log('[DialogController] Destroyed');
  }
}
