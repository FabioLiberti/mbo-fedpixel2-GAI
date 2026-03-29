// frontend/src/phaser/scenes/BaseLabScene.ts

import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { Agent, AgentState } from '../sprites/Agent';
import { createAgent } from '../sprites/agentFactory';
import { FLController } from '../fl/FLController';
import { LabTypeId, LAB_TYPES } from '../types/LabTypeConstants';
import { DialogController } from '../controllers/DialogController';
import { FLDialogIntegrator } from '../fl/FLDialogIntegrator';
import { loadDialogAssets } from '../loader';
import { DialogDebugger } from '../utils/dialogDebugger';
import { LabControlsMenu, type LabControlConfig, type ILabControlScene } from '../ui/LabControlsMenu';
import { SimpleLLMPanel } from '../ui/simple/SimpleLLMPanel';
import { AgentsLegend } from '../ui/AgentsLegend';
import { GlobalAgentController } from '../controllers/GlobalAgentController';
import { DialogEventTracker } from '../controllers/DialogEventTracker';
import { debugTextures, debugTextureKey } from '../utils/textureDebugHelper';
import { generateTilesetCanvas, TilesetTheme, TILE } from '../utils/tilesetGenerator';

/**
 * Interfaccia per i dati di interazione tra agenti
 */
interface AgentInteractionData {
  agentId1: string;
  agentId2: string;
  type: string;
  [key: string]: any;
}

/**
 * Interfaccia per la configurazione di un agente
 */
export interface AgentConfigEntry {
  type: string;
  name: string;
  position: { x: number; y: number };
  specialization?: string;
}

/**
 * Interfaccia che definisce il tema di un laboratorio
 */
export interface LabTheme {
  name: string;
  backgroundColor: number;
  tilesetKey: string;
  colorPalette: {
    primary: number;
    secondary: number;
    accent: number;
    background: number;
  };
}

/**
 * Scena base per tutti i laboratori nel gioco.
 * Contiene metodi condivisi per debug, texture, animazioni, agenti, camera, interazioni.
 * Le sottoclassi forniscono solo le parti specifiche (background, titolo, zone, config).
 */
export class BaseLabScene extends BaseScene implements ILabControlScene {
  // Agenti presenti nel laboratorio
  public agents: Agent[] = [];

  // Zone di interazione
  protected interactionZones: Phaser.GameObjects.Zone[] = [];

  // Griglia per il pathfinding
  public grid: number[][] = [];

  // Controller per il Federated Learning
  public flController: FLController;

  // Controller per i dialoghi degli agenti
  protected dialogController!: DialogController;

  // Integratore tra FL e sistema di dialogo
  protected flDialogIntegrator!: FLDialogIntegrator;

  // Debugger per i dialoghi
  protected dialogDebugger: DialogDebugger | null = null;

  // ID del tipo di laboratorio (verrà impostato nelle sottoclassi)
  protected labTypeId: LabTypeId = LAB_TYPES.MERCATORUM;

  // Tema del laboratorio (da sovrascrivere nelle classi derivate)
  public theme: LabTheme = {
    name: "Base Laboratory",
    backgroundColor: 0x333333,
    tilesetKey: 'tiles_default',
    colorPalette: {
      primary: 0x555555,
      secondary: 0x777777,
      accent: 0x999999,
      background: 0x333333
    }
  };

  // Menu dei controlli del laboratorio
  protected labControlsMenu: LabControlsMenu | null = null;

  // Pannello LLM semplificato
  protected simpleLLMPanel: SimpleLLMPanel | null = null;

  // Debug elements
  public debugGraphics: Phaser.GameObjects.Graphics | null = null;
  public debugText: Phaser.GameObjects.Text | null = null;
  protected assetsLoaded: boolean = false;
  protected textureTestContainers: Phaser.GameObjects.Container[] = [];
  protected rawSprites: Phaser.GameObjects.Sprite[] = [];

  // Shared controllers
  public agentsLegend: AgentsLegend | null = null;
  public agentController: GlobalAgentController | null = null;
  public dialogEventTracker: DialogEventTracker | null = null;

  // Tilemap (when using tilemap-based layout instead of procedural)
  protected labTilemap: Phaser.Tilemaps.Tilemap | null = null;

  // Zoom state
  private isZoomed: boolean = false;
  private zoomBackBtn: Phaser.GameObjects.Text | null = null;
  private zoomTimestamp: number = 0; // when last zoom-in happened

  // Cooldown per state icons (agentId → next allowed timestamp)
  private zoneIconCooldowns: Map<string, number> = new Map();

  constructor(key: string) {
    super(key);
    console.log(`BaseLabScene constructor called with key: ${key}`);
    this.flController = FLController.getInstance();
  }

  init(): void {
    super.init();
    this.agents = [];
    this.interactionZones = [];
    this.grid = [];
    this.assetsLoaded = false;
    this.textureTestContainers = [];
    this.rawSprites = [];
    console.log(`BaseLabScene initialized: ${this.scene.key}`);
  }

  preload(): void {
    super.preload();
    console.log(`BaseLabScene preload called: ${this.scene.key}`);

    // Carica il tileset di default se non è stato già caricato
    if (!this.textures.exists(this.theme.tilesetKey)) {
      this.assetLoader.loadImage(this.theme.tilesetKey, '/assets/labs/default/tileset.png');
    }

    // Carica gli asset di dialogo
    loadDialogAssets(this);
  }

