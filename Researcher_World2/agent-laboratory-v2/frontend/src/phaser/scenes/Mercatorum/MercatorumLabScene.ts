// src/phaser/scenes/Mercatorum/MercatorumLabScene.ts

import { BaseScene } from '../BaseScene';
import { Agent, AgentState } from '../../sprites/Agent';
import { LAB_TYPES } from '../../types/LabTypeConstants';
import { GlobalAgentController } from '../../controllers/GlobalAgentController';
import { MERCATORUM_THEME, IMercatorumLabScene, MercatorumSceneRefs } from './types';
import { LLMControlPanel } from '../../ui/LLMControlPanel';
import { SimpleLLMPanel } from '../../ui/simple/SimpleLLMPanel';
import { DialogEventTracker } from '../../controllers/DialogEventTracker';
import { LabControlsMenu, type LabControlConfig } from '../../ui/LabControlsMenu';

// Importa i moduli
import * as UI from './UI';
import * as Agents from './Agents';
import * as Environment from './Environment';
import * as Textures from './Textures';


export class MercatorumLabScene extends BaseScene implements IMercatorumLabScene {
  // Agenti e interazioni
  public agents: Agent[] = [];
  public interactionZones: Phaser.GameObjects.Zone[] = [];

  // Grid per il pathfinding
  public grid: number[][] = [];

  // Elementi di debug
  public debugGraphics: Phaser.GameObjects.Graphics | null = null;
  public debugText: Phaser.GameObjects.Text | null = null;
  public assetsLoaded: boolean = false;
  public textureTestContainers: Phaser.GameObjects.Container[] = [];
  public rawSprites: Phaser.GameObjects.Sprite[] = [];

  // Legenda
  public agentsLegend: any = null;

  // Controller
  public agentController: GlobalAgentController | null = null;

  // Pannello di controllo condiviso
  private labControls: LabControlsMenu | null = null;

  // Legacy properties kept for IMercatorumLabScene compatibility
  public controlPanel: Phaser.GameObjects.Container | null = null;
  public controlPanelToggle: Phaser.GameObjects.Container | null = null;
  public isPanelOpen: boolean = false;
  public llmPanel: LLMControlPanel | null = null;
  public simpleLLMPanel: SimpleLLMPanel | null = null;

  // Tracker dialoghi
  public dialogEventTracker: DialogEventTracker | null = null;

  // Tema
  public theme = MERCATORUM_THEME;

  constructor() {
    super('MercatorumLabScene');
    console.log('MercatorumLabScene constructor called');
  }

  init(): void {
    console.log('MercatorumLabScene init START');
    try {
      super.init();
      this.grid = [];
      this.agents = [];
      this.interactionZones = [];
      this.assetsLoaded = false;
      this.textureTestContainers = [];
      this.rawSprites = [];
      this.isPanelOpen = false;
      console.log('MercatorumLabScene init COMPLETE');
    } catch (error) {
      console.error('Error in MercatorumLabScene init:', error);
    }
  }

