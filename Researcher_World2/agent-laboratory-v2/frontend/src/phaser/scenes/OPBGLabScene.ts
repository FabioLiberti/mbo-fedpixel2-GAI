// frontend/src/phaser/scenes/OPBGLabScene.ts
//
// Scene del laboratorio OPBG — estende BaseLabScene con tema ospedaliero pediatrico.

import Phaser from 'phaser';
import { BaseLabScene, LabTheme, AgentConfigEntry } from './BaseLabScene';
import { Agent } from '../sprites/Agent';
import { LabControlsMenu, type LabControlConfig } from '../ui/LabControlsMenu';
import { GlobalAgentController } from '../controllers/GlobalAgentController';
import { DialogEventTracker } from '../controllers/DialogEventTracker';
import { LAB_TYPES } from '../types/LabTypeConstants';
import { THEME_OPBG, TILE } from '../utils/tilesetGenerator';

// ---------------------------------------------------------------------------
// Agent config — aligned with backend PERSONA_REGISTRY["opbg"]
// ---------------------------------------------------------------------------
const OPBG_AGENTS: AgentConfigEntry[] = [
  { type: 'doctor',         name: 'Matteo Ferri',     position: { x: 300, y: 250 }, specialization: 'clinical_data' },
  { type: 'student_postdoc', name: 'Marco Romano',    position: { x: 150, y: 200 }, specialization: 'data_science' },
  { type: 'engineer',       name: 'Lorenzo Mancini',  position: { x: 200, y: 150 }, specialization: 'model_optimization' },
  { type: 'researcher',     name: 'Giulia Conti',     position: { x: 250, y: 180 }, specialization: 'privacy_engineering' },
];

const CHARACTER_TYPES = ['doctor', 'student_postdoc', 'engineer', 'researcher'];

const TYPE_COLORS: Record<string, { main: string; accent: string }> = {
  doctor:          { main: '#00B8D4', accent: '#00838F' },
  student_postdoc: { main: '#FB8C00', accent: '#E65100' },
  engineer:        { main: '#F44336', accent: '#C62828' },
  researcher:      { main: '#7B1FA2', accent: '#6A1B9A' },
};

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
export class OPBGLabScene extends BaseLabScene {

  public theme: LabTheme = {
    name: 'OPBG IRCCS Lab',
    backgroundColor: 0xf0f0f0,
    tilesetKey: 'tiles_opbg',
    colorPalette: { primary: 0x00b8d4, secondary: 0xffb6c1, accent: 0x4fc7ff, background: 0xffffff },
  };

  constructor() {
    super('OPBGLabScene');
  }

  // ---- preload ----------------------------------------------------------

  preload(): void {
    super.preload();
    this.setLoadingListeners();

    // Spritesheets specifici OPBG
    this.load.spritesheet('doctor', 'assets/characters/doctor_spritesheet.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('student_postdoc', 'assets/characters/student_spritesheet.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('engineer', 'assets/characters/engineer_spritesheet.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('researcher', 'assets/characters/researcher_spritesheet.png', { frameWidth: 32, frameHeight: 48 });

    // Assets lab-specific
    this.load.image('opbg_background', 'assets/labs/opbg/background.png');
    this.load.image('opbg_furniture', 'assets/labs/opbg/furniture.png');
    this.load.image('medical_icons', 'assets/labs/opbg/medical_icons.png');
    this.load.json('labAgentTypesConfig', 'assets/config/labAgentTypes.json');
    this.load.image('opbg-logo', 'assets/ui/opbg-logo.png');
    this.load.image('medical_equipment', 'assets/labs/opbg/medical_equipment.png');
    this.load.image('patient_icons', 'assets/labs/opbg/patient_icons.png');
  }

  // ---- create -----------------------------------------------------------

  create(): void {
    console.log('OPBGLabScene create START');
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
      this.createHospitalBackground();
      this.createLabTilemap(THEME_OPBG, (floor, furn, cols, rows) => {
        // Walls — hospital corridor style
        for (let x = 0; x < cols; x++) { furn.putTileAt(TILE.WALL_H, x, 0); furn.putTileAt(TILE.WALL_H, x, rows - 1); }
        for (let y = 1; y < rows - 1; y++) { furn.putTileAt(TILE.WALL, 0, y); furn.putTileAt(TILE.WALL, cols - 1, y); }
        furn.putTileAt(TILE.WALL_CORNER, 0, 0); furn.putTileAt(TILE.WALL_CORNER, cols - 1, 0);
        furn.putTileAt(TILE.WALL_CORNER, 0, rows - 1); furn.putTileAt(TILE.WALL_CORNER, cols - 1, rows - 1);
        // Doors
        furn.putTileAt(TILE.DOOR, 1, rows - 1); furn.putTileAt(TILE.DOOR, cols - 2, rows - 1);
        // Windows along top
        for (let x = 2; x < cols - 2; x += 2) furn.putTileAt(TILE.WINDOW, x, 0);
        // Central server room (data sensibili)
        const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
        for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) {
          if (Math.abs(dx) === 2 || Math.abs(dy) === 1) furn.putTileAt(TILE.CABINET, cx + dx, cy + dy);
          else furn.putTileAt(TILE.SERVER, cx + dx, cy + dy);
        }
        // Workstations (left side)
        for (let y = 3; y < rows - 3; y += 3) {
          furn.putTileAt(TILE.DESK, 1, y); furn.putTileAt(TILE.MONITOR, 2, y);
          furn.putTileAt(TILE.CHAIR, 2, y + 1);
        }
        // Clinical area (right side) — equipment + cabinets
        furn.putTileAt(TILE.EQUIPMENT, cols - 3, 2); furn.putTileAt(TILE.EQUIPMENT, cols - 2, 2);
        furn.putTileAt(TILE.EQUIPMENT, cols - 3, 3); furn.putTileAt(TILE.CABINET, cols - 2, 3);
        furn.putTileAt(TILE.CABINET, cols - 3, 5); furn.putTileAt(TILE.CABINET, cols - 2, 5);
        // Meeting area (bottom center)
        for (let dx = -1; dx <= 1; dx++) furn.putTileAt(TILE.TABLE, cx + dx, rows - 3);
        furn.putTileAt(TILE.CHAIR, cx - 2, rows - 3); furn.putTileAt(TILE.CHAIR, cx + 2, rows - 3);
        // Plants for pediatric atmosphere
        furn.putTileAt(TILE.PLANT, 1, 1); furn.putTileAt(TILE.PLANT, cols - 2, 1);
        furn.putTileAt(TILE.PLANT, 1, rows - 2); furn.putTileAt(TILE.PLANT, cols - 2, rows - 2);
      });
      this.createArenaZones();
      this.createInteractionZones();
      this.enableZoneZoom();

      // Agents
      this.createAgentsFromConfig(OPBG_AGENTS);

      // Camera
      this.setupCamera();

      // Controllers
      this.dialogEventTracker = new DialogEventTracker(this);
      this.agentController = new GlobalAgentController(this, LAB_TYPES.OPBG);
      this.agentController.setSimulationAgents(this.agents);
      this.agentController.initDebugger();

      // Lab controls panel
      const controlConfig: LabControlConfig = {
        labId: 'opbg',
        labName: 'OPBG IRCCS Lab',
        labDescription:
          'Laboratorio di ricerca specializzato in federated learning\n' +
          'applicato alla medicina pediatrica e clinica.\n\n' +
          'Specializzazione in:\n' +
          '• Privacy engineering per dati sanitari sensibili\n' +
          '• Medical imaging con federated learning\n' +
          '• Equità e bias nei modelli clinici\n' +
          '• Compliance normativa per dati pediatrici',
        theme: { primary: this.theme.colorPalette.primary, secondary: 0x1a1a2e, accent: 0xf5f5dc },
        navigation: [
          { label: '← Vai a Mercatorum Lab', sceneKey: 'MercatorumLabScene' },
          { label: '→ Vai a Blekinge Lab',   sceneKey: 'BlekingeLabScene' },
        ],
      };
      this.labControlsMenu = new LabControlsMenu(this, controlConfig);
      const dc = this.agentController.getDialogController();
      if (dc) this.labControlsMenu.setDialogController(dc);

      // Title
      this.create3DTitle('OPBG IRCCS Lab', '#00b8d4', 'Arial');

      console.log('OPBGLabScene create COMPLETE');
    } catch (error) {
      console.error('Error in OPBGLabScene create:', error);
    }
  }

