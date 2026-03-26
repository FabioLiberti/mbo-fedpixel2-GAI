// src/phaser/scenes/Mercatorum/MercatorumLabScene.ts
//
// Scene del laboratorio Mercatorum — estende BaseLabScene con tema italiano classico.

import Phaser from 'phaser';
import { BaseLabScene, LabTheme, AgentConfigEntry } from '../BaseLabScene';
import { Agent } from '../../sprites/Agent';
import { LabControlsMenu, type LabControlConfig } from '../../ui/LabControlsMenu';
import { GlobalAgentController } from '../../controllers/GlobalAgentController';
import { DialogEventTracker } from '../../controllers/DialogEventTracker';
import { LAB_TYPES } from '../../types/LabTypeConstants';
import { THEME_MERCATORUM, TILE } from '../../utils/tilesetGenerator';

// ---------------------------------------------------------------------------
// Agent config — aligned with backend PERSONA_REGISTRY["mercatorum"]
// ---------------------------------------------------------------------------
const MERCATORUM_AGENTS: AgentConfigEntry[] = [
  { type: 'professor',          name: 'Elena Conti',   position: { x: 150, y: 200 }, specialization: 'privacy_economics' },
  { type: 'privacy_specialist', name: 'Luca Bianchi',  position: { x: 300, y: 250 }, specialization: 'compliance_verification' },
  { type: 'student',            name: 'Marco Rossi',   position: { x: 200, y: 150 }, specialization: 'data_science' },
  { type: 'researcher',         name: 'Sofia Greco',   position: { x: 350, y: 180 }, specialization: 'privacy_engineering' },
];

