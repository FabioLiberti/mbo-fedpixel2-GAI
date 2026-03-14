// frontend/src/phaser/fl/FLDialogIntegrator.ts

import { DialogController } from '../controllers/DialogController';
import { FLController } from './FLController';
import { FLDialogType } from '../types/DialogTypes';

/**
 * Interfaccia per gli eventi di Federated Learning
 */
interface FLEventData {
  agentId?: string;
  sourceAgentId?: string;
  targetAgentId?: string;
  accuracy?: number;
  round?: number;
  [key: string]: any; // Per proprietà aggiuntive
}

/**
 * Classe che integra i dialoghi con il sistema di Federated Learning
 */
export class FLDialogIntegrator {
  private dialogController: DialogController;
  private flController: FLController;
  private scene: Phaser.Scene;
  
  constructor(dialogController: DialogController, flController: FLController, scene: Phaser.Scene) {
    this.dialogController = dialogController;
    this.flController = flController;
    this.scene = scene; // Prendi la scena come parametro del costruttore
    
    this.initEventListeners();
  }
  
  private initEventListeners(): void {
    // Accesso diretto a scene.game
    const game = this.scene.game;
    
    // Eventi relativi al Federated Learning
    game.events.on('fl-model-update', (data: FLEventData) => {
      this.handleModelUpdateEvent(data);
    });
    
    game.events.on('fl-data-sharing', (data: FLEventData) => {
      this.handleDataSharingEvent(data);
    });
    
    game.events.on('fl-privacy-check', (data: FLEventData) => {
      this.handlePrivacyCheckEvent(data);
    });
    
    game.events.on('fl-research-progress', (data: FLEventData) => {
      this.handleResearchProgressEvent(data);
    });
  }
  
  /**
   * Gestisce l'evento di aggiornamento del modello FL
   */
  private handleModelUpdateEvent(data: FLEventData): void {
    if (!data.agentId) return;
    
    // Genera un dialogo appropriato per l'aggiornamento del modello
    this.createModelUpdateDialog(data.agentId, data);
  }
  
  /**
   * Crea un dialogo per l'aggiornamento del modello
   */
  private createModelUpdateDialog(agentId: string, data: FLEventData): void {
    // Genera un dialogo appropriato per l'aggiornamento del modello
    this.dialogController.createDialog({
      sourceId: agentId,
      type: FLDialogType.MODEL,
      text: this.getModelUpdateMessage(data),
      showEffect: true
    });
  }
  
  /**
   * Gestisce l'evento di condivisione dati
   */
  private handleDataSharingEvent(data: FLEventData): void {
    if (!data.sourceAgentId || !data.targetAgentId) return;
    
    // Avvia un dialogo tra gli agenti coinvolti nella condivisione dati
    this.createDataSharingDialog(data.sourceAgentId, data.targetAgentId, data);
  }
  
  /**
   * Crea un dialogo per la condivisione dati
   */
  private createDataSharingDialog(sourceAgentId: string, targetAgentId: string, data: FLEventData): void {
    this.dialogController.createDialog({
      sourceId: sourceAgentId,
      targetId: targetAgentId,
      type: FLDialogType.DATA,
      text: "Condivisione dati sicura in corso...",
      showEffect: true
    });
  }
  
  /**
   * Gestisce l'evento di controllo privacy
   */
  private handlePrivacyCheckEvent(data: FLEventData): void {
    if (!data.agentId) return;
    
    // Genera un dialogo appropriato per il controllo privacy
    this.createPrivacyCheckDialog(data.agentId, data);
  }
  
  /**
   * Crea un dialogo per il controllo privacy
   */
  private createPrivacyCheckDialog(agentId: string, data: FLEventData): void {
    this.dialogController.createDialog({
      sourceId: agentId,
      type: FLDialogType.PRIVACY,
      text: this.getPrivacyCheckMessage(data),
      showEffect: true
    });
  }
  
  /**
   * Gestisce l'evento di progresso nella ricerca
   */
  private handleResearchProgressEvent(data: FLEventData): void {
    if (!data.agentId) return;
    
    // Genera un dialogo appropriato per il progresso nella ricerca
    this.createResearchProgressDialog(data.agentId, data);
  }
  
  /**
   * Crea un dialogo per il progresso nella ricerca
   */
  private createResearchProgressDialog(agentId: string, data: FLEventData): void {
    this.dialogController.createDialog({
      sourceId: agentId,
      type: FLDialogType.RESEARCH,
      text: this.getResearchProgressMessage(data),
      showEffect: true
    });
  }
  
  /**
   * Ottiene un messaggio personalizzato per l'aggiornamento del modello
   */
  private getModelUpdateMessage(data: FLEventData): string {
    const messages = [
      "Modello aggiornato, precisione migliorata del " + Math.floor(Math.random() * 5 + 1) + "%!",
      "Ho ottimizzato i parametri del modello",
      "La convergenza sta migliorando"
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }
  
  /**
   * Ottiene un messaggio personalizzato per il controllo privacy
   */
  private getPrivacyCheckMessage(data: FLEventData): string {
    const messages = [
      "Privacy budget sotto controllo",
      "Verificando meccanismi di protezione dati",
      "Applicando differential privacy"
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }
  
  /**
   * Ottiene un messaggio personalizzato per il progresso nella ricerca
   */
  private getResearchProgressMessage(data: FLEventData): string {
    const messages = [
      "Nuova intuizione sul modello federato!",
      "Ho trovato un approccio innovativo",
      "Questo algoritmo potrebbe essere rivoluzionario"
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }
  
  /**
   * Pulisce le risorse quando non più necessarie
   */
  public destroy(): void {
    const game = this.scene.game;
    
    // Rimuovi gli ascoltatori di eventi
    game.events.off('fl-model-update');
    game.events.off('fl-data-sharing');
    game.events.off('fl-privacy-check');
    game.events.off('fl-research-progress');
  }
}