// frontend/src/phaser/ui/LLMControlPanel.ts

import * as Phaser from 'phaser';
import { DialogController } from '../controllers/DialogController';
import { LLMPanelState, LLMLogEntry } from './LLMPanelState';
import { LLMPanelRenderer } from './LLMPanelRenderer';
import { LLMMessagingService } from './LLMMessagingService';
import type { IAgentScene } from '../types/IAgentScene';

/**
 * Pannello di controllo per la gestione degli LLM nel sistema
 */
export class LLMControlPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private renderer: LLMPanelRenderer;
  private state: LLMPanelState;
  private messagingService: LLMMessagingService;
  private dialogController: DialogController | null = null;
  private isVisible: boolean = false;
  private updateTimer: Phaser.Time.TimerEvent | null = null;
  private backendCheckTimer: Phaser.Time.TimerEvent | null = null;
  
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    onClose?: () => void
  ) {
    this.scene = scene;
    
    // Crea un container per raggruppare tutti gli elementi del pannello
    this.container = this.scene.add.container(x, y);
    this.container.setDepth(1000); // Assicura che sia sopra altri elementi
    
    // Inizializza lo stato
    this.state = new LLMPanelState();
    this.state.loadState();
    
    // Inizializza il servizio messaggi
    this.messagingService = new LLMMessagingService(this.state.getDefaultModelInfo());
    
    // Inizializza il renderer
    this.renderer = new LLMPanelRenderer(scene, this.container, onClose || (() => this.hide()));
    
    // Controlla stato del backend
    this.checkBackendStatus();
    
    // Inizializza l'interfaccia utente
    this.initializeUI();
    
    // Inizialmente visibile
    this.show();
    
    // Registra eventi per il ridimensionamento della finestra
    this.scene.scale.on('resize', this.handleResize, this);
    
    // Avvia un timer per aggiornare le statistiche frequentemente
    this.updateTimer = this.scene.time.addEvent({
      delay: 500, // Ridotto a 500ms per aggiornamenti più frequenti
      callback: this.updateStats,
      callbackScope: this,
      loop: true
    });
    
    // Avvia un timer per controllare lo stato del backend ogni 5 secondi
    this.backendCheckTimer = this.scene.time.addEvent({
      delay: 5000,
      callback: this.checkBackendStatus,
      callbackScope: this,
      loop: true
    });
    
    // Registra eventi per aggiornare i contatori dei dialoghi
    this.scene.game.events.on('dialog-created', this.handleDialogCreated, this);
    this.scene.game.events.on('backend-status-changed', this.handleBackendStatusChanged, this);
    this.scene.game.events.on('dialog-counter-updated', this.handleDialogCounterUpdated, this);
    
    // Gestisce l'evento per mostrare il dettaglio di un messaggio
    this.scene.events.on('show-full-message', this.handleShowFullMessage, this);
    
    // Posiziona il pannello per evitare sovrapposizioni
    this.renderer.repositionPanel(x, y);
  }
  
  /**
   * Inizializza l'interfaccia utente
   */
  private initializeUI(): void {
    // Crea sezione controlli
    this.renderer.createControlsSection(
      this.state.getIsLLMEnabled(),
      this.state.getMessageFrequency(),
      this.state.getSelectedMessageType(),
      this.handleToggleLLM.bind(this),
      this.handleFrequencyChange.bind(this),
      this.handleMessageTypeChange.bind(this),
      this.handleGenerateMessage.bind(this)
    );
    
    // Crea sezione statistiche
    this.renderer.createStatsSection(this.getStatsForDisplay());
    
    // Crea sezione log
    this.renderer.createLogSection(
      this.state.getMessageLog(),
      this.state.getColorForType.bind(this.state)
    );
  }
  
  /**
   * Ottiene i dati formattati per la visualizzazione delle statistiche
   */
  private getStatsForDisplay(): any {
    const counts = this.state.getDialogCounts();
    
    // Converti la frequenza in testo
    const frequency = this.state.getMessageFrequency();
    let frequencyText = 'Normal';
    if (frequency < 0.25) {
      frequencyText = 'Low';
    } else if (frequency > 0.75) {
      frequencyText = 'High';
    }
    
    return {
      llm: counts.llm,
      standard: counts.standard,
      simulated: counts.simulated,
      frequency: frequencyText,
      llmStatus: this.state.getIsLLMEnabled() ? 'Enabled' : 'Disabled'
    };
  }
  
  /**
   * Gestisce il cambio di stato del toggle LLM
   */
  private handleToggleLLM(enabled: boolean): void {
    this.state.setIsLLMEnabled(enabled);
    
    // Aggiorna il controller dialoghi se presente
    if (this.dialogController) {
      this.dialogController.toggleLLMDialogs(enabled);
    }
    
    // Aggiorna visivamente lo stato del toggle
    if (this.renderer) {
      // Assicurati che il toggle venga aggiornato visivamente (attraverso metodi aggiuntivi nel renderer)
      if ((this.renderer as any).updateToggleVisual) {
        (this.renderer as any).updateToggleVisual(enabled);
      }
    }
    
    // Aggiorna le statistiche
    this.updateStats();
  }
  
  /**
   * Gestisce il cambio di frequenza dei messaggi
   */
  private handleFrequencyChange(value: number): void {
    this.state.setMessageFrequency(value);
    
    // Aggiorna le statistiche
    this.updateStats();
  }
  
  /**
   * Gestisce il cambio di tipo di messaggio
   */
  private handleMessageTypeChange(type: string): void {
    this.state.setSelectedMessageType(type);
    
    // Aggiorna la visualizzazione dei pulsanti
    this.renderer.updateMessageTypeButtons(type);
    
    // Aggiorna le statistiche
    this.updateStats();
  }
  
  /**
   * Controlla lo stato del backend
   */
  private async checkBackendStatus(): Promise<void> {
    try {
      const isConnected = await this.messagingService.checkBackendStatus();
      
      if (isConnected !== this.state.getIsBackendConnected()) {
        this.state.setIsBackendConnected(isConnected);
        
        // Aggiorna l'indicatore di stato
        this.renderer.updateBackendStatusIndicator(isConnected);
        
        // Aggiorna il testo del pulsante di generazione
        this.renderer.updateGenerateButtonText(isConnected);
      }
    } catch (error) {
      console.error('Error checking backend status:', error);
      // In caso di errore, imposta lo stato come disconnesso
      this.state.setIsBackendConnected(false);
      this.renderer.updateBackendStatusIndicator(false);
      this.renderer.updateGenerateButtonText(false);
    }
  }
  
  /**
   * Gestisce i cambiamenti di stato del backend
   */
  private handleBackendStatusChanged(event: CustomEvent): void {
    if (event && event.detail && event.detail.connected !== undefined) {
      const isConnected = event.detail.connected;
      this.state.setIsBackendConnected(isConnected);
      
      // Aggiorna l'indicatore di stato
      this.renderer.updateBackendStatusIndicator(isConnected);
      
      // Aggiorna il testo del pulsante di generazione
      this.renderer.updateGenerateButtonText(isConnected);
    }
  }
  
  /**
   * Genera un nuovo messaggio LLM
   */
  private async handleGenerateMessage(): Promise<void> {
    try {
      // Ottieni gli agenti dalla scena
      const agentsList = this.getSceneAgents();
      
      if (agentsList.length === 0) {
        console.warn('Cannot generate LLM message: No agents found in scene');
        return;
      }
      
      // Seleziona un agente casuale
      const randomIndex = Math.floor(Math.random() * agentsList.length);
      const agent = agentsList[randomIndex];
      
      // Tipo di messaggio selezionato
      const messageType = this.state.getSelectedMessageType();
      
      // Crea un placeholder per il messaggio mentre viene generato
      const placeholderEntry: LLMLogEntry = {
        timestamp: Date.now(),
        agentId: agent.id,
        agentName: agent.name || `Agent ${agent.id}`,
        text: this.state.getIsBackendConnected() ? 'Generating LLM message...' : 'Generating simulated message...',
        type: messageType,
        isSimulated: !this.state.getIsBackendConnected(),
        modelInfo: this.state.getDefaultModelInfo()
      };
      
      // Aggiungi il placeholder al log
      this.state.addLogEntry(placeholderEntry);
      
      // Aggiorna la visualizzazione del log
      this.renderer.updateLogDisplay(
        this.state.getMessageLog(),
        this.state.getColorForType.bind(this.state)
      );
      
      // Genera il messaggio
      const messageEntry = await this.messagingService.generateMessage(agent, messageType);
      
      // Rimuovi il placeholder dal log (sostituendolo con il messaggio reale)
      const currentLog = this.state.getMessageLog();
      currentLog.shift(); // Rimuovi il primo elemento (placeholder)
      
      // Aggiungi il nuovo messaggio
      this.state.addLogEntry(messageEntry);
      
      // Aggiorna la visualizzazione del log
      this.renderer.updateLogDisplay(
        this.state.getMessageLog(),
        this.state.getColorForType.bind(this.state)
      );
      
      // Emetti evento appropriato in base al tipo di messaggio
      this.emitMessageEvent(agent, messageEntry);
      
      // Aggiorna le statistiche
      this.updateStats();
    } catch (error) {
      console.error('Error generating LLM message:', error);
    }
  }
  
  /**
   * Emette un evento in base al tipo di messaggio generato
   */
  private emitMessageEvent(agent: any, messageEntry: LLMLogEntry): void {
    switch (messageEntry.type) {
      case 'dialog':
        // Se c'è un altro agente, crea una conversazione
        if (this.getSceneAgents().length > 1) {
          // Trova un altro agente casuale diverso dal primo
          let targetAgent;
          do {
            const agents = this.getSceneAgents();
            const targetIndex = Math.floor(Math.random() * agents.length);
            targetAgent = agents[targetIndex];
          } while (targetAgent.id === agent.id);
          
          // Emetti un evento di interazione tra agenti
          this.scene.game.events.emit('agent-interaction', {
            agentId1: agent.id,
            agentId2: targetAgent.id,
            type: 'conversation',
            llm: true,
            isSimulated: messageEntry.isSimulated
          });
          
          // Emetti anche l'evento dialog-created per il conteggio
          this.scene.game.events.emit('dialog-created', {
            type: messageEntry.isSimulated ? 'simulated' : 'llm',
            isSimulated: messageEntry.isSimulated
          });
        } else {
          // Crea un monologo
          this.scene.game.events.emit('agent-reaction', {
            agentId: agent.id,
            eventType: 'reflection',
            context: 'Federated learning research progress',
            llm: true,
            isSimulated: messageEntry.isSimulated
          });
          
          // Emetti anche l'evento dialog-created per il conteggio
          this.scene.game.events.emit('dialog-created', {
            type: messageEntry.isSimulated ? 'simulated' : 'llm',
            isSimulated: messageEntry.isSimulated
          });
        }
        break;
      
      case 'thinking':
        // Genera un pensiero
        this.scene.game.events.emit('agent-thinking', {
          agentId: agent.id,
          context: 'Analyzing federated learning optimization challenges',
          llm: true,
          isSimulated: messageEntry.isSimulated
        });
        
        // Emetti anche l'evento dialog-created per il conteggio
        this.scene.game.events.emit('dialog-created', {
          type: messageEntry.isSimulated ? 'simulated' : 'llm',
          isSimulated: messageEntry.isSimulated
        });
        break;
      
      case 'decision':
        // Genera una decisione
        this.scene.game.events.emit('agent-decision', {
          agentId: agent.id,
          decisionType: 'algorithm_selection',
          context: 'Optimizing federated learning algorithm for heterogeneous clients',
          llm: true,
          isSimulated: messageEntry.isSimulated
        });
        
        // Emetti anche l'evento dialog-created per il conteggio
        this.scene.game.events.emit('dialog-created', {
          type: messageEntry.isSimulated ? 'simulated' : 'llm',
          isSimulated: messageEntry.isSimulated
        });
        break;
    }
  }
  
  /**
   * Gestisce l'evento di creazione di un dialogo
   */
  private handleDialogCreated(data: any): void {
    if (data && data.type) {
      const counts = this.state.getDialogCounts();
      
      // Incrementa il contatore appropriato
      if (data.isSimulated) {
        counts.simulated++;
      } else if (data.type === 'llm' || data.type === 'llm-dialog') {
        counts.llm++;
      } else {
        counts.standard++;
      }
      
      // Aggiorna i contatori
      this.state.updateDialogCounts(counts);
      
      // Salva lo stato
      this.state.saveState();
      
      // Aggiorna immediatamente le statistiche
      this.updateStats();
    }
  }
  
  /**
   * Gestisce l'evento di aggiornamento dei contatori dei dialoghi
   */
  private handleDialogCounterUpdated(data: { llm: number, simulated: number, standard: number }): void {
    try {
      console.log('[LLMControlPanel] Dialog counter updated:', data);
      
      // Aggiorna i contatori nello stato
      this.state.updateDialogCounts(data);
      
      // Aggiorna la visualizzazione
      this.updateStats();
    } catch (error) {
      console.error('Error handling dialog counter update:', error);
    }
  }
  
  /**
   * Gestisce l'evento per mostrare il dettaglio completo di un messaggio
   */
  private handleShowFullMessage(entry: LLMLogEntry): void {
    this.renderer.showFullMessageDialog(entry);
  }
  
  /**
   * Aggiorna le statistiche visualizzate
   */
  private updateStats(): void {
    // Aggiorna la visualizzazione delle statistiche
    this.renderer.updateStats(this.getStatsForDisplay());
  }
  
  /**
   * Gestisce il ridimensionamento della finestra
   */
  private handleResize(): void {
    this.renderer.handleResize();
  }
  
  /**
   * Ottiene la lista degli agenti dalla scena corrente
   */
  private getSceneAgents(): any[] {
    // Variabile per memorizzare gli agenti trovati
    let foundAgents: any[] = [];
    
    try {
      // Prova ad accedere agli agenti dalla scena (IAgentScene)
      const agentScene = this.scene as unknown as IAgentScene;
      if (agentScene.agents && agentScene.agents.length > 0) {
        foundAgents = agentScene.agents;
      }
      // Se ancora non trovati, cerca nei children della scena
      else {
        foundAgents = this.scene.children.getChildren()
          .filter((child: any) => {
            if (!child.getData) return false;
            return child.getData('id') && (child.getData('type') || child.getData('role'));
          })
          .map((agent: any) => {
            return {
              id: agent.getData('id'),
              name: agent.getData('name') || `Agent ${agent.getData('id')}`,
              type: agent.getData('type') || agent.getData('role'),
              x: agent.x,
              y: agent.y
            };
          });
      }

      // Se ancora non ci sono agenti, crea un agente di sistema fittizio
      if (foundAgents.length === 0) {
        foundAgents = [{
          id: 'system_agent',
          name: 'System Agent',
          type: 'system',
          x: this.scene.cameras.main.centerX,
          y: this.scene.cameras.main.centerY
        }];
      }

      return foundAgents;
    } catch (error) {
      console.error('Error getting agents:', error);
      // In caso di errore, restituisci un array vuoto
      return [];
    }
  }
  
  /**
   * Imposta il controller dei dialoghi
   */
  public setDialogController(controller: DialogController): void {
    try {
      this.dialogController = controller;
      
      // Applica lo stato corrente
      if (controller && this.state.getIsLLMEnabled() !== undefined) {
        controller.toggleLLMDialogs(this.state.getIsLLMEnabled());
      }
      
      // Sincronizza i contatori con i valori dal tracker
      this.syncCountersWithController();
      
      // Aggiorna statistiche
      this.updateStats();
    } catch (error) {
      console.error('Error setting dialog controller:', error);
    }
  }
  
  /**
   * Sincronizza i contatori con quelli del tracker
   */
  private syncCountersWithController(): void {
    try {
      // Ottieni i contatori dal tracker di dialoghi della scena
      const agentScene = this.scene as unknown as IAgentScene;
      if (agentScene.dialogEventTracker) {
        const stats = agentScene.dialogEventTracker.getCounters();
        const currentCounts = this.state.getDialogCounts();
        
        // Prendi il valore massimo tra i contatori attuali e quelli del tracker
        const newCounts = {
          llm: Math.max(stats.llm || 0, currentCounts.llm),
          standard: Math.max(stats.standard || 0, currentCounts.standard),
          simulated: Math.max(stats.simulated || 0, currentCounts.simulated)
        };
        
        this.state.updateDialogCounts(newCounts);
        this.state.saveState();
        
        console.log('[LLMControlPanel] Synced counters with tracker:', newCounts);
      } else {
        console.warn('[LLMControlPanel] Dialog event tracker not found in scene');
      }
    } catch (error) {
      console.error('Error syncing counters with tracker:', error);
    }
  }
  
  /**
   * Mostra il pannello
   */
  public show(): void {
    this.renderer.show();
    this.isVisible = true;
    
    // Assicurati che i timer siano attivi
    if (!this.updateTimer) {
      this.updateTimer = this.scene.time.addEvent({
        delay: 500,
        callback: this.updateStats,
        callbackScope: this,
        loop: true
      });
    } else if (this.updateTimer.paused) {
      this.updateTimer.paused = false;
    }
    
    if (!this.backendCheckTimer) {
      this.backendCheckTimer = this.scene.time.addEvent({
        delay: 5000,
        callback: this.checkBackendStatus,
        callbackScope: this,
        loop: true
      });
    } else if (this.backendCheckTimer.paused) {
      this.backendCheckTimer.paused = false;
    }
  }
  
  /**
   * Nasconde il pannello
   */
  public hide(): void {
    this.renderer.hide();
    this.isVisible = false;
    
    // Pausa i timer quando il pannello è nascosto per risparmiare risorse
    if (this.updateTimer) {
      this.updateTimer.paused = true;
    }
    
    if (this.backendCheckTimer) {
      this.backendCheckTimer.paused = true;
    }
  }
  
  /**
   * Restituisce lo stato di visibilità del pannello
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }
  
  /**
   * Restituisce il riferimento al container
   */
  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
  
  /**
   * Distrugge il pannello e pulisce le risorse
   */
  public destroy(): void {
    try {
      // Ferma i timer
      if (this.updateTimer) {
        this.updateTimer.destroy();
        this.updateTimer = null;
      }
      
      if (this.backendCheckTimer) {
        this.backendCheckTimer.destroy();
        this.backendCheckTimer = null;
      }
      
      // Rimuovi ascoltatori eventi
      this.scene.scale.off('resize', this.handleResize, this);
      this.scene.game.events.off('dialog-created', this.handleDialogCreated, this);
      this.scene.game.events.off('backend-status-changed', this.handleBackendStatusChanged, this);
      this.scene.game.events.off('dialog-counter-updated', this.handleDialogCounterUpdated, this);
      this.scene.events.off('show-full-message', this.handleShowFullMessage, this);
      
      // Salva lo stato prima di distruggere
      this.state.saveState();
      
      // Distruggi renderer
      this.renderer.destroy();
    } catch (error) {
      console.error('Error destroying LLM control panel:', error);
    }
  }
}