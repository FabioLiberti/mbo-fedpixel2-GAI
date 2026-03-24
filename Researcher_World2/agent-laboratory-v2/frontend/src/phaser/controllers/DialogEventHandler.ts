// frontend/src/phaser/controllers/DialogEventHandler.ts
//
// Registers and handles all Phaser game events related to dialogs:
// agent interactions, cognitive processes, FL events, API responses.

import Phaser from 'phaser';
import { FLDialogType as DialogType, CognitiveProcessType } from '../types/DialogTypes';
import { api } from '../../services/api';
import { emitPhaserDialog } from '../../utils/customEvents';
import type { DialogState, DialogConfig, DialogResponse } from './DialogState';
import type { DialogRenderer } from './DialogRenderer';

// Forward reference: the controller passes createDialog / createCognitiveProcess
export interface DialogCreator {
  createDialog(config: DialogConfig): void;
  createCognitiveProcess(config: DialogConfig): void;
}

export class DialogEventHandler {
  private state: DialogState;
  private renderer: DialogRenderer;
  private creator: DialogCreator;

  constructor(state: DialogState, renderer: DialogRenderer, creator: DialogCreator) {
    this.state = state;
    this.renderer = renderer;
    this.creator = creator;
  }

  // ── Bridge to React LLM Panel ─────────────────────────────────────

  private bridgeToPanel(agentId: string, text: string, isLlm: boolean, cognitiveType?: string): void {
    const agent = this.state.getAgentDetails(agentId);
    if (!agent || !text) return;
    emitPhaserDialog({
      agentName: agent.name,
      agentRole: agent.role,
      labId: this.state.getLabTypeString(),
      text,
      isLlm,
      cognitiveType,
    });
  }

  // ── Registration / tear-down ──────────────────────────────────────

  registerEvents(): void {
    try {
      const ge = this.state.scene.game.events;
      ge.on('agent-interaction', this.handleAgentInteraction, this);
      ge.on('agent-thinking', this.handleAgentThinking, this);
      ge.on('agent-decision', this.handleAgentDecision, this);
      ge.on('agent-planning', this.handleAgentPlanning, this);
      ge.on('agent-reaction', this.handleAgentReaction, this);
      ge.on('fl-event', this.handleFLEvent, this);
      ge.on('fl-training-started', this.handleFLTrainingStarted, this);
      ge.on('fl-round-completed', this.handleFLRoundCompleted, this);
      ge.on('fl-client-selected', this.handleFLClientSelected, this);
      ge.on('fl-privacy-breach', this.handleFLPrivacyBreach, this);
      ge.on('fl-convergence-reached', this.handleFLConvergenceReached, this);
      ge.on('api-dialog-response', this.handleAPIDialogResponse, this);
      ge.on('dialog-created', this.handleDialogCreated, this);
      if (this.state.debugMode) console.log('[DialogEventHandler] Events registered');
    } catch (e) {
      console.error('[DialogEventHandler] registerEvents error:', e);
    }
  }

  unregisterEvents(): void {
    const ge = this.state.scene.game.events;
    ge.off('agent-interaction', this.handleAgentInteraction, this);
    ge.off('agent-thinking', this.handleAgentThinking, this);
    ge.off('agent-decision', this.handleAgentDecision, this);
    ge.off('agent-planning', this.handleAgentPlanning, this);
    ge.off('agent-reaction', this.handleAgentReaction, this);
    ge.off('fl-event', this.handleFLEvent, this);
    ge.off('fl-training-started', this.handleFLTrainingStarted, this);
    ge.off('fl-round-completed', this.handleFLRoundCompleted, this);
    ge.off('fl-client-selected', this.handleFLClientSelected, this);
    ge.off('fl-privacy-breach', this.handleFLPrivacyBreach, this);
    ge.off('fl-convergence-reached', this.handleFLConvergenceReached, this);
    ge.off('api-dialog-response', this.handleAPIDialogResponse, this);
    ge.off('dialog-created', this.handleDialogCreated, this);
  }

  // ── Shared LLM-source tagging helper ──────────────────────────────

