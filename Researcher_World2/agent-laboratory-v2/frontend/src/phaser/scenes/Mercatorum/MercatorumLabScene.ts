// src/phaser/scenes/Mercatorum/MercatorumLabScene.ts
//
// Scene del laboratorio Mercatorum — estende BaseLabScene con tema italiano classico.

import Phaser from 'phaser';
import { BaseLabScene, LabTheme, AgentConfigEntry } from '../BaseLabScene';
import { LabControlsMenu, type LabControlConfig } from '../../ui/LabControlsMenu';
import { GlobalAgentController } from '../../controllers/GlobalAgentController';
import { DialogEventTracker } from '../../controllers/DialogEventTracker';
import { LAB_TYPES } from '../../types/LabTypeConstants';
import { THEME_MERCATORUM, TILE } from '../../utils/tilesetGenerator';

// ---------------------------------------------------------------------------
// Agent config — aligned with backend PERSONA_REGISTRY["mercatorum"]
// Positions placed inside their thematic rooms
// ---------------------------------------------------------------------------
const MERCATORUM_AGENTS: AgentConfigEntry[] = [
  { type: 'professor_portrait',          name: 'Elena Conti',   position: { x: 130, y: 140 }, specialization: 'privacy_economics' },
  { type: 'privacy_specialist_portrait', name: 'Luca Bianchi',  position: { x: 660, y: 140 }, specialization: 'compliance_verification' },
  { type: 'student',                     name: 'Marco Rossi',   position: { x: 400, y: 420 }, specialization: 'data_science' },
  { type: 'researcher',                  name: 'Sofia Greco',   position: { x: 400, y: 140 }, specialization: 'privacy_engineering' },
];

// Portrait types use high-res images (unique keys to avoid conflict with WorldMapScene spritesheets)
const PORTRAIT_TYPES = ['professor_portrait', 'privacy_specialist_portrait'];
// Spritesheet types for animations/placeholders
const SPRITESHEET_TYPES = ['student', 'researcher'];

const TYPE_COLORS: Record<string, { main: string; accent: string }> = {
  student:    { main: '#FB8C00', accent: '#E65100' },
  researcher: { main: '#43A047', accent: '#2E7D32' },
};

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
export class MercatorumLabScene extends BaseLabScene {

  public theme: LabTheme = {
    name: 'Università Mercatorum Lab',
    backgroundColor: 0xd2691e,
    tilesetKey: 'tiles_mercatorum',
    colorPalette: { primary: 0xd2691e, secondary: 0x1a365d, accent: 0xf5f5dc, background: 0xd2691e },
  };

  constructor() {
    super('MercatorumLabScene');
  }

  // ---- preload ----------------------------------------------------------

