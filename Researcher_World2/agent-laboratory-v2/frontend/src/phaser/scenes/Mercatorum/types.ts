// src/phaser/scenes/Mercatorum/types.ts

import { Agent } from '../../sprites/Agent';
import { GlobalAgentController } from '../../controllers/GlobalAgentController';
import { AgentsLegend } from '../../ui/AgentsLegend';
import { LabTheme } from '../BaseLabScene';
import { BaseScene } from '../BaseScene';
import { LLMControlPanel } from '../../ui/LLMControlPanel'; 
import { DialogEventTracker } from '../../controllers/DialogEventTracker'; // NUOVO

export interface MercatorumAgentConfig {
  type: string;
  name: string;
  position: { x: number; y: number };
  specialization?: string;
}

export interface MercatorumLabConfig {
  agents: MercatorumAgentConfig[];
}

// Interfaccia per contenere i riferimenti agli elementi della scena
export interface MercatorumSceneRefs {
  agents: Agent[];
  interactionZones: Phaser.GameObjects.Zone[];
  grid: number[][];
  agentController: GlobalAgentController | null;
  agentsLegend: AgentsLegend | null;
  debugGraphics: Phaser.GameObjects.Graphics | null;
  debugText: Phaser.GameObjects.Text | null;
  controlPanel: Phaser.GameObjects.Container | null;
  controlPanelToggle: Phaser.GameObjects.Container | null;
  textureTestContainers: Phaser.GameObjects.Container[];
  rawSprites: Phaser.GameObjects.Sprite[];
  assetsLoaded: boolean;
  isPanelOpen: boolean;
  llmPanel: LLMControlPanel | null;
}

// Interfaccia per la scena Mercatorum che estende BaseScene
export interface IMercatorumLabScene extends BaseScene {
  agents: Agent[];
  interactionZones: Phaser.GameObjects.Zone[];
  grid: number[][];
  agentController: GlobalAgentController | null;
  agentsLegend: AgentsLegend | null;
  debugGraphics: Phaser.GameObjects.Graphics | null;
  debugText: Phaser.GameObjects.Text | null;
  controlPanel: Phaser.GameObjects.Container | null;
  controlPanelToggle: Phaser.GameObjects.Container | null;
  textureTestContainers: Phaser.GameObjects.Container[];
  rawSprites: Phaser.GameObjects.Sprite[];
  assetsLoaded: boolean;
  isPanelOpen: boolean;
  theme: LabTheme;
  llmPanel: LLMControlPanel | null;
  dialogEventTracker?: DialogEventTracker | null; // NUOVO: aggiunto il tracker di dialoghi
  updateDebugInfo(text: string): void;
  trackDialog?(type: 'llm' | 'simulated' | 'standard', agentId?: string): void; // NUOVO: metodo opzionale per tracciare dialoghi
}

// Esporta il tema per il laboratorio Mercatorum
export const MERCATORUM_THEME: LabTheme = {
  name: "Università Mercatorum Lab",
  backgroundColor: 0xd2691e, // Tonalità terracotta
  tilesetKey: 'tiles_mercatorum',
  colorPalette: {
    primary: 0xd2691e,   // Tonalità terracotta
    secondary: 0x1a365d, // Blu navy
    accent: 0xf5f5dc,    // Crema
    background: 0xd2691e  // Tonalità terracotta
  }
};

// Configurazione degli agenti per Mercatorum (allineata al backend PERSONA_REGISTRY)
export const MERCATORUM_AGENT_CONFIG: MercatorumLabConfig = {
  agents: [
    {
      type: 'professor',
      name: 'Elena Conti',
      position: { x: 150, y: 200 },
      specialization: 'privacy_economics'
    },
    {
      type: 'privacy_specialist',
      name: 'Luca Bianchi',
      position: { x: 300, y: 250 },
      specialization: 'compliance_verification'
    },
    {
      type: 'researcher',
      name: 'Marco Rossi',
      position: { x: 200, y: 150 },
      specialization: 'secure_aggregation'
    },
    {
      type: 'student_postdoc',
      name: 'Davide Greco',
      position: { x: 350, y: 180 },
      specialization: 'data_science'
    }
  ]
};