  create(): void {
    console.log(`BaseLabScene create called: ${this.scene.key}`);

    // Monitora gli eventi di interazione tra agenti
    this.game.events.on('agent-interaction', (data: AgentInteractionData) => {
      console.log('DEBUG: Agent interaction event detected', data);
    });

    // Imposta il colore di sfondo
    this.cameras.main.setBackgroundColor(this.theme.backgroundColor);

    // Crea le animazioni dei personaggi
    this.createAnimations();

    // Inizializza la griglia di base per il pathfinding
    this.initializeGrid();

    // Crea le zone di interazione
    this.createInteractionZones();

    // Mostra il nome del laboratorio (Debug/Placeholder)
    this.add.text(
      this.cameras.main.centerX,
      20,
      this.theme.name,
      {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { left: 10, right: 10, top: 5, bottom: 5 }
      }
    ).setOrigin(0.5, 0).setDepth(100).setScrollFactor(0);

    // Inizializza gli effetti FL per questo laboratorio
    this.flController.initLabEffects(this);

    // Inizializza il controller dei dialoghi
    this.dialogController = new DialogController(this);

    // Registra gli agenti col sistema di dialogo
    this.registerAgentsWithDialogController();

    // Integra FL con il sistema di dialogo
    this.flDialogIntegrator = new FLDialogIntegrator(
      this.dialogController,
      this.flController,
      this
    );

    // Inizializza il debugger dei dialoghi (solo in modalità sviluppo)
    if (process.env.NODE_ENV !== 'production') {
      this.dialogDebugger = new DialogDebugger(this, this.dialogController, this.agents);
    }

    // Inizializza il menu dei controlli
    this.initializeControlsMenu();

    console.log(`BaseLabScene ${this.scene.key} setup complete`);

    // Emetti un evento quando la scena viene chiusa
    this.events.on('shutdown', () => {
      this.game.events.emit('sceneShutdown', this.scene.key);
      if (this.dialogController) this.dialogController.destroy();
      if (this.flDialogIntegrator) this.flDialogIntegrator.destroy();
      if (this.dialogDebugger) { this.dialogDebugger.destroy(); this.dialogDebugger = null; }
      if (this.labControlsMenu) { this.labControlsMenu.destroy(); this.labControlsMenu = null; }
      if (this.simpleLLMPanel) { this.simpleLLMPanel.destroy(); this.simpleLLMPanel = null; }
      this.game.events.off('agent-interaction');
    });
  }

  // ------------------------------------------------------------------
  // Controls menu
  // ------------------------------------------------------------------

  protected initializeControlsMenu(): void {
    try {
      this.labControlsMenu = new LabControlsMenu(this, {
        labId: 'default', labName: 'Lab', labDescription: '',
        theme: { primary: 0x3f51b5, secondary: 0x1a1a2e, accent: 0xf5f5dc },
        navigation: [],
      });
      this.simpleLLMPanel = new SimpleLLMPanel(this, 20, 60);
      if (this.simpleLLMPanel && this.dialogController) {
        this.simpleLLMPanel.setDialogController(this.dialogController);
      }
      console.log('Controls menu initialized successfully');
    } catch (error) {
      console.error('Error initializing controls menu:', error);
    }
  }

  public getControlsMenu(): LabControlsMenu | null { return this.labControlsMenu; }
  public getLLMPanel(): SimpleLLMPanel | null { return this.simpleLLMPanel; }

  protected registerAgentsWithDialogController(): void {
    this.agents.forEach(agent => {
      if (agent && this.dialogController) {
        this.dialogController.trackAgent(agent.getId(), {
          id: agent.getId(),
          name: agent.name || `Agent ${agent.getId()}`,
          type: agent.getData('type') || 'researcher',
          role: agent.getData('role') || 'researcher'
        });
      }
    });
  }

  update(time: number, delta: number): void {
    this.updateAgents(time, delta);
    this.checkInteractions();
    if (this.dialogDebugger) this.dialogDebugger.updateAgents(this.agents);
  }

  public getLabTypeId(): LabTypeId { return this.labTypeId; }

  // ------------------------------------------------------------------
  // Grid & pathfinding
  // ------------------------------------------------------------------

  protected initializeGrid(): void {
    const width = Math.ceil(this.cameras.main.width / 32);
    const height = Math.ceil(this.cameras.main.height / 32);
    this.grid = Array(height).fill(0).map(() => Array(width).fill(0));
  }

  protected createInteractionZones(): void {
    console.log('Creating interaction zones (base - override in subclass)');
  }

  protected createTestAgents(): void {
    console.log('Creating test agents (base - override in subclass)');
  }

  protected updateAgents(time: number, delta: number): void {
    this.agents.forEach(agent => {
      if (agent && typeof agent.update === 'function') agent.update(time, delta);
    });
  }

  protected checkInteractions(): void {
    for (let i = 0; i < this.agents.length; i++) {
      for (let j = i + 1; j < this.agents.length; j++) {
        const agent1 = this.agents[i];
        const agent2 = this.agents[j];
        if (!agent1 || !agent2) continue;
        const distance = Phaser.Math.Distance.Between(agent1.x, agent1.y, agent2.x, agent2.y);
        if (distance < 32) this.handleAgentInteraction(agent1, agent2);
      }
    }
    this.agents.forEach(agent => {
      if (!agent) return;
      this.interactionZones.forEach(zone => {
        const bounds = zone.getBounds();
        if (bounds.contains(agent.x, agent.y)) this.handleZoneInteraction(agent, zone);
      });
    });
  }

  protected registerAgentForFL(agent: Agent, agentId: string): void {
    if (agent && agentId) {
      this.game.events.emit('agentCreated', agent, agentId, this.labTypeId);
    }
  }

  protected handleAgentInteraction(agent1: Agent, agent2: Agent): void {
    if (Math.random() < 0.3) {
      this.game.events.emit('agent-interaction', {
        agentId1: agent1.getId(), agentId2: agent2.getId(), type: 'proximity'
      });
    }
  }

  protected handleZoneInteraction(_agent: Agent, _zone: Phaser.GameObjects.Zone): void {
    // No-op — icons are now driven by agent state changes, not zone proximity
  }

  // Room-to-allowed-state mapping for context-aware icons
  private static ROOM_STATE_ICONS: Record<string, Record<string, string>> = {
    professor_office: { working: '💻', discussing: '💬' },
    privacy_lab:      { working: '💻', discussing: '💬' },
    research_area:    { working: '💻', discussing: '💬' },
    server_room:      { working: '💻' },
    break_room:       { meeting: '🤝', discussing: '💬' },
    meeting_room:     { presenting: '📊', meeting: '🤝', discussing: '💬' },
  };
  private static ANYWHERE_ICONS: Record<string, string> = {
    walking: '🚶',
    discussing: '💬',
  };

