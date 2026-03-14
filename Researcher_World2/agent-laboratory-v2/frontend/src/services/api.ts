// frontend/src/services/api.ts

// Configurazione di base per l'API REST
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8091';
// Definizione esplicita dell'URL WebSocket per garantire coerenza
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8091';

// Classe per gestire WebSocket
class WebSocketService {
  private socket: WebSocket | null = null;
  private messageHandlers: { [key: string]: ((data: any) => void)[] } = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private intentionalDisconnect = false;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    this.socket = null;
  }

  // Connessione al server WebSocket
  connect(): Promise<void> {
    // Se c'è già una connessione attiva, restituiscila
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    
    // Se c'è già un tentativo di connessione in corso, restituiscilo
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.intentionalDisconnect = false;
    
    this.connectionPromise = new Promise<void>((resolve, reject) => {
      try {
        // Chiudi il socket precedente se esiste
        if (this.socket) {
          this.socket.close();
        }
        
        console.log(`Connecting to WebSocket at ${WS_BASE_URL}/ws`);
        this.socket = new WebSocket(`${WS_BASE_URL}/ws`);

        // Imposta un timeout per evitare che la connessione rimanga in sospeso
        const connectionTimeout = setTimeout(() => {
          if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection timeout'));
            this.connectionPromise = null;
            
            // Chiudi il socket e inizia il processo di riconnessione
            if (this.socket) {
              this.socket.close();
              this.socket = null;
            }
            this.attemptReconnect();
          }
        }, 5000);

        this.socket.onopen = () => {
          console.log('WebSocket connected successfully');
          clearTimeout(connectionTimeout);
          this.reconnectAttempts = 0;
          resolve();
          this.connectionPromise = null;
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket connection error:', error);
          clearTimeout(connectionTimeout);
          reject(error);
          this.connectionPromise = null;
        };

        this.socket.onclose = (event) => {
          if (!this.intentionalDisconnect) {
            console.log('WebSocket disconnected:', event.reason);
            this.attemptReconnect();
          }
          this.connectionPromise = null;
        };

        // Gestisci messaggi in arrivo
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const eventType = data.type || 'message';
            
            if (this.messageHandlers[eventType]) {
              this.messageHandlers[eventType].forEach(handler => handler(data));
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        reject(error);
        this.connectionPromise = null;
      }
    });
    
    return this.connectionPromise;
  }

  // Tenta la riconnessione
  private attemptReconnect(): void {
    if (this.intentionalDisconnect) return;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  // Disconnetti dal server
  disconnect(): void {
    this.intentionalDisconnect = true;
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.reconnectAttempts = 0;
    this.connectionPromise = null;
  }

  // Invia un messaggio al server
  sendMessage(event: string | object, data?: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      let messageToSend;
      
      if (typeof event === 'string') {
        if (data) {
          // Formato: (event, data)
          messageToSend = {
            type: event,
            ...data
          };
        } else {
          // Formato: (event)
          messageToSend = { type: event };
        }
      } else {
        // Formato: (oggetto completo)
        messageToSend = event;
      }
      
      this.socket.send(JSON.stringify(messageToSend));
    } else {
      console.warn('WebSocket not connected, message not sent');
      
      // Tenta di riconnettersi e inviare il messaggio
      this.connect()
        .then(() => this.sendMessage(event, data))
        .catch(error => {
          console.error('Could not reconnect to send message:', error);
        });
    }
  }

  // Registra un handler per un tipo di messaggio
  onMessage(event: string, handler: (data: any) => void): void {
    if (!this.messageHandlers[event]) {
      this.messageHandlers[event] = [];
    }
    
    // Evita duplicati
    if (!this.messageHandlers[event].includes(handler)) {
      this.messageHandlers[event].push(handler);
    }
  }

  // Rimuovi un handler
  offMessage(event: string, handler?: (data: any) => void): void {
    if (!this.messageHandlers[event]) {
      return;
    }
    
    if (handler) {
      this.messageHandlers[event] = this.messageHandlers[event].filter(h => h !== handler);
    } else {
      delete this.messageHandlers[event];
    }
  }

  // Controlla se il socket è connesso
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

// Istanza singleton del servizio WebSocket
export const webSocketService = new WebSocketService();

