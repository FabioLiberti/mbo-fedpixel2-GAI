// frontend/src/phaser/ui/simple/LLMDialogIntegrator.ts

import { DialogController } from '../../controllers/DialogController';
import { SimpleLLMPanelController } from './SimpleLLMPanelController';
export {};

/**
 * Interfaccia per le opzioni di configurazione
 */
interface LLMDialogIntegratorOptions {
  /** Frequenza di generazione automatica dei messaggi (0-1) */
  autoGenerateFrequency?: number;
  /** Intervallo minimo tra messaggi automatici (ms) */
  minInterval?: number;
  /** Intervallo massimo tra messaggi automatici (ms) */
  maxInterval?: number;
  /** Tipi di messaggi da generare automaticamente */
  messageTypes?: string[];
  /** Numero massimo di agenti da considerare per i dialoghi */
  maxAgents?: number;
  /** Se attivare la generazione automatica all'inizializzazione */
  autoStart?: boolean;
}

/**
 * Classe che integra il controller LLM con il sistema di dialoghi
 * Consente la generazione automatica di messaggi LLM e la loro integrazione nei dialoghi
 */
export class LLMDialogIntegrator {
  private dialogController: DialogController;
  private llmController: SimpleLLMPanelController;
  private scene: Phaser.Scene;
  
  // Configurazione
  private options: Required<LLMDialogIntegratorOptions>;
  
  // Stato
  private isAutoGenerateEnabled: boolean = false;
  private nextAutoGenerateTime: number = 0;
  private timerId: number | null = null;
  
  /**
   * Costruttore
   */
  constructor(
    scene: Phaser.Scene,
    dialogController: DialogController,
    llmController: SimpleLLMPanelController,
    options: LLMDialogIntegratorOptions = {}
  ) {
    this.scene = scene;
    this.dialogController = dialogController;
    this.llmController = llmController;
    
    // Imposta opzioni con default
    this.options = {
      autoGenerateFrequency: options.autoGenerateFrequency ?? 0.5,
      minInterval: options.minInterval ?? 5000, // 5 secondi
      maxInterval: options.maxInterval ?? 15000, // 15 secondi
      messageTypes: options.messageTypes ?? ['dialog', 'thinking', 'decision'],
      maxAgents: options.maxAgents ?? 10,
      autoStart: options.autoStart ?? false
    };
    
    // Avvia generazione automatica se richiesto
    if (this.options.autoStart) {
      this.enableAutoGenerate();
    }
    
    // Registra eventi
    this.registerEvents();
  }
  
  /**
   * Registra gli eventi per l'integrazione
   */
  private registerEvents(): void {
    // Sincronizza con eventi del gioco
    this.scene.events.on('dialog-created', this.handleDialogCreated, this);
    this.scene.events.on('scene-sleep', this.handleSceneSleep, this);
    this.scene.events.on('scene-wake', this.handleSceneWake, this);
  }
  
  /**
   * Gestisce la creazione di un dialogo
   */
  private handleDialogCreated(data: any): void {
    // Se un dialogo è stato creato, aggiorna il contatore
    if (data && data.type) {
      // Resetta il timer per la prossima generazione automatica
      // per evitare troppi dialoghi ravvicinati
      this.resetAutoGenerateTimer();
    }
  }
  
  /**
   * Gestisce la messa in pausa della scena
   */
  private handleSceneSleep(): void {
    // Disabilita temporaneamente la generazione automatica
    if (this.isAutoGenerateEnabled) {
      this.disableAutoGenerate();
      // Memorizza che era attiva
      (this as any)._wasEnabled = true;
    }
  }
  
  /**
   * Gestisce la ripresa della scena
   */
  private handleSceneWake(): void {
    // Riattiva la generazione automatica se era attiva
    if ((this as any)._wasEnabled) {
      this.enableAutoGenerate();
      delete (this as any)._wasEnabled;
    }
  }
  
  /**
   * Abilita la generazione automatica di messaggi
   */
  public enableAutoGenerate(): void {
    if (this.isAutoGenerateEnabled) return;
    
    this.isAutoGenerateEnabled = true;
    this.scheduleNextGeneration();
  }
  
