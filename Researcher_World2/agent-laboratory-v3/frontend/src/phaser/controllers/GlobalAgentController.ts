// frontend/src/phaser/controllers/GlobalAgentController.ts

import { WorldMapScene } from '../scenes/WorldMapScene';
import { SCENE_KEYS } from '../game';
import { LAB_TYPES, LabTypeId } from '../types/LabTypeConstants';
import { DialogController } from './DialogController';
import { Agent } from '../sprites/Agent';
import { FLDialogType } from '../types/DialogTypes';
import { DialogDebugger } from '../utils/dialogDebugger';

/**
 * Interfaccia che definisce i dati di un agente per la visualizzazione sulla mappa mondiale
 */
interface AgentData {
  id: string;
  type: string;
  labScene: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  moving?: boolean;
  state?: string;
}

/**
 * Interfaccia per le dimensioni reali di un laboratorio
 */
interface LabDimensions {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Controller globale per gestire gli agenti nella mappa mondiale e le interazioni tra agenti.
 * Coordina le informazioni sugli agenti tra i diversi laboratori, aggiorna le miniature
 * e gestisce il sistema di dialogo tra agenti.
 */
export class GlobalAgentController {
  private scene: Phaser.Scene;
  private isWorldMapScene: boolean = false;
  private agents: AgentData[] = [];
  private agentUpdateInterval: number = 0;
  private labDimensions: Map<string, LabDimensions> = new Map();
  
  // Componenti per gestione dialoghi
  private dialogController: DialogController | null = null;
  private simulationAgents: Agent[] = [];
  private debugger: DialogDebugger | null = null;
  private enableDebugMode: boolean = false;
  private labTypeId: LabTypeId | null = null;
  
  constructor(scene: Phaser.Scene, labTypeId?: LabTypeId) {
    this.scene = scene;
    
    // Determina se è la WorldMapScene o una scene di laboratorio
    this.isWorldMapScene = scene instanceof WorldMapScene;
    
    if (!this.isWorldMapScene && labTypeId) {
      this.labTypeId = labTypeId;
      
      // Inizializza il controller di dialogo solo per le scene di laboratorio
      this.dialogController = new DialogController(scene);
      this.enableDebugMode = process.env.NODE_ENV !== 'production';
      
      console.log(`GlobalAgentController: Dialog system initialized for lab ${labTypeId}`);
    }
    
    // Imposta le dimensioni reali di ogni laboratorio
    // Queste sono dimensioni approssimative e potrebbero dover essere aggiustate
    this.labDimensions.set(SCENE_KEYS.MERCATORUM, {
      width: 960,
      height: 540,
      offsetX: 0,
      offsetY: 0
    });
    
    this.labDimensions.set(SCENE_KEYS.BLEKINGE, {
      width: 960,
      height: 540,
      offsetX: 0,
      offsetY: 0
    });
    
    this.labDimensions.set(SCENE_KEYS.OPBG, {
      width: 960,
      height: 540,
      offsetX: 0,
      offsetY: 0
    });
    
    // Inizializza gli event listener
    this.initEventListeners();
  }
  
  /**
   * Inizializza il controller globale degli agenti per WorldMapScene
   */
  initialize(): void {
    if (!this.isWorldMapScene) return;
    
    console.log("GlobalAgentController: Initializing WorldMap mode");
    
    // Carica i dati iniziali degli agenti da tutti i laboratori
    this.loadAgentsData();
    
    // Imposta un intervallo per aggiornare periodicamente la posizione degli agenti
    this.agentUpdateInterval = window.setInterval(() => {
      this.updateAgentsData();
    }, 500); // Aggiorna più frequentemente (ogni 0.5 secondi)
  }
  
  /**
   * Aggiorna la visualizzazione degli agenti a ogni frame (per WorldMapScene)
   */
  update(time: number, delta: number): void {
    if (!this.isWorldMapScene) return;
    
    // Aggiorna le posizioni degli agenti in movimento fluido
    this.updateAgentMovement(delta);
  }
  
