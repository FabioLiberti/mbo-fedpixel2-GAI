// frontend/src/phaser/ui/LLMMessagingService.ts

import { LLMLogEntry } from './LLMPanelState';

/**
 * Interfaccia per messaggi di errore
 */
interface ErrorWithMessage {
  message: string;
}

/**
 * Interfaccia per la risposta dell'API di stato LLM
 */
interface LLMStatusResponse {
  available: boolean;
  model?: string;
  message?: string;
}

/**
 * Verifica se l'errore ha una proprietà message
 */
function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Converte un errore in un messaggio di errore leggibile
 */
function toErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return String(error);
}

/**
 * Servizio per gestire la comunicazione con il backend per i messaggi LLM
 */
export class LLMMessagingService {
  private isBackendConnected: boolean = false;
  private lastBackendCheck: number = 0;
  private checkInterval: number = 5000;
  private defaultModelInfo: any;
  private apiBaseUrl: string;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private simulatedDialogs: string[] = [
    "I'm researching Federated Learning in federated learning.",
    "Let's analyze this federated learning approach in more detail.",
    "I've been working on optimizing the client selection algorithm.",
    "Have you considered the impact of non-IID data distribution on model convergence?",
    "We should implement differential privacy techniques to enhance the security.",
    "The communication efficiency could be improved with model compression."
  ];
  
  private simulatedThinking: string[] = [
    "The current aggregation method might be introducing bias due to the heterogeneous data sources...",
    "If we implement quantization on the client updates, we could reduce bandwidth by 70% while maintaining accuracy...",
    "The privacy-utility tradeoff is crucial here - increasing epsilon improves model performance but reduces privacy guarantees...",
    "What if we implemented a dynamic client selection strategy based on data quality and computational resources?",
    "The convergence rate seems to slow down after round 15, possibly due to client drift..."
  ];
  
  private simulatedDecisions: string[] = [
    "Decision: We should implement FedProx instead of FedAvg to handle the non-IID data distribution across clients.",
    "Decision: Implementing secure aggregation protocol to enhance privacy guarantees for sensitive medical data.",
    "Decision: We'll adopt adaptive learning rates for clients based on their local data distributions.",
    "Decision: Implement knowledge distillation on the server to reduce the model size before distribution.",
    "Decision: Applying differential privacy with a gradually decreasing epsilon value throughout training."
  ];
  
  constructor(defaultModelInfo: any) {
    this.defaultModelInfo = defaultModelInfo;
    
    // Determina l'URL base dell'API
    this.apiBaseUrl = this.getApiBaseUrl();
    
    // Controlla subito lo stato del backend
    this.checkBackendStatus();
  }
  
  /**
   * Ottiene l'URL base dell'API
   */
  private getApiBaseUrl(): string {
    // Cerca di ottenere l'URL base da una variabile di ambiente o config
    const apiUrl = (window as any).API_BASE_URL;
    
    if (apiUrl) {
      return apiUrl;
    }
    
    // Altrimenti, costruisci l'URL in base all'host corrente
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    // Usa la porta 8091 per lo sviluppo locale
    return `${protocol}//${hostname}:8091`;
  }
  
  /**
   * Controlla lo stato del backend
   */
  public async checkBackendStatus(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastBackendCheck < this.checkInterval) {
      console.log('[LLMMessagingService] Using cached backend status:', this.isBackendConnected);
      return this.isBackendConnected;
    }

    try {
      console.log('[LLMMessagingService] Checking backend status...');
      const response = await fetch(`${this.apiBaseUrl}/ai/status`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      const wasConnected = this.isBackendConnected;
      this.isBackendConnected = response.ok;
      this.lastBackendCheck = now;
      
      if (wasConnected !== this.isBackendConnected) {
        console.log(`[LLMMessagingService] Backend connection status changed: ${this.isBackendConnected ? 'Connected' : 'Disconnected'}`);
        
        // Emetti un evento per notificare il cambio di stato
        const event = new CustomEvent('backend-status-changed', {
          detail: { connected: this.isBackendConnected }
        });
        window.dispatchEvent(event);
      }
      
      if (!this.isBackendConnected) {
        console.warn('[LLMMessagingService] Backend is not connected, using simulated messages');
        console.warn('[LLMMessagingService] Please ensure the backend server is running on port 8091');
      } else {
        console.log('[LLMMessagingService] Backend is connected and ready');
      }
      
      return this.isBackendConnected;
    } catch (error) {
      console.error('[LLMMessagingService] Error checking backend status:', error);
      this.isBackendConnected = false;
      this.lastBackendCheck = now;
      
      // Emetti un evento per notificare l'errore
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const event = new CustomEvent('backend-status-error', {
        detail: { error: errorMessage }
      });
      window.dispatchEvent(event);
      
      return false;
    }
  }
  
