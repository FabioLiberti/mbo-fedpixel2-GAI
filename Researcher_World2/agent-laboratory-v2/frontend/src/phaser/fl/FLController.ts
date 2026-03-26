import { FLVisualEffects } from './FLVisualEffects';
import { FLState } from './FLState';
import { Agent } from '../sprites/Agent';
import { LabType } from '../types/LabType';
import { LabTypeId, LAB_TYPES } from '../types/LabTypeConstants';
import { BaseLabScene } from '../scenes/BaseLabScene';
import { WorldMapScene } from '../scenes/WorldMapScene';

/**
 * Interfaccia per i dati di stato FL ricevuti dal backend
 */
export interface FLStatusData {
  enabled: boolean;
  currentState: string;
  activeAgents: Array<{
    id: string;
    state: string;
    labType: string; // ID del laboratorio
    agentType: string;
  }>;
  metrics: {
    accuracy?: number;
    loss?: number;
    round?: number;
    clientFraction?: number;
    accuracyHistory?: number[];
    lossHistory?: number[];
    perClient?: Array<Record<string, { accuracy: number; loss: number }>>;
    localVsGlobal?: Record<string, { local_acc: number; global_acc: number; gain: number }>;
    crossEval?: Record<string, { accuracy: number; loss: number; samples: number }>;
  };
  dp?: {
    enabled: boolean;
    epsilon_total: number;
    epsilon_spent: number;
    epsilon_remaining: number;
    budget_fraction: number;
    noise_multiplier: number;
    max_grad_norm: number;
    exhausted: boolean;
    per_client_sigma?: Record<string, number>;
  };
  connections: Array<{
    source: string; // ID del laboratorio
    target: string; // ID del laboratorio
    active: boolean;
  }>;
  algorithm?: string;   // "fedavg" | "fedprox"
  mu?: number;          // FedProx proximal term (0..1)
  dataDistribution?: Record<string, {
    n_samples: number;
    age_mean: number;
    age_std: number;
    positive_ratio: number;
    age_histogram: { bins: string[]; counts: number[] };
  }>;
  convergence?: {
    converged: boolean;
    budget_exhausted: boolean;
    rounds_completed: number;
    best_accuracy: number;
    should_stop: boolean;
  };
  fromSimulation?: boolean; // Campo opzionale per indicare se i dati provengono dalla simulazione React
}

/**
 * Controller centrale per gestire gli effetti visivi FL in tutte le scene
 */
export class FLController {
  private static instance: FLController;
  private worldMapEffects: FLVisualEffects | null = null;
  private labEffects: Map<LabTypeId, FLVisualEffects> = new Map();
  private enabled: boolean = false;
  private currentState: string = FLState.IDLE;
  private activeAgents: Map<string, { 
    agent: Agent | null;
    state: FLState;
    labTypeId: LabTypeId;
  }> = new Map();
  private connections: Array<{
    source: LabTypeId;
    target: LabTypeId;
    active: boolean;
  }> = [];

  /**
   * Ottiene l'istanza singleton del controller
   */
  public static getInstance(): FLController {
    if (!FLController.instance) {
      FLController.instance = new FLController();
    }
    return FLController.instance;
  }

  /**
   * Inizializza gli effetti visivi per la scena della mappa mondiale
   */
  public initWorldMapEffects(scene: WorldMapScene): void {
    this.worldMapEffects = new FLVisualEffects(scene);
    this.updateWorldMapVisuals();
  }

  /**
   * Inizializza gli effetti visivi per una scena di laboratorio
   */
  public initLabEffects(scene: BaseLabScene): void {
    const labTypeId = scene.getLabTypeId();
    this.labEffects.set(labTypeId, new FLVisualEffects(scene));
    this.updateLabVisuals(labTypeId);
  }

  /**
   * Aggiorna lo stato FL in base ai dati ricevuti dal backend
   */
  public updateFLStatus(data: FLStatusData): void {
    this.enabled = data.enabled;
    this.currentState = data.currentState;

    // Aggiorna le informazioni sugli agenti attivi
    this.activeAgents.clear();
    data.activeAgents.forEach(agentData => {
      this.activeAgents.set(agentData.id, {
        agent: null, // L'agente effettivo verrà associato quando trovato in una scena
        state: agentData.state as FLState,
        labTypeId: agentData.labType as LabTypeId
      });
    });

    // Aggiorna le connessioni tra laboratori
    this.connections = data.connections.map(conn => ({
      source: conn.source as LabTypeId,
      target: conn.target as LabTypeId,
      active: conn.active
    }));

    // Aggiorna tutti gli effetti visivi
    this.updateAllVisuals();
  }