  private tagLLMSource(data: { agentId?: string; llm?: boolean; isSimulated?: boolean; counted?: boolean }, agentId: string): void {
    const s = this.state;
    if (data.llm === undefined) {
      if (s.dialogSources.get(agentId) === 'llm') {
        data.llm = true;
        data.isSimulated = false;
        if (!data.counted) {
          s.scene.game.events.emit('dialog-created', { type: 'llm', isLLMGenerated: true });
          data.counted = true;
        }
      }
    } else if (data.llm === true && !data.counted) {
      s.scene.game.events.emit('dialog-created', {
        type: data.isSimulated ? 'simulated' : 'llm',
        isLLMGenerated: !data.isSimulated,
      });
      data.counted = true;
    }
  }

  // ── Think-tag extraction ──────────────────────────────────────────

  private stripThinkTag(text: string): { cleaned: string; thinking: string | null } {
    const m = text.match(/<think>([\s\S]*?)<\/think>/);
    if (m) {
      return { cleaned: text.replace(/<think>[\s\S]*?<\/think>/, '').trim(), thinking: m[1].trim() };
    }
    return { cleaned: text, thinking: null };
  }

  analyzeText(text: string): { processedText: string; processType: CognitiveProcessType | null } {
    const patterns: [RegExp, CognitiveProcessType][] = [
      [/<decision>([\s\S]*?)<\/decision>/, CognitiveProcessType.DECISION],
      [/<plan>([\s\S]*?)<\/plan>/, CognitiveProcessType.PLANNING],
      [/<think>([\s\S]*?)<\/think>/, CognitiveProcessType.THINKING],
    ];
    for (const [pat, ptype] of patterns) {
      const m = text.match(pat);
      if (m) return { processedText: m[1].trim(), processType: ptype };
    }
    return { processedText: text, processType: null };
  }

  // ── Counter event ─────────────────────────────────────────────────

  private handleDialogCreated(data: any): void {
    if (!data) return;
    const s = this.state;
    if (data.type === 'llm') s.llmDialogCount++;
    else if (data.type === 'simulated') s.simulatedDialogCount++;
    else s.standardDialogCount++;
    s.saveDialogCounters();
    if (s.debugMode) console.log(`[DialogEventHandler] Counter updated: ${data.type}`);
  }

  // ── API response ──────────────────────────────────────────────────

  private handleAPIDialogResponse(data: any): void {
    if (!data?.response) return;
    const s = this.state;
    const response = data.response as DialogResponse;
    const agentId = data.agentId;
    if (response.isLLMGenerated) {
      s.dialogSources.set(agentId, response.source || 'llm');
      if (!data.counted) {
        s.scene.game.events.emit('dialog-created', {
          type: response.source === 'fallback' ? 'simulated' : 'llm',
          isLLMGenerated: response.source !== 'fallback',
        });
        data.counted = true;
      }
    } else {
      s.dialogSources.set(agentId, 'standard');
      if (!data.counted) {
        s.scene.game.events.emit('dialog-created', { type: 'standard' });
        data.counted = true;
      }
    }
  }

  // ── Agent interaction ─────────────────────────────────────────────

