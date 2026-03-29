// frontend/src/phaser/controllers/DialogState.ts
//
// Shared state container for the Dialog sub-system.
// Owns counters, flags, localStorage I/O, LLM availability check,
// and the dialog-source tracking map.

import Phaser from 'phaser';
import { api } from '../../services/api';
import { LabTheme } from '../scenes/BaseLabScene';
import { SpeechBubble } from '../ui/SpeechBubble';
import { ThoughtBubble } from '../ui/ThoughtBubble';
import { DecisionBubble } from '../ui/DecisionBubble';
import { FLDialogType as DialogType, CognitiveProcessType } from '../types/DialogTypes';
import type { IAgentScene } from '../types/IAgentScene';

// ── Shared interfaces ────────────────────────────────────────────────

export interface DialogConfig {
  sourceId: string;
  targetId?: string;
  type: DialogType;
  text: string;
  duration?: number;
  showEffect?: boolean;
  callback?: () => void;
  isLLMDialog?: boolean;
  cognitiveType?: CognitiveProcessType;
  metadata?: any;
  priority?: number;
  isResponse?: boolean;
}

export interface DialogResponse {
  dialog: string;
  isLLMGenerated: boolean;
  source?: string;
  model?: string;
}

export type BubbleType = SpeechBubble | ThoughtBubble | DecisionBubble;

// ── DialogState ──────────────────────────────────────────────────────

export class DialogState {
  // References
  scene: Phaser.Scene;
  labTheme: LabTheme | null;

  // Active bubbles & queue
  activeBubbles: Map<string, BubbleType> = new Map();
  dialogQueue: DialogConfig[] = [];
  isProcessingQueue = false;

  // Flags
  debugMode = false;
  isLLMAvailable = false;
  showLLMDialogs = true;

  // LLM check throttle
  lastLLMCheck = 0;
  readonly LLM_CHECK_INTERVAL = 60_000;

  // Counters
  cognitiveProcessCounter = 0;
  llmDialogCount = 0;
  simulatedDialogCount = 0;
  standardDialogCount = 0;

  // Per-agent dialog source tracking
  dialogSources: Map<string, string> = new Map();

  constructor(scene: Phaser.Scene, labTheme?: LabTheme) {
    this.scene = scene;
    this.labTheme = labTheme || null;
    this.debugMode = localStorage.getItem('dialog_debug') === 'true';
    this.loadDialogCounters();
  }

  // ── localStorage I/O ───────────────────────────────────────────────

  loadDialogCounters(): void {
    try {
      const saved = localStorage.getItem('dialog_counters');
      if (saved) {
        const c = JSON.parse(saved);
        this.llmDialogCount = c.llm || 0;
        this.simulatedDialogCount = c.simulated || 0;
        this.standardDialogCount = c.standard || 0;
        if (this.debugMode) {
          console.log(`[DialogState] Loaded counters: LLM=${this.llmDialogCount}, Sim=${this.simulatedDialogCount}, Std=${this.standardDialogCount}`);
        }
      }
    } catch (e) {
      console.error('[DialogState] Error loading counters:', e);
    }
  }

  saveDialogCounters(): void {
    try {
      const counters = {
        llm: this.llmDialogCount,
        simulated: this.simulatedDialogCount,
        standard: this.standardDialogCount,
      };
      localStorage.setItem('dialog_counters', JSON.stringify(counters));
      this.scene.game.events.emit('dialog-counter-updated', counters);
      if (this.debugMode) {
        console.log(`[DialogState] Saved counters: LLM=${this.llmDialogCount}, Sim=${this.simulatedDialogCount}, Std=${this.standardDialogCount}`);
      }
    } catch (e) {
      console.error('[DialogState] Error saving counters:', e);
    }
  }

  // ── LLM availability ──────────────────────────────────────────────

  async checkLLMAvailability(): Promise<void> {
    const now = Date.now();
    if (now - this.lastLLMCheck < this.LLM_CHECK_INTERVAL) return;
    this.lastLLMCheck = now;
    try {
      const result = await api.checkLLMAvailability();
      this.isLLMAvailable = result.available;
      if (this.debugMode) {
        console.log(`[DialogState] LLM available: ${this.isLLMAvailable}`);
      }
    } catch (e) {
      console.error('[DialogState] LLM check failed:', e);
      this.isLLMAvailable = false;
    }
  }

