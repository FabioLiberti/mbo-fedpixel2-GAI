// frontend/src/phaser/ui/LLMPanelState.ts

/**
 * Interfaccia per log dei messaggi LLM
 */
export interface LLMLogEntry {
  timestamp: number;
  agentId: string;
  agentName: string;
  text: string;
  type: string;
  isSimulated?: boolean; // Indica se è un messaggio simulato o reale
  modelInfo?: {
    name: string;
    temperature: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
}

/**
 * Interfaccia per le statistiche di dialogo estese
 */
export interface ExtendedDialogStatistics {
  llm: number;
  standard: number;
  simulated?: number;
}

/**
 * Classe per gestire lo stato del pannello di controllo LLM
 */
export class LLMPanelState {
  // Valori e stato
  private isLLMEnabled: boolean = true;
  private messageFrequency: number = 0.5; // 0-1 range
  private selectedMessageType: string = 'dialog'; // dialog, thinking, decision
  private messageLog: LLMLogEntry[] = [];
  private llmDialogCount: number = 0;
  private standardDialogCount: number = 0;
  private simulatedDialogCount: number = 0;
  private isBackendConnected: boolean = false;
  private maxLogEntries: number = 50;
  private stateVersion: number = 1; // Per gestire migrazioni future
  private lastSaveTime: number = 0;
  private saveInterval: number = 5000; // Salva lo stato al massimo ogni 5 secondi

  // Chiave LocalStorage
  private readonly storageKey: string = 'llm_control_panel_state';

  // Informazioni modello LLM predefinite
  private defaultModelInfo = {
    name: 'qwen3:0.6b',
    temperature: 0.7,
    maxTokens: 1024,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0
  };

  constructor() {
    // Carica automaticamente lo stato all'inizializzazione
    this.loadState();
  }

  /**
   * Carica lo stato da localStorage
   */
  public loadState(): void {
    try {
      const savedState = localStorage.getItem(this.storageKey);
      if (!savedState) return;
      
      const state = JSON.parse(savedState);
      
      // Controlla versione dello stato
      if (state.stateVersion !== undefined && state.stateVersion >= 1) {
        // Aggiorna proprietà
        this.isLLMEnabled = state.isLLMEnabled !== undefined ? state.isLLMEnabled : true;
        this.messageFrequency = state.messageFrequency !== undefined ? state.messageFrequency : 0.5;
        this.selectedMessageType = state.selectedMessageType || 'dialog';
        
        // Carica contatori messaggi se disponibili
        if (state.llmDialogCount !== undefined) this.llmDialogCount = state.llmDialogCount;
        if (state.standardDialogCount !== undefined) this.standardDialogCount = state.standardDialogCount;
        if (state.simulatedDialogCount !== undefined) this.simulatedDialogCount = state.simulatedDialogCount;
        
        // Carica log messaggi se disponibile
        if (state.messageLog && Array.isArray(state.messageLog)) {
          this.messageLog = state.messageLog;
        }
      } else {
        // Versione vecchia o non specificata, applica migrazione semplice
        this.isLLMEnabled = state.isLLMEnabled !== undefined ? state.isLLMEnabled : true;
        this.messageFrequency = state.messageFrequency !== undefined ? state.messageFrequency : 0.5;
        this.selectedMessageType = state.selectedMessageType || 'dialog';
      }
      
      // Imposta tempo ultimo salvataggio
      this.lastSaveTime = Date.now();
    } catch (error) {
      console.error('Error loading LLM panel state:', error);
      // In caso di errore, inizializza con valori di default
      this.resetToDefaults();
    }
  }

