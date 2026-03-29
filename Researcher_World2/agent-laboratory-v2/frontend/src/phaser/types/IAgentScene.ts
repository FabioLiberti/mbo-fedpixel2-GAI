// frontend/src/phaser/types/IAgentScene.ts
//
// Shared interface for scenes that expose agents and controllers.
// Used by UI components to access scene properties without `as any`.

import { Agent } from '../sprites/Agent';
import { GlobalAgentController } from '../controllers/GlobalAgentController';
import { AgentsLegend } from '../ui/AgentsLegend';
import { DialogEventTracker } from '../controllers/DialogEventTracker';
import type { FLController } from '../fl/FLController';

/**
 * Minimal scene interface for components that need agent access.
 * All lab scenes (BaseLabScene subclasses) satisfy this interface.
 */
export interface IAgentScene extends Phaser.Scene {
  agents: Agent[];
  agentController: GlobalAgentController | null;
  agentsLegend: AgentsLegend | null;
  dialogEventTracker: DialogEventTracker | null;
  flController?: FLController;
  debugGraphics: Phaser.GameObjects.Graphics | null;
  debugText: Phaser.GameObjects.Text | null;
  theme: { name: string; colorPalette: Record<string, number> };
  /** Navigation grid: 0 = walkable, 1 = blocked. Rows×Cols at 32px per cell. */
  grid?: number[][];
  updateDebugInfo(text: string): void;
}

/** Declare custom window properties used across the app. */
declare global {
  interface Window {
    API_BASE_URL?: string;
  }
}