  // Contextual phrases triggered after state icons (round-robin per key)
  private static STATE_PHRASES: Record<string, Record<string, string[]>> = {
    working: {
      professor_office: ['Sto rivedendo i risultati...', 'Preparo il prossimo esperimento.', 'Analizzo i dati del round precedente.'],
      privacy_lab:      ['Verifico le garanzie di privacy.', 'Testo il protocollo di anonimizzazione.', 'Controllo il budget epsilon.'],
      research_area:    ['Implemento il nuovo algoritmo.', 'Ottimizzo i parametri del modello.', 'Scrivo il codice di training.'],
      server_room:      ['Monitoro le risorse del cluster.', 'Aggiorno la configurazione del server.', 'Verifico i log di aggregazione.'],
      _default:         ['Sto lavorando...', 'Ci sono progressi.', 'Quasi finito con questa parte.'],
    },
    walking: {
      professor_office: ['Devo verificare i parametri del modello.', 'Vado a rivedere il protocollo sperimentale.', 'Devo aggiornare la documentazione.'],
      privacy_lab:      ['Voglio controllare i log di privacy.', 'Devo verificare il budget epsilon corrente.', 'Vado a testare il nuovo meccanismo di anonimizzazione.'],
      research_area:    ['Ho un\'idea per ottimizzare l\'aggregazione.', 'Devo controllare i risultati dell\'ultimo round.', 'Vado a implementare la nuova strategia di sampling.'],
      server_room:      ['Devo verificare lo stato del cluster.', 'Vado a controllare i tempi di aggregazione.', 'I log del server mostrano qualcosa di interessante.'],
      break_room:       ['Una pausa mi aiuterà a pensare meglio.', 'Devo riflettere sull\'approccio da usare.', 'Vado a prendere un caffè e ragionare.'],
      meeting_room:     ['Devo preparare i grafici per la riunione.', 'Voglio discutere i risultati con il team.', 'È ora di aggiornarci sui progressi.'],
      _default:         ['Devo verificare una cosa importante.', 'Ho avuto un\'intuizione, vado a controllare.', 'Voglio confrontare i dati con quelli precedenti.'],
    },
    // discussing and meeting: no icon phrases — the dialog system handles speech bubbles
    discussing: {},
    meeting: {},
    presenting: {
      _default: ['Ecco i risultati del round.', 'Guardate questi grafici.', 'Vi mostro i dati.'],
    },
  };
  private statePhrasesIndexes: Map<string, number> = new Map();

  /** Determine which room an agent is in based on interaction zones. */
  private getAgentRoom(agent: Agent): string | null {
    for (const zone of this.interactionZones) {
      const bounds = zone.getBounds();
      if (bounds.contains(agent.x, agent.y)) return zone.name;
    }
    return null;
  }

  /** Listen for agent state changes and show room-appropriate icon. */
  protected enableStateIcons(): void {
    this.events.on('agent-state-change', (agent: Agent, state: string) => {
      if (state === 'idle') return;

      const room = this.getAgentRoom(agent);
      let icon: string | undefined;

      if (room && BaseLabScene.ROOM_STATE_ICONS[room]) {
        icon = BaseLabScene.ROOM_STATE_ICONS[room][state];
      }
      if (!icon) {
        icon = BaseLabScene.ANYWHERE_ICONS[state];
      }
      if (!icon) return;

      const key = agent.getId() + '_state';
      const now = this.time.now;
      if ((this.zoneIconCooldowns.get(key) ?? 0) > now) return;
      this.zoneIconCooldowns.set(key, now + 8000);

      // Show icon
      const startY = agent.y - 35;
      const t = this.add.text(agent.x, startY, icon, { fontSize: '22px' });
      t.setOrigin(0.5).setDepth(100).setAlpha(1);

      this.tweens.add({
        targets: t,
        alpha: 0,
        y: startY - 20,
        delay: 2000,
        duration: 1500,
        ease: 'Power1',
        onComplete: () => t.destroy(),
      });

      // After icon fades a bit, show contextual phrase as small speech bubble
      const phrases = BaseLabScene.STATE_PHRASES[state];
      if (phrases) {
        const pool = (room && phrases[room]) || phrases._default;
        if (pool && pool.length > 0) {
          const phraseKey = `${state}_${room || '_'}`;
          const idx = this.statePhrasesIndexes.get(phraseKey) ?? 0;
          const phrase = pool[idx % pool.length];
          this.statePhrasesIndexes.set(phraseKey, idx + 1);

          this.time.delayedCall(1200, () => {
            const bubble = this.add.text(agent.x, agent.y - 52, phrase, {
              fontSize: '8px', fontFamily: 'Arial',
              color: '#ffffff', backgroundColor: '#000000aa',
              padding: { left: 5, right: 5, top: 3, bottom: 3 },
            }).setOrigin(0.5, 1).setDepth(101).setAlpha(0);

            this.tweens.add({
              targets: bubble, alpha: 1, duration: 300, ease: 'Power1',
            });
            this.tweens.add({
              targets: bubble, alpha: 0, delay: 3500, duration: 1000, ease: 'Power1',
              onComplete: () => bubble.destroy(),
            });
          });
        }
      }
    });
  }

  /** Listen for coffee-break events and move agents to break_room zone. */
  protected enableCoffeeBreak(): void {
    this.game.events.on('coffee-break', (data: { agentIds: string[] }) => {
      this.moveAgentsToZone(data.agentIds, 'break_room');
    });
    // Generic go-to-room event: { agentIds: string[], room: string }
    this.game.events.on('go-to-room', (data: { agentIds: string[]; room: string }) => {
      this.moveAgentsToZone(data.agentIds, data.room);
    });
  }

