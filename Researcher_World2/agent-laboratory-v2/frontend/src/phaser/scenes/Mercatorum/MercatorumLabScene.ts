// src/phaser/scenes/Mercatorum/MercatorumLabScene.ts

import { BaseScene } from '../BaseScene';
import { Agent, AgentState } from '../../sprites/Agent';
import { LAB_TYPES } from '../../types/LabTypeConstants';
import { GlobalAgentController } from '../../controllers/GlobalAgentController';
import { MERCATORUM_THEME, IMercatorumLabScene, MercatorumSceneRefs } from './types';
import { LLMControlPanel } from '../../ui/LLMControlPanel';
import { SimpleLLMPanel } from '../../ui/simple/SimpleLLMPanel';
import { DialogEventTracker } from '../../controllers/DialogEventTracker';

// Importa i moduli
import * as UI from './UI';
import * as Agents from './Agents';
import * as Environment from './Environment';
import * as Textures from './Textures';
import * as Controls from './Controls';


export class MercatorumLabScene extends BaseScene implements IMercatorumLabScene {
  // Agenti e interazioni - cambiati da protected a public per compatibilità con l'interfaccia
  public agents: Agent[] = [];
  public interactionZones: Phaser.GameObjects.Zone[] = [];
  
  // Grid per il pathfinding - cambiato da protected a public
  public grid: number[][] = [];
  
  // Elementi di debug - cambiati da private a public
  public debugGraphics: Phaser.GameObjects.Graphics | null = null;
  public debugText: Phaser.GameObjects.Text | null = null;
  public assetsLoaded: boolean = false;
  public textureTestContainers: Phaser.GameObjects.Container[] = [];
  public rawSprites: Phaser.GameObjects.Sprite[] = [];
  
  // Dichiarazione aggiuntiva per la legenda
  public agentsLegend: any = null;
  
  // Controller per gestire i dialoghi
  public agentController: GlobalAgentController | null = null;

  // Componenti UI per il pannello di controllo
  public controlPanel: Phaser.GameObjects.Container | null = null;
  public controlPanelToggle: Phaser.GameObjects.Container | null = null;
  public isPanelOpen: boolean = false;

  // Pannello di controllo LLM - nuova proprietà
  public llmPanel: LLMControlPanel | null = null;
  
  // Pannello SimpleLLM
  public simpleLLMPanel: SimpleLLMPanel | null = null;
  
  // Tracker per i dialoghi - NUOVO
  public dialogEventTracker: DialogEventTracker | null = null;

  // Tema del laboratorio Mercatorum - cambiato da protected a public
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
      // Ottieni il riferimento agli elementi della scena per i moduli
      const sceneRefs: MercatorumSceneRefs = {
        agents: this.agents,
        interactionZones: this.interactionZones,
        grid: this.grid,
        agentController: this.agentController,
        agentsLegend: this.agentsLegend,
        debugGraphics: this.debugGraphics,
        debugText: this.debugText,
        controlPanel: this.controlPanel,
        controlPanelToggle: this.controlPanelToggle, 
        textureTestContainers: this.textureTestContainers,
        rawSprites: this.rawSprites,
        assetsLoaded: this.assetsLoaded,
        isPanelOpen: this.isPanelOpen,
        llmPanel: this.llmPanel
      };

      // Inizializza gli elementi di debug
      this.createDebugElements();
      
      // Assicuriamoci che il debug sia disattivato all'avvio
      Controls.initDebugState(this);
      
      // Imposta un colore di sfondo acceso per debug
      this.cameras.main.setBackgroundColor(0xFF00FF); // Magenta vivace per debug
      
      // Fase 1: Gestione texture e animazioni
      Textures.setupTextures(this);
      
      // Visualizza asset disponibili
      this.displayLoadedAssets();
      
      // Dopo il debug, usa il colore reale
      setTimeout(() => {
        this.cameras.main.setBackgroundColor(this.theme.backgroundColor);
      }, 1000);
      
      // Fase 2: Crea l'ambiente
      Environment.createEnvironment(this);
      
      // NUOVO: Inizializza il tracker di dialoghi prima di creare gli agenti
      this.dialogEventTracker = new DialogEventTracker(this);
      
      // Fase 3: Crea agenti e zone di interazione
      Agents.createAgents(this);
      
      // Fase 4: Configura la UI
      UI.setupUI(this);
      
      // Fase 5: Crea il pannello di controllo
      Controls.createControlPanel(this);