  /**
   * Imposta gli agenti nella scena di laboratorio per il sistema di dialogo
   */
  setSimulationAgents(agents: Agent[]): void {
    if (this.isWorldMapScene) return;
    
    this.simulationAgents = agents;
    
    // Aggiorna il debugger se esiste
    if (this.debugger) {
      this.debugger.updateAgents(agents);
    }
    
    console.log(`GlobalAgentController: ${agents.length} simulation agents registered`);
  }
  
  /**
   * Inizializza il debugger visuale per i dialoghi
   */
  initDebugger(): void {
    if (this.isWorldMapScene || !this.dialogController || this.simulationAgents.length === 0) return;
    
    if (this.enableDebugMode) {
      console.log('Initializing dialog debugger');
      this.debugger = new DialogDebugger(this.scene, this.dialogController, this.simulationAgents);
    }
  }
  
  /**
   * Inizializza i listener di eventi
   */
  private initEventListeners(): void {
    // Ascolta l'evento agent-interaction, rilevante solo per le scene di laboratorio
    if (!this.isWorldMapScene) {
      this.scene.game.events.on('agent-interaction', this.handleAgentInteraction, this);
      console.log('GlobalAgentController: agent-interaction event listener initialized');
    }
  }
  
  /**
   * Gestisce l'interazione tra agenti
   */
  private handleAgentInteraction(data: any): void {
    if (this.isWorldMapScene) return;

    if (!data || !data.agentId1 || !data.agentId2) {
      console.warn('[GlobalAgentController] Invalid interaction data');
      return;
    }

    // Dialog creation is handled entirely by DialogEventHandler.
    // Here we only emit FL-specific side-effect events.
    let dialogType = FLDialogType.GENERAL;
    if (data.type === 'test-dialog') {
      const types = [FLDialogType.GENERAL, FLDialogType.MODEL, FLDialogType.DATA, FLDialogType.PRIVACY, FLDialogType.RESEARCH];
      dialogType = types[Math.floor(Math.random() * types.length)];
    } else if (Object.values(FLDialogType).includes(data.type)) {
      dialogType = data.type as FLDialogType;
    }

    if (dialogType === FLDialogType.MODEL) {
      this.scene.game.events.emit('fl-model-update', { agentId: data.agentId1, accuracy: Math.random() * 10 + 90 });
    } else if (dialogType === FLDialogType.DATA) {
      this.scene.game.events.emit('fl-data-sharing', { sourceAgentId: data.agentId1, targetAgentId: data.agentId2 });
    } else if (dialogType === FLDialogType.PRIVACY) {
      this.scene.game.events.emit('fl-privacy-check', { agentId: data.agentId1 });
    } else if (dialogType === FLDialogType.RESEARCH) {
      this.scene.game.events.emit('fl-research-progress', { agentId: data.agentId1 });
    }
  }
  