  /** Move a list of agents to the center of a named zone (with random offset). */
  private moveAgentsToZone(agentIds: string[], zoneName: string): void {
    const zone = this.interactionZones.find(z => z.name === zoneName);
    if (!zone) return;
    for (const agentId of agentIds) {
      const agent = this.agents.find((a: Agent) => a.getId() === agentId);
      if (agent) {
        const ox = Phaser.Math.Between(-20, 20);
        const oy = Phaser.Math.Between(-20, 20);
        agent.moveTo(zone.x + ox, zone.y + oy);
      }
    }
  }

  protected findPath(startX: number, startY: number, targetX: number, targetY: number): {x: number, y: number}[] {
    return [{ x: startX, y: startY }, { x: targetX, y: targetY }];
  }

  protected pixelToGrid(x: number, y: number): {gridX: number, gridY: number} {
    return { gridX: Math.floor(x / 32), gridY: Math.floor(y / 32) };
  }

  protected gridToPixel(gridX: number, gridY: number): {x: number, y: number} {
    return { x: gridX * 32 + 16, y: gridY * 32 + 16 };
  }

  protected createNavigationButtons(): void {}

  // ------------------------------------------------------------------
  // Shared utility: Debug elements
  // ------------------------------------------------------------------

  protected createDebugElements(): void {
    try {
      this.debugGraphics = this.add.graphics();
      if (this.debugGraphics) {
        this.debugGraphics.fillStyle(0x000000, 0.7);
        this.debugGraphics.fillRect(10, 10, 400, 200);
        this.debugGraphics.setDepth(1000);
        this.debugGraphics.setScrollFactor(0);
      }
      this.debugText = this.add.text(20, 20, 'Debug info loading...', {
        fontSize: '14px', color: '#FFFFFF', fontFamily: 'monospace',
        wordWrap: { width: 380 }
      });
      if (this.debugText) { this.debugText.setDepth(1001); this.debugText.setScrollFactor(0); }

      const toggleButton = this.add.text(410, 10, 'X', {
        fontSize: '16px', color: '#FFFFFF', backgroundColor: '#FF0000',
        padding: { left: 5, right: 5, top: 2, bottom: 2 }
      });
      if (toggleButton) {
        toggleButton.setDepth(1001); toggleButton.setScrollFactor(0); toggleButton.setVisible(false);
        toggleButton.setInteractive({ useHandCursor: true });
        toggleButton.on('pointerdown', () => {
          if (this.debugGraphics !== null && this.debugText !== null) {
            const visible = !this.debugGraphics.visible;
            this.debugGraphics.setVisible(visible);
            this.debugText.setVisible(visible);
            toggleButton.setText(visible ? 'X' : 'D');
          }
        });
      }
    } catch (error) {
      console.error('Error creating debug elements:', error);
    }
  }

  public updateDebugInfo(text: string): void {
    if (this.debugText && this.debugText.scene) {
      try { this.debugText.setText(text); } catch (error) {
        console.error('Error in updateDebugInfo:', error);
      }
    }
  }

  protected displayLoadedAssets(): void {
    try {
      const textureKeys = this.textures.getTextureKeys();
      const infoText = `Scene: ${this.scene.key}\nLoaded textures: ${textureKeys.length}\nKeys: ${textureKeys.slice(0, 5).join(', ')}${textureKeys.length > 5 ? '...' : ''}\nAnimation count: ${this.anims.getAll().length}`;
      this.updateDebugInfo(infoText);
      console.log(infoText);
    } catch (error) {
      console.error('Error displaying loaded assets:', error);
    }
  }

  // ------------------------------------------------------------------
  // Shared utility: Texture placeholders & animations
  // ------------------------------------------------------------------

  protected createMissingTextures(characterTypes: string[]): void {
    try {
      characterTypes.forEach(type => {
        if (!this.textures.exists(type)) {
          console.log(`Creating missing texture for ${type}`);
          this.createDirectPlaceholderTexture(type, 32, 48);
        }
      });
    } catch (error) {
      console.error('Error in createMissingTextures:', error);
    }
  }