  preload(): void {
    super.preload();
    this.setLoadingListeners();

    // Portrait types: high-res images with unique keys (avoid conflict with WorldMapScene)
    this.load.image('professor_portrait', 'assets/sprites/1024x1536/_Professor3.png');
    this.load.image('privacy_specialist_portrait', 'assets/sprites/1024x1536/_Manager.png');

    // Spritesheet types: pixel-art standard
    this.load.spritesheet('student', 'assets/characters/student_spritesheet.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('researcher', 'assets/characters/researcher_spritesheet.png', { frameWidth: 32, frameHeight: 48 });

    // Assets lab-specific
    this.load.image('mercatorum_background', 'assets/labs/mercatorum/background.png');
    this.load.image('mercatorum_furniture', 'assets/labs/mercatorum/furniture.png');
    this.load.image('mercatorum-logo', 'assets/ui/mercatorum-logo.png');
    this.load.json('labAgentTypesConfig', 'assets/config/labAgentTypes.json');
  }

  // ---- create -----------------------------------------------------------

  create(): void {
    console.log('MercatorumLabScene create START');
    try {
      // Debug (hidden)
      this.createDebugElements();
      if (this.debugGraphics) this.debugGraphics.setVisible(false);
      if (this.debugText) this.debugText.setVisible(false);

      // Brief magenta flash for debug, then real background
      this.cameras.main.setBackgroundColor(0xFF00FF);
      setTimeout(() => this.cameras.main.setBackgroundColor(this.theme.backgroundColor), 1000);

      // Textures & animations (only spritesheet types)
      this.createImprovedPlaceholders(SPRITESHEET_TYPES, TYPE_COLORS);
      this.runTextureDebug();
      this.displayLoadedAssets();
      this.createMissingTextures(SPRITESHEET_TYPES);
      this.createAllCharacterAnimations(SPRITESHEET_TYPES);

      // Scene layout: background + tilemap with 6-room grid
      this.createItalianClassicBackground();
      this.createLabTilemap(THEME_MERCATORUM, (floor, furn, cols, rows) => {
        // --- Layout constants ---
        const midY = Math.floor(rows / 2);      // horizontal divider row
        const c1 = Math.floor(cols / 3);         // first vertical divider col
        const c2 = Math.floor(2 * cols / 3);     // second vertical divider col

        // --- Perimeter walls ---
        for (let x = 0; x < cols; x++) { furn.putTileAt(TILE.WALL_H, x, 0); furn.putTileAt(TILE.WALL_H, x, rows - 1); }
        for (let y = 1; y < rows - 1; y++) { furn.putTileAt(TILE.WALL, 0, y); furn.putTileAt(TILE.WALL, cols - 1, y); }
        furn.putTileAt(TILE.WALL_CORNER, 0, 0); furn.putTileAt(TILE.WALL_CORNER, cols - 1, 0);
        furn.putTileAt(TILE.WALL_CORNER, 0, rows - 1); furn.putTileAt(TILE.WALL_CORNER, cols - 1, rows - 1);

        // --- Internal dividers (horizontal at midY, vertical at c1 & c2) ---
        for (let x = 1; x < cols - 1; x++) furn.putTileAt(TILE.WALL_INTERNAL, x, midY);
        for (let y = 1; y < rows - 1; y++) {
          if (y !== midY) { // leave gap at intersection
            furn.putTileAt(TILE.WALL_INTERNAL, c1, y);
            furn.putTileAt(TILE.WALL_INTERNAL, c2, y);
          }
        }
        // Doors in dividers
        furn.putTileAt(TILE.DOOR, c1, Math.floor(midY / 2) + 1);
        furn.putTileAt(TILE.DOOR, c2, Math.floor(midY / 2) + 1);
        furn.putTileAt(TILE.DOOR, c1, midY + Math.floor((rows - midY) / 2));
        furn.putTileAt(TILE.DOOR, c2, midY + Math.floor((rows - midY) / 2));
        furn.putTileAt(TILE.DOOR, Math.floor(c1 / 2) + 1, midY);
        furn.putTileAt(TILE.DOOR, Math.floor((c1 + c2) / 2), midY);
        furn.putTileAt(TILE.DOOR, Math.floor((c2 + cols) / 2), midY);

        // --- Paint room floors ---
        // Top-left: Ufficio Prof (amber)
        for (let y = 1; y < midY; y++) for (let x = 1; x < c1; x++) floor.putTileAt(TILE.FLOOR_PROF, x, y);
        // Top-center: Meeting Room (blue)
        for (let y = 1; y < midY; y++) for (let x = c1 + 1; x < c2; x++) floor.putTileAt(TILE.FLOOR_MEETING, x, y);
        // Top-right: Privacy Lab (purple)
        for (let y = 1; y < midY; y++) for (let x = c2 + 1; x < cols - 1; x++) floor.putTileAt(TILE.FLOOR_PRIVACY, x, y);
        // Bottom-left: Break Room (warm)
        for (let y = midY + 1; y < rows - 1; y++) for (let x = 1; x < c1; x++) floor.putTileAt(TILE.FLOOR_BREAK, x, y);
        // Bottom-center: Area Ricerca (teal)
        for (let y = midY + 1; y < rows - 1; y++) for (let x = c1 + 1; x < c2; x++) floor.putTileAt(TILE.FLOOR_RESEARCH, x, y);
        // Bottom-right: Server Room (green)
        for (let y = midY + 1; y < rows - 1; y++) for (let x = c2 + 1; x < cols - 1; x++) floor.putTileAt(TILE.FLOOR_SERVER, x, y);

        // --- Furniture per room ---
        // Ufficio Prof: desk, bookshelf, lamp, painting, rug
        furn.putTileAt(TILE.DESK, 2, 2); furn.putTileAt(TILE.CHAIR, 3, 2);
        furn.putTileAt(TILE.BOOKSHELF, 1, 1); furn.putTileAt(TILE.BOOKSHELF, 2, 1);
        furn.putTileAt(TILE.PLANT, 1, midY - 1);
        furn.putTileAt(TILE.LAMP, c1 - 1, 1);
        furn.putTileAt(TILE.PAINTING, c1 - 1, 2);
        furn.putTileAt(TILE.RUG, 3, 3); furn.putTileAt(TILE.RUG, 4, 3);

        // Meeting Room: central table, whiteboard, projector, extra chairs
        const mx = Math.floor((c1 + c2) / 2);
        const my = Math.floor(midY / 2);
        for (let dx = -1; dx <= 1; dx++) furn.putTileAt(TILE.TABLE, mx + dx, my);
        furn.putTileAt(TILE.CHAIR, mx - 2, my); furn.putTileAt(TILE.CHAIR, mx + 2, my);
        furn.putTileAt(TILE.CHAIR, mx - 1, my + 1); furn.putTileAt(TILE.CHAIR, mx + 1, my + 1);
        furn.putTileAt(TILE.WHITEBOARD, mx, 1);
        furn.putTileAt(TILE.PROJECTOR, mx, my - 2);
        furn.putTileAt(TILE.PLANT, c2 - 1, 1);

        // Privacy Lab: desks, server, monitor, printer
        furn.putTileAt(TILE.DESK, c2 + 2, 2); furn.putTileAt(TILE.CHAIR, c2 + 3, 2);
        furn.putTileAt(TILE.DESK, c2 + 2, 4); furn.putTileAt(TILE.CHAIR, c2 + 3, 4);
        furn.putTileAt(TILE.MONITOR, cols - 2, 1);
        furn.putTileAt(TILE.PRINTER, cols - 2, 3);
        furn.putTileAt(TILE.BOOKSHELF, c2 + 1, 1);

        // Break Room: couch, coffee table, fridge, vending machine, plant
        furn.putTileAt(TILE.COUCH, 2, midY + 2); furn.putTileAt(TILE.COUCH, 3, midY + 2);
        furn.putTileAt(TILE.COFFEE_TABLE, 2, midY + 3);
        furn.putTileAt(TILE.FRIDGE, 1, midY + 1);
        furn.putTileAt(TILE.VENDING, c1 - 1, midY + 1);
        furn.putTileAt(TILE.PLANT, 1, rows - 2);
        furn.putTileAt(TILE.LAMP, c1 - 1, rows - 2);

        // Area Ricerca: desks, bookshelf, printer, lamp
        furn.putTileAt(TILE.DESK, mx - 1, midY + 2); furn.putTileAt(TILE.CHAIR, mx, midY + 2);
        furn.putTileAt(TILE.DESK, mx - 1, midY + 4); furn.putTileAt(TILE.CHAIR, mx, midY + 4);
        furn.putTileAt(TILE.BOOKSHELF, mx + 1, midY + 1);
        furn.putTileAt(TILE.PRINTER, c2 - 1, midY + 1);
        furn.putTileAt(TILE.LAMP, c1 + 1, rows - 2);
        furn.putTileAt(TILE.PLANT, c2 - 1, rows - 2);

        // Server Room: servers, equipment, UPS, monitor
        furn.putTileAt(TILE.SERVER, c2 + 2, midY + 1); furn.putTileAt(TILE.SERVER, c2 + 3, midY + 1);
        furn.putTileAt(TILE.SERVER, c2 + 2, midY + 2); furn.putTileAt(TILE.SERVER, c2 + 3, midY + 2);
        furn.putTileAt(TILE.EQUIPMENT, cols - 2, midY + 1);
        furn.putTileAt(TILE.UPS, cols - 2, midY + 2);
        furn.putTileAt(TILE.UPS, cols - 2, midY + 3);
        furn.putTileAt(TILE.MONITOR, c2 + 1, midY + 3);
        furn.putTileAt(TILE.PLANT, cols - 2, rows - 2);
      });
      // Skip createArenaZones — Mercatorum has its own room layout above
      this.createInteractionZones();
      this.enableZoneZoom();

      // Agents (scale computed dynamically from AGENT_TARGET_HEIGHT)
      this.createAgentsFromConfig(MERCATORUM_AGENTS, PORTRAIT_TYPES);
      this.enableStateIcons();
      this.enableCoffeeBreak();

      // Camera
      this.setupCamera();

      // LLM status indicator (bottom-left)
      this.createLLMStatusIndicator();

      // Controllers
      this.dialogEventTracker = new DialogEventTracker(this);
      this.agentController = new GlobalAgentController(this, LAB_TYPES.MERCATORUM);
      this.agentController.setSimulationAgents(this.agents);
      this.agentController.initDebugger();

      // Lab controls panel
      const controlConfig: LabControlConfig = {
        labId: 'mercatorum',
        labName: 'Università Mercatorum Lab',
        labDescription:
          'Laboratorio di ricerca specializzato in business intelligence\n' +
          'e analisi finanziaria federata.\n\n' +
          'Specializzazione in:\n' +
          '• Business intelligence e analisi finanziaria federata\n' +
          '• Privacy-preserving analytics per dati aziendali sensibili\n' +
          '• Compliance GDPR e framework regolatori\n' +
          '• Ottimizzazione di modelli federati per previsioni di mercato',
        theme: { primary: this.theme.colorPalette.primary, secondary: 0x1a1a2e, accent: 0xf5f5dc },
        navigation: [
          { label: '→ Vai a Blekinge Lab', sceneKey: 'BlekingeLabScene' },
          { label: '→ Vai a OPBG Lab', sceneKey: 'OPBGLabScene' },
        ],
      };
      this.labControlsMenu = new LabControlsMenu(this, controlConfig);
      const dc = this.agentController.getDialogController();
      if (dc) this.labControlsMenu.setDialogController(dc);

      // Title
      this.create3DTitle('Università Mercatorum Lab', '#f5f5dc', 'serif');

      console.log('MercatorumLabScene create COMPLETE');
    } catch (error) {
      console.error('Error in MercatorumLabScene create:', error);
    }
  }

  // ---- update -----------------------------------------------------------

  update(time: number, delta: number): void {
    try {
      this.updateAgents(time, delta);
      this.checkInteractions();
    } catch (error) {
      console.error('Error in MercatorumLabScene update:', error);
    }
  }

  // ---- Scene-specific: Italian classic background -----------------------

  private createItalianClassicBackground(): void {
    try {
      if (this.textures.exists('mercatorum_background')) {
        const bg = this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'mercatorum_background');
        bg.setDepth(-10);
        const scaleX = this.cameras.main.width / bg.width;
        const scaleY = this.cameras.main.height / bg.height;
        bg.setScale(Math.max(scaleX, scaleY));
        return;
      }

      // Fallback: Italian classic geometric pattern
      const g = this.add.graphics();
      g.fillStyle(this.theme.backgroundColor, 1);
      g.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

      // Roman arch pattern
      g.lineStyle(2, 0xf5f5dc, 0.3);
      const archW = 80, archH = 40;
      for (let x = -archW / 2; x < this.cameras.main.width + archW / 2; x += archW) {
        for (let y = 0; y < this.cameras.main.height; y += archH * 2) {
          g.beginPath();
          g.moveTo(x, y + archH);
          g.arc(x + archW / 2, y + archH, archW / 2, Math.PI, 0);
          g.stroke();
        }
      }

      // Laurel leaf pattern
      g.fillStyle(this.theme.colorPalette.accent, 0.2);
      for (let x = 40; x < this.cameras.main.width; x += 120) {
        for (let y = 60; y < this.cameras.main.height; y += 120) {
          g.fillCircle(x, y, 15);
          g.fillCircle(x + 10, y - 5, 10);
          g.fillCircle(x - 10, y - 5, 10);
        }
      }
      g.strokePath();
      g.setDepth(-10);
    } catch (error) {
      console.error('Error in createItalianClassicBackground:', error);
    }
  }