  private async handleAgentInteraction(data: {
    agentId1: string; agentId2: string; type: string;
    llm?: boolean; isSimulated?: boolean; counted?: boolean;
  }): Promise<void> {
    const s = this.state;
    if (s.debugMode) console.log(`[DialogEventHandler] Interaction: ${data.agentId1} ↔ ${data.agentId2}`);

    // Tag LLM source for both agents
    if (data.llm === undefined) {
      const isLLM = s.dialogSources.get(data.agentId1) === 'llm' || s.dialogSources.get(data.agentId2) === 'llm';
      if (isLLM) { data.llm = true; data.isSimulated = false; if (!data.counted) { s.scene.game.events.emit('dialog-created', { type: 'llm', isLLMGenerated: true }); data.counted = true; } }
    } else if (data.llm === true && !data.counted) {
      s.scene.game.events.emit('dialog-created', { type: data.isSimulated ? 'simulated' : 'llm', isLLMGenerated: !data.isSimulated });
      data.counted = true;
    }

    try {
      const agent1 = s.getAgentDetails(data.agentId1);
      const agent2 = s.getAgentDetails(data.agentId2);
      if (!agent1 || !agent2) { console.warn('[DialogEventHandler] Missing agent details'); return; }

      const flState = s.getCurrentFLState();
      if (!s.isLLMAvailable) await s.checkLLMAvailability();

      if (s.isLLMAvailable) {
        try {
          // Agent 1 thinking
          const t1 = await api.generateAgentThinking({
            agentId: agent1.id, agentName: agent1.name, agentRole: agent1.role,
            agentSpecialization: agent1.specialization || 'general',
            targetAgentId: agent2.id, targetAgentName: agent2.name, targetAgentRole: agent2.role,
            interactionType: data.type, labType: s.getLabTypeString(), flState,
          });
          s.scene.game.events.emit('api-dialog-response', { agentId: agent1.id, response: t1 });
          if (t1.thinking) {
            this.creator.createCognitiveProcess({
              sourceId: agent1.id, type: DialogType.GENERAL, text: t1.thinking,
              cognitiveType: CognitiveProcessType.THINKING, isLLMDialog: true, showEffect: false, duration: 3000, priority: 5,
            });
            this.bridgeToPanel(agent1.id, t1.thinking, true, 'thinking');
          }

          // Agent 1 dialog (after delay)
          setTimeout(async () => {
            const d1 = await api.generateAgentDialog({
              agentId: agent1.id, agentName: agent1.name, agentRole: agent1.role,
              agentSpecialization: agent1.specialization || 'general',
              targetAgentId: agent2.id, targetAgentName: agent2.name, targetAgentRole: agent2.role,
              interactionType: data.type, labType: s.getLabTypeString(), flState,
            });
            s.scene.game.events.emit('api-dialog-response', { agentId: agent1.id, response: d1 });
            this.creator.createDialog({
              sourceId: agent1.id, targetId: agent2.id,
              type: s.getDialogTypeForRole(agent1.role), text: d1.dialog,
              isLLMDialog: true, showEffect: true, priority: 7,
            });
            this.bridgeToPanel(agent1.id, d1.dialog, true, 'dialog');
          }, 3000);

          // Agent 2 thinking + dialog (after longer delay)
          setTimeout(async () => {
            const t2 = await api.generateAgentThinking({
              agentId: agent2.id, agentName: agent2.name, agentRole: agent2.role,
              agentSpecialization: agent2.specialization || 'general',
              targetAgentId: agent1.id, targetAgentName: agent1.name, targetAgentRole: agent1.role,
              interactionType: data.type, labType: s.getLabTypeString(), flState,
            });
            s.scene.game.events.emit('api-dialog-response', { agentId: agent2.id, response: t2 });
            if (t2.thinking) {
              this.creator.createCognitiveProcess({
                sourceId: agent2.id, type: DialogType.GENERAL, text: t2.thinking,
                cognitiveType: CognitiveProcessType.THINKING, isLLMDialog: true, showEffect: false, duration: 3000, priority: 5,
              });
              this.bridgeToPanel(agent2.id, t2.thinking, true, 'thinking');
            }
            setTimeout(async () => {
              const d2 = await api.generateAgentDialog({
                agentId: agent2.id, agentName: agent2.name, agentRole: agent2.role,
                agentSpecialization: agent2.specialization || 'general',
                targetAgentId: agent1.id, targetAgentName: agent1.name, targetAgentRole: agent1.role,
                interactionType: data.type, labType: s.getLabTypeString(), flState,
              });
              s.scene.game.events.emit('api-dialog-response', { agentId: agent2.id, response: d2 });
              this.creator.createDialog({
                sourceId: agent2.id, targetId: agent1.id,
                type: s.getDialogTypeForRole(agent2.role), text: d2.dialog,
                isLLMDialog: true, showEffect: false, priority: 7,
              });
              this.bridgeToPanel(agent2.id, d2.dialog, true, 'dialog');
            }, 3000);
          }, 6000);

          return;
        } catch (e) {
          console.error('[DialogEventHandler] LLM interaction error, falling back:', e);
        }
      }

      // Fallback: preset dialogs
      this.creator.createDialog({
        sourceId: agent1.id, targetId: agent2.id,
        type: s.getDialogTypeForRole(agent1.role),
        text: this.renderer.getPresetDialog(agent1.role, data.type),
        showEffect: true, priority: 5,
      });
      setTimeout(() => {
        this.creator.createDialog({
          sourceId: agent2.id, targetId: agent1.id,
          type: s.getDialogTypeForRole(agent2.role),
          text: this.renderer.getPresetDialog(agent2.role, data.type),
          showEffect: false, priority: 5,
        });
      }, 1500);
      s.scene.game.events.emit('dialog-created', { type: 'standard' });
      s.scene.game.events.emit('dialog-created', { type: 'standard' });
    } catch (e) {
      console.error('[DialogEventHandler] handleAgentInteraction error:', e);
    }
  }