  // ---- update -----------------------------------------------------------

  update(time: number, delta: number): void {
    try {
      this.updateAgents(time, delta);
      this.checkInteractions();
    } catch (error) {
      console.error('Error in OPBGLabScene update:', error);
    }
  }

  // ---- Scene-specific: Hospital background ------------------------------

  private createHospitalBackground(): void {
    try {
      if (this.textures.exists('opbg_background')) {
        const bg = this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'opbg_background');
        bg.setDepth(-10);
        if (bg.width > 0 && bg.height > 0) {
          bg.setScale(Math.max(this.cameras.main.width / bg.width, this.cameras.main.height / bg.height));
        }
        return;
      }

      // Fallback: child-friendly hospital pattern
      const g = this.add.graphics();
      g.fillStyle(this.theme.backgroundColor, 1);
      g.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

      // Light tile grid
      g.lineStyle(1, 0xeeeeee, 1);
      for (let x = 0; x < this.cameras.main.width; x += 32) { g.moveTo(x, 0); g.lineTo(x, this.cameras.main.height); }
      for (let y = 0; y < this.cameras.main.height; y += 32) { g.moveTo(0, y); g.lineTo(this.cameras.main.width, y); }

      // Colored decorative bands
      const colors = [this.theme.colorPalette.primary, this.theme.colorPalette.secondary, this.theme.colorPalette.accent];
      for (let i = 0; i < 5; i++) {
        g.fillStyle(colors[i % colors.length], 0.1);
        g.fillRect(0, i * 100 + 50, this.cameras.main.width, 20);
      }

      // Pediatric bubble decorations
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * this.cameras.main.width;
        const y = Math.random() * this.cameras.main.height;
        g.fillStyle(colors[Math.floor(Math.random() * colors.length)], 0.05 + Math.random() * 0.1);
        g.fillCircle(x, y, 5 + Math.random() * 15);
      }
      g.strokePath();
      g.setDepth(-10);
    } catch (error) {
      console.error('Error in createHospitalBackground:', error);
    }
  }

  // ---- Scene-specific: Hospital temporary map ---------------------------

  // createHospitalTemporaryMap removed — replaced by tilemap in create()

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

      addZone(100, 200, gs * 4, gs * 4, 'meeting_room');
      addZone(this.cameras.main.width / 2, gs / 2, this.cameras.main.width - 100, gs * 2, 'data_center');
      addZone(this.cameras.main.width - 100, this.cameras.main.height - 100, gs * 5, gs * 3, 'clinical_area');
    } catch (error) {
      console.error('Error in createInteractionZones:', error);
    }
  }

  // ---- Scene-specific: Zone interaction icons ---------------------------

  protected handleZoneInteraction(agent: Agent, zone: Phaser.GameObjects.Zone): void {
    let icon = '❓';
    if (zone.name === 'meeting_room') icon = '👥';
    else if (zone.name === 'data_center') icon = '🖥️';
    else if (zone.name === 'clinical_area') icon = '🏥';
    this.showZoneIcon(agent, icon);
  }
}