  preload() {
    console.log('MercatorumLabScene preload START');
    try {
      // Chiama il preload del padre per caricare gli asset comuni
      super.preload();
      
      // Gestione del caricamento delle risorse
      this.setLoadingListeners();
      
      // Carica le risorse attraverso il modulo Textures
      Textures.preloadAssets(this);
      
      console.log('MercatorumLabScene preload COMPLETE');
    } catch (error) {
      console.error('Error in MercatorumLabScene preload:', error);
      this.updateDebugInfo(`Preload error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  create() {
    console.log('MercatorumLabScene create START');

    try {
      // Inizializza gli elementi di debug
      this.createDebugElements();
      if (this.debugGraphics) this.debugGraphics.setVisible(false);
      if (this.debugText) this.debugText.setVisible(false);

      // Colore debug temporaneo
      this.cameras.main.setBackgroundColor(0xFF00FF);

      // Fase 1: Gestione texture e animazioni
      Textures.setupTextures(this);
      this.displayLoadedAssets();

      setTimeout(() => {
        this.cameras.main.setBackgroundColor(this.theme.backgroundColor);
      }, 1000);

      // Fase 2: Crea l'ambiente
      Environment.createEnvironment(this);

      // Fase 3: Inizializza tracker e crea agenti
      this.dialogEventTracker = new DialogEventTracker(this);
      Agents.createAgents(this);

      // Fase 4: Configura la UI (titolo)
      UI.setupUI(this);

      // Fase 5: Inizializza controller dialoghi
      this.agentController = new GlobalAgentController(this, LAB_TYPES.MERCATORUM);
      this.agentController.setSimulationAgents(this.agents);
      this.agentController.initDebugger();

      // Fase 6: Pannello "Controlli Lab" condiviso
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
        theme: {
          primary: this.theme.colorPalette.primary,    // 0xd2691e terracotta
          secondary: this.theme.colorPalette.secondary, // 0x1a365d navy
          accent: this.theme.colorPalette.accent,       // 0xf5f5dc cream
        },
        navigation: [
          { label: '→ Vai a Blekinge Lab', sceneKey: 'BlekingeLabScene' },
          { label: '→ Vai a OPBG Lab', sceneKey: 'OPBGLabScene' },
        ],
      };
      this.labControls = new LabControlsMenu(this as any, controlConfig);
      const dc = this.agentController.getDialogController();
      if (dc) this.labControls.setDialogController(dc);

      console.log('MercatorumLabScene create COMPLETE');

      if (!this.scene.isActive()) {
        this.scene.setActive(true);
        this.scene.setVisible(true);
      }
    } catch (error) {
      console.error('Error in MercatorumLabScene create:', error);
      this.updateDebugInfo(`Create error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public trackDialog(type: 'llm' | 'simulated' | 'standard', agentId?: string): void {
    if (this.dialogEventTracker) {
      this.dialogEventTracker.trackDialog(type, agentId);
    }
  }

  update(time: number, delta: number) {
    try {
      // Aggiorna tutti gli agenti
      Agents.updateAgents(this, time, delta);
      
      // Stimola occasionalmente i movimenti degli agenti per evitare che restino fermi
      if (Math.random() < 0.005) { // 0.5% di possibilità per frame
        Agents.stimulateRandomAgentMovement(this);
      }
      
      // Controlla le interazioni
      Agents.checkInteractions(this);
    } catch (error) {
      console.error('Error in MercatorumLabScene update:', error);
    }
  }

  // Gestori eventi di caricamento
  private setLoadingListeners(): void {
    this.load.on('progress', (value: number) => {
      console.log(`Load progress: ${Math.round(value * 100)}%`);
      this.updateDebugInfo(`Loading: ${Math.round(value * 100)}%`);
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

  // Crea elementi per il debug visivo
  private createDebugElements(): void {
    try {
      // Crea un pannello di debug per mostrare informazioni sugli asset
      this.debugGraphics = this.add.graphics();
      
      if (this.debugGraphics) {
        this.debugGraphics.fillStyle(0x000000, 0.7);
        this.debugGraphics.fillRect(10, 10, 400, 200);
        this.debugGraphics.setDepth(1000);
        this.debugGraphics.setScrollFactor(0);
        // Nascosto all'avvio
        this.debugGraphics.setVisible(false);
      }
      
      // Testo di debug
      this.debugText = this.add.text(
        20, 
        20, 
        'Debug info loading...', 
        { 
          fontSize: '14px',
          color: '#FFFFFF',
          fontFamily: 'monospace',
          wordWrap: { width: 380 }
        }
      );
      
      if (this.debugText) {
        this.debugText.setDepth(1001);
        this.debugText.setScrollFactor(0);
        // Nascosto all'avvio
        this.debugText.setVisible(false);
      }
    } catch (error) {
      console.error('Error creating debug elements:', error);
    }
  }
  
  // Aggiorna le informazioni di debug
  public updateDebugInfo(text: string): void {
    if (this.debugText && this.debugText.scene) {
      try {
        this.debugText.setText(text);
      } catch (error) {
        console.error('Error in updateDebugInfo:', error);
      }
    } else {
      console.log('Debug info update (skipped - no valid debug text):', text);
    }
  }
  
  // Visualizza informazioni sugli asset caricati
  private displayLoadedAssets(): void {
    try {
      const textureKeys = this.textures.getTextureKeys();
      const infoText = `
        Scene: ${this.scene.key}
        Loaded textures: ${textureKeys.length}
        Keys: ${textureKeys.slice(0, 5).join(', ')}${textureKeys.length > 5 ? '...' : ''}
        Animation count: ${this.anims.getAll().length}
      `;
      
      this.updateDebugInfo(infoText);
      console.log(infoText);
    } catch (error) {
      console.error('Error displaying loaded assets:', error);
    }
  }

  // Metodo chiamato quando la scena viene distrutta
  destroy(): void {
    try {
      // Assicurati che tutti gli elementi siano distrutti
      if (this.agentsLegend) {
        this.agentsLegend = null;
      }
      
      // Pulisci tutti gli agenti
      this.agents.forEach(agent => {
        if (agent) agent.destroy();
      });
      this.agents = [];
      
      // Pulisci le zone di interazione
      this.interactionZones.forEach(zone => {
        if (zone) zone.destroy();
      });
      this.interactionZones = [];
      
      // Pulisci gli elementi di debug
      if (this.debugText) {
        this.debugText.destroy();
        this.debugText = null;
      }
      
      if (this.debugGraphics) {
        this.debugGraphics.destroy();
        this.debugGraphics = null;
      }
      
      // Pulisci i contenitori di test
      if (this.textureTestContainers) {
        this.textureTestContainers.forEach(container => {
          if (container) container.destroy();
        });
        this.textureTestContainers = [];
      }
      
      // Pulisci gli sprite di test
      if (this.rawSprites) {
        this.rawSprites.forEach(sprite => {
          if (sprite) sprite.destroy();
        });
        this.rawSprites = [];
      }

      // Distruggi il controller degli agenti
      if (this.agentController) {
        this.agentController.destroy();
        this.agentController = null;
      }
      
      // Distruggi il pannello condiviso
      if (this.labControls) {
        this.labControls.destroy();
        this.labControls = null;
      }
      
      // NUOVO: Distruggi il tracker di dialoghi
      if (this.dialogEventTracker) {
        this.dialogEventTracker.destroy();
        this.dialogEventTracker = null;
      }
      
      console.log(`Scene ${this.scene.key} resources cleaned up`);
    } catch (error) {
      console.error(`Error cleaning up scene ${this.scene.key}:`, error);
    }
  }
}