  /**
   * Salva lo stato corrente in localStorage
   */
  public saveState(): void {
    try {
      // Limita la frequenza dei salvataggi
      const now = Date.now();
      if (now - this.lastSaveTime < this.saveInterval) {
        return;
      }
      
      this.lastSaveTime = now;
      
      const state = {
        stateVersion: this.stateVersion,
        isLLMEnabled: this.isLLMEnabled,
        messageFrequency: this.messageFrequency,
        selectedMessageType: this.selectedMessageType,
        messageLog: this.messageLog.slice(0, this.maxLogEntries),
        llmDialogCount: this.llmDialogCount,
        standardDialogCount: this.standardDialogCount,
        simulatedDialogCount: this.simulatedDialogCount,
        lastSaveTime: now
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving LLM panel state:', error);
    }
  }

  /**
   * Ripristina lo stato a valori predefiniti
   */
  public resetToDefaults(): void {
    this.isLLMEnabled = true;
    this.messageFrequency = 0.5;
    this.selectedMessageType = 'dialog';
    this.messageLog = [];
    this.llmDialogCount = 0;
    this.standardDialogCount = 0;
    this.simulatedDialogCount = 0;
    
    // Salva lo stato predefinito
    this.saveState();
  }

  /**
   * Aggiunge un'entrata al log messaggi
   */
  public addLogEntry(entry: LLMLogEntry): void {
    try {
      // Aggiungi informazioni del modello se non presenti
      if (!entry.modelInfo) {
        entry.modelInfo = {...this.defaultModelInfo};
      }
      
      // Se il backend è disconnesso, marca il messaggio come simulato
      if (!this.isBackendConnected && !entry.isSimulated) {
        entry.isSimulated = true;
      }
      
      // Aggiungi il nuovo messaggio all'inizio del log
      this.messageLog.unshift(entry);
      
      // Limita il numero di messaggi nel log
      if (this.messageLog.length > this.maxLogEntries) {
        this.messageLog.pop();
      }
      
      // Incrementa automaticamente i contatori in base al tipo
      this.updateCountersFromEntry(entry);
      
      // Salva il log
      this.saveState();
    } catch (error) {
      console.error('Error adding log entry:', error);
    }
  }

  /**
   * Aggiorna i contatori in base a una nuova entrata
   */
  private updateCountersFromEntry(entry: LLMLogEntry): void {
    try {
      if (entry.isSimulated) {
        this.simulatedDialogCount++;
      } else if (entry.type === 'dialog') {
        this.llmDialogCount++;
      } else {
        this.standardDialogCount++;
      }
    } catch (error) {
      console.error('Error updating counters:', error);
    }
  }

  // Getters
  public getIsLLMEnabled(): boolean {
    return this.isLLMEnabled;
  }

  public getMessageFrequency(): number {
    return this.messageFrequency;
  }

  public getSelectedMessageType(): string {
    return this.selectedMessageType;
  }

  public getMessageLog(): LLMLogEntry[] {
    return [...this.messageLog];
  }

  public getDialogCounts(): { llm: number, standard: number, simulated: number } {
    return {
      llm: this.llmDialogCount,
      standard: this.standardDialogCount,
      simulated: this.simulatedDialogCount
    };
  }

  public getDefaultModelInfo(): any {
    return {...this.defaultModelInfo};
  }

  public getIsBackendConnected(): boolean {
    return this.isBackendConnected;
  }

  public getMaxLogEntries(): number {
    return this.maxLogEntries;
  }

  // Setters
  public setIsLLMEnabled(value: boolean): void {
    if (this.isLLMEnabled !== value) {
      this.isLLMEnabled = value;
      this.saveState();
    }
  }

  public setMessageFrequency(value: number): void {
    if (this.messageFrequency !== value) {
      this.messageFrequency = value;
      this.saveState();
    }
  }

  public setSelectedMessageType(value: string): void {
    if (this.selectedMessageType !== value) {
      this.selectedMessageType = value;
      this.saveState();
    }
  }

  public setIsBackendConnected(value: boolean): void {
    this.isBackendConnected = value;
  }

  public setMaxLogEntries(value: number): void {
    if (value > 0 && value !== this.maxLogEntries) {
      this.maxLogEntries = value;
      
      // Tronca il log se necessario
      if (this.messageLog.length > this.maxLogEntries) {
        this.messageLog = this.messageLog.slice(0, this.maxLogEntries);
      }
      
      this.saveState();
    }
  }

  public updateDialogCounts(counts: { llm?: number, standard?: number, simulated?: number }): void {
    let hasChanges = false;
    
    if (counts.llm !== undefined && counts.llm !== this.llmDialogCount) {
      this.llmDialogCount = counts.llm;
      hasChanges = true;
    }
    
    if (counts.standard !== undefined && counts.standard !== this.standardDialogCount) {
      this.standardDialogCount = counts.standard;
      hasChanges = true;
    }
    
    if (counts.simulated !== undefined && counts.simulated !== this.simulatedDialogCount) {
      this.simulatedDialogCount = counts.simulated;
      hasChanges = true;
    }
    
    if (hasChanges) {
      this.saveState();
    }
  }

  /**
   * Ottiene il colore per il tipo di messaggio
   */
  public getColorForType(type: string, isSimulated: boolean = false): string {
    // Se è simulato, usa colori più tenui
    if (isSimulated) {
      switch (type.toLowerCase()) {
        case 'dialog':
          return '#7baf7e'; // Verde più chiaro
        case 'thinking':
          return '#ffbb33'; // Arancione più chiaro
        case 'decision':
          return '#64b5f6'; // Blu più chiaro
        default:
          return '#dddddd';
      }
    }
    
    // Altrimenti, usa colori standard
    switch (type.toLowerCase()) {
      case 'dialog':
        return '#4caf50';
      case 'thinking':
        return '#ff9800';
      case 'decision':
        return '#2196f3';
      default:
        return '#bbbbbb';
    }
  }
  
  /**
   * Cancella il log dei messaggi
   */
  public clearMessageLog(): void {
    this.messageLog = [];
    this.saveState();
  }
  
  /**
   * Ripristina i contatori
   */
  public resetCounters(): void {
    this.llmDialogCount = 0;
    this.standardDialogCount = 0;
    this.simulatedDialogCount = 0;
    this.saveState();
  }
}