  // ── Agent thinking ────────────────────────────────────────────────

  private async handleAgentThinking(data: {
    agentId: string; context: string; llm?: boolean; isSimulated?: boolean; counted?: boolean;
  }): Promise<void> {
    const s = this.state;
    this.tagLLMSource(data, data.agentId);
    if (!s.isLLMAvailable) { await s.checkLLMAvailability(); if (!s.isLLMAvailable) return; }
    try {
      const agent = s.getAgentDetails(data.agentId);
      if (!agent) return;
      const result = await api.generateAgentThinking({
        agentId: agent.id, agentName: agent.name, agentRole: agent.role,
        agentSpecialization: agent.specialization || 'general',
        interactionType: 'thinking', labType: s.getLabTypeString(),
        context: data.context, flState: s.getCurrentFLState(),
      });
      s.scene.game.events.emit('api-dialog-response', { agentId: agent.id, response: result });
      if (result.thinking) {
        const { processedText, processType } = this.analyzeText(result.thinking);
        this.creator.createCognitiveProcess({
          sourceId: agent.id, type: DialogType.RESEARCH, text: processedText,
          cognitiveType: processType || CognitiveProcessType.THINKING, isLLMDialog: true, priority: 6,
        });
        this.bridgeToPanel(agent.id, processedText, true, 'thinking');
      }
    } catch (e) {
      console.error('[DialogEventHandler] handleAgentThinking error:', e);
    }
  }

  // ── Agent decision ────────────────────────────────────────────────

  private async handleAgentDecision(data: {
    agentId: string; decisionType: string; context: string;
    llm?: boolean; isSimulated?: boolean; counted?: boolean;
  }): Promise<void> {
    const s = this.state;
    this.tagLLMSource(data, data.agentId);
    if (!s.isLLMAvailable) { await s.checkLLMAvailability(); if (!s.isLLMAvailable) return; }
    try {
      const agent = s.getAgentDetails(data.agentId);
      if (!agent) return;
      const result = await api.generateFLDecision({
        agentId: agent.id, agentName: agent.name, agentRole: agent.role,
        agentSpecialization: agent.specialization || 'general',
        decisionType: data.decisionType, labType: s.getLabTypeString(),
        context: data.context, flState: s.getCurrentFLState(),
      });
      s.scene.game.events.emit('api-dialog-response', { agentId: agent.id, response: result });
      if (result.decision) {
        const { cleaned, thinking } = this.stripThinkTag(result.decision);
        if (thinking) {
          this.creator.createCognitiveProcess({
            sourceId: agent.id, type: DialogType.MODEL, text: thinking,
            cognitiveType: CognitiveProcessType.THINKING, isLLMDialog: true, duration: 4000, priority: 6,
          });
          this.bridgeToPanel(agent.id, thinking, true, 'thinking');
          setTimeout(() => {
            this.creator.createCognitiveProcess({
              sourceId: agent.id, type: DialogType.MODEL, text: cleaned,
              cognitiveType: CognitiveProcessType.DECISION, isLLMDialog: true, priority: 8,
            });
            this.bridgeToPanel(agent.id, cleaned, true, 'decision');
          }, 4000);
        } else {
          this.creator.createCognitiveProcess({
            sourceId: agent.id, type: DialogType.MODEL, text: cleaned,
            cognitiveType: CognitiveProcessType.DECISION, isLLMDialog: true, priority: 8,
          });
          this.bridgeToPanel(agent.id, cleaned, true, 'decision');
        }
      }
    } catch (e) {
      console.error('[DialogEventHandler] handleAgentDecision error:', e);
    }
  }