  // ---- Scene-specific: 6-room interaction zones --------------------------

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

      // Variant with label at bottom-center of the room (for rooms obscured by scene title)
      const addZoneCustomLabel = (x: number, y: number, w: number, h: number, name: string, label: string) => {
        const z = this.add.zone(x, y, w, h);
        z.setName(name); z.setInteractive();
        this.add.text(x, y + h / 2 - 6, label, {
          fontSize: '9px', color: '#ffffff', backgroundColor: '#00000088',
          padding: { left: 4, right: 4, top: 2, bottom: 2 }
        }).setOrigin(0.5, 1).setDepth(5);
        this.interactionZones.push(z);
      };

      // Room center helpers (pixel coords)
      const roomCX = (x0: number, x1: number) => ((x0 + x1) / 2) * gs;
      const roomCY = (y0: number, y1: number) => ((y0 + y1) / 2) * gs;
      const roomW = (x0: number, x1: number) => (x1 - x0) * gs;
      const roomH = (y0: number, y1: number) => (y1 - y0) * gs;

      // Top-left: Ufficio Prof. (label centrata sulla porta verso Break Room)
      {
        const px = roomCX(1, c1), py = roomCY(1, midY);
        const pw = roomW(1, c1), ph = roomH(1, midY);
        const doorX = (Math.floor(c1 / 2) + 1) * gs + gs / 2; // centro porta nel divider midY
        const z = this.add.zone(px, py, pw, ph);
        z.setName('professor_office'); z.setInteractive();
        this.add.text(doorX, py + ph / 2 - 6, 'Ufficio Prof.', {
          fontSize: '9px', color: '#ffffff', backgroundColor: '#00000088',
          padding: { left: 4, right: 4, top: 2, bottom: 2 }
        }).setOrigin(0.5, 1).setDepth(5);
        this.interactionZones.push(z);
      }
      // Top-center: Meeting Room (label shifted down to avoid scene title overlap)
      addZoneCustomLabel(roomCX(c1 + 1, c2), roomCY(1, midY), roomW(c1 + 1, c2), roomH(1, midY), 'meeting_room', 'Meeting Room');
      // Top-right: Privacy Lab (label shifted down to avoid scene title overlap)
      addZoneCustomLabel(roomCX(c2 + 1, cols - 1), roomCY(1, midY), roomW(c2 + 1, cols - 1), roomH(1, midY), 'privacy_lab', 'Privacy Lab');
      // Bottom-left: Break Room (label centrata sulla porta orizzontale)
      {
        const bx = roomCX(1, c1), by = roomCY(midY + 1, rows - 1);
        const bw = roomW(1, c1), bh = roomH(midY + 1, rows - 1);
        const doorX = (Math.floor(c1 / 2) + 1) * gs + gs / 2; // centro porta nel divider
        const z = this.add.zone(bx, by, bw, bh);
        z.setName('break_room'); z.setInteractive();
        this.add.text(doorX, by - bh / 2 + 6, 'Break Room', {
          fontSize: '9px', color: '#ffffff', backgroundColor: '#00000088',
          padding: { left: 4, right: 4, top: 2, bottom: 2 }
        }).setOrigin(0.5, 0).setDepth(5);
        this.interactionZones.push(z);
      }
      // Bottom-center: Area Ricerca
      addZone(roomCX(c1 + 1, c2), roomCY(midY + 1, rows - 1), roomW(c1 + 1, c2), roomH(midY + 1, rows - 1), 'research_area', 'Area Ricerca');
      // Bottom-right: Server Room
      addZone(roomCX(c2 + 1, cols - 1), roomCY(midY + 1, rows - 1), roomW(c2 + 1, cols - 1), roomH(midY + 1, rows - 1), 'server_room', 'Server Room');
    } catch (error) {
      console.error('Error in createInteractionZones:', error);
    }
  }

}