  // ── Debug / public accessors ──────────────────────────────────────

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    localStorage.setItem('dialog_debug', String(enabled));
    if (enabled) console.log('[DialogState] Debug mode enabled');
  }

  getDialogStatistics() {
    return {
      llm: this.llmDialogCount,
      simulated: this.simulatedDialogCount,
      standard: this.standardDialogCount,
    };
  }

  resetDialogStatistics(): void {
    this.llmDialogCount = 0;
    this.simulatedDialogCount = 0;
    this.standardDialogCount = 0;
    this.saveDialogCounters();
    if (this.debugMode) console.log('[DialogState] Statistics reset');
  }

  // ── Utility helpers (scene queries) ───────────────────────────────

  getAgentDetails(agentId: string): { id: string; name: string; role: string; specialization: string; x: number; y: number } | null {
    try {
      const agents = this.scene.children.getChildren()
        .filter((child: any) =>
          (child.getData && child.getData('id') === agentId) ||
          (child.getId && child.getId() === agentId)
        );
      if (agents.length > 0) {
        const a = agents[0] as any;
        return {
          id: agentId,
          name: a.name || a.getData('name') || 'Unknown Agent',
          role: a.role || a.getData('role') || a.type || a.getData('type') || 'researcher',
          specialization: a.specialization || a.getData('specialization') || 'general',
          x: a.x,
          y: a.y,
        };
      }
    } catch (e) {
      console.error(`[DialogState] getAgentDetails(${agentId}):`, e);
    }
    return null;
  }

  getRandomAgentByRole(role: string): { id: string; name: string; role: string; specialization: string } | null {
    try {
      const agents = this.scene.children.getChildren()
        .filter((child: any) => {
          if (!child.getData) return false;
          const r = child.getData('role') || child.getData('type');
          return r && r.toLowerCase() === role.toLowerCase();
        });
      if (agents.length === 0) return null;
      const agent = agents[Math.floor(Math.random() * agents.length)] as any;
      return {
        id: agent.getData('id'),
        name: agent.getData('name') || 'Unknown Agent',
        role: agent.getData('role') || agent.getData('type') || role,
        specialization: agent.getData('specialization') || 'general',
      };
    } catch (e) {
      console.error(`[DialogState] getRandomAgentByRole(${role}):`, e);
      return null;
    }
  }

  selectRandomAgents(count = 1): string[] {
    try {
      const agents = this.scene.children.getChildren()
        .filter((child: any) => child.getData && child.getData('id'));
      return agents
        .sort(() => 0.5 - Math.random())
        .slice(0, count)
        .map((a: any) => a.getData('id'));
    } catch (e) {
      console.error('[DialogState] selectRandomAgents:', e);
      return [];
    }
  }

  getCurrentFLState(): any {
    try {
      const flc = (this.scene as IAgentScene).flController;
      if (flc && 'getState' in flc) return (flc as unknown as { getState: () => unknown }).getState();
    } catch (e) {
      console.warn('[DialogState] getCurrentFLState:', e);
    }
    return null;
  }

  getLabTypeString(): string {
    if (!this.labTheme) return 'default';
    if (this.labTheme.name.includes('Mercatorum')) return 'mercatorum';
    if (this.labTheme.name.includes('Blekinge')) return 'blekinge';
    if (this.labTheme.name.includes('OPBG') || this.labTheme.name.includes('Bambino Gesù')) return 'opbg';
    return 'default';
  }

  getDialogTypeForRole(role: string): DialogType {
    const map: Record<string, DialogType> = {
      professor: DialogType.RESEARCH,
      researcher: DialogType.RESEARCH,
      student_postdoc: DialogType.RESEARCH,
      student: DialogType.RESEARCH,
      doctor: DialogType.DATA,
      engineer: DialogType.MODEL,
      ml_engineer: DialogType.MODEL,
      data_engineer: DialogType.DATA,
      privacy_specialist: DialogType.PRIVACY,
    };
    return map[role.toLowerCase()] || DialogType.GENERAL;
  }
}