  /**
   * Genera un messaggio LLM o simulato
   */
  public async generateMessage(agentData: any, messageType: string): Promise<LLMLogEntry> {
    try {
      console.log(`[LLMMessagingService] Generating message for agent ${agentData.id} (${agentData.name || 'unnamed'})`);
      console.log(`[LLMMessagingService] Message type: ${messageType}`);
      
      // Verifica lo stato del backend
      await this.checkBackendStatus();
      
      // Ottieni i dati dell'agente
      const { id: agentId, name: agentName } = agentData;
      const agentRole = agentData.role || 'researcher';
      const agentSpecialization = agentData.specialization || 'Federated Learning';
      
      // Flag per indicare se il messaggio è simulato (quando il backend è disconnesso)
      const isSimulated = !this.isBackendConnected;
      console.log(`[LLMMessagingService] Message will be ${isSimulated ? 'simulated' : 'generated by LLM'}`);
      
      let messageText = '';
      
      if (!isSimulated) {
        console.log('[LLMMessagingService] Attempting to generate LLM message...');
        try {
          // Costruisci i dati per la richiesta API
          const requestData = {
            agentId: agentId,
            agentName: agentName || `Agent ${agentId}`,
            agentRole: agentRole,
            agentSpecialization: agentSpecialization,
            targetAgentId: null,
            targetAgentName: null,
            targetAgentRole: null,
            interactionType: messageType === 'dialog' ? 'working' : messageType,
            labType: this.getLabTypeFromAgent(agentData)
          };
          
          console.log('[LLMMessagingService] Sending request to LLM API:', requestData);
          
          // Chiama l'API di generazione dialogo
          const response = await fetch(`${this.apiBaseUrl}/ai/generate-dialog`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            signal: AbortSignal.timeout(5000)
          });
          
          if (response.ok) {
            const data = await response.json();
            messageText = data.dialog || data.message || "No response from LLM service";
            console.log('[LLMMessagingService] Successfully generated LLM message');
          } else {
            console.warn('[LLMMessagingService] Error from LLM API, using simulated message');
            messageText = this.generateSimulatedMessage(messageType, agentData);
          }
        } catch (apiError) {
          console.error('[LLMMessagingService] API call failed:', apiError);
          messageText = this.generateSimulatedMessage(messageType, agentData);
        }
      } else {
        console.log('[LLMMessagingService] Generating simulated message');
        messageText = this.generateSimulatedMessage(messageType, agentData);
      }
      
      console.log(`[LLMMessagingService] Generated message: ${messageText.substring(0, 50)}...`);
      
      // Crea e restituisci un oggetto messaggio
      return {
        timestamp: Date.now(),
        agentId,
        agentName: agentName || `Agent ${agentId}`,
        text: messageText,
        type: messageType,
        isSimulated,
        modelInfo: { ...this.defaultModelInfo }
      };
    } catch (error) {
      console.error('[LLMMessagingService] Error generating message:', error);
      
      // In caso di errore, restituisci un messaggio di errore simulato
      return {
        timestamp: Date.now(),
        agentId: agentData.id,
        agentName: agentData.name || `Agent ${agentData.id}`,
        text: `Error generating message: ${toErrorMessage(error)}`,
        type: messageType,
        isSimulated: true,
        modelInfo: { ...this.defaultModelInfo }
      };
    }
  }
  
  /**
   * Determina il tipo di laboratorio dall'agente
   */
  private getLabTypeFromAgent(agentData: any): string {
    // Se l'agente ha un laboratorio specificato, usalo
    if (agentData.lab) {
      return agentData.lab;
    }
    
    // Se l'agente ha un contesto di laboratorio, estrailo
    if (agentData.context && agentData.context.lab) {
      return agentData.context.lab;
    }
    
    // Altrimenti, determina il tipo di laboratorio dal ruolo dell'agente
    const role = agentData.role?.toLowerCase() || '';
    
    if (role.includes('medic') || role.includes('doctor') || role.includes('bio')) {
      return 'opbg';
    } else if (role.includes('engineer') || role.includes('tech')) {
      return 'blekinge';
    } else {
      return 'mercatorum';
    }
  }
  
  /**
   * Genera un messaggio simulato
   */
  private generateSimulatedMessage(type: string, agentData: any): string {
    // Ottieni l'array di messaggi corretto in base al tipo
    let messagesArray: string[];
    
    if (type === 'dialog') {
      messagesArray = this.simulatedDialogs;
    } else if (type === 'thinking') {
      messagesArray = this.simulatedThinking;
    } else if (type === 'decision') {
      messagesArray = this.simulatedDecisions;
    } else {
      messagesArray = this.simulatedDialogs; // Default
    }
    
    // Seleziona un messaggio casuale dall'array
    const randomIndex = Math.floor(Math.random() * messagesArray.length);
    let baseMessage = messagesArray[randomIndex];
    
    // Personalizza il messaggio con informazioni sull'agente
    if (agentData.name || agentData.role) {
      const role = agentData.role || 'researcher';
      const name = agentData.name || `Agent ${agentData.id}`;
      
      // Aggiungi piccole variazioni in base al ruolo
      if (role.toLowerCase().includes('professor')) {
        baseMessage = `As a professor, I believe ${baseMessage.toLowerCase()}`;
      } else if (role.toLowerCase().includes('student')) {
        baseMessage = `I'm still learning, but ${baseMessage.toLowerCase()}`;
      } else if (role.toLowerCase().includes('doctor') || role.toLowerCase().includes('medical')) {
        baseMessage = `From a medical perspective, ${baseMessage.toLowerCase()}`;
      } else if (role.toLowerCase().includes('engineer')) {
        baseMessage = `From an engineering standpoint, ${baseMessage.toLowerCase()}`;
      }
      
      // Aggiungi il nome dell'agente in alcuni messaggi
      if (Math.random() > 0.7) {
        baseMessage = `${name}: ${baseMessage}`;
      }
    }
    
    return baseMessage;
  }
  
  /**
   * Restituisce lo stato attuale della connessione backend
   */
  public isConnected(): boolean {
    return this.isBackendConnected;
  }
  
  /**
   * Imposta gli array di messaggi simulati
   */
  public setSimulatedMessages(dialogs: string[], thinking: string[], decisions: string[]): void {
    if (dialogs && dialogs.length > 0) {
      this.simulatedDialogs = dialogs;
    }
    
    if (thinking && thinking.length > 0) {
      this.simulatedThinking = thinking;
    }
    
    if (decisions && decisions.length > 0) {
      this.simulatedDecisions = decisions;
    }
  }
}