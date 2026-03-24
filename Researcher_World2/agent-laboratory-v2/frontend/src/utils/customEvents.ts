/**
 * Centralized DOM custom events for React ↔ Phaser communication.
 *
 * EVENT SYSTEM CONVENTIONS:
 * 1. WebSocket messages: backend → App.tsx → Zustand store (data flow)
 * 2. DOM CustomEvents: React ↔ Phaser bidirectional (UI actions) — THIS FILE
 * 3. Phaser game.events: internal Phaser scene-to-scene only
 *
 * All cross-boundary events (React ↔ Phaser) MUST go through this file.
 */

// =========================================================================
// FL Panel Toggle
// =========================================================================

const FL_PANEL_KEY = 'fl-panel-visible';
const FL_PANEL_EVENT = 'fl-panel-toggle';

export const getFLPanelState = (): boolean => {
  try {
    const storedValue = localStorage.getItem(FL_PANEL_KEY);
    return storedValue ? JSON.parse(storedValue) : true;
  } catch {
    return true;
  }
};

export const updateFLPanelState = (visible: boolean): void => {
  try {
    localStorage.setItem(FL_PANEL_KEY, JSON.stringify(visible));
  } catch {
    // localStorage may be unavailable
  }
};

export const emitFLPanelToggle = (visible: boolean): void => {
  updateFLPanelState(visible);
  document.dispatchEvent(new CustomEvent(FL_PANEL_EVENT, { detail: { visible } }));
};

export const addFLPanelToggleListener = (callback: (visible: boolean) => void): () => void => {
  const handler = (event: Event) => {
    callback((event as CustomEvent).detail.visible);
  };
  document.addEventListener(FL_PANEL_EVENT, handler);
  return () => document.removeEventListener(FL_PANEL_EVENT, handler);
};

// =========================================================================
// LLM Panel Toggle
// =========================================================================

const LLM_PANEL_EVENT = 'llm-panel-toggle';

export const emitLLMPanelToggle = (visible: boolean): void => {
  document.dispatchEvent(new CustomEvent(LLM_PANEL_EVENT, { detail: { visible } }));
};

export const addLLMPanelToggleListener = (callback: (visible: boolean) => void): () => void => {
  const handler = (event: Event) => {
    callback((event as CustomEvent).detail.visible);
  };
  document.addEventListener(LLM_PANEL_EVENT, handler);
  return () => document.removeEventListener(LLM_PANEL_EVENT, handler);
};

// =========================================================================
// Simulation Control (React → Phaser)
// =========================================================================

const SIM_CONTROL_EVENT = 'simulation:control';

export type SimControlAction = 'start' | 'stop' | 'pause' | 'resume' | 'reset';

export const emitSimulationControl = (action: SimControlAction): void => {
  document.dispatchEvent(new CustomEvent(SIM_CONTROL_EVENT, { detail: { action } }));
};

export const addSimulationControlListener = (callback: (action: SimControlAction) => void): () => void => {
  const handler = (event: Event) => {
    callback((event as CustomEvent).detail.action);
  };
  document.addEventListener(SIM_CONTROL_EVENT, handler);
  return () => document.removeEventListener(SIM_CONTROL_EVENT, handler);
};

// =========================================================================
// Documentation (Phaser → React)
// =========================================================================

export const emitOpenDocumentation = (): void => {
  document.dispatchEvent(new CustomEvent('openDocumentation'));
};

export const addOpenDocumentationListener = (callback: () => void): () => void => {
  document.addEventListener('openDocumentation', callback);
  return () => document.removeEventListener('openDocumentation', callback);
};