  /**
   * Genera un testo casuale in base al tipo di dialogo
   */
  private getRandomDialogText(type: FLDialogType): string {
    const texts: Record<FLDialogType, string[]> = {
      [FLDialogType.GENERAL]: [
        "Ciao, come va la ricerca?",
        "Hai visto gli ultimi risultati?",
        "Dovremmo coordinarci meglio sul progetto."
      ],
      [FLDialogType.MODEL]: [
        "Ho aggiornato il modello con nuovi parametri!",
        "La precisione è migliorata del 5% con l'ultimo update.",
        "Il modello sta convergendo bene."
      ],
      [FLDialogType.DATA]: [
        "Sto condividendo i dati anonimizzati con te.",
        "Questi dati sono cruciali per il nostro esperimento.",
        "Dobbiamo migliorare la qualità dei nostri dataset."
      ],
      [FLDialogType.PRIVACY]: [
        "Ho implementato misure di differential privacy.",
        "Il privacy budget è sotto controllo.",
        "Questi dati sono protetti secondo gli standard GDPR."
      ],
      [FLDialogType.RESEARCH]: [
        "Ho una nuova intuizione sul problema!",
        "Questo approccio potrebbe essere rivoluzionario.",
        "Dobbiamo documentare i nostri risultati."
      ]
    };
    
    const options = texts[type] || texts[FLDialogType.GENERAL];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  /**
   * Ottiene il controller dei dialoghi
   */
  getDialogController(): DialogController | null {
    return this.dialogController;
  }
  
  /**
   * Attiva/disattiva la visualizzazione del debugger
   */
  toggleDebugger(): void {
    if (this.isWorldMapScene) return;
    
    if (this.debugger && typeof this.debugger.toggle === 'function') {
      this.debugger.toggle();
    } else if (this.enableDebugMode) {
      // Inizializza il debugger se non esiste
      this.initDebugger();
      // Verifichiamo che il debugger sia stato creato e abbia il metodo toggle
      if (this.debugger && typeof this.debugger.toggle === 'function') {
        this.debugger.toggle();
      }
    }
  }
  
  /**
   * Pulisce le risorse quando il controller non è più necessario
   */
  destroy(): void {
    console.log("GlobalAgentController: Cleaning up");
    
    // Rimuovi i listener di eventi
    if (!this.isWorldMapScene) {
      this.scene.game.events.off('agent-interaction', this.handleAgentInteraction, this);
    }
    
    // Pulisci gli intervalli se in modalità WorldMap
    if (this.isWorldMapScene && this.agentUpdateInterval) {
      clearInterval(this.agentUpdateInterval);
    }
    
    // Distruggi il DialogController se esiste
    if (this.dialogController) {
      this.dialogController.destroy();
    }
    
    // Distruggi il debugger se esiste
    if (this.debugger && typeof this.debugger.destroy === 'function') {
      this.debugger.destroy();
      this.debugger = null;
    }
  }
  
  /**
   * Carica i dati iniziali degli agenti dai laboratori
   */
  private loadAgentsData(): void {
    if (!this.isWorldMapScene) return;
    
    console.log("GlobalAgentController: Loading initial agent data");
    
    // In una implementazione reale, questi dati potrebbero provenire
    // da un'API o dallo store React/Redux
    
    // Agenti Mercatorum (allineati a MercatorumLabScene MERCATORUM_AGENTS)
    const mercatorumAgents = [
      { id: 'prof1', type: 'professor6', labScene: SCENE_KEYS.MERCATORUM, x: 130, y: 140 },
      { id: 'priv1', type: 'privacy_specialist', labScene: SCENE_KEYS.MERCATORUM, x: 660, y: 140 },
      { id: 'stu1', type: 'student', labScene: SCENE_KEYS.MERCATORUM, x: 400, y: 420 },
      { id: 'res1', type: 'researcher', labScene: SCENE_KEYS.MERCATORUM, x: 400, y: 140 },
    ];

    // Agenti Blekinge (allineati a BlekingeLabScene BLEKINGE_AGENTS)
    const blekingeAgents = [
      { id: 'prof2', type: 'professor_senior', labScene: SCENE_KEYS.BLEKINGE, x: 130, y: 140 },
      { id: 'stu2', type: 'student', labScene: SCENE_KEYS.BLEKINGE, x: 400, y: 420 },
      { id: 'swe1', type: 'sw_engineer', labScene: SCENE_KEYS.BLEKINGE, x: 400, y: 140 },
      { id: 'eng1', type: 'engineer', labScene: SCENE_KEYS.BLEKINGE, x: 660, y: 140 },
    ];

    // Agenti OPBG (allineati a OPBGLabScene OPBG_AGENTS)
    const opbgAgents = [
      { id: 'doc1', type: 'doctor', labScene: SCENE_KEYS.OPBG, x: 130, y: 140 },
      { id: 'spd1', type: 'student_postdoc', labScene: SCENE_KEYS.OPBG, x: 400, y: 420 },
      { id: 'eng2', type: 'engineer', labScene: SCENE_KEYS.OPBG, x: 660, y: 140 },
      { id: 'res3', type: 'researcher', labScene: SCENE_KEYS.OPBG, x: 400, y: 140 },
    ];
    
    // Unisci tutti i dati degli agenti
    this.agents = [...mercatorumAgents, ...blekingeAgents, ...opbgAgents];
    
    // Aggiorna la visualizzazione degli agenti nelle miniature
    this.updateLabMiniaturesWithAgents();
  }
  
  /**
   * Aggiorna i dati degli agenti, simulando il movimento
   */
  private updateAgentsData(): void {
    if (!this.isWorldMapScene) return;
    
    // In una implementazione reale, qui faresti una chiamata API per
    // ottenere i dati aggiornati degli agenti da tutti i laboratori
    
    // Simula decisioni degli agenti - cambia target e stato
    this.agents.forEach(agent => {
      // Solo alcuni agenti prendono decisioni per volta (per movimento naturale)
      if (Math.random() > 0.7) {
        // Decide se l'agente deve muoversi verso un nuovo punto
        if (!agent.moving || Math.random() > 0.6) {
          const labDimensions = this.labDimensions.get(agent.labScene);
          if (labDimensions) {
            // Calcola una nuova destinazione entro i confini del laboratorio
            agent.targetX = Math.max(50, Math.min(labDimensions.width - 50, 
              agent.x + (Math.random() - 0.5) * 300)); // Movimento più realistico
              
            agent.targetY = Math.max(50, Math.min(labDimensions.height - 50, 
              agent.y + (Math.random() - 0.5) * 200));
              
            // Imposta lo stato in movimento
            agent.moving = true;
            agent.state = 'walking';
          }
        } else if (agent.moving && Math.random() > 0.9) {
          // Occasionalmente l'agente si ferma anche se non ha raggiunto la destinazione
          agent.moving = false;
          agent.state = 'idle';
        }
      }
    });
    
    // Aggiorna la visualizzazione degli agenti nelle miniature
    this.updateLabMiniaturesWithAgents();
  }
  
  /**
   * Aggiorna la posizione degli agenti in movimento per renderla più fluida
   */
  private updateAgentMovement(delta: number): void {
    if (!this.isWorldMapScene) return;
    
    let agentsUpdated = false;
    
    // Aggiorna tutti gli agenti in movimento
    this.agents.forEach(agent => {
      if (agent.moving && agent.targetX !== undefined && agent.targetY !== undefined) {
        // Calcola la direzione e la distanza verso la destinazione
        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Se l'agente è abbastanza vicino alla destinazione, consideralo arrivato
        if (distance < 5) {
          agent.x = agent.targetX;
          agent.y = agent.targetY;
          agent.moving = false;
          agent.state = 'idle';
          agentsUpdated = true;
        } else {
          // Altrimenti, muovi l'agente verso la destinazione
          const speed = 80; // Pixel al secondo
          const speedFactor = speed * (delta / 1000);
          
          // Applica il movimento in base alla velocità
          const normX = dx / distance;
          const normY = dy / distance;
          
          agent.x += normX * speedFactor;
          agent.y += normY * speedFactor;
          agentsUpdated = true;
        }
      }
    });
    
    // Aggiorna le miniature solo se ci sono stati cambiamenti
    if (agentsUpdated) {
      this.updateLabMiniaturesWithAgents();
    }
  }
  
  /**
   * Converte le coordinate di un laboratorio in coordinate per la miniatura
   */
  private convertLabCoordsToMiniature(
    x: number, 
    y: number, 
    labScene: string
  ): { miniX: number, miniY: number } {
    // Ottieni le dimensioni del laboratorio
    const labDimensions = this.labDimensions.get(labScene);
    
    if (!labDimensions) {
      console.warn(`No dimensions found for lab ${labScene}`);
      return { miniX: 0, miniY: 0 };
    }
    
    // Calcola la posizione proporzionale all'interno del laboratorio (valori da 0 a 1)
    const relativeX = (x - labDimensions.offsetX) / labDimensions.width;
    const relativeY = (y - labDimensions.offsetY) / labDimensions.height;
    
    // Mappa questa posizione relativa sulla miniatura
    // Le dimensioni 150x120 sono quelle della miniatura specificate in LabMiniature.ts
    // Usiamo un fattore di scala più piccolo per mantenere gli agenti entro i bordi
    const miniatureWidth = 130;
    const miniatureHeight = 100;
    
    // Mappa le coordinate centrandole nella miniatura
    const miniX = (relativeX - 0.5) * miniatureWidth;
    const miniY = (relativeY - 0.5) * miniatureHeight;
    
    return { miniX, miniY };
  }
  
  /**
   * Aggiorna le miniature dei laboratori con i dati degli agenti
   */
  private updateLabMiniaturesWithAgents(): void {
    if (!this.isWorldMapScene) return;
    
    // Raggruppa gli agenti per laboratorio
    const mercatorumAgents = this.agents.filter(a => a.labScene === SCENE_KEYS.MERCATORUM);
    const blekingeAgents = this.agents.filter(a => a.labScene === SCENE_KEYS.BLEKINGE);
    const opbgAgents = this.agents.filter(a => a.labScene === SCENE_KEYS.OPBG);
    
    // Converti le coordinate del laboratorio in coordinate per la miniatura
    const mercatorumAgentsWithMiniCoords = mercatorumAgents.map(agent => {
      const { miniX, miniY } = this.convertLabCoordsToMiniature(agent.x, agent.y, agent.labScene);
      return {
        ...agent,
        miniX,
        miniY,
        state: agent.state || 'idle'
      };
    });
    
    const blekingeAgentsWithMiniCoords = blekingeAgents.map(agent => {
      const { miniX, miniY } = this.convertLabCoordsToMiniature(agent.x, agent.y, agent.labScene);
      return {
        ...agent,
        miniX,
        miniY,
        state: agent.state || 'idle'
      };
    });
    
    const opbgAgentsWithMiniCoords = opbgAgents.map(agent => {
      const { miniX, miniY } = this.convertLabCoordsToMiniature(agent.x, agent.y, agent.labScene);
      return {
        ...agent,
        miniX,
        miniY,
        state: agent.state || 'idle'
      };
    });
    
    try {
      // Utilizziamo l'operatore as any per bypassare il controllo di tipo
      const worldMapScene = this.scene as any;
      
      // Ottieni riferimenti alle miniature dei laboratori usando funzioni helper sicure
      const getMiniature = (labTypeId: string): any => {
        if (!worldMapScene.labMiniatures || typeof worldMapScene.labMiniatures.get !== 'function') {
          console.warn("labMiniatures map is not available in the scene");
          return null;
        }
        
        // Tenta con diverse varianti della chiave
        const keys = [
          labTypeId,
          labTypeId.toLowerCase(),
          labTypeId.toUpperCase()
        ];
        
        for (const key of keys) {
          try {
            const miniature = worldMapScene.labMiniatures.get(key);
            if (miniature) return miniature;
          } catch (e) {
            console.warn(`Error getting miniature with key ${key}:`, e);
          }
        }
        
        return null;
      };
      
      // Ottieni le miniature
      const mercatorumMiniature = getMiniature(LAB_TYPES.MERCATORUM);
      const blekingeMiniature = getMiniature(LAB_TYPES.BLEKINGE);
      const opbgMiniature = getMiniature(LAB_TYPES.OPBG);
      
      // Debug dei valori delle chiavi
      console.debug("Lab type keys:", {
        mercatorum: LAB_TYPES.MERCATORUM,
        blekinge: LAB_TYPES.BLEKINGE,
        opbg: LAB_TYPES.OPBG
      });
      
      // Debug delle miniature trovate
      console.debug("Miniatures found:", {
        mercatorum: !!mercatorumMiniature,
        blekinge: !!blekingeMiniature,
        opbg: !!opbgMiniature
      });
      
      // Aggiorna le miniature in modo sicuro
      if (mercatorumMiniature && typeof mercatorumMiniature.updateAgentPositions === 'function') {
        mercatorumMiniature.updateAgentPositions(mercatorumAgentsWithMiniCoords);
      }
      
      if (blekingeMiniature && typeof blekingeMiniature.updateAgentPositions === 'function') {
        blekingeMiniature.updateAgentPositions(blekingeAgentsWithMiniCoords);
      }
      
      if (opbgMiniature && typeof opbgMiniature.updateAgentPositions === 'function') {
        opbgMiniature.updateAgentPositions(opbgAgentsWithMiniCoords);
      }
    } catch (error) {
      console.error("Error updating lab miniatures:", error);
    }
  }
}