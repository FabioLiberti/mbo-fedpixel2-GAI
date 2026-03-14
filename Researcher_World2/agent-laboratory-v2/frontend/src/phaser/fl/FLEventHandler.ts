import { FLController, FLStatusData } from './FLController';
import { Agent } from '../sprites/Agent';
import { LabTypeId, LAB_TYPES } from '../types/LabTypeConstants';

/**
 * Gestore degli eventi relativi al Federated Learning tra il frontend React e il gioco Phaser
 */
export class FLEventHandler {
  private game: Phaser.Game;
  private flController: FLController;

  constructor(game: Phaser.Game) {
    this.game = game;
    this.flController = FLController.getInstance();
    this.initEventListeners();
  }

  /**
   * Inizializza i listener di eventi
   */
  private initEventListeners(): void {
    // Ascolta gli aggiornamenti di stato FL da React
    this.game.events.on('updateFLStatus', this.handleFLStatusUpdate, this);
    
    // Ascolta la registrazione di nuovi agenti
    this.game.events.on('agentCreated', this.handleAgentCreated, this);

    // Ascolta rimozione delle scene
    this.game.events.on('sceneShutdown', this.handleSceneShutdown, this);
  }

  /**
   * Gestisce gli aggiornamenti di stato FL da React
   */
  private handleFLStatusUpdate(flStatus: FLStatusData): void {
    this.flController.updateFLStatus(flStatus);
  }

  /**
   * Gestisce la creazione di un nuovo agente
   */
  private handleAgentCreated(agent: Agent, agentId: string, labTypeId: LabTypeId): void {
    this.flController.registerAgent(agentId, agent, labTypeId);
  }

  /**
   * Gestisce lo shutdown di una scena
   */
  private handleSceneShutdown(sceneName: string): void {
    // Determina il tipo di scena in base al nome
    if (sceneName === 'WorldMapScene') {
      this.flController.clearWorldMapEffects();
    } else if (sceneName.includes('LabScene')) {
      // Determina il tipo di laboratorio dal nome della scena
      let labTypeId: LabTypeId | null = null;
      
      if (sceneName.includes('Mercatorum')) {
        labTypeId = LAB_TYPES.MERCATORUM;
      } else if (sceneName.includes('Blekinge')) {
        labTypeId = LAB_TYPES.BLEKINGE;
      } else if (sceneName.includes('OPBG')) {
        labTypeId = LAB_TYPES.OPBG;
      }
      
      if (labTypeId) {
        this.flController.clearLabEffects(labTypeId);
      }
    }
  }

  /**
   * Pulisce tutti i listener di eventi
   */
  public destroy(): void {
    this.game.events.off('updateFLStatus', this.handleFLStatusUpdate, this);
    this.game.events.off('agentCreated', this.handleAgentCreated, this);
    this.game.events.off('sceneShutdown', this.handleSceneShutdown, this);
  }
}