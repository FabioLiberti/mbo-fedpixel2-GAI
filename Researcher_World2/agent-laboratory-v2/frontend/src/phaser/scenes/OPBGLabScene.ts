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

      // Scene layout
      this.createHospitalBackground();
      this.createHospitalTemporaryMap();
      this.initializeGrid();
      this.createInteractionZones();

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

  private createHospitalTemporaryMap(): void {
    try {
      if (this.textures.exists('opbg_furniture')) {
        const f = this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'opbg_furniture');
        f.setDepth(-5);
        this.createGridFromImage(f);
        return;
      }

      const gs = 32;
      const w = Math.ceil(this.cameras.main.width / gs);
      const h = Math.ceil(this.cameras.main.height / gs);
      this.grid = Array(h).fill(0).map(() => Array(w).fill(0));

      const furniture = this.add.graphics();
      const cx = Math.floor(w / 2), cy = Math.floor(h / 2);

      // Server Room
      furniture.fillStyle(this.theme.colorPalette.primary, 0.2);
      furniture.lineStyle(2, this.theme.colorPalette.primary, 0.8);
      furniture.fillRoundedRect(w * gs / 2 - 80, h * gs / 2 - 40, 160, 80, 10);
      furniture.strokeRoundedRect(w * gs / 2 - 80, h * gs / 2 - 40, 160, 80, 10);
      this.add.text(w * gs / 2, h * gs / 2, 'Server Room\nDati Sensibili', { fontSize: '14px', color: '#333333', align: 'center' }).setOrigin(0.5);
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (let x = cx - 2; x <= cx + 2; x++) {
          if (y >= 0 && y < h && x >= 0 && x < w) this.grid[y][x] = 1;
        }
      }

      // Work stations (left)
      furniture.fillStyle(this.theme.colorPalette.secondary, 0.7);
      for (let y = 2; y < h - 2; y += 3) {
        furniture.fillRect(gs, y * gs, gs * 2, gs);
        if (y >= 0 && y < h) { this.grid[y][1] = 1; this.grid[y][2] = 1; }
      }

      // Clinical area
      furniture.fillStyle(this.theme.colorPalette.accent, 0.2);
      furniture.lineStyle(2, this.theme.colorPalette.accent, 0.8);
      furniture.fillRoundedRect(w * gs - 200, h * gs / 2 - 60, 180, 120, 10);
      furniture.strokeRoundedRect(w * gs - 200, h * gs / 2 - 60, 180, 120, 10);
      this.add.text(w * gs - 110, h * gs / 2 - 50, 'Area Clinica', { fontSize: '14px', color: '#333333', align: 'center' }).setOrigin(0.5);

      // Hospital beds (simplified)
      furniture.fillStyle(0xffffff, 1);
      furniture.fillRect(w * gs - 180, h * gs / 2 - 30, 60, 30);
      furniture.fillRect(w * gs - 100, h * gs / 2 - 30, 60, 30);
      furniture.fillRect(w * gs - 180, h * gs / 2 + 30, 60, 30);
      furniture.fillRect(w * gs - 100, h * gs / 2 + 30, 60, 30);

      // Pediatric star decorations
      furniture.fillStyle(this.theme.colorPalette.secondary, 0.5);
      furniture.fillStar(50, 50, 5, 10, 15);
      furniture.fillStar(w * gs - 50, 50, 5, 10, 15);

      furniture.setDepth(-5);
    } catch (error) {
      console.error('Error in createHospitalTemporaryMap:', error);
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

      addZone(100, 200, gs * 4, gs * 4, 'meeting_room');
      addZone(this.cameras.main.width / 2, gs / 2, this.cameras.main.width - 100, gs * 2, 'data_center');
      addZone(this.cameras.main.width - 100, this.cameras.main.height - 100, gs * 5, gs * 3, 'clinical_area');
    } catch (error) {
      console.error('Error in createInteractionZones:', error);
    }
  }

  // ---- Scene-specific: Zone interaction icons ---------------------------

  protected handleZoneInteraction(agent: Agent, zone: Phaser.GameObjects.Zone): void {
    try {
      let icon = '❓';
      if (zone.name === 'meeting_room') icon = '👥';
      else if (zone.name === 'data_center') icon = '🖥️';
      else if (zone.name === 'clinical_area') icon = '🏥';

      const t = this.add.text(agent.x, agent.y - 30, icon, { fontSize: '24px' });
      t.setOrigin(0.5); t.setDepth(100);
      this.time.delayedCall(1500, () => t.destroy());
    } catch (error) {
      console.error('Error in handleZoneInteraction:', error);
    }
  }
}