// Only spritesheet types get placeholder/animations; portrait types are static images
const SPRITESHEET_TYPES = ['student', 'researcher'];
const PORTRAIT_TYPES = ['professor', 'privacy_specialist'];

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

    // Mercatorum: professor e privacy_specialist usano ritratti come immagini statiche
    this.load.image('professor', 'assets/sprites/1024x1536/_Professor3.png');
    this.load.image('privacy_specialist', 'assets/sprites/1024x1536/_Manager.png');

    // student e researcher usano spritesheets pixel-art standard
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

      // Scene layout: background + tilemap
      this.createItalianClassicBackground();
      this.createLabTilemap(THEME_MERCATORUM, (floor, furn, cols, rows) => {
        // Walls around perimeter
        for (let x = 0; x < cols; x++) { furn.putTileAt(TILE.WALL_H, x, 0); furn.putTileAt(TILE.WALL_H, x, rows - 1); }
        for (let y = 1; y < rows - 1; y++) { furn.putTileAt(TILE.WALL, 0, y); furn.putTileAt(TILE.WALL, cols - 1, y); }
        furn.putTileAt(TILE.WALL_CORNER, 0, 0); furn.putTileAt(TILE.WALL_CORNER, cols - 1, 0);
        furn.putTileAt(TILE.WALL_CORNER, 0, rows - 1); furn.putTileAt(TILE.WALL_CORNER, cols - 1, rows - 1);
        // Bookshelves along top wall
        for (let x = 2; x < cols - 2; x++) furn.putTileAt(TILE.BOOKSHELF, x, 1);
        // Doors
        furn.putTileAt(TILE.DOOR, Math.floor(cols / 2), rows - 1);
        // Desks along left/right walls
        for (let y = 3; y < rows - 3; y += 3) {
          furn.putTileAt(TILE.DESK, 1, y); furn.putTileAt(TILE.CHAIR, 2, y);
          furn.putTileAt(TILE.DESK, cols - 2, y); furn.putTileAt(TILE.CHAIR, cols - 3, y);
        }
        // Central meeting table
        const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
        for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) furn.putTileAt(TILE.TABLE, cx + dx, cy + dy);
        // Rug under table area
        for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 2; dy++) {
          const tx = cx + dx, ty = cy + dy;
          if (!furn.getTileAt(tx, ty) || furn.getTileAt(tx, ty)!.index === -1) floor.putTileAt(TILE.RUG, tx, ty);
        }
        // Plants in corners
        furn.putTileAt(TILE.PLANT, 1, rows - 2); furn.putTileAt(TILE.PLANT, cols - 2, rows - 2);
        // Server rack
        furn.putTileAt(TILE.SERVER, 1, 1); furn.putTileAt(TILE.SERVER, 1, 2);
        // Whiteboard
        furn.putTileAt(TILE.WHITEBOARD, Math.floor(cols / 2) - 1, 1); furn.putTileAt(TILE.WHITEBOARD, Math.floor(cols / 2) + 1, 1);
      });
      this.createInteractionZones();

      // Agents (portrait types get 0.15 scale, spritesheets get 5.0)
      this.createAgentsFromConfig(MERCATORUM_AGENTS, PORTRAIT_TYPES);

      // Camera
      this.setupCamera();

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
      this.createMercatorumTitle();

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

      addZone(this.cameras.main.width / 2, this.cameras.main.height / 2, gs * 4, gs * 3, 'meeting_table');
      addZone(this.cameras.main.width / 2, gs, this.cameras.main.width - 100, gs * 2, 'library');
      addZone(100, 300, gs * 4, gs * 4, 'financial_data');
    } catch (error) {
      console.error('Error in createInteractionZones:', error);
    }
  }

  // ---- Scene-specific: Zone interaction icons ---------------------------

  protected handleZoneInteraction(agent: Agent, zone: Phaser.GameObjects.Zone): void {
    try {
      let icon = '💭';
      if (zone.name === 'meeting_table') icon = '👥';
      else if (zone.name === 'library') icon = '📚';
      else if (zone.name === 'financial_data') icon = '📊';

      const t = this.add.text(agent.x, agent.y - 30, icon, { fontSize: '24px' });
      t.setOrigin(0.5); t.setDepth(100);
      this.time.delayedCall(1500, () => t.destroy());
    } catch (error) {
      console.error('Error in handleZoneInteraction:', error);
    }
  }

  // ---- Scene-specific: Italian styled title -----------------------------

  private createMercatorumTitle(): void {
    try {
      const titleContainer = this.add.container(this.cameras.main.centerX, 25);
      titleContainer.setDepth(10);

      const tempText = this.add.text(0, 0, 'Università Mercatorum Lab', { fontSize: '40px', fontFamily: 'serif', fontStyle: 'bold' });
      const textWidth = tempText.width + 60;
      const textHeight = tempText.height + 20;
      tempText.destroy();

      // Terracotta background with cream border
      const bg = this.add.graphics();
      bg.fillStyle(0x7b5c3e, 0.9);
      bg.fillRoundedRect(-textWidth / 2 - 5, -textHeight / 2 - 5, textWidth + 10, textHeight + 10, 8);
      bg.fillStyle(0xd2691e, 0.95);
      bg.fillRoundedRect(-textWidth / 2, -textHeight / 2, textWidth, textHeight, 8);
      bg.lineStyle(3, 0xf5f5dc, 1);
      bg.strokeRoundedRect(-textWidth / 2, -textHeight / 2, textWidth, textHeight, 8);
      bg.setDepth(5);
      titleContainer.add(bg);

      // Shadow layers
      const shadows = [
        { offset: 6, color: '#3a2915', alpha: 0.3, depth: 6 },
        { offset: 4, color: '#4f3a20', alpha: 0.5, depth: 7 },
        { offset: 3, color: '#644b2b', alpha: 0.6, depth: 8 },
        { offset: 2, color: '#7a5e36', alpha: 0.7, depth: 9 },
      ];
      for (const s of shadows) {
        const t = this.add.text(s.offset, s.offset, 'Università Mercatorum Lab', {
          fontSize: '40px', color: s.color, align: 'center', fontFamily: 'serif', fontStyle: 'bold'
        });
        t.setOrigin(0.5); t.setDepth(s.depth); t.setAlpha(s.alpha); titleContainer.add(t);
      }

      // Main text in cream
      const mainText = this.add.text(0, 0, 'Università Mercatorum Lab', {
        fontSize: '40px', color: '#f5f5dc', align: 'center', fontFamily: 'serif', fontStyle: 'bold'
      });
      mainText.setOrigin(0.5); mainText.setDepth(10); titleContainer.add(mainText);

      // Italian classic corner decorations
      const dec = this.add.graphics();
      dec.fillStyle(0xf5f5dc, 1);
      dec.fillRect(-textWidth / 2 + 4, -textHeight / 2 + 4, 8, 2);
      dec.fillRect(-textWidth / 2 + 4, -textHeight / 2 + 4, 2, 8);
      dec.fillRect(textWidth / 2 - 12, -textHeight / 2 + 4, 8, 2);
      dec.fillRect(textWidth / 2 - 6, -textHeight / 2 + 4, 2, 8);
      dec.fillRect(-textWidth / 2 + 4, textHeight / 2 - 6, 8, 2);
      dec.fillRect(-textWidth / 2 + 4, textHeight / 2 - 12, 2, 8);
      dec.fillRect(textWidth / 2 - 12, textHeight / 2 - 6, 8, 2);
      dec.fillRect(textWidth / 2 - 6, textHeight / 2 - 12, 2, 8);
      dec.setDepth(12);
      titleContainer.add(dec);
    } catch (error) {
      console.error('Error creating Mercatorum title:', error);
    }
  }
}