  /**
   * Disabilita la generazione automatica di messaggi
   */
  public disableAutoGenerate(): void {
    this.isAutoGenerateEnabled = false;
    
    // Cancella timer se presente
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
  
  /**
   * Pianifica la prossima generazione automatica
   */
  private scheduleNextGeneration(): void {
    if (!this.isAutoGenerateEnabled) return;
    
    // Cancella timer esistente
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
    }
    
    // Calcola intervallo casuale basato sulla frequenza
    const frequencyFactor = 1 - this.options.autoGenerateFrequency; // Inverti per far sì che freq alta = interval basso
    const range = this.options.maxInterval - this.options.minInterval;
    const interval = this.options.minInterval + (range * frequencyFactor);
    
    // Aggiungi un po' di casualità
    const randomizedInterval = interval * (0.8 + (Math.random() * 0.4)); // ±20%
    
    // Imposta timer
    this.timerId = window.setTimeout(() => {
      this.generateRandomMessage();
      // Pianifica la prossima generazione
      this.scheduleNextGeneration();
    }, randomizedInterval);
  }
  
  /**
   * Resetta il timer per la prossima generazione automatica
   */
  private resetAutoGenerateTimer(): void {
    if (!this.isAutoGenerateEnabled) return;
    
    // Cancella timer esistente
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    
    // Pianifica la prossima generazione con un ritardo più lungo
    this.scheduleNextGeneration();
  }
  
  /**
   * Genera un messaggio casuale
   */
  private generateRandomMessage(): void {
    try {
      // Ottieni agenti disponibili
      const agents = this.getAvailableAgents();
      
      if (agents.length === 0) {
        console.log('Nessun agente disponibile per la generazione di messaggi');
        return;
      }
      
      // Seleziona un agente casuale
      const randomAgentIndex = Math.floor(Math.random() * Math.min(agents.length, this.options.maxAgents));
      const agent = agents[randomAgentIndex];
      
      // Seleziona un tipo di messaggio casuale
      const randomTypeIndex = Math.floor(Math.random() * this.options.messageTypes.length);
      const messageType = this.options.messageTypes[randomTypeIndex];
      
      // Genera messaggio
      this.llmController.generateMessage(agent);
    } catch (error) {
      console.error('Errore nella generazione automatica di messaggi:', error);
    }
  }
  
  /**
   * Ottiene gli agenti disponibili per la generazione di messaggi
   */
  private getAvailableAgents(): any[] {
    // Ottiene gli agenti dalla scena
    // Implementazione semplificata, potrebbe essere necessario modificarla
    // in base a come sono gestiti gli agenti
    try {
      if ((this.scene as any).agents) {
        return (this.scene as any).agents;
      }
      
      if ((this.scene as any).agentController && (this.scene as any).agentController.agents) {
        return (this.scene as any).agentController.agents;
      }
      
      // Cerca tra i figli della scena
      const agents = this.scene.children.getChildren()
        .filter((child: any) => {
          if (!child.getData) return false;
          return child.getData('id') && (child.getData('type') || child.getData('role'));
        })
        .map((agent: any) => {
          return {
            id: agent.getData('id'),
            name: agent.getData('name') || `Agent ${agent.getData('id')}`,
            type: agent.getData('type') || agent.getData('role'),
            role: agent.getData('role') || 'researcher',
            x: agent.x,
            y: agent.y
          };
        });
      
      return agents;
    } catch (error) {
      console.error('Error getting agents:', error);
      return [];
    }
  }
  
  /**
   * Imposta la frequenza di generazione automatica
   */
  public setAutoGenerateFrequency(frequency: number): void {
    this.options.autoGenerateFrequency = Phaser.Math.Clamp(frequency, 0, 1);
  }
  
  /**
   * Imposta i tipi di messaggi da generare automaticamente
   */
  public setMessageTypes(types: string[]): void {
    if (types.length > 0) {
      this.options.messageTypes = types;
    }
  }
  
  /**
   * Distrugge l'integratore e pulisce le risorse
   */
  public destroy(): void {
    // Disabilita generazione automatica
    this.disableAutoGenerate();
    
    // Rimuovi eventi
    this.scene.events.off('dialog-created', this.handleDialogCreated, this);
    this.scene.events.off('scene-sleep', this.handleSceneSleep, this);
    this.scene.events.off('scene-wake', this.handleSceneWake, this);
  }
}