// frontend/src/phaser/scenes/BlekingeLabScene.ts
//
// Scene del laboratorio Blekinge — estende BaseLabScene con tema scandinavo.

import Phaser from 'phaser';
import { BaseLabScene, LabTheme, AgentConfigEntry } from './BaseLabScene';
import { Agent } from '../sprites/Agent';
import { LabControlsMenu, type LabControlConfig } from '../ui/LabControlsMenu';
import { GlobalAgentController } from '../controllers/GlobalAgentController';
import { DialogEventTracker } from '../controllers/DialogEventTracker';
import { LAB_TYPES } from '../types/LabTypeConstants';
import { THEME_BLEKINGE, TILE } from '../utils/tilesetGenerator';

// ---------------------------------------------------------------------------
// Agent config — aligned with backend PERSONA_REGISTRY["blekinge"]
// ---------------------------------------------------------------------------
const BLEKINGE_AGENTS: AgentConfigEntry[] = [
  { type: 'professor_senior', name: 'Lars Lindberg',   position: { x: 150, y: 200 }, specialization: 'fl_architecture' },
  { type: 'student',          name: 'Erik Johansson',  position: { x: 300, y: 250 }, specialization: 'communication_efficiency' },
  { type: 'sw_engineer',      name: 'Sara Nilsson',    position: { x: 200, y: 150 }, specialization: 'platform_development' },
  { type: 'engineer',         name: 'Nils Eriksson',   position: { x: 350, y: 180 }, specialization: 'model_optimization' },
];

const CHARACTER_TYPES = ['professor_senior', 'student', 'sw_engineer', 'engineer'];

const TYPE_COLORS: Record<string, { main: string; accent: string }> = {
  professor_senior: { main: '#0D47A1', accent: '#0A3780' },
  student:          { main: '#FB8C00', accent: '#E65100' },
  sw_engineer:      { main: '#26A69A', accent: '#00897B' },
  engineer:         { main: '#F44336', accent: '#C62828' },
};

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
export class BlekingeLabScene extends BaseLabScene {

  public theme: LabTheme = {
    name: 'Blekinge University Lab',
    backgroundColor: 0x88ccee,
    tilesetKey: 'tiles_blekinge',
    colorPalette: { primary: 0x3f51b5, secondary: 0x4fc3f7, accent: 0xffcc44, background: 0x88ccee },
  };

  constructor() {
    super('BlekingeLabScene');
  }

  // ---- preload ----------------------------------------------------------

