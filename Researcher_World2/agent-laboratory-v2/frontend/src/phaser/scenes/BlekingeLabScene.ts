// frontend/src/phaser/scenes/BlekingeLabScene.ts
//
// Scene del laboratorio Blekinge — estende BaseLabScene con tema scandinavo.
// 6-room layout: Ufficio Prof, IoT Lab, Networking Room, Nordic Lounge, Area Sviluppo, Data Center.

import Phaser from 'phaser';
import { BaseLabScene, LabTheme, AgentConfigEntry } from './BaseLabScene';
import { LabControlsMenu, type LabControlConfig } from '../ui/LabControlsMenu';
import { GlobalAgentController } from '../controllers/GlobalAgentController';
import { DialogEventTracker } from '../controllers/DialogEventTracker';
import { LAB_TYPES } from '../types/LabTypeConstants';
import { THEME_BLEKINGE, TILE } from '../utils/tilesetGenerator';

// ---------------------------------------------------------------------------
// Agent config — aligned with backend PERSONA_REGISTRY["blekinge"]
// Positions placed inside their thematic rooms
// ---------------------------------------------------------------------------
const BLEKINGE_AGENTS: AgentConfigEntry[] = [
  { type: 'professor_senior', name: 'Lars Lindberg',   position: { x: 130, y: 140 }, specialization: 'fl_architecture' },
  { type: 'student',          name: 'Erik Johansson',  position: { x: 400, y: 420 }, specialization: 'communication_efficiency' },
  { type: 'sw_engineer',      name: 'Sara Nilsson',    position: { x: 400, y: 140 }, specialization: 'platform_development' },
  { type: 'engineer',         name: 'Nils Eriksson',   position: { x: 660, y: 140 }, specialization: 'model_optimization' },
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
    this.labTypeId = LAB_TYPES.BLEKINGE;
  }

  // ---- preload ----------------------------------------------------------

  preload(): void {
    super.preload();
    this.setLoadingListeners();

    // Spritesheets specifici Blekinge
    this.load.spritesheet('professor_senior', 'assets/characters/professor_spritesheet.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('student', 'assets/characters/student_spritesheet.png?v=2', { frameWidth: 32, frameHeight: 48 });
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

      // Scene layout: background + tilemap with 6-room grid
      this.createScandinavianBackground();
      this.createLabTilemap(THEME_BLEKINGE, (floor, furn, cols, rows) => {
        const midY = Math.floor(rows / 2);
        const c1 = Math.floor(cols / 3);
        const c2 = Math.floor(2 * cols / 3);

        // --- Perimeter walls ---
        for (let x = 0; x < cols; x++) { furn.putTileAt(TILE.WALL_H, x, 0); furn.putTileAt(TILE.WALL_H, x, rows - 1); }
        for (let y = 1; y < rows - 1; y++) { furn.putTileAt(TILE.WALL, 0, y); furn.putTileAt(TILE.WALL, cols - 1, y); }
        furn.putTileAt(TILE.WALL_CORNER, 0, 0); furn.putTileAt(TILE.WALL_CORNER, cols - 1, 0);
        furn.putTileAt(TILE.WALL_CORNER, 0, rows - 1); furn.putTileAt(TILE.WALL_CORNER, cols - 1, rows - 1);

        // --- Internal dividers ---
        for (let x = 1; x < cols - 1; x++) furn.putTileAt(TILE.WALL_INTERNAL, x, midY);
        for (let y = 1; y < rows - 1; y++) {
          if (y !== midY) {
            furn.putTileAt(TILE.WALL_INTERNAL, c1, y);
            furn.putTileAt(TILE.WALL_INTERNAL, c2, y);
          }
        }

        // --- Doors ---
        furn.putTileAt(TILE.DOOR, c1, Math.floor(midY / 2) + 1);
        furn.putTileAt(TILE.DOOR, c2, Math.floor(midY / 2) + 1);
        furn.putTileAt(TILE.DOOR, c1, midY + Math.floor((rows - midY) / 2));
        furn.putTileAt(TILE.DOOR, c2, midY + Math.floor((rows - midY) / 2));
        furn.putTileAt(TILE.DOOR, Math.floor(c1 / 2) + 1, midY);
        furn.putTileAt(TILE.DOOR, Math.floor((c1 + c2) / 2), midY);
        furn.putTileAt(TILE.DOOR, Math.floor((c2 + cols) / 2), midY);

        // --- Windows along top (Scandinavian: lots of light) ---
        for (let x = 2; x < cols - 2; x += 2) furn.putTileAt(TILE.WINDOW, x, 0);

        // --- Paint room floors ---
        // Top-left: Ufficio Prof (ice blue)
        for (let y = 1; y < midY; y++) for (let x = 1; x < c1; x++) floor.putTileAt(TILE.FLOOR_PROF, x, y);
        // Top-center: IoT Lab
        for (let y = 1; y < midY; y++) for (let x = c1 + 1; x < c2; x++) floor.putTileAt(TILE.FLOOR_RESEARCH, x, y);
        // Top-right: Networking Room
        for (let y = 1; y < midY; y++) for (let x = c2 + 1; x < cols - 1; x++) floor.putTileAt(TILE.FLOOR_SERVER, x, y);
        // Bottom-left: Nordic Lounge
        for (let y = midY + 1; y < rows - 1; y++) for (let x = 1; x < c1; x++) floor.putTileAt(TILE.FLOOR_BREAK, x, y);
        // Bottom-center: Area Sviluppo
        for (let y = midY + 1; y < rows - 1; y++) for (let x = c1 + 1; x < c2; x++) floor.putTileAt(TILE.FLOOR_MEETING, x, y);
        // Bottom-right: Data Center
        for (let y = midY + 1; y < rows - 1; y++) for (let x = c2 + 1; x < cols - 1; x++) floor.putTileAt(TILE.FLOOR_PRIVACY, x, y);

        // --- Furniture per room ---

        // Ufficio Prof: desk, bookshelf, lamp, rug, plant
        furn.putTileAt(TILE.DESK, 2, 2); furn.putTileAt(TILE.CHAIR, 3, 2);
        furn.putTileAt(TILE.BOOKSHELF, 1, 1); furn.putTileAt(TILE.BOOKSHELF, 2, 1);
        furn.putTileAt(TILE.LAMP, c1 - 1, 1);
        furn.putTileAt(TILE.RUG, 3, 3); furn.putTileAt(TILE.RUG, 4, 3);
        furn.putTileAt(TILE.PLANT, 1, midY - 1);

        // IoT Lab: desks, monitors, equipment, whiteboard
        const mx = Math.floor((c1 + c2) / 2);
        furn.putTileAt(TILE.DESK, c1 + 2, 2); furn.putTileAt(TILE.MONITOR, c1 + 3, 2);
        furn.putTileAt(TILE.DESK, c1 + 2, 4); furn.putTileAt(TILE.MONITOR, c1 + 3, 4);
        furn.putTileAt(TILE.EQUIPMENT, mx, 1);
        furn.putTileAt(TILE.WHITEBOARD, mx + 1, 1);
        furn.putTileAt(TILE.PLANT, c2 - 1, 1);

        // Networking Room: servers, UPS, monitors, equipment
        furn.putTileAt(TILE.SERVER, c2 + 2, 1); furn.putTileAt(TILE.SERVER, c2 + 3, 1);
        furn.putTileAt(TILE.SERVER, c2 + 2, 2); furn.putTileAt(TILE.SERVER, c2 + 3, 2);
        furn.putTileAt(TILE.UPS, cols - 2, 1); furn.putTileAt(TILE.UPS, cols - 2, 2);
        furn.putTileAt(TILE.MONITOR, c2 + 1, 3);
        furn.putTileAt(TILE.EQUIPMENT, cols - 2, 3);

        // Nordic Lounge: couches, coffee table, fridge, vending, lamp
        furn.putTileAt(TILE.COUCH, 2, midY + 2); furn.putTileAt(TILE.COUCH, 3, midY + 2);
        furn.putTileAt(TILE.COFFEE_TABLE, 2, midY + 3);
        furn.putTileAt(TILE.FRIDGE, 1, midY + 1);
        furn.putTileAt(TILE.VENDING, c1 - 1, midY + 1);
        furn.putTileAt(TILE.LAMP, c1 - 1, rows - 2);
        furn.putTileAt(TILE.PLANT, 1, rows - 2);
        furn.putTileAt(TILE.RUG, 2, midY + 4); furn.putTileAt(TILE.RUG, 3, midY + 4);

        // Area Sviluppo: desks, bookshelf, printer, lamp, projector
        furn.putTileAt(TILE.DESK, mx - 1, midY + 2); furn.putTileAt(TILE.CHAIR, mx, midY + 2);
        furn.putTileAt(TILE.DESK, mx - 1, midY + 4); furn.putTileAt(TILE.CHAIR, mx, midY + 4);
        furn.putTileAt(TILE.BOOKSHELF, mx + 1, midY + 1);
        furn.putTileAt(TILE.PRINTER, c2 - 1, midY + 1);
        furn.putTileAt(TILE.LAMP, c1 + 1, rows - 2);
        furn.putTileAt(TILE.PROJECTOR, mx, midY + 1);

        // Data Center: servers, UPS, equipment, monitor
        furn.putTileAt(TILE.SERVER, c2 + 2, midY + 1); furn.putTileAt(TILE.SERVER, c2 + 3, midY + 1);
        furn.putTileAt(TILE.SERVER, c2 + 2, midY + 2); furn.putTileAt(TILE.SERVER, c2 + 3, midY + 2);
        furn.putTileAt(TILE.UPS, cols - 2, midY + 1); furn.putTileAt(TILE.UPS, cols - 2, midY + 2);
        furn.putTileAt(TILE.EQUIPMENT, cols - 2, midY + 3);
        furn.putTileAt(TILE.MONITOR, c2 + 1, midY + 3);
        furn.putTileAt(TILE.PLANT, cols - 2, rows - 2);
      });
      this.createInteractionZones();
      this.enableZoneZoom();

      // Agents
      this.createAgentsFromConfig(BLEKINGE_AGENTS);
      this.enableStateIcons();
      this.enableCoffeeBreak();
      this.enableAnalytics();

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
          '• Ottimizzazione IoT e edge computing',
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

  // ---- Scene-specific: 6-room interaction zones -------------------------

  protected createInteractionZones(): void {
    try {
      const gs = 32;
      const cam = this.cameras.main;
      const cols = Math.floor(cam.width / gs);
      const rows = Math.floor(cam.height / gs);
      const midY = Math.floor(rows / 2);
      const c1 = Math.floor(cols / 3);
      const c2 = Math.floor(2 * cols / 3);

      const addZone = (x: number, y: number, w: number, h: number, name: string, label: string) => {
        const z = this.add.zone(x, y, w, h);
        z.setName(name); z.setInteractive();
        this.add.text(x, y - h / 2 + 6, label, {
          fontSize: '9px', color: '#ffffff', backgroundColor: '#00000088',
          padding: { left: 4, right: 4, top: 2, bottom: 2 }
        }).setOrigin(0.5, 0).setDepth(5);
        this.interactionZones.push(z);
      };

      const addZoneBottom = (x: number, y: number, w: number, h: number, name: string, label: string) => {
        const z = this.add.zone(x, y, w, h);
        z.setName(name); z.setInteractive();
        this.add.text(x, y + h / 2 - 6, label, {
          fontSize: '9px', color: '#ffffff', backgroundColor: '#00000088',
          padding: { left: 4, right: 4, top: 2, bottom: 2 }
        }).setOrigin(0.5, 1).setDepth(5);
        this.interactionZones.push(z);
      };

      const roomCX = (x0: number, x1: number) => ((x0 + x1) / 2) * gs;
      const roomCY = (y0: number, y1: number) => ((y0 + y1) / 2) * gs;
      const roomW = (x0: number, x1: number) => (x1 - x0) * gs;
      const roomH = (y0: number, y1: number) => (y1 - y0) * gs;

      // Top-left: Ufficio Prof.
      addZoneBottom(roomCX(1, c1), roomCY(1, midY), roomW(1, c1), roomH(1, midY), 'professor_office', 'Ufficio Prof.');
      // Top-center: IoT Lab
      addZoneBottom(roomCX(c1 + 1, c2), roomCY(1, midY), roomW(c1 + 1, c2), roomH(1, midY), 'iot_lab', 'IoT Lab');
      // Top-right: Networking Room
      addZoneBottom(roomCX(c2 + 1, cols - 1), roomCY(1, midY), roomW(c2 + 1, cols - 1), roomH(1, midY), 'networking_room', 'Networking Room');
      // Bottom-left: Nordic Lounge
      addZone(roomCX(1, c1), roomCY(midY + 1, rows - 1), roomW(1, c1), roomH(midY + 1, rows - 1), 'break_room', 'Nordic Lounge');
      // Bottom-center: Area Sviluppo
      addZone(roomCX(c1 + 1, c2), roomCY(midY + 1, rows - 1), roomW(c1 + 1, c2), roomH(midY + 1, rows - 1), 'development_area', 'Area Sviluppo');
      // Bottom-right: Data Center
      addZone(roomCX(c2 + 1, cols - 1), roomCY(midY + 1, rows - 1), roomW(c2 + 1, cols - 1), roomH(midY + 1, rows - 1), 'data_center', 'Data Center');
    } catch (error) {
      console.error('Error in createInteractionZones:', error);
    }
  }

}