// Funzioni API REST
export const api = {
  // Ottieni configurazione simulazione
  getSimulationConfig: async () => {
    try {
      const url = `${API_BASE_URL}/config`;
      console.log(`Fetching simulation config from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch simulation config: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  },
  
  // Ottieni dati laboratorio
  getLaboratoryData: async (labId: string) => {
    try {
      const url = `${API_BASE_URL}/laboratory/${labId}`;
      console.log(`Fetching laboratory data from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data for laboratory ${labId}: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  },
  
  // Ottieni ricercatori
  getResearchers: async () => {
    try {
      const url = `${API_BASE_URL}/researchers`;
      console.log(`Fetching researchers from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch researchers: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  },
  
  // Ottieni stato simulazione
  getSimulationStatus: async () => {
    try {
      const url = `${API_BASE_URL}/simulation/status`;
      console.log(`Fetching simulation status from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch simulation status: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  },
  
  // Avvia simulazione
  startSimulation: async () => {
    try {
      const url = `${API_BASE_URL}/simulation/start`;
      console.log(`Starting simulation: ${url}`);
      const response = await fetch(url, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error(`Failed to start simulation: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  },
  
  // Ferma simulazione
  stopSimulation: async () => {
    try {
      const url = `${API_BASE_URL}/simulation/stop`;
      console.log(`Stopping simulation: ${url}`);
      const response = await fetch(url, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error(`Failed to stop simulation: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  },
  
  // Aggiorna configurazione simulazione
  updateSimulationConfig: async (config: any) => {
    try {
      const url = `${API_BASE_URL}/config`;
      console.log(`Updating simulation config: ${url}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      if (!response.ok) {
        throw new Error(`Failed to update simulation config: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  },
  
  // Genera un dialogo usando LLM
  generateAgentDialog: async (params: {
    agentId: string;
    agentName: string;
    agentRole: string;
    agentSpecialization: string;
    targetAgentId?: string;
    targetAgentName?: string;
    targetAgentRole?: string;
    interactionType: string;
    labType: string;
    flState?: any;
  }) => {
    try {
      const url = `${API_BASE_URL}/ai/generate-dialog`;
      console.log(`Generating LLM dialog: ${url}`, params);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        throw new Error(`Failed to generate dialog: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      // In caso di errore, restituisci un dialogo di fallback
      return {
        dialog: "Let's discuss this research...",
        isLLMGenerated: false
      };
    }
  },

  // Verifica se il servizio LLM è disponibile
  checkLLMAvailability: async () => {
    try {
      const url = `${API_BASE_URL}/ai/status`;
      console.log(`Checking LLM availability: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        return { available: false };
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return { available: false };
    }
  },
  
  // Genera pensieri dell'agente tramite LLM
  generateAgentThinking: async (params: {
    agentId: string;
    agentName: string;
    agentRole: string;
    agentSpecialization: string;
    targetAgentId?: string;
    targetAgentName?: string;
    targetAgentRole?: string;
    interactionType: string;
    labType: string;
    context?: string;
    flState?: any;
  }) => {
    try {
      const url = `${API_BASE_URL}/ai/thinking`;
      console.log(`Generating agent thinking: ${url}`, params);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        throw new Error(`Failed to generate thinking: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return {
        thinking: "I should consider the implications of this interaction...",
        isLLMGenerated: false
      };
    }
  },

  // Genera decisioni FL tramite LLM
  generateFLDecision: async (params: {
    agentId: string;
    agentName: string;
    agentRole: string;
    agentSpecialization: string;
    decisionType: string;
    labType: string;
    context?: string;
    flState?: any;
  }) => {
    try {
      const url = `${API_BASE_URL}/ai/decision`;
      console.log(`Generating FL decision: ${url}`, params);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        throw new Error(`Failed to generate decision: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return {
        decision: "Based on the data, we should proceed with the standard approach.",
        isLLMGenerated: false
      };
    }
  },

  // Genera piani d'azione tramite LLM
  generateActionPlan: async (params: {
    agentId: string;
    agentName: string;
    agentRole: string;
    agentSpecialization: string;
    planningType: string;
    labType: string;
    context?: string;
    flState?: any;
  }) => {
    try {
      const url = `${API_BASE_URL}/ai/plan`;
      console.log(`Generating action plan: ${url}`, params);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        throw new Error(`Failed to generate plan: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return {
        plan: "I need to gather more data and analyze the current model performance.",
        isLLMGenerated: false
      };
    }
  },

  // Genera reazioni agli eventi tramite LLM
  generateEventReaction: async (params: {
    agentId: string;
    agentName: string;
    agentRole: string;
    agentSpecialization: string;
    eventType: string;
    labType: string;
    context?: string;
    flState?: any;
  }) => {
    try {
      const url = `${API_BASE_URL}/ai/reaction`;
      console.log(`Generating event reaction: ${url}`, params);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        throw new Error(`Failed to generate reaction: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API error:', error);
      return {
        reaction: "This is an interesting development. We should adapt our approach.",
        isLLMGenerated: false
      };
    }
  }
};