// frontend/src/phaser/scenes/BaseLabScene.ts

import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { Agent } from '../sprites/Agent';
import { FLController } from '../fl/FLController';
import { LabTypeId, LAB_TYPES } from '../types/LabTypeConstants';
import { DialogController } from '../controllers/DialogController';
import { FLDialogIntegrator } from '../fl/FLDialogIntegrator';
import { loadDialogAssets } from '../loader';
import { DialogDebugger } from '../utils/dialogDebugger';
import { LabControlsMenu } from '../ui/LabControlsMenu';
import { SimpleLLMPanel } from '../ui/simple/SimpleLLMPanel';

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
 * Scena base per tutti i laboratori nel gioco
 * Estende BaseScene e aggiunge funzionalità specifiche per i laboratori
 */
export class BaseLabScene extends BaseScene {
  // Agenti presenti nel laboratorio
  protected agents: Agent[] = [];
  
  // Zone di interazione
  protected interactionZones: Phaser.GameObjects.Zone[] = [];
  
  // Griglia per il pathfinding
  protected grid: number[][] = [];
  
  // Controller per il Federated Learning
  protected flController: FLController;
  
  // Controller per i dialoghi degli agenti
  protected dialogController!: DialogController; // Usiamo ! per dire a TS che verrà assegnato in create()
  
  // Integratore tra FL e sistema di dialogo
  protected flDialogIntegrator!: FLDialogIntegrator; // Usiamo ! per dire a TS che verrà assegnato in create()
  
  // Debugger per i dialoghi
  protected dialogDebugger: DialogDebugger | null = null;
  
  // ID del tipo di laboratorio (verrà impostato nelle sottoclassi)
  protected labTypeId: LabTypeId = LAB_TYPES.MERCATORUM; // Valore di default
  