  /**
   * Associa un'istanza di agente in gioco con i dati FL
   */
  public registerAgent(agentId: string, agent: Agent, labTypeId: LabTypeId): void {
    if (this.activeAgents.has(agentId)) {
      const agentData = this.activeAgents.get(agentId)!;
      agentData.agent = agent;
      agentData.labTypeId = labTypeId;
    }

    // Aggiorna gli effetti visivi per il laboratorio specifico
    this.updateLabVisuals(labTypeId);
  }

  /**
   * Aggiorna tutti gli effetti visivi in tutte le scene
   */
  private updateAllVisuals(): void {
    // Aggiorna gli effetti nella mappa mondiale
    this.updateWorldMapVisuals();

    // Aggiorna gli effetti in tutti i laboratori
    this.labEffects.forEach((_, labTypeId) => {
      this.updateLabVisuals(labTypeId);
    });
  }

  /**
   * Aggiorna gli effetti visivi nella mappa mondiale
   */
  private updateWorldMapVisuals(): void {
    if (!this.worldMapEffects || !this.enabled) return;

    // Aggiorna le connessioni tra laboratori nella mappa mondiale
    this.connections.forEach(conn => {
      this.worldMapEffects?.updateConnection(
        conn.source,
        conn.target,
        conn.active
      );
    });
  }

  /**
   * Aggiorna gli effetti visivi in un laboratorio specifico
   */
  private updateLabVisuals(labTypeId: LabTypeId): void {
    const labEffects = this.labEffects.get(labTypeId);
    if (!labEffects || !this.enabled) return;

    // Aggiorna gli indicatori di stato per gli agenti in questo laboratorio
    this.activeAgents.forEach(agentData => {
      if (agentData.labTypeId === labTypeId && agentData.agent) {
        labEffects.updateAgentState(agentData.agent, agentData.state);
      }
    });

    // Aggiorna le connessioni per questo laboratorio
    this.connections.forEach(conn => {
      if (conn.source === labTypeId || conn.target === labTypeId) {
        labEffects.updateConnection(
          conn.source,
          conn.target,
          conn.active
        );
      }
    });
  }

  /**
   * Pulisce gli effetti visivi per una scena di laboratorio
   */
  public clearLabEffects(labTypeId: LabTypeId): void {
    const labEffects = this.labEffects.get(labTypeId);
    if (labEffects) {
      labEffects.clear();
      this.labEffects.delete(labTypeId);
    }
  }

  /**
   * Pulisce gli effetti visivi per la mappa mondiale
   */
  public clearWorldMapEffects(): void {
    if (this.worldMapEffects) {
      this.worldMapEffects.clear();
      this.worldMapEffects = null;
    }
  }

  /**
   * Pulisce tutti gli effetti visivi
   */
  public clearAllEffects(): void {
    this.clearWorldMapEffects();
    Array.from(this.labEffects.keys()).forEach(labTypeId => {
      this.clearLabEffects(labTypeId);
    });
  }

  /**
   * Verifica se il FL è abilitato
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Ottiene lo stato corrente del FL
   */
  public getCurrentState(): string {
    return this.currentState;
  }

  /**
   * Ottiene le informazioni sugli agenti attivi nel FL
   */
  public getActiveAgents(): Map<string, { 
    agent: Agent | null;
    state: FLState;
    labTypeId: LabTypeId;
  }> {
    return this.activeAgents;
  }

  /**
   * Ottiene gli agenti attivi filtrati per laboratorio
   */
  public getAgentsByLab(labTypeId: LabTypeId): Map<string, {
    agent: Agent | null;
    state: FLState;
    labTypeId: LabTypeId;
  }> {
    const filtered = new Map<string, { agent: Agent | null; state: FLState; labTypeId: LabTypeId }>();
    this.activeAgents.forEach((data, id) => {
      if (data.labTypeId === labTypeId) {
        filtered.set(id, data);
      }
    });
    return filtered;
  }

  /**
   * Ottiene le informazioni sulle connessioni attive
   */
  public getConnections(): Array<{
    source: LabTypeId;
    target: LabTypeId;
    active: boolean;
  }> {
    return this.connections;
  }
}