// frontend/src/phaser/ui/simple/SimpleLLMPanelModel.ts

/**
 * Interfaccia per log dei messaggi LLM
 */
export interface SimpleLLMLogEntry {
    id: string;               // ID unico per ogni messaggio
    timestamp: number;        // Timestamp del messaggio
    agentId: string;          // ID dell'agente
    agentName: string;        // Nome dell'agente
    text: string;             // Testo del messaggio
    type: string;             // Tipo: dialog, thinking, decision
    category: string;         // Categoria: llm, simulated, standard
    modelInfo?: {             // Informazioni sul modello LLM
      name: string;
      temperature: number;
      maxTokens?: number;
    };
  }
  
  /**
   * Interfaccia per gli eventi del modello
   */
  export type SimpleLLMModelEvent = 
    | { type: 'toggle-changed', enabled: boolean }
    | { type: 'message-type-changed', messageType: string }
    | { type: 'frequency-changed', frequency: number }
    | { type: 'log-updated', entries: SimpleLLMLogEntry[] }
    | { type: 'stats-updated', stats: { llm: number, simulated: number, standard: number } }
    | { type: 'backend-status-changed', connected: boolean };
  
  /**
   * Tipo di listener per gli eventi del modello
   */
  export type SimpleLLMModelEventListener = (event: SimpleLLMModelEvent) => void;
  
  /**
   * Classe che rappresenta il modello di dati per il pannello di controllo LLM semplificato
   * Segue il pattern Observer per notificare i cambiamenti di stato
   */
  export class SimpleLLMPanelModel {
    private isLLMEnabled: boolean = true;
    private messageFrequency: number = 0.5;
    private selectedMessageType: string = 'dialog';
    private messageLog: SimpleLLMLogEntry[] = [];
    private isBackendConnected: boolean = false;
    private llmCount: number = 0;
    private simulatedCount: number = 0;
    private standardCount: number = 0;
    private maxLogEntries: number = 50;
    private storageKey: string = 'simple_llm_panel_state';
    private listeners: SimpleLLMModelEventListener[] = [];
    
    private defaultModelInfo = {
      name: 'qwen3:0.6b',
      temperature: 0.7,
      maxTokens: 1024
    };
    
    constructor() {
      this.loadState();
    }
    
    /**
     * Aggiunge un listener per gli eventi del modello
     */
    public addEventListener(listener: SimpleLLMModelEventListener): void {
      this.listeners.push(listener);
    }
    
    /**
     * Rimuove un listener dagli eventi del modello
     */
    public removeEventListener(listener: SimpleLLMModelEventListener): void {
      this.listeners = this.listeners.filter(l => l !== listener);
    }
    
    /**
     * Notifica tutti i listener di un evento
     */
    private notifyListeners(event: SimpleLLMModelEvent): void {
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      }
    }
    
    /**
     * Carica lo stato dal localStorage
     */
    public loadState(): void {
      try {
        const savedState = localStorage.getItem(this.storageKey);
        if (!savedState) return;
        
        const state = JSON.parse(savedState);
        
        // Aggiorna proprietà
        this.isLLMEnabled = state.isLLMEnabled !== undefined ? state.isLLMEnabled : true;
        this.messageFrequency = state.messageFrequency !== undefined ? state.messageFrequency : 0.5;
        this.selectedMessageType = state.selectedMessageType || 'dialog';
        
        // Carica contatori
        if (state.llmCount !== undefined) this.llmCount = state.llmCount;
        if (state.simulatedCount !== undefined) this.simulatedCount = state.simulatedCount;
        if (state.standardCount !== undefined) this.standardCount = state.standardCount;
        
        // Carica log messaggi
        if (state.messageLog && Array.isArray(state.messageLog)) {
          this.messageLog = state.messageLog;
        }
        
        // Notifica cambiamenti
        this.notifyStatsUpdated();
        this.notifyLogUpdated();
      } catch (error) {
        console.error('Error loading LLM panel state:', error);
      }
    }
    
    /**
     * Salva lo stato nel localStorage
     */
    public saveState(): void {
      try {
        const state = {
          isLLMEnabled: this.isLLMEnabled,
          messageFrequency: this.messageFrequency,
          selectedMessageType: this.selectedMessageType,
          messageLog: this.messageLog.slice(0, this.maxLogEntries),
          llmCount: this.llmCount,
          simulatedCount: this.simulatedCount,
          standardCount: this.standardCount
        };
        
        localStorage.setItem(this.storageKey, JSON.stringify(state));
      } catch (error) {
        console.error('Error saving LLM panel state:', error);
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
    
    public getMessageLog(): SimpleLLMLogEntry[] {
      return [...this.messageLog];
    }
    
    public getStats(): { llm: number, simulated: number, standard: number } {
      return {
        llm: this.llmCount,
        simulated: this.simulatedCount,
        standard: this.standardCount
      };
    }
    
    public getIsBackendConnected(): boolean {
      return this.isBackendConnected;
    }
    
    public getDefaultModelInfo(): any {
      return {...this.defaultModelInfo};
    }
    
    // Setters con notifica eventi
    public setIsLLMEnabled(value: boolean): void {
      if (this.isLLMEnabled !== value) {
        this.isLLMEnabled = value;
        this.saveState();
        this.notifyListeners({ type: 'toggle-changed', enabled: value });
      }
    }
    
    public setMessageFrequency(value: number): void {
      if (this.messageFrequency !== value) {
        this.messageFrequency = value;
        this.saveState();
        this.notifyListeners({ type: 'frequency-changed', frequency: value });
      }
    }
    
    public setSelectedMessageType(value: string): void {
      if (this.selectedMessageType !== value) {
        this.selectedMessageType = value;
        this.saveState();
        this.notifyListeners({ type: 'message-type-changed', messageType: value });
      }
    }
    
    public setIsBackendConnected(value: boolean): void {
      if (this.isBackendConnected !== value) {
        this.isBackendConnected = value;
        this.notifyListeners({ type: 'backend-status-changed', connected: value });
      }
    }
    
    /**
     * Aggiunge un'entrata al log messaggi
     */
    public addLogEntry(entry: Omit<SimpleLLMLogEntry, 'id'>): void {
      try {
        // Crea un ID unico
        const id = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Crea il nuovo messaggio con ID
        const newEntry: SimpleLLMLogEntry = {
          id,
          ...entry
        };
        
        // Aggiunge all'inizio del log
        this.messageLog.unshift(newEntry);
        
        // Limita la dimensione del log
        if (this.messageLog.length > this.maxLogEntries) {
          this.messageLog = this.messageLog.slice(0, this.maxLogEntries);
        }
        
        // Incrementa contatore in base alla categoria
        if (entry.category === 'llm') {
          this.llmCount++;
        } else if (entry.category === 'simulated') {
          this.simulatedCount++;
        } else if (entry.category === 'standard') {
          this.standardCount++;
        }
        
        // Salva stato e notifica
        this.saveState();
        this.notifyLogUpdated();
        this.notifyStatsUpdated();
      } catch (error) {
        console.error('Error adding log entry:', error);
      }
    }
    
    /**
     * Incrementa un contatore specifico
     */
    public incrementCounter(category: 'llm' | 'simulated' | 'standard'): void {
      if (category === 'llm') {
        this.llmCount++;
      } else if (category === 'simulated') {
        this.simulatedCount++;
      } else if (category === 'standard') {
        this.standardCount++;
      }
      
      this.saveState();
      this.notifyStatsUpdated();
    }
    
    /**
     * Reset dei contatori
     */
    public resetCounters(): void {
      this.llmCount = 0;
      this.simulatedCount = 0;
      this.standardCount = 0;
      
      this.saveState();
      this.notifyStatsUpdated();
    }
    
    /**
     * Cancella il log
     */
    public clearLog(): void {
      this.messageLog = [];
      this.saveState();
      this.notifyLogUpdated();
    }
    
    /**
     * Notifica che il log è stato aggiornato
     */
    private notifyLogUpdated(): void {
      this.notifyListeners({
        type: 'log-updated',
        entries: this.getMessageLog()
      });
    }
    
    /**
     * Notifica che le statistiche sono state aggiornate
     */
    private notifyStatsUpdated(): void {
      this.notifyListeners({
        type: 'stats-updated',
        stats: this.getStats()
      });
    }
  }