      // Fase 6: Inizializza il controller per i dialoghi
      this.initDialogController();
      
      console.log('MercatorumLabScene create COMPLETE');
      
      // Forza l'attivazione della scena se non è già attiva
      if (!this.scene.isActive()) {
        console.log('MercatorumLabScene not active, attempting to force activation');
        this.scene.setActive(true);
        this.scene.setVisible(true);
      }
      
    } catch (error) {
      console.error('Error in MercatorumLabScene create:', error);
      this.updateDebugInfo(`Create error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Inizializza il controller per i dialoghi
  private initDialogController(): void {
    try {
      // Inizializza il controller globale per gli agenti con supporto per i dialoghi
      this.agentController = new GlobalAgentController(this, LAB_TYPES.MERCATORUM);

      // Registra gli agenti creati nel controller
      this.agentController.setSimulationAgents(this.agents);

      // Inizializza il debugger dei dialoghi
      this.agentController.initDebugger();
      
      // Inizializza SimpleLLMPanel se non esistente
      if (!this.simpleLLMPanel) {
        this.simpleLLMPanel = new SimpleLLMPanel(this, 20, 60);
      }
      
      // NUOVO: Se il tracker di dialoghi esiste, assicuriamoci che i dialoghi vengano tracciati
      if (this.dialogEventTracker) {
        console.log('Dialog event tracker already exists, ready for tracking dialogs');
      } else {
        // Fallback: crea il tracker se non esiste
        this.dialogEventTracker = new DialogEventTracker(this);
        console.log('Created dialog event tracker as fallback');
      }

      console.log('Dialog controller initialized with tracker integration');
    } catch (error) {
      console.error('Error initializing dialog controller:', error);
    }
  }

  // NUOVO: Metodo per tracciare manualmente un dialogo
  public trackDialog(type: 'llm' | 'simulated' | 'standard', agentId?: string): void {
    if (this.dialogEventTracker) {
      this.dialogEventTracker.trackDialog(type, agentId);
    } else {
      console.warn('Cannot track dialog: dialog event tracker not initialized');
      
      // Emetti comunque l'evento in caso il tracker venga inizializzato più tardi
      this.events.emit('mercatorum-dialog-created', { 
        type, 
        agentId 
      });
    }
  }
  
  // Aggiungi pulsante per SimpleLLMPanel al menu di controllo
  private addSimpleLLMButton(): void {
    try {
      // Aggiungi il pulsante direttamente sulla scena invece che nel controlPanel
      const llmSimpleButton = this.add.text(
        this.cameras.main.width - 200,  // Posiziona a destra
        150,  // Posiziona più in alto
        'LLM Simple',
        {
          fontSize: '16px',
          color: '#ffffff',
          backgroundColor: '#3f51b5',
          padding: { left: 10, right: 10, top: 5, bottom: 5 }
        }
      );
      
      llmSimpleButton.setOrigin(0, 0.5);
      llmSimpleButton.setInteractive({ useHandCursor: true });
      llmSimpleButton.setScrollFactor(0);  // Fissa rispetto alla camera
      llmSimpleButton.setDepth(1000);  // Assicurati che sia sopra gli altri elementi
      
      // Effetti hover
      llmSimpleButton.on('pointerover', () => {
        llmSimpleButton.setBackgroundColor('#5c6bc0');
      });
      
      llmSimpleButton.on('pointerout', () => {
        llmSimpleButton.setBackgroundColor('#3f51b5');
      });
      
      // Azione al click
      llmSimpleButton.on('pointerdown', () => {
        if (this.simpleLLMPanel) {
          this.simpleLLMPanel.toggle();
        } else {
          console.warn('SimpleLLMPanel not initialized');
        }
      });
      
      console.log('LLM Simple button added directly to scene');
    } catch (error) {
      console.error('Error adding LLM Simple button:', error);
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
      
      // Distruggi il pannello di controllo
      if (this.controlPanel) {
        this.controlPanel.destroy();
        this.controlPanel = null;
      }
      
      // Distruggi il pulsante toggle
      if (this.controlPanelToggle) {
        this.controlPanelToggle.destroy();
        this.controlPanelToggle = null;
      }
      
      // Distruggi il pannello LLM
      if (this.llmPanel) {
        this.llmPanel.destroy();
        this.llmPanel = null;
      }
      
      // Distruggi il pannello SimpleLLM
      if (this.simpleLLMPanel) {
        this.simpleLLMPanel.destroy();
        this.simpleLLMPanel = null;
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