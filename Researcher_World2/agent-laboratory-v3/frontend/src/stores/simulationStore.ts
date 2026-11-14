import { create } from 'zustand';
import type { SimulationUpdateData, FLUpdateData, AgentStateData } from '../types/WebSocketMessages';

/**
 * Centralized simulation state — single source of truth for React + Phaser.
 *
 * Data flows:  Backend WebSocket → store.setBackendData() → all consumers
 * Phaser reads: simulationStore.getState() (non-React, no hook needed)
 * React reads:  useSimulationStore(selector) (reactive, re-renders on change)
 */

export type SimulationStatus = 'stopped' | 'running' | 'paused';

interface SimulationState {
  // Connection
  connected: boolean;
  setConnected: (v: boolean) => void;

  // Simulation status
  simStatus: SimulationStatus;
  setSimStatus: (v: SimulationStatus) => void;

  // Agent data
  agentCount: number;
  agentStates: AgentStateData[];

  // FL data (from backend broadcast)
  fl: FLUpdateData | null;
  flRound: number;
  flAccuracy: number;
  flLoss: number;
  flPhase: string;

  // LLM
  llmEnabled: boolean;
  setLlmEnabled: (v: boolean) => void;

  // Raw backend payload (for components that need the full object)
  backendSimData: SimulationUpdateData | null;

  // Main updater — called from WebSocket handler
  setBackendData: (data: SimulationUpdateData) => void;

  // Reset on simulation stop/reset
  resetFL: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  // Defaults
  connected: false,
  setConnected: (v) => set({ connected: v }),

  simStatus: 'stopped',
  setSimStatus: (v) => set({ simStatus: v }),

  agentCount: 9,
  agentStates: [],

  fl: null,
  flRound: 0,
  flAccuracy: 0,
  flLoss: 0,
  flPhase: 'idle',

  llmEnabled: false,
  setLlmEnabled: (v) => set({ llmEnabled: v }),

  backendSimData: null,

  setBackendData: (data) => {
    const updates: Partial<SimulationState> = {
      backendSimData: data,
      agentCount: data.agent_count,
      agentStates: data.agent_states,
    };

    // Derive simStatus
    if (data.simulation) {
      if (data.simulation.running && !data.simulation.paused) updates.simStatus = 'running';
      else if (data.simulation.running && data.simulation.paused) updates.simStatus = 'paused';
      else updates.simStatus = 'stopped';
    }

    // FL data
    if (data.fl) {
      const fl = data.fl;
      updates.fl = fl;
      updates.flRound = fl.round ?? 0;
      updates.flPhase = fl.current_phase || 'idle';

      const acc = Array.isArray(fl.metrics?.accuracy)
        ? (fl.metrics.accuracy[fl.metrics.accuracy.length - 1] ?? 0)
        : (fl.metrics?.accuracy ?? 0);
      const loss = Array.isArray(fl.metrics?.loss)
        ? (fl.metrics.loss[fl.metrics.loss.length - 1] ?? 1)
        : (fl.metrics?.loss ?? 1);
      updates.flAccuracy = acc as number;
      updates.flLoss = loss as number;
    }

    set(updates);
  },

  resetFL: () => set({
    fl: null,
    flRound: 0,
    flAccuracy: 0,
    flLoss: 0,
    flPhase: 'idle',
  }),
}));