  preload(): void {
    super.preload();
    this.setLoadingListeners();

    // Spritesheets specifici Blekinge
    this.load.spritesheet('professor_senior', 'assets/characters/professor_spritesheet.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('student', 'assets/characters/student_spritesheet.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('sw_engineer', 'assets/characters/researcher_spritesheet.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('engineer', 'assets/characters/engineer_spritesheet.png', { frameWidth: 32, frameHeight: 48 });

    // Assets lab-specific
    this.load.image('blekinge_background', 'assets/labs/blekinge/background.png');
    this.load.image('blekinge_furniture', 'assets/labs/blekinge/furniture.png');
    this.load.image('blekinge-logo', 'assets/ui/blekinge-logo.png');
    this.load.json('labAgentTypesConfig', 'assets/config/labAgentTypes.json');
  }

  // ---- create -----------------------------------------------------------

  create(): void {
    console.log('BlekingeLabScene create START');
    try {
      // Debug (hidden)
      this.createDebugElements();
      if (this.debugGraphics) this.debugGraphics.setVisible(false);
      if (this.debugText) this.debugText.setVisible(false);

      // Brief magenta flash for debug, then real background
      this.cameras.main.setBackgroundColor(0xFF00FF);
      setTimeout(() => this.cameras.main.setBackgroundColor(this.theme.backgroundColor), 1000);

      // Textures & animations
      this.createImprovedPlaceholders(CHARACTER_TYPES, TYPE_COLORS);
      this.runTextureDebug();
      this.displayLoadedAssets();
      this.createMissingTextures(CHARACTER_TYPES);
      this.createAllCharacterAnimations(CHARACTER_TYPES);

      // Scene layout: background + tilemap
      this.createScandinavianBackground();
      this.createLabTilemap(THEME_BLEKINGE, (floor, furn, cols, rows) => {
        // Minimal walls — Scandinavian open plan
        for (let x = 0; x < cols; x++) { furn.putTileAt(TILE.WALL_H, x, 0); }
        for (let y = 1; y < rows; y++) { furn.putTileAt(TILE.WALL, 0, y); furn.putTileAt(TILE.WALL, cols - 1, y); }
        furn.putTileAt(TILE.WALL_CORNER, 0, 0); furn.putTileAt(TILE.WALL_CORNER, cols - 1, 0);
        // Windows along top wall
        for (let x = 3; x < cols - 3; x += 3) furn.putTileAt(TILE.WINDOW, x, 0);
        // Innovation corner (bottom-left)
        furn.putTileAt(TILE.COUCH, 2, rows - 3); furn.putTileAt(TILE.COUCH, 3, rows - 3);
        furn.putTileAt(TILE.TABLE, 2, rows - 4); furn.putTileAt(TILE.PLANT, 1, rows - 2);
        // Data wall (top) — whiteboards and monitors
        for (let x = 2; x < cols - 2; x += 2) furn.putTileAt(TILE.WHITEBOARD, x, 1);
        for (let x = 3; x < cols - 2; x += 2) furn.putTileAt(TILE.MONITOR, x, 1);
        // Workstation clusters (center)
        const cx = Math.floor(cols / 2);
        // Cluster left
        furn.putTileAt(TILE.DESK, cx - 4, 5); furn.putTileAt(TILE.DESK, cx - 3, 5);
        furn.putTileAt(TILE.CHAIR, cx - 4, 6); furn.putTileAt(TILE.CHAIR, cx - 3, 6);
        // Cluster right
        furn.putTileAt(TILE.DESK, cx + 2, 5); furn.putTileAt(TILE.DESK, cx + 3, 5);
        furn.putTileAt(TILE.CHAIR, cx + 2, 6); furn.putTileAt(TILE.CHAIR, cx + 3, 6);
        // Server area (right side)
        furn.putTileAt(TILE.SERVER, cols - 2, 2); furn.putTileAt(TILE.SERVER, cols - 2, 3);
        furn.putTileAt(TILE.SERVER, cols - 2, 4);
        // Relax area (bottom-right)
        furn.putTileAt(TILE.COUCH, cols - 4, rows - 3); furn.putTileAt(TILE.COUCH, cols - 3, rows - 3);
        furn.putTileAt(TILE.PLANT, cols - 2, rows - 2);
        // Rug in relax area
        for (let dx = -2; dx <= 0; dx++) for (let dy = -1; dy <= 1; dy++) {
          floor.putTileAt(TILE.RUG, cols - 3 + dx, rows - 3 + dy);
        }
      });
      this.createArenaZones();
      this.createInteractionZones();
      this.enableZoneZoom();

      // Agents
      this.createAgentsFromConfig(BLEKINGE_AGENTS);

      // Camera
      this.setupCamera();

      // Controllers
      this.dialogEventTracker = new DialogEventTracker(this);
      this.agentController = new GlobalAgentController(this, LAB_TYPES.BLEKINGE);
      this.agentController.setSimulationAgents(this.agents);
      this.agentController.initDebugger();

      // Lab controls panel
      const controlConfig: LabControlConfig = {
        labId: 'blekinge',
        labName: 'Blekinge University Lab',
        labDescription:
          'Laboratorio di ricerca specializzato in architetture di\n' +
          'federated learning e comunicazione efficiente.\n\n' +
          'Specializzazione in:\n' +
          '• Architetture FL distribuite e scalabili\n' +
          '• Efficienza della comunicazione tra nodi federati\n' +
          '• Gestione dati non-IID in ambienti eterogenei\n' +
          '• Ottimizzazione del consenso distribuito',
        theme: { primary: this.theme.colorPalette.primary, secondary: 0x1a1a2e, accent: 0xf5f5dc },
        navigation: [
          { label: '← Torna a Mercatorum', sceneKey: 'MercatorumLabScene' },
          { label: '→ Vai a OPBG Lab',     sceneKey: 'OPBGLabScene' },
        ],
      };
      this.labControlsMenu = new LabControlsMenu(this, controlConfig);
      const dc = this.agentController.getDialogController();
      if (dc) this.labControlsMenu.setDialogController(dc);

      // Title
      this.create3DTitle('Blekinge University Lab', '#4fc3f7');

      console.log('BlekingeLabScene create COMPLETE');
    } catch (error) {
      console.error('Error in BlekingeLabScene create:', error);
    }
  }

  // ---- update -----------------------------------------------------------

  update(time: number, delta: number): void {
    try {
      this.updateAgents(time, delta);
      this.checkInteractions();
    } catch (error) {
      console.error('Error in BlekingeLabScene update:', error);
    }
  }

  // ---- Scene-specific: Scandinavian background --------------------------

  private createScandinavianBackground(): void {
    try {
      if (this.textures.exists('blekinge_background')) {
        const bg = this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'blekinge_background');
        bg.setDepth(-10);
        if (bg.width > this.cameras.main.width || bg.height > this.cameras.main.height) {
          bg.setScale(Math.min(this.cameras.main.width / bg.width, this.cameras.main.height / bg.height));
        }
        return;
      }

      // Fallback: geometric Scandinavian pattern
      const g = this.add.graphics();
      g.fillStyle(this.theme.backgroundColor, 1);
      g.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
      g.lineStyle(2, 0xffffff, 0.3);
      for (let y = 0; y < this.cameras.main.height; y += 40) { g.moveTo(0, y); g.lineTo(this.cameras.main.width, y); }
      g.fillStyle(this.theme.colorPalette.accent, 0.2);
      for (let x = 0; x < this.cameras.main.width; x += 80) {
        for (let y = 0; y < this.cameras.main.height; y += 80) {
          g.fillTriangle(x, y, x + 40, y, x + 20, y + 30);
        }
      }
      g.strokePath();
      g.setDepth(-10);
    } catch (error) {
      console.error('Error in createScandinavianBackground:', error);
    }
  }

  // ---- Scene-specific: Interaction zones --------------------------------

  protected createInteractionZones(): void {
    try {
      const gs = 32;
      const zoneGraphics = this.add.graphics();
      zoneGraphics.lineStyle(2, 0x00ff00, 0.5);

      const addZone = (x: number, y: number, w: number, h: number, name: string) => {
        const z = this.add.zone(x, y, w, h);
        z.setName(name); z.setInteractive();
        zoneGraphics.strokeRect(x - w / 2, y - h / 2, w, h);
        this.interactionZones.push(z);
      };

      addZone(100, 200, gs * 4, gs * 4, 'innovation_corner');
      addZone(this.cameras.main.width / 2, gs / 2, this.cameras.main.width - 100, gs * 2, 'data_wall');
      addZone(this.cameras.main.width - 100, this.cameras.main.height - 100, gs * 5, gs * 3, 'relax_area');
    } catch (error) {
      console.error('Error in createInteractionZones:', error);
    }
  }

  // ---- Scene-specific: Zone interaction icons ---------------------------

  protected handleZoneInteraction(agent: Agent, zone: Phaser.GameObjects.Zone): void {
    try {
      let icon = '❓';
      if (zone.name === 'innovation_corner') icon = '💡';
      else if (zone.name === 'data_wall') icon = '📊';
      else if (zone.name === 'relax_area') icon = '🌊';

      const t = this.add.text(agent.x, agent.y - 30, icon, { fontSize: '24px' });
      t.setOrigin(0.5); t.setDepth(100);
      this.time.delayedCall(1500, () => t.destroy());
    } catch (error) {
      console.error('Error in handleZoneInteraction:', error);
    }
  }
}