  // Tema del laboratorio (da sovrascrivere nelle classi derivate)
  protected theme: LabTheme = {
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
        padding: {
          left: 10,
          right: 10,
          top: 5,
          bottom: 5
        }
      }
    ).setOrigin(0.5, 0).setDepth(100).setScrollFactor(0);
    
    // Inizializza gli effetti FL per questo laboratorio
    this.flController.initLabEffects(this);
    
    // Inizializza il controller dei dialoghi
    this.dialogController = new DialogController(this);
    
    // Registra gli agenti col sistema di dialogo
    this.registerAgentsWithDialogController();
    
    // Log per debug
    console.log(`DEBUG: Registered ${this.agents.length} agents with DialogController`);
    
    // Integra FL con il sistema di dialogo
    this.flDialogIntegrator = new FLDialogIntegrator(
      this.dialogController,
      this.flController,
      this // Passa la scena come terzo parametro
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
      
      // Pulisci le risorse del dialog controller
      if (this.dialogController) {
        this.dialogController.destroy();
      }
      
      // Pulisci le risorse dell'integratore FL
      if (this.flDialogIntegrator) {
        this.flDialogIntegrator.destroy();
      }
      
      // Pulisci il debugger dei dialoghi
      if (this.dialogDebugger) {
        this.dialogDebugger.destroy();
        this.dialogDebugger = null;
      }
      
      // Pulisci il menu dei controlli
      if (this.labControlsMenu) {
        this.labControlsMenu.destroy();
        this.labControlsMenu = null;
      }

      // Pulisci il pannello LLM
      if (this.simpleLLMPanel) {
        this.simpleLLMPanel.destroy();
        this.simpleLLMPanel = null;
      }
      
      // Rimuovi gli ascoltatori di eventi
      this.game.events.off('agent-interaction');
    });
  }

  /**
   * Inizializza il menu dei controlli del laboratorio
   */
  protected initializeControlsMenu(): void {
    try {
      // Crea il menu dei controlli (modificato per utilizzare un solo parametro)
      this.labControlsMenu = new LabControlsMenu(this);

      // Crea il pannello LLM semplificato
      this.simpleLLMPanel = new SimpleLLMPanel(this, 20, 60);

      // Configura il pannello LLM con il controller dei dialoghi
      if (this.simpleLLMPanel && this.dialogController) {
        this.simpleLLMPanel.setDialogController(this.dialogController);
      }

      // Aggiungi il pannello LLM al menu dei controlli
      // Questo dovrebbe essere sostituito con una logica che riflette la vera interfaccia di LabControlsMenu
      if (this.labControlsMenu && this.simpleLLMPanel) {
        // Supponendo che ci sia un metodo per aggiungere pulsanti o elementi UI
        // this.labControlsMenu.addButton('LLM Panel', () => this.simpleLLMPanel?.toggle());
      }

      console.log('Controls menu initialized successfully');
    } catch (error) {
      console.error('Error initializing controls menu:', error);
    }
  }

  /**
   * Ottiene il menu dei controlli
   */
  public getControlsMenu(): LabControlsMenu | null {
    return this.labControlsMenu;
  }

  /**
   * Ottiene il pannello LLM
   */
  public getLLMPanel(): SimpleLLMPanel | null {
    return this.simpleLLMPanel;
  }
  
  /**
   * Questo metodo sostituisce la chiamata diretta a registerAgent
   /**
   * Registra gli agenti col controller di dialogo
   */
  protected registerAgentsWithDialogController(): void {
    // Registra ogni agente con il controller dei dialoghi
    this.agents.forEach(agent => {
      if (agent && this.dialogController) {
        // Creiamo un dialogo per l'agente con i dati corretti
        // Utilizziamo un metodo più semplice che non richiede un tipo di dialogo specifico
        this.dialogController.trackAgent(agent.getId(), {
          id: agent.getId(),
          name: agent.name || `Agent ${agent.getId()}`,
          type: agent.getData('type') || 'researcher',
          role: agent.getData('role') || 'researcher'
        });
        
        console.log(`Agent registered for dialogs: ${agent.getId()}`);
      }
    });
  }
  
  update(time: number, delta: number): void {
    // Aggiorna tutti gli agenti
    this.updateAgents(time, delta);
    
    // Controlla le interazioni
    this.checkInteractions();
    
    // Aggiorna la lista degli agenti nel debugger (se necessario)
    if (this.dialogDebugger) {
      this.dialogDebugger.updateAgents(this.agents);
    }

    // Aggiorna il pannello LLM (se ha un metodo update)
    // Qui non facciamo nulla perché il SimpleLLMPanel non ha un metodo update
  }
  
  /**
   * Restituisce l'ID del tipo di laboratorio di questa scena
   * Questo metodo è essenziale per il funzionamento del FL
   */
  public getLabTypeId(): LabTypeId {
    return this.labTypeId;
  }
  
  /**
   * Inizializza la griglia per il pathfinding
   */
  protected initializeGrid(): void {
    console.log('Initializing basic grid');
    
    // Inizializza una griglia vuota (sovrascrivere nelle sottoclassi)
    const width = Math.ceil(this.cameras.main.width / 32);
    const height = Math.ceil(this.cameras.main.height / 32);
    
    this.grid = Array(height).fill(0).map(() => Array(width).fill(0));
  }
  
  /**
   * Crea le zone di interazione
   * (da implementare nelle sottoclassi)
   */
  protected createInteractionZones(): void {
    console.log('Creating interaction zones');
    // Implementazione di base vuota, da sovrascrivere nelle sottoclassi
  }
  
  /**
   * Crea agenti di base per il test
   * (da implementare nelle sottoclassi)
   */
  protected createTestAgents(): void {
    console.log('Creating test agents');
    // Implementazione di base vuota, da sovrascrivere nelle sottoclassi
  }
  
  /**
   * Aggiorna tutti gli agenti
   */
  protected updateAgents(time: number, delta: number): void {
    this.agents.forEach(agent => {
      if (agent && typeof agent.update === 'function') {
        agent.update(time, delta);
      }
    });
  }
  
  /**
   * Controlla le interazioni tra agenti e con l'ambiente
   */
  protected checkInteractions(): void {
    // Controlla le interazioni agente-agente
    for (let i = 0; i < this.agents.length; i++) {
      for (let j = i + 1; j < this.agents.length; j++) {
        const agent1 = this.agents[i];
        const agent2 = this.agents[j];
        
        if (!agent1 || !agent2) continue;
        
        const distance = Phaser.Math.Distance.Between(
          agent1.x, agent1.y,
          agent2.x, agent2.y
        );
        
        // Se gli agenti sono abbastanza vicini, possono interagire
        if (distance < 32) {
          this.handleAgentInteraction(agent1, agent2);
        }
      }
    }
    
    // Controlla le interazioni agente-zona
    this.agents.forEach(agent => {
      if (!agent) return;
      
      this.interactionZones.forEach(zone => {
        const bounds = zone.getBounds();
        if (bounds.contains(agent.x, agent.y)) {
          this.handleZoneInteraction(agent, zone);
        }
      });
    });
  }
  
  /**
   * Registra un agente per il Federated Learning
   * @param agent L'agente da registrare
   * @param agentId ID univoco dell'agente
   */
  protected registerAgentForFL(agent: Agent, agentId: string): void {
    if (agent && agentId) {
      // Emetti un evento per registrare l'agente col controller FL
      this.game.events.emit('agentCreated', agent, agentId, this.labTypeId);
    }
  }
  
  /**
   * Gestisce l'interazione tra due agenti
   * (implementazione di base, da sovrascrivere nelle sottoclassi)
   */
  protected handleAgentInteraction(agent1: Agent, agent2: Agent): void {
    console.log(`Agent interaction: ${agent1.name} with ${agent2.name}`);
    
    // Emetti un evento di interazione che può essere intercettato dal sistema di dialogo
    if (Math.random() < 0.3) { // Solo una percentuale di interazioni genera un dialogo
      this.game.events.emit('agent-interaction', {
        agentId1: agent1.getId(),
        agentId2: agent2.getId(),
        type: 'proximity'
      });
    }
  }
  
  /**
   * Gestisce l'interazione tra un agente e una zona
   * (implementazione di base, da sovrascrivere nelle sottoclassi)
   */
  protected handleZoneInteraction(agent: Agent, zone: Phaser.GameObjects.Zone): void {
    console.log(`Zone interaction: ${agent.name} with ${zone.name}`);
    // Implementazione di base vuota, da sovrascrivere nelle sottoclassi
  }
  
  /**
   * Trova un percorso tra due punti (metodo base)
   * Nelle sottoclassi, implementare l'algoritmo A* completo
   */
  protected findPath(startX: number, startY: number, targetX: number, targetY: number): {x: number, y: number}[] {
    // Implementazione base che restituisce solo il punto di partenza e di arrivo
    return [
      { x: startX, y: startY },
      { x: targetX, y: targetY }
    ];
  }
  
  /**
   * Converte una posizione in pixel in una posizione nella griglia
   */
  protected pixelToGrid(x: number, y: number): {gridX: number, gridY: number} {
    const gridSize = 32; // Dimensione predefinita della griglia
    return {
      gridX: Math.floor(x / gridSize),
      gridY: Math.floor(y / gridSize)
    };
  }
  
  /**
   * Converte una posizione nella griglia in una posizione in pixel
   */
  protected gridToPixel(gridX: number, gridY: number): {x: number, y: number} {
    const gridSize = 32; // Dimensione predefinita della griglia
    return {
      x: gridX * gridSize + gridSize / 2,
      y: gridY * gridSize + gridSize / 2
    };
  }
  
  /**
   * Crea pulsanti di navigazione tra laboratori
   */
  protected createNavigationButtons(): void {
    // Implementazione di base, da sovrascrivere nelle sottoclassi
    console.log('Creating navigation buttons');
  }
}