  // ── Agent planning ────────────────────────────────────────────────

  private async handleAgentPlanning(data: {
    agentId: string; planningType: string; context: string;
    llm?: boolean; isSimulated?: boolean; counted?: boolean;
  }): Promise<void> {
    const s = this.state;
    this.tagLLMSource(data, data.agentId);
    if (!s.isLLMAvailable) { await s.checkLLMAvailability(); if (!s.isLLMAvailable) return; }
    try {
      const agent = s.getAgentDetails(data.agentId);
      if (!agent) return;
      const result = await api.generateActionPlan({
        agentId: agent.id, agentName: agent.name, agentRole: agent.role,
        agentSpecialization: agent.specialization || 'general',
        planningType: data.planningType, labType: s.getLabTypeString(),
        context: data.context, flState: s.getCurrentFLState(),
      });
      s.scene.game.events.emit('api-dialog-response', { agentId: agent.id, response: result });
      if (result.plan) {
        const { cleaned, thinking } = this.stripThinkTag(result.plan);
        if (thinking) {
          this.creator.createCognitiveProcess({
            sourceId: agent.id, type: DialogType.RESEARCH, text: thinking,
            cognitiveType: CognitiveProcessType.THINKING, isLLMDialog: true, duration: 4000, priority: 6,
          });
          this.bridgeToPanel(agent.id, thinking, true, 'thinking');
          setTimeout(() => {
            this.creator.createCognitiveProcess({
              sourceId: agent.id, type: DialogType.RESEARCH, text: cleaned,
              cognitiveType: CognitiveProcessType.PLANNING, isLLMDialog: true, priority: 8,
            });
            this.bridgeToPanel(agent.id, cleaned, true, 'planning');
          }, 4000);
        } else {
          this.creator.createCognitiveProcess({
            sourceId: agent.id, type: DialogType.RESEARCH, text: cleaned,
            cognitiveType: CognitiveProcessType.PLANNING, isLLMDialog: true, priority: 8,
          });
          this.bridgeToPanel(agent.id, cleaned, true, 'planning');
        }
      }
    } catch (e) {
      console.error('[DialogEventHandler] handleAgentPlanning error:', e);
    }
  }

  // ── Agent reaction ────────────────────────────────────────────────

  private async handleAgentReaction(data: {
    agentId: string; eventType: string; context: string;
    llm?: boolean; isSimulated?: boolean; counted?: boolean;
  }): Promise<void> {
    const s = this.state;
    this.tagLLMSource(data, data.agentId);
    if (!s.isLLMAvailable) { await s.checkLLMAvailability(); if (!s.isLLMAvailable) return; }
    try {
      const agent = s.getAgentDetails(data.agentId);
      if (!agent) return;
      const result = await api.generateEventReaction({
        agentId: agent.id, agentName: agent.name, agentRole: agent.role,
        agentSpecialization: agent.specialization || 'general',
        eventType: data.eventType, labType: s.getLabTypeString(),
        context: data.context, flState: s.getCurrentFLState(),
      });
      s.scene.game.events.emit('api-dialog-response', { agentId: agent.id, response: result });
      if (result.reaction) {
        const { cleaned, thinking } = this.stripThinkTag(result.reaction);
        if (thinking) {
          this.creator.createCognitiveProcess({
            sourceId: agent.id, type: DialogType.GENERAL, text: thinking,
            cognitiveType: CognitiveProcessType.THINKING, isLLMDialog: true, duration: 3000, priority: 7,
          });
          this.bridgeToPanel(agent.id, thinking, true, 'thinking');
          setTimeout(() => {
            this.creator.createDialog({
              sourceId: agent.id, type: s.getDialogTypeForRole(agent.role), text: cleaned,
              isLLMDialog: true, showEffect: true, priority: 9,
            });
            this.bridgeToPanel(agent.id, cleaned, true, 'dialog');
          }, 3000);
        } else {
          this.creator.createDialog({
            sourceId: agent.id, type: s.getDialogTypeForRole(agent.role), text: cleaned,
            isLLMDialog: true, showEffect: true, priority: 9,
          });
          this.bridgeToPanel(agent.id, cleaned, true, 'dialog');
        }
      }
    } catch (e) {
      console.error('[DialogEventHandler] handleAgentReaction error:', e);
    }
  }

  // ── FL events ─────────────────────────────────────────────────────

  private async handleFLEvent(data: { eventType: string; context: string; agentIds?: string[] }): Promise<void> {
    const s = this.state;
    if (!s.isLLMAvailable) { await s.checkLLMAvailability(); if (!s.isLLMAvailable) return; }
    try {
      const agentIds = data.agentIds || s.selectRandomAgents(2);
      for (const agentId of agentIds) {
        this.handleAgentReaction({ agentId, eventType: data.eventType, context: data.context });
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      console.error('[DialogEventHandler] handleFLEvent error:', e);
    }
  }

  private handleFLTrainingStarted(data: { context: string; rounds: number; clientsCount: number }): void {
    if (this.state.debugMode) console.log('[DialogEventHandler] FL Training Started:', data);
    const agent = this.state.getRandomAgentByRole('researcher');
    if (agent) {
      this.handleAgentReaction({
        agentId: agent.id, eventType: 'training_started',
        context: `Training started with ${data.clientsCount} clients and ${data.rounds} rounds. ${data.context}`,
      });
    }
  }

  private handleFLRoundCompleted(data: { context: string; round: number; totalRounds: number; accuracy: number; loss: number }): void {
    if (this.state.debugMode) console.log('[DialogEventHandler] FL Round Completed:', data);
    if (data.round === Math.floor(data.totalRounds / 2) || data.round === data.totalRounds - 1) {
      const agent = this.state.getRandomAgentByRole('researcher');
      if (agent) {
        this.handleAgentReaction({
          agentId: agent.id, eventType: 'round_completed',
          context: `Round ${data.round + 1}/${data.totalRounds} completed. Accuracy: ${(data.accuracy * 100).toFixed(2)}%, Loss: ${data.loss.toFixed(4)}. ${data.context}`,
        });
      }
    }
  }

  private handleFLClientSelected(data: { context: string; agentId: string; round: number }): void {
    if (this.state.debugMode) console.log('[DialogEventHandler] FL Client Selected:', data);
    this.handleAgentReaction({
      agentId: data.agentId, eventType: 'client_selected',
      context: `Selected as client for round ${data.round + 1}. ${data.context}`,
    });
  }

  private handleFLPrivacyBreach(data: { context: string; severity: 'low' | 'medium' | 'high'; affectedAgentId?: string }): void {
    if (this.state.debugMode) console.log('[DialogEventHandler] FL Privacy Breach:', data);
    const agent = this.state.getRandomAgentByRole('privacy_specialist') || this.state.getRandomAgentByRole('researcher');
    if (agent) {
      const sev = { high: 'Critical privacy breach detected! Immediate action required.', medium: 'Moderate privacy leak detected. Protocol review needed.', low: 'Minor privacy concern detected. Monitoring the situation.' };
      this.handleAgentReaction({ agentId: agent.id, eventType: 'privacy_breach', context: `${sev[data.severity]} ${data.context}` });
      if (data.affectedAgentId) {
        setTimeout(() => {
          this.handleAgentReaction({ agentId: data.affectedAgentId!, eventType: 'privacy_affected', context: `My data privacy may have been compromised. ${data.context}` });
        }, 3000);
      }
    }
  }

  private handleFLConvergenceReached(data: { context: string; rounds: number; finalAccuracy: number }): void {
    if (this.state.debugMode) console.log('[DialogEventHandler] FL Convergence Reached:', data);
    const agentIds = this.state.selectRandomAgents(2);
    const ctx = `Model has converged after ${data.rounds} rounds with ${(data.finalAccuracy * 100).toFixed(2)}% accuracy. ${data.context}`;
    agentIds.forEach((id, i) => {
      setTimeout(() => {
        this.handleAgentReaction({ agentId: id, eventType: 'convergence_reached', context: ctx });
      }, i * 3000);
    });
  }
}
