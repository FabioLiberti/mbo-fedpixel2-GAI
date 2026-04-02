// frontend/src/phaser/scenes/OPBGLabScene.ts
//
// Scene del laboratorio OPBG — estende BaseLabScene con tema ospedaliero pediatrico.
// 6-room layout: Ufficio Medico, Data Room, Sala Consulto, Area Relax, Lab Analisi, Server Clinico.

import Phaser from 'phaser';
import { BaseLabScene, LabTheme, AgentConfigEntry } from './BaseLabScene';
import { LabControlsMenu, type LabControlConfig } from '../ui/LabControlsMenu';
import { GlobalAgentController } from '../controllers/GlobalAgentController';
import { DialogEventTracker } from '../controllers/DialogEventTracker';
import { LAB_TYPES } from '../types/LabTypeConstants';
import { THEME_OPBG, TILE } from '../utils/tilesetGenerator';

// ---------------------------------------------------------------------------
// Agent config — aligned with backend PERSONA_REGISTRY["opbg"]
// Positions placed inside their thematic rooms
// ---------------------------------------------------------------------------
const OPBG_AGENTS: AgentConfigEntry[] = [
  { type: 'doctor',         name: 'Matteo Ferri',     position: { x: 130, y: 140 }, specialization: 'clinical_data' },
  { type: 'student_postdoc', name: 'Marco Romano',    position: { x: 400, y: 420 }, specialization: 'data_science' },
  { type: 'engineer',       name: 'Lorenzo Mancini',  position: { x: 660, y: 140 }, specialization: 'model_optimization' },
  { type: 'researcher',     name: 'Giulia Conti',     position: { x: 400, y: 140 }, specialization: 'privacy_engineering' },
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
    this.labTypeId = LAB_TYPES.OPBG;
  }

  // ---- preload ----------------------------------------------------------

  preload(): void {
    super.preload();
    this.setLoadingListeners();

    // Spritesheets specifici OPBG
    this.load.spritesheet('doctor', 'assets/characters/doctor_spritesheet.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('student_postdoc', 'assets/characters/student_spritesheet.png?v=2', { frameWidth: 32, frameHeight: 48 });
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

      // Scene layout: background + tilemap with 6-room grid
      this.createHospitalBackground();
      this.createLabTilemap(THEME_OPBG, (floor, furn, cols, rows) => {
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

        // --- Windows along top ---
        for (let x = 2; x < cols - 2; x += 2) furn.putTileAt(TILE.WINDOW, x, 0);

        // --- Paint room floors ---
        // Top-left: Ufficio Medico (mint green)
        for (let y = 1; y < midY; y++) for (let x = 1; x < c1; x++) floor.putTileAt(TILE.FLOOR_PROF, x, y);
        // Top-center: Data Room (teal)
        for (let y = 1; y < midY; y++) for (let x = c1 + 1; x < c2; x++) floor.putTileAt(TILE.FLOOR_PRIVACY, x, y);
        // Top-right: Sala Consulto (meeting)
        for (let y = 1; y < midY; y++) for (let x = c2 + 1; x < cols - 1; x++) floor.putTileAt(TILE.FLOOR_MEETING, x, y);
        // Bottom-left: Area Relax (warm)
        for (let y = midY + 1; y < rows - 1; y++) for (let x = 1; x < c1; x++) floor.putTileAt(TILE.FLOOR_BREAK, x, y);
        // Bottom-center: Lab Analisi (research)
        for (let y = midY + 1; y < rows - 1; y++) for (let x = c1 + 1; x < c2; x++) floor.putTileAt(TILE.FLOOR_RESEARCH, x, y);
        // Bottom-right: Server Clinico (server)
        for (let y = midY + 1; y < rows - 1; y++) for (let x = c2 + 1; x < cols - 1; x++) floor.putTileAt(TILE.FLOOR_SERVER, x, y);

        // --- Furniture per room ---

        // Ufficio Medico: desk, bookshelf, cabinet, lamp, plant, painting
        furn.putTileAt(TILE.DESK, 2, 2); furn.putTileAt(TILE.CHAIR, 3, 2);
        furn.putTileAt(TILE.BOOKSHELF, 1, 1);
        furn.putTileAt(TILE.CABINET, 2, 1);
        furn.putTileAt(TILE.LAMP, c1 - 1, 1);
        furn.putTileAt(TILE.PAINTING, c1 - 1, 2);
        furn.putTileAt(TILE.PLANT, 1, midY - 1);
        furn.putTileAt(TILE.RUG, 3, 3);

        // Data Room: desks, monitors, server, equipment, printer
        furn.putTileAt(TILE.DESK, c1 + 2, 2); furn.putTileAt(TILE.MONITOR, c1 + 3, 2);
        furn.putTileAt(TILE.DESK, c1 + 2, 4); furn.putTileAt(TILE.MONITOR, c1 + 3, 4);
        furn.putTileAt(TILE.SERVER, c2 - 1, 1);
        furn.putTileAt(TILE.EQUIPMENT, c2 - 1, 2);
        furn.putTileAt(TILE.PRINTER, c1 + 1, 1);

        // Sala Consulto: table, chairs, whiteboard, projector, plant
        const mx2 = Math.floor((c2 + cols - 1) / 2);
        const my = Math.floor(midY / 2);
        for (let dx = -1; dx <= 1; dx++) furn.putTileAt(TILE.TABLE, mx2 + dx, my);
        furn.putTileAt(TILE.CHAIR, mx2 - 2, my); furn.putTileAt(TILE.CHAIR, mx2 + 2, my);
        furn.putTileAt(TILE.CHAIR, mx2 - 1, my + 1); furn.putTileAt(TILE.CHAIR, mx2 + 1, my + 1);
        furn.putTileAt(TILE.WHITEBOARD, mx2, 1);
        furn.putTileAt(TILE.PROJECTOR, mx2, my - 2);
        furn.putTileAt(TILE.PLANT, cols - 2, 1);

        // Area Relax: couches, coffee table, fridge, vending, plants
        furn.putTileAt(TILE.COUCH, 2, midY + 2); furn.putTileAt(TILE.COUCH, 3, midY + 2);
        furn.putTileAt(TILE.COFFEE_TABLE, 2, midY + 3);
        furn.putTileAt(TILE.FRIDGE, 1, midY + 1);
        furn.putTileAt(TILE.VENDING, c1 - 1, midY + 1);
        furn.putTileAt(TILE.PLANT, 1, rows - 2);
        furn.putTileAt(TILE.PLANT, c1 - 1, rows - 2);
        furn.putTileAt(TILE.RUG, 2, midY + 4); furn.putTileAt(TILE.RUG, 3, midY + 4);

        // Lab Analisi: desks, equipment, cabinet, bookshelf, lamp
        const mx = Math.floor((c1 + c2) / 2);
        furn.putTileAt(TILE.DESK, mx - 1, midY + 2); furn.putTileAt(TILE.CHAIR, mx, midY + 2);
        furn.putTileAt(TILE.DESK, mx - 1, midY + 4); furn.putTileAt(TILE.CHAIR, mx, midY + 4);
        furn.putTileAt(TILE.EQUIPMENT, mx + 1, midY + 1);
        furn.putTileAt(TILE.CABINET, c2 - 1, midY + 1);
        furn.putTileAt(TILE.BOOKSHELF, c1 + 1, midY + 1);
        furn.putTileAt(TILE.LAMP, c1 + 1, rows - 2);

        // Server Clinico: servers, UPS, equipment, monitor
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
      this.createAgentsFromConfig(OPBG_AGENTS);
      this.enableStateIcons();
      this.enableCoffeeBreak();
      this.enableAnalytics();

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
          '• Equita e bias nei modelli clinici\n' +
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

      // Top-left: Ufficio Medico
      addZoneBottom(roomCX(1, c1), roomCY(1, midY), roomW(1, c1), roomH(1, midY), 'medical_office', 'Ufficio Medico');
      // Top-center: Data Room
      addZoneBottom(roomCX(c1 + 1, c2), roomCY(1, midY), roomW(c1 + 1, c2), roomH(1, midY), 'data_room', 'Data Room');
      // Top-right: Sala Consulto
      addZoneBottom(roomCX(c2 + 1, cols - 1), roomCY(1, midY), roomW(c2 + 1, cols - 1), roomH(1, midY), 'consultation_room', 'Sala Consulto');
      // Bottom-left: Area Relax
      addZone(roomCX(1, c1), roomCY(midY + 1, rows - 1), roomW(1, c1), roomH(midY + 1, rows - 1), 'break_room', 'Area Relax');
      // Bottom-center: Lab Analisi
      addZone(roomCX(c1 + 1, c2), roomCY(midY + 1, rows - 1), roomW(c1 + 1, c2), roomH(midY + 1, rows - 1), 'analysis_lab', 'Lab Analisi');
      // Bottom-right: Server Clinico
      addZone(roomCX(c2 + 1, cols - 1), roomCY(midY + 1, rows - 1), roomW(c2 + 1, cols - 1), roomH(midY + 1, rows - 1), 'clinical_server', 'Server Clinico');
    } catch (error) {
      console.error('Error in createInteractionZones:', error);
    }
  }

}