  protected createImprovedPlaceholders(
    characterTypes: string[],
    typeColors: Record<string, { main: string; accent: string }>
  ): void {
    try {
      characterTypes.forEach(type => {
        if (this.textures.exists(type)) return;
        console.log(`Creating improved placeholder for ${type}`);

        const frameWidth = 32, frameHeight = 48, frameCount = 4;
        const canvas = document.createElement('canvas');
        canvas.width = frameWidth;
        canvas.height = frameHeight * frameCount;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const colors = typeColors[type] || { main: '#FF00FF', accent: '#AA00AA' };

        for (let frame = 0; frame < frameCount; frame++) {
          const fy = frame * frameHeight;
          ctx.fillStyle = colors.main;
          ctx.fillRect(0, fy, frameWidth, frameHeight);
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1;
          ctx.strokeRect(1, fy + 1, frameWidth - 2, frameHeight - 2);
          ctx.fillStyle = colors.accent;
          ctx.beginPath(); ctx.arc(frameWidth / 2, fy + 12, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          if (frame % 2 === 0) {
            ctx.fillRect(frameWidth / 2 - 5, fy + 19, 10, 20);
          } else {
            ctx.fillRect(frameWidth / 2 - 5, fy + 19, 10, 16);
            ctx.beginPath();
            ctx.moveTo(frameWidth / 2 - 4, fy + 35); ctx.lineTo(frameWidth / 2 - 1, fy + 45);
            ctx.lineTo(frameWidth / 2 + 1, fy + 45); ctx.lineTo(frameWidth / 2 + 4, fy + 35);
            ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = '#FFFFFF'; ctx.font = '6px Arial'; ctx.textAlign = 'center';
          const label = frame === 0 ? type : frame === 1 ? 'frame ' + frame : frame === 2 ? 'walking' : 'moving';
          ctx.fillText(label, frameWidth / 2, fy + frameHeight - 5);
        }

        this.textures.addCanvas(type, canvas);
        const texture = this.textures.get(type);
        for (let i = 0; i < frameCount; i++) {
          texture.add(i, 0, 0, i * frameHeight, frameWidth, frameHeight);
        }
        texture.refresh();
        console.log(`Placeholder for ${type} created with ${texture.frameTotal} frames`);
      });
    } catch (error) {
      console.error('Error in createImprovedPlaceholders:', error);
    }
  }

  protected createDirectPlaceholderTexture(key: string, width: number, height: number): void {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height * 4;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const color = '#FF00FF';
      for (let frame = 0; frame < 4; frame++) {
        const fy = frame * height;
        ctx.fillStyle = color; ctx.fillRect(0, fy, width, height);
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1;
        ctx.strokeRect(1, fy + 1, width - 2, height - 2);
        ctx.fillStyle = '#FFFFFF'; ctx.font = '8px Arial'; ctx.textAlign = 'center';
        ctx.fillText(key, width / 2, fy + height / 2);
      }

      this.textures.addCanvas(key, canvas);
      const texture = this.textures.get(key);
      for (let i = 0; i < 4; i++) {
        texture.add(i, 0, 0, i * height, width, height);
      }
      texture.refresh();
    } catch (error) {
      console.error(`Error creating placeholder for ${key}:`, error);
    }
  }

  protected createAllCharacterAnimations(characterTypes: string[]): void {
    try {
      characterTypes.forEach(char => {
        if (!this.textures.exists(char)) return;
        const texture = this.textures.get(char);
        if (!texture || texture.frameTotal <= 0) return;

        // frameTotal includes __BASE frame
        const actualFrames = Math.max(1, texture.frameTotal - 1);

        if (!this.anims.exists(`${char}_idle`)) {
          this.anims.create({ key: `${char}_idle`, frames: this.anims.generateFrameNumbers(char, { start: 0, end: 0 }), frameRate: 1, repeat: 0 });
        }
        if (!this.anims.exists(`${char}_walk`)) {
          this.anims.create({ key: `${char}_walk`, frames: this.anims.generateFrameNumbers(char, { start: 0, end: Math.min(3, actualFrames - 1) }), frameRate: 6, repeat: -1 });
        }
        if (!this.anims.exists(`${char}_working`)) {
          this.anims.create({ key: `${char}_working`, frames: this.anims.generateFrameNumbers(char, { start: 0, end: Math.min(1, actualFrames - 1) }), frameRate: 3, repeat: -1 });
        }
        if (!this.anims.exists(`${char}_discussing`)) {
          const df = actualFrames >= 4 ? { frames: [0, 1, 0, 2] } : actualFrames >= 2 ? { frames: [0, 1] } : { frames: [0] };
          this.anims.create({ key: `${char}_discussing`, frames: this.anims.generateFrameNumbers(char, df), frameRate: 4, repeat: -1 });
        }
      });
    } catch (error) {
      console.error('Error creating character animations:', error);
    }
  }

  protected runTextureDebug(): void {
    try {
      const keys = this.textures.getTextureKeys();
      console.log(`[TextureDebug] Available textures: ${keys.join(', ')}`);
      keys.forEach((key: string) => {
        const tex = this.textures.get(key);
        console.log(`  ${key}: ${tex.frameTotal} frames`);
      });
    } catch (error) {
      console.error('Error in runTextureDebug:', error);
    }
  }

  // ------------------------------------------------------------------
  // Shared utility: Agent creation from config
  // ------------------------------------------------------------------

  /** Target height in pixels for all agents — change this to resize uniformly */
  protected static readonly AGENT_TARGET_HEIGHT = 80;

  protected createAgentsFromConfig(
    agents: AgentConfigEntry[],
    portraitTypes: string[] = []
  ): void {
    try {
      const targetH = (this.constructor as typeof BaseLabScene).AGENT_TARGET_HEIGHT;

      agents.forEach(agentConfig => {
        try {
          if (!this.textures.exists(agentConfig.type)) {
            this.createDirectPlaceholderTexture(agentConfig.type, 32, 48);
          }

          // Compute scale dynamically so every agent is targetH pixels tall
          const isPortrait = portraitTypes.includes(agentConfig.type);
          let sourceHeight: number;
          if (isPortrait) {
            const tex = this.textures.get(agentConfig.type);
            sourceHeight = tex?.getSourceImage()?.height ?? 1024;
          } else {
            // Spritesheet frame height (set in preload frameHeight)
            const tex = this.textures.get(agentConfig.type);
            const frame = tex?.get(0);
            sourceHeight = frame?.height ?? 48;
          }
          const scale = targetH / sourceHeight;

          const agent = createAgent(this, {
            type: agentConfig.type,
            name: agentConfig.name,
            position: agentConfig.position,
            role: agentConfig.type,
            scale,
            speed: 25
          });

          this.add.existing(agent);
          this.agents.push(agent);
          agent.changeState(AgentState.IDLE);
          console.log(`Agent ${agentConfig.name} created (h=${sourceHeight} scale=${scale.toFixed(3)})`);
        } catch (error) {
          console.error(`Error creating agent ${agentConfig.name}:`, error);
        }
      });
      console.log(`Created ${this.agents.length} agents (target height: ${targetH}px)`);
    } catch (error) {
      console.error('Error in createAgentsFromConfig:', error);
    }
  }

  // ------------------------------------------------------------------
  // Shared utility: Camera
  // ------------------------------------------------------------------

  protected setupCamera(): void {
    try {
      this.cameras.main.setBounds(0, 0, this.cameras.main.width, this.cameras.main.height);
      this.cameras.main.setZoom(1);
      this.cameras.main.centerOn(this.cameras.main.width / 2, this.cameras.main.height / 2);
    } catch (error) {
      console.error('Error in setupCamera:', error);
    }
  }

  // ------------------------------------------------------------------
  // Camera zoom into zone / reset
  // ------------------------------------------------------------------

  protected zoomToZone(centerX: number, centerY: number, zoomLevel: number = 2.0): void {
    if (this.isZoomed) return;
    this.isZoomed = true;

    const cam = this.cameras.main;
    cam.removeBounds();

    // Tween only zoom; use centerOn() each frame so the target point stays
    // at the exact center of the viewport regardless of scale mode or DPI.
    const proxy = { z: cam.zoom };
    this.tweens.add({
      targets: proxy,
      z: zoomLevel,
      duration: 400,
      ease: 'Power2',
      onUpdate: () => {
        cam.setZoom(proxy.z);
        cam.centerOn(centerX, centerY);
      },
    });

    this.zoomBackBtn = this.add.text(cam.width - 10, 10, '✕ Vista completa', {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: '#333333cc',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    })
      .setOrigin(1, 0)
      .setDepth(1000)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    this.zoomBackBtn!.on('pointerdown', () => this.resetZoom());
  }

  protected resetZoom(): void {
    if (!this.isZoomed) return;
    this.isZoomed = false;

    const cam = this.cameras.main;
    // Capture current center via worldView (accurate with any scale mode)
    const focusX = cam.worldView.centerX;
    const focusY = cam.worldView.centerY;

    const proxy = { z: cam.zoom };
    this.tweens.add({
      targets: proxy,
      z: 1,
      duration: 400,
      ease: 'Power2',
      onUpdate: () => {
        cam.setZoom(proxy.z);
        cam.centerOn(focusX, focusY);
      },
      onComplete: () => {
        cam.setZoom(1);
        cam.setScroll(0, 0);
        cam.setBounds(0, 0, cam.width, cam.height);
      },
    });

    if (this.zoomBackBtn) {
      this.zoomBackBtn.destroy();
      this.zoomBackBtn = null;
    }
  }

  protected enableZoneZoom(): void {
    // Zone label click → zoom in (only via label text, not the invisible zone)
    for (const zone of this.interactionZones) {
      zone.on('pointerdown', () => {
        if (!this.isZoomed) {
          this.zoomTimestamp = Date.now();
          this.zoomToZone(zone.x, zone.y);
        }
      });
    }

    // Any click → zoom out (when zoomed), with 600ms grace period to avoid
    // the same pointerdown that triggered zoom-in also triggering zoom-out
    this.input.on('pointerdown', () => {
      if (!this.isZoomed) return;
      if (Date.now() - this.zoomTimestamp < 600) return;
      this.resetZoom();
    });
  }

  // ------------------------------------------------------------------
  // Shared utility: LLM status indicator
  // ------------------------------------------------------------------

  protected createLLMStatusIndicator(): void {
    try {
      const cam = this.cameras.main;
      const indicator = this.add.container(70, cam.height - 16);
      indicator.setDepth(999);
      indicator.setScrollFactor(0);

      const dot = this.add.graphics();
      const label = this.add.text(10, 0, 'LLM: ...', {
        fontSize: '10px', color: '#aaaaaa', fontFamily: 'Arial'
      }).setOrigin(0, 0.5);
      indicator.add([dot, label]);

      const drawDot = (color: number) => { dot.clear(); dot.fillStyle(color, 1); dot.fillCircle(0, 0, 5); };
      drawDot(0x888888);

      // Periodic check every 15s
      const check = async () => {
        try {
          const resp = await fetch('http://localhost:8091/ai/status', { signal: AbortSignal.timeout(3000) });
          if (resp.ok) {
            const data = await resp.json();
            if (data.available) {
              drawDot(0x44cc44); label.setText('LLM attivo'); label.setColor('#44cc44');
            } else {
              drawDot(0xcccc00); label.setText('Preset'); label.setColor('#cccc00');
            }
          } else {
            drawDot(0xcc4444); label.setText('Offline'); label.setColor('#cc4444');
          }
        } catch {
          drawDot(0xcc4444); label.setText('Offline'); label.setColor('#cc4444');
        }
      };

      check();
      this.time.addEvent({ delay: 15000, callback: check, loop: true });
    } catch (error) {
      console.error('Error creating LLM status indicator:', error);
    }
  }

  // ------------------------------------------------------------------
  // Shared utility: Grid from image
  // ------------------------------------------------------------------

  protected createGridFromImage(image: Phaser.GameObjects.Image): void {
    try {
      const gridSize = 32;
      const width = Math.ceil(this.cameras.main.width / gridSize);
      const height = Math.ceil(this.cameras.main.height / gridSize);
      this.grid = Array(height).fill(0).map(() => Array(width).fill(0));

      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      for (let y = centerY - 1; y <= centerY + 1; y++) {
        for (let x = centerX - 2; x <= centerX + 2; x++) {
          if (y >= 0 && y < height && x >= 0 && x < width) this.grid[y][x] = 1;
        }
      }
      for (let x = 0; x < width; x++) this.grid[0][x] = 1;
    } catch (error) {
      console.error('Error in createGridFromImage:', error);
    }
  }

  // ------------------------------------------------------------------
  // Shared utility: Temporary map (fallback)
  // ------------------------------------------------------------------

  protected createTemporaryMap(furnitureKey: string): void {
    try {
      if (this.textures.exists(furnitureKey)) {
        const furniture = this.add.image(
          this.cameras.main.width / 2, this.cameras.main.height / 2, furnitureKey
        );
        furniture.setDepth(-5);
        this.createGridFromImage(furniture);
        return;
      }

      const gridSize = 32;
      const width = Math.ceil(this.cameras.main.width / gridSize);
      const height = Math.ceil(this.cameras.main.height / gridSize);
      this.grid = Array(height).fill(0).map(() => Array(width).fill(0));

      const furniture = this.add.graphics();
      furniture.fillStyle(this.theme.colorPalette.primary, 0.7);

      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      furniture.fillRect(centerX * gridSize - 80, centerY * gridSize - 40, 160, 80);
      for (let y = centerY - 1; y <= centerY + 1; y++) {
        for (let x = centerX - 2; x <= centerX + 2; x++) {
          if (y >= 0 && y < height && x >= 0 && x < width) this.grid[y][x] = 1;
        }
      }

      furniture.fillStyle(this.theme.colorPalette.secondary, 0.7);
      for (let y = 2; y < height - 2; y += 3) {
        furniture.fillRect(gridSize, y * gridSize, gridSize * 2, gridSize);
        if (y >= 0 && y < height) { this.grid[y][1] = 1; this.grid[y][2] = 1; }
      }
      for (let y = 2; y < height - 2; y += 3) {
        furniture.fillRect(width * gridSize - gridSize * 3, y * gridSize, gridSize * 2, gridSize);
        if (y >= 0 && y < height) { this.grid[y][width - 2] = 1; this.grid[y][width - 3] = 1; }
      }

      furniture.fillStyle(0x333333, 0.8);
      furniture.fillRect(0, 0, width * gridSize, gridSize);
      for (let x = 0; x < width; x++) this.grid[0][x] = 1;
      furniture.setDepth(-5);
    } catch (error) {
      console.error('Error in createTemporaryMap:', error);
    }
  }

  // ------------------------------------------------------------------
  // Shared utility: Tilemap-based lab layout
  // ------------------------------------------------------------------

  /**
   * Creates a tilemap-based lab layout using a runtime-generated tileset.
   * Subclasses provide `tilesetTheme` and `layoutFn` to define the appearance.
   *
   * @param tilesetTheme  Color palette for the tileset
   * @param layoutFn      Callback that places tiles on the floor/furniture layers
   * @param cols          Grid columns (default: derived from camera width)
   * @param rows          Grid rows (default: derived from camera height)
   */
  protected createLabTilemap(
    tilesetTheme: TilesetTheme,
    layoutFn: (floor: Phaser.Tilemaps.TilemapLayer, furniture: Phaser.Tilemaps.TilemapLayer, cols: number, rows: number) => void,
    cols?: number,
    rows?: number,
  ): void {
    try {
      const c = cols ?? Math.floor(this.cameras.main.width / 32);
      const r = rows ?? Math.floor(this.cameras.main.height / 32);

      // 1. Generate tileset texture
      const tilesetKey = `tileset_${this.scene.key}`;
      if (!this.textures.exists(tilesetKey)) {
        const canvas = generateTilesetCanvas(tilesetTheme);
        this.textures.addCanvas(tilesetKey, canvas);
      }

      // 2. Create blank tilemap
      const map = this.make.tilemap({
        tileWidth: 32,
        tileHeight: 32,
        width: c,
        height: r,
      });
      if (!map) {
        console.error('Failed to create tilemap');
        return;
      }
      this.labTilemap = map;

      // 3. Add the runtime tileset image
      const tileset = map.addTilesetImage('lab-tiles', tilesetKey, 32, 32, 0, 0);
      if (!tileset) {
        console.error('Failed to add tileset image');
        return;
      }

      // 4. Create layers
      const floorLayer = map.createBlankLayer('floor', tileset, 0, 0);
      const furnitureLayer = map.createBlankLayer('furniture', tileset, 0, 0);
      if (!floorLayer || !furnitureLayer) {
        console.error('Failed to create tilemap layers');
        return;
      }

      floorLayer.setDepth(-8);
      furnitureLayer.setDepth(-4);

      // 5. Fill floor with checkerboard pattern
      for (let y = 0; y < r; y++) {
        for (let x = 0; x < c; x++) {
          floorLayer.putTileAt((x + y) % 2 === 0 ? TILE.FLOOR : TILE.FLOOR_ALT, x, y);
        }
      }

      // 6. Let subclass populate the furniture
      layoutFn(floorLayer, furnitureLayer, c, r);

      // 7. Update pathfinding grid from furniture layer
      // DOOR tiles are passable (they connect rooms); everything else blocks.
      const WALKABLE_TILES = new Set([TILE.DOOR, TILE.CHAIR, TILE.RUG, TILE.LAMP]);
      this.grid = Array(r).fill(0).map(() => Array(c).fill(0));
      for (let y = 0; y < r; y++) {
        for (let x = 0; x < c; x++) {
          const tile = furnitureLayer.getTileAt(x, y);
          if (tile && tile.index !== -1 && !WALKABLE_TILES.has(tile.index)) {
            this.grid[y][x] = 1; // blocked
          }
        }
      }

      console.log(`Tilemap created for ${this.scene.key}: ${c}x${r} tiles`);
    } catch (error) {
      console.error('Error in createLabTilemap:', error);
    }
  }

  // ------------------------------------------------------------------
  // Arena zone visualization
  // ------------------------------------------------------------------

  /**
   * Arena zone definition for createArenaZones().
   * Coordinates are in tile units (not pixels).
   */
  protected createArenaZones(): void {
    const cols = Math.floor(this.cameras.main.width / 32);
    const rows = Math.floor(this.cameras.main.height / 32);
    if (!this.labTilemap) return;
    const floorLayer = this.labTilemap.getLayer('floor')?.tilemapLayer;
    if (!floorLayer) return;

    // Proportional zone layout (matches backend MazeAdapter 20x20 grid):
    //   workspace:    top half          (y: 0 .. midY-1)
    //   meeting_room: mid band          (y: midY .. midY + meetH - 1)
    //   break_room:   bottom-left       (y: midY + meetH .. rows-1, x: 0 .. midX-1)
    //   server_room:  bottom-right      (y: midY + meetH .. rows-1, x: midX .. cols-1)
    const midY = Math.floor(rows * 0.5);
    const meetH = Math.max(2, Math.floor(rows * 0.25));
    const bottomY = midY + meetH;
    const midX = Math.floor(cols / 2);

    // 1. Paint zone-colored floors
    // Workspace keeps default checkerboard (FLOOR/FLOOR_ALT) — no repaint
    // Meeting room
    for (let y = midY; y < bottomY && y < rows; y++)
      for (let x = 0; x < cols; x++)
        floorLayer.putTileAt(TILE.FLOOR_MEETING, x, y);
    // Break room (bottom-left)
    for (let y = bottomY; y < rows; y++)
      for (let x = 0; x < midX; x++)
        floorLayer.putTileAt(TILE.FLOOR_BREAK, x, y);
    // Server room (bottom-right)
    for (let y = bottomY; y < rows; y++)
      for (let x = midX; x < cols; x++)
        floorLayer.putTileAt(TILE.FLOOR_SERVER, x, y);

    // 2. Internal wall dividers (on furniture layer so they block pathfinding)
    const furnLayer = this.labTilemap.getLayer('furniture')?.tilemapLayer;
    if (furnLayer) {
      // Divider between workspace and meeting room
      for (let x = 1; x < cols - 1; x++) {
        if (!furnLayer.getTileAt(x, midY) || furnLayer.getTileAt(x, midY)?.index === -1) {
          furnLayer.putTileAt(TILE.WALL_INTERNAL, x, midY);
        }
      }
      // Divider between meeting and break/server
      for (let x = 1; x < cols - 1; x++) {
        if (!furnLayer.getTileAt(x, bottomY) || furnLayer.getTileAt(x, bottomY)?.index === -1) {
          furnLayer.putTileAt(TILE.WALL_INTERNAL, x, bottomY);
        }
      }
    }

    // 3. Text labels + emoji icons
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 3, y: 1 },
    };

    const zones = [
      { name: '💻 Workspace',    x: 2, y: 1 },
      { name: '🤝 Meeting Room', x: 2, y: midY + 1 },
      { name: '☕ Break Room',    x: 2, y: Math.min(bottomY + 1, rows - 2) },
      { name: '🖥️ Server Room',  x: midX + 1, y: Math.min(bottomY + 1, rows - 2) },
    ];

    for (const z of zones) {
      const label = this.add.text(z.x * 32, z.y * 32, z.name, labelStyle);
      label.setDepth(-2);
      label.setAlpha(0.85);
    }
  }

  // ------------------------------------------------------------------
  // Shared utility: 3D pixel-art title
  // ------------------------------------------------------------------

  protected create3DTitle(title: string, textColor: string, fontFamily: string = 'monospace'): void {
    const titleContainer = this.add.container(this.cameras.main.centerX, 25);
    titleContainer.setDepth(10);

    const tempText = this.add.text(0, 0, title, { fontSize: '40px', fontFamily, fontStyle: 'bold' });
    const textWidth = tempText.width + 60;
    const textHeight = tempText.height + 20;
    tempText.destroy();

    const bg = this.add.graphics();
    bg.fillStyle(0x888888, 0.9);
    bg.fillRoundedRect(-textWidth / 2 - 5, -textHeight / 2 - 5, textWidth + 10, textHeight + 10, 8);
    bg.fillStyle(0xFFFFFF, 0.95);
    bg.fillRoundedRect(-textWidth / 2, -textHeight / 2, textWidth, textHeight, 8);
    bg.lineStyle(2, 0x000000, 1);
    bg.strokeRoundedRect(-textWidth / 2, -textHeight / 2, textWidth, textHeight, 8);
    bg.setDepth(5);
    titleContainer.add(bg);

    // Shadow layers
    const shadows = [
      { offset: 6, color: '#111111', alpha: 0.3, depth: 6 },
      { offset: 4, color: '#222222', alpha: 0.5, depth: 7 },
      { offset: 3, color: '#333333', alpha: 0.6, depth: 8 },
      { offset: 2, color: '#444444', alpha: 0.7, depth: 9 },
    ];
    for (const s of shadows) {
      const t = this.add.text(s.offset, s.offset, title, { fontSize: '40px', color: s.color, align: 'center', fontFamily, fontStyle: 'bold' });
      t.setOrigin(0.5); t.setDepth(s.depth); t.setAlpha(s.alpha); titleContainer.add(t);
    }

    const mainText = this.add.text(0, 0, title, { fontSize: '40px', color: textColor, align: 'center', fontFamily, fontStyle: 'bold' });
    mainText.setOrigin(0.5); mainText.setDepth(10); titleContainer.add(mainText);

    // Pixel art corner decorations
    const colorNum = parseInt(textColor.replace('#', ''), 16);
    const corners = this.add.graphics();
    corners.fillStyle(colorNum, 1);
    corners.fillRect(-textWidth / 2, -textHeight / 2, 6, 6);
    corners.fillRect(textWidth / 2 - 6, -textHeight / 2, 6, 6);
    corners.fillRect(-textWidth / 2, textHeight / 2 - 6, 6, 6);
    corners.fillRect(textWidth / 2 - 6, textHeight / 2 - 6, 6, 6);
    corners.setDepth(12);
    titleContainer.add(corners);
  }

  // ------------------------------------------------------------------
  // Shared utility: Loading listeners for preload()
  // ------------------------------------------------------------------

  protected setLoadingListeners(): void {
    this.load.on('progress', (value: number) => {
      console.log(`Load progress: ${Math.round(value * 100)}%`);
    });
    this.load.on('complete', () => {
      console.log('All assets loaded successfully');
      this.assetsLoaded = true;
      this.updateDebugInfo('Assets loaded - creating scene elements');
    });
    this.load.on('loaderror', (file: any) => {
      console.error(`Error loading file: ${file.key} from ${file.url}`);
      this.updateDebugInfo(`Error loading: ${file.key}`);
    });
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------

  destroy(): void {
    try {
      this.agents.forEach(agent => { if (agent) agent.destroy(); });
      this.agents = [];
      this.interactionZones.forEach(zone => { if (zone) zone.destroy(); });
      this.interactionZones = [];
      if (this.debugText) { this.debugText.destroy(); this.debugText = null; }
      if (this.debugGraphics) { this.debugGraphics.destroy(); this.debugGraphics = null; }
      this.textureTestContainers.forEach(c => { if (c) c.destroy(); });
      this.textureTestContainers = [];
      this.rawSprites.forEach(s => { if (s) s.destroy(); });
      this.rawSprites = [];
      if (this.agentsLegend) this.agentsLegend = null;
      console.log(`Scene ${this.scene.key} resources cleaned up`);
    } catch (error) {
      console.error(`Error cleaning up scene ${this.scene.key}:`, error);
    }
  }
}
