// frontend/src/phaser/sprites/Agent.ts

import Phaser from 'phaser';

export interface AgentConfig {
  role: string;
  name: string;
  speed: number;
  scale?: number; // Parametro opzionale per la scala
  state?: AgentState;
  specialization?: string;
  id?: string; // Aggiunto ID opzionale per tracciare l'agente
}

export enum AgentState {
  IDLE = 'idle',
  WALKING = 'walking',
  WORKING = 'working',
  MEETING = 'meeting',
  DISCUSSING = 'discussing',
  PRESENTING = 'presenting'
}

/**
 * Classe che rappresenta un agente ricercatore nel simulatore
 */
export class Agent extends Phaser.GameObjects.Sprite {
  // Proprietà di base
  public name: string;
  public role: string;
  public speed: number;
  public specialization: string;
  private id: string;
  
  // Stato e comportamento
  protected currentState: AgentState;
  protected targetX: number | null = null;
  protected targetY: number | null = null;
  protected path: {x: number, y: number}[] = [];
  protected currentPathIndex: number = 0;
  
  // Tempistiche per il comportamento autonomo
  protected nextDecisionTime: number = 0;
  protected stateTimer: number = 0;
  
  // UI e effetti
  protected nameText: Phaser.GameObjects.Text;
  protected stateIndicator: Phaser.GameObjects.Sprite | null = null;
  
  // Timer per ottenere sistemi di gioco
  private currentTimeValue: number = 0;
  
  // Ultima interazione salvata per evitare ripetizioni
  private lastInteractionTime: number = 0;
  private lastInteractionAgent: string | null = null;
  
  constructor(
    scene: any, // Usiamo any per evitare problemi di tipizzazione con Phaser
    x: number, 
    y: number, 
    texture: string,
    config: AgentConfig
  ) {
    super(scene, x, y, texture);
    
    // Configura proprietà di base
    this.name = config.name;
    this.role = config.role;
    this.speed = config.speed;
    this.specialization = config.specialization || 'general';
    this.currentState = config.state || AgentState.IDLE;
    this.id = config.id || `agent_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Configura sprite
    this.setOrigin(0.5);
    
    // Salva il fattore di scala per usarlo nel calcolo dell'offset dell'etichetta
    const scale = config.scale || 1;
    this.setScale(scale);
    
    // Calcola l'offset verticale in base alla dimensione dell'agente e alla scala
    const labelOffset = 20 * scale;
    
    // Calcola la dimensione del font in base alla scala (con limite superiore)
    const fontSize = Math.max(10, Math.round(12 * Math.min(scale, 1.5)));
    
    // Aggiungi etichetta con nome con posizione adattata alla scala
    this.nameText = scene.add.text(x, y - labelOffset, config.name, { 
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { left: 3, right: 3, top: 1, bottom: 1 }
    });
    this.nameText.setOrigin(0.5);
    this.nameText.setDepth(1000); // Assicura che l'etichetta sia visibile sopra altri elementi
    
    // Inizializza tempo corrente
    this.currentTimeValue = Date.now();
    
    // Inizializza animazione
    this.playAnimation();
    
    // Avvia il comportamento autonomo con un po' di casualità
    this.nextDecisionTime = this.getCurrentTime() + Phaser.Math.Between(1000, 5000);
  }
  
  /**
   * Restituisce l'ID univoco dell'agente
   */
  public getId(): string {
    return this.id;
  }
  
  /**
   * Restituisce lo stato corrente dell'agente
   */
  public getCurrentState(): AgentState {
    return this.currentState;
  }
  
  /**
   * Ottiene il tempo corrente del sistema in modo sicuro
   */
  public getCurrentTime(): number {
    // Usa il tempo di Phaser se disponibile, altrimenti usa il tempo corrente
    try {
      const sceneAny = this.scene as any;
      if (sceneAny.time && sceneAny.time.now) {
        return sceneAny.time.now;
      }
    } catch (e) {
      console.warn('Error getting time from scene:', e);
    }
    
    // Fallback con una gestione del tempo indipendente
    return this.currentTimeValue;
  }
  
  /**
   * Accede al gioco in modo sicuro attraverso la scena
   */
  protected getGameEvents(): Phaser.Events.EventEmitter {
    // Fallback per emettitore di eventi
    const sceneAny = this.scene as any;
    if (sceneAny.game?.events) {
      return sceneAny.game.events;
    }
    if (sceneAny.events) {
      return sceneAny.events;
    }
    return new Phaser.Events.EventEmitter();
  }
  
  update(time: number, delta: number): void {
    // Aggiorna il tempo corrente
    this.currentTimeValue = time;
    
    // Calcola l'offset corretto basato sulla scala attuale
    const labelOffset = 20 * this.scale;
    
    // Aggiorna la posizione dell'etichetta del nome
    this.nameText.setPosition(this.x, this.y - labelOffset);
    
    // Gestisci il movimento verso un obiettivo
    this.updateMovement(delta);
    
    // Gestisci il comportamento autonomo
    this.updateAutonomousBehavior(time);
    
    // Aggiorna l'indicatore di stato se presente
    this.updateStateIndicator();
  }
  
  /**
   * Aggiorna la posizione dell'agente in base al percorso
   */
  private updateMovement(delta: number): void {
    if (this.currentState !== AgentState.WALKING || this.path.length === 0) {
      return;
    }
    
    const currentTarget = this.path[this.currentPathIndex];
    if (!currentTarget) return;
    
    // Calcola la direzione verso il punto target
    const dx = currentTarget.x - this.x;
    const dy = currentTarget.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 5) {
      // Arrivati al punto corrente del percorso
      this.currentPathIndex++;
      
      // Se abbiamo raggiunto la fine del percorso
      if (this.currentPathIndex >= this.path.length) {
        this.path = [];
        this.currentPathIndex = 0;
        this.changeState(AgentState.IDLE);
        return;
      }
    } else {
      // Continua a muoversi verso il target
      const speedFactor = this.speed * (delta / 1000);
      
      // Normalizza e applica la velocità
      const vx = (dx / distance) * speedFactor;
      const vy = (dy / distance) * speedFactor;
      
      this.x += vx;
      this.y += vy;
      
      // Aggiorna la direzione dello sprite
      if (dx < 0) {
        this.setFlipX(true);  // Guarda a sinistra
      } else if (dx > 0) {
        this.setFlipX(false); // Guarda a destra
      }
    }
  }
  
  /**
   * Gestisce il comportamento autonomo dell'agente
   */
  private updateAutonomousBehavior(time: number): void {
    // Aggiorna il timer dello stato
    if (this.stateTimer > 0 && time > this.stateTimer) {
      this.stateTimer = 0;
      this.changeState(AgentState.IDLE);
    }
    
    // Prendi decisioni autonome solo se non impegnato in altre attività
    if (time > this.nextDecisionTime && this.currentState === AgentState.IDLE) {
      this.makeDecision();
      
      // Imposta il prossimo momento decisionale con un po' di casualità
      this.nextDecisionTime = time + Phaser.Math.Between(3000, 8000);
    }
  }
  
  /**
   * Aggiorna l'indicatore visivo dello stato
   */
  private updateStateIndicator(): void {
    // Implementazione per mostrare un'icona o effetto in base allo stato
    if (!this.stateIndicator) {
      return;
    }
    
    // Aggiorna la posizione dell'indicatore di stato
    this.stateIndicator.setPosition(this.x, this.y - 40);
    
    // Cambia l'aspetto dell'indicatore in base allo stato
    switch (this.currentState) {
      case AgentState.WORKING:
        this.stateIndicator.setAlpha(1); 
        break;
      case AgentState.DISCUSSING:
        this.stateIndicator.setAlpha(1);
        break;
      case AgentState.MEETING:
        this.stateIndicator.setAlpha(1);
        break;
      default:
        this.stateIndicator.setAlpha(0); // Nascondi per altri stati
        break;
    }
  }
  
  /**
   * Fa prendere una decisione autonoma all'agente
   */
  private makeDecision(): void {
    // Probabilità delle varie azioni
    const rand = Math.random();
    
    if (rand < 0.4) {
      // Spostati in un punto casuale
      this.moveToRandomPoint();
    } else if (rand < 0.7) {
      // Passa allo stato di lavoro per un po'
      this.changeState(AgentState.WORKING);
      this.stateTimer = this.getCurrentTime() + Phaser.Math.Between(5000, 10000);
    } else if (rand < 0.9) {
      // Cerca altri agenti nelle vicinanze con cui interagire
      this.findNearbyAgentToInteract();
    } else {
      // Resta in idle
      this.changeState(AgentState.IDLE);
      // Gioca un'animazione casuale di idle
      if (Math.random() > 0.5) {
        this.playAnimation();
      }
    }
  }
  
  /**
   * Sposta l'agente in un punto casuale della mappa
   */
  private moveToRandomPoint(): void {
    // Ottieni le dimensioni dell'area di gioco in modo sicuro
    const sceneAny = this.scene as any;
    const width = sceneAny.cameras?.main?.width || 800;
    const height = sceneAny.cameras?.main?.height || 600;
    
    // Genera coordinate casuali all'interno dell'area visibile
    const margin = 50;
    const targetX = Phaser.Math.Between(margin, width - margin);
    const targetY = Phaser.Math.Between(margin, height - margin);
    
    this.moveTo(targetX, targetY);
  }
  
  /**
   * Cerca un altro agente nelle vicinanze con cui interagire
   */
  private findNearbyAgentToInteract(): void {
    try {
      // Ottieni tutti gli agenti nella scena
      const sceneAny = this.scene as any;
      const agents = sceneAny.agents || [];
      
      // Filtra per escludere se stesso e trovare l'agente più vicino
      let closestAgent: Agent | null = null;
      let minDistance = Number.MAX_VALUE;
      
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i] as Agent;
        if (!agent || agent.getId() === this.id) continue;
        
        const distance = Phaser.Math.Distance.Between(
          this.x, this.y,
          agent.x, agent.y
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestAgent = agent;
        }
      }
      
      // Se abbiamo trovato un agente vicino e la distanza è ragionevole
      if (closestAgent && minDistance < 200) {
        // Passa allo stato di discussione o meeting
        const rand = Math.random();
        
        // Evita interazioni ripetitive con lo stesso agente in poco tempo
        const currentTime = this.getCurrentTime();
        if (this.lastInteractionAgent === closestAgent.getId() && 
            currentTime - this.lastInteractionTime < 10000) {
          return;
        }
        
        // Aggiorna le informazioni dell'ultima interazione
        this.lastInteractionAgent = closestAgent.getId();
        this.lastInteractionTime = currentTime;
        
        if (rand < 0.6) {
          this.changeState(AgentState.DISCUSSING);
          this.stateTimer = this.getCurrentTime() + Phaser.Math.Between(3000, 6000);
          
          // Emetti un evento di interazione che può essere intercettato dal sistema di dialogo
          this.getGameEvents().emit('agent-interaction', {
            agentId1: this.id,
            agentId2: closestAgent.getId(),
            type: 'discussion'
          });
          
          // Log per debug
          console.log(`${this.name} starting discussion with ${closestAgent.name}`);
        } else {
          this.changeState(AgentState.MEETING);
          this.stateTimer = this.getCurrentTime() + Phaser.Math.Between(4000, 8000);
          
          // Emetti un evento di interazione che può essere intercettato dal sistema di dialogo
          this.getGameEvents().emit('agent-interaction', {
            agentId1: this.id,
            agentId2: closestAgent.getId(),
            type: 'meeting'
          });
          
          // Log per debug
          console.log(`${this.name} starting meeting with ${closestAgent.name}`);
        }
        
        // Muoviti verso l'agente target per avvicinarti
        this.moveTowards(closestAgent.x, closestAgent.y, 40);
      } else {
        // Se non ci sono agenti vicini, cerca un punto casuale
        this.moveToRandomPoint();
      }
    } catch (error) {
      console.error('Error in findNearbyAgentToInteract:', error);
      // In caso di errore, tenta semplicemente di muoversi in un punto casuale
      this.moveToRandomPoint();
    }
  }
  
  /**
   * Trova un ID di agente casuale dalla scena
   */
  private findRandomAgentId(): string {
    try {
      // Ottieni tutti gli agenti nella scena
      const sceneAny = this.scene as any;
      const agents = sceneAny.agents || [];
      
      // Lista per agenti filtrati
      const otherAgents: Agent[] = [];
      
      // Filtra per escludere se stesso
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i] as Agent;
        if (agent && agent.getId() !== this.id) {
          otherAgents.push(agent);
        }
      }
      
      if (otherAgents.length > 0) {
        // Seleziona un agente casuale
        const randomIndex = Math.floor(Math.random() * otherAgents.length);
        return otherAgents[randomIndex].getId();
      }
    } catch (error) {
      console.error('Error in findRandomAgentId:', error);
    }
    
    // Fallback se non ci sono altri agenti o c'è un errore
    return `agent_random_${Math.floor(Math.random() * 1000)}`;
  }
  
  /**
   * Imposta lo stato dell'agente e aggiorna l'animazione
   */
  public changeState(newState: AgentState): void {
    if (this.currentState === newState) return;
    
    this.currentState = newState;
    this.playAnimation();
    
    // Debug
    console.log(`Agent ${this.name} changed state to ${newState}`);
  }
  
  /**
   * Riproduce l'animazione appropriata per lo stato corrente
   */
  private playAnimation(): void {
    switch (this.currentState) {
      case AgentState.WALKING:
        // Trova l'animazione di camminata per questo tipo di agente
        const walkAnim = `${this.role}_walk`;
        if (this.anims.exists(walkAnim)) {
          this.play(walkAnim);
        } else {
          // Fallback se l'animazione non esiste (es. sprite ritratto singolo-frame)
          console.warn(`Animation ${walkAnim} does not exist, using idle`);
          this.playIdleAnimation();
        }
        break;
      
      case AgentState.WORKING:
        // Trova l'animazione di lavoro per questo tipo di agente
        const workingAnim = `${this.role}_working`;
        if (this.anims.exists(workingAnim)) {
          this.play(workingAnim);
        } else {
          // Fallback se l'animazione non esiste
          console.warn(`Animation ${workingAnim} does not exist, using idle`);
          this.playIdleAnimation();
        }
        break;
        
      case AgentState.DISCUSSING:
      case AgentState.MEETING:
        // Trova l'animazione di discussione per questo tipo di agente
        const discussingAnim = `${this.role}_discussing`;
        if (this.anims.exists(discussingAnim)) {
          this.play(discussingAnim);
        } else {
          // Fallback se l'animazione non esiste
          console.warn(`Animation ${discussingAnim} does not exist, using idle`);
          this.playIdleAnimation();
        }
        break;
        
      case AgentState.IDLE:
      default:
        this.playIdleAnimation();
        break;
    }
  }
  
  /**
   * Riproduce l'animazione di idle
   */
  private playIdleAnimation(): void {
    // Trova l'animazione di idle per questo tipo di agente
    const idleAnim = `${this.role}_idle`;
    if (this.anims.exists(idleAnim)) {
      this.play(idleAnim);
    }
    // Se non esiste animazione, lo sprite mostra il frame di default della texture
    // (funziona sia per spritesheets che per immagini statiche)
  }
  
  /**
   * Muove l'agente verso una destinazione specifica
   */
  public moveTo(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    
    // In una implementazione completa, qui andrebbe calcolato un percorso
    // usando l'algoritmo A* e la griglia di navigazione
    // Per ora, usiamo un percorso diretto
    this.path = [
      { x: this.x, y: this.y },
      { x, y }
    ];
    
    this.currentPathIndex = 0;
    this.changeState(AgentState.WALKING);
  }
  
  /**
   * Muove l'agente verso una posizione ma si ferma a una certa distanza
   */
  public moveTowards(x: number, y: number, stopDistance: number): void {
    // Calcola la direzione
    const dx = x - this.x;
    const dy = y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Se già abbastanza vicino, non fare nulla
    if (distance <= stopDistance) {
      return;
    }
    
    // Calcola punto a cui arrivare (stopDistance dalla destinazione)
    const ratio = (distance - stopDistance) / distance;
    const targetX = this.x + dx * ratio;
    const targetY = this.y + dy * ratio;
    
    // Usa il metodo moveTo standard
    this.moveTo(targetX, targetY);
  }
  
  /**
   * Interagisce con un altro agente
   * @param otherAgent Agente con cui interagire
   */
  public interactWith(otherAgent: Agent): void {
    // Logica di interazione base
    console.log(`${this.name} is interacting with ${otherAgent.name}`);
    
    // Emetti un evento di interazione che può essere intercettato dal sistema di dialogo
    this.getGameEvents().emit('agent-interaction', {
      agentId1: this.id,
      agentId2: otherAgent.getId(),
      type: 'interaction'
    });
    
    // Cambia lo stato a DISCUSSING
    this.changeState(AgentState.DISCUSSING);
    this.stateTimer = this.getCurrentTime() + 3000; // Interagisci per 3 secondi
  }
  
  /**
   * Pulisce le risorse quando l'agente viene distrutto
   */
  destroy(fromScene?: boolean): void {
    if (this.nameText) {
      this.nameText.destroy();
    }
    
    if (this.stateIndicator) {
      this.stateIndicator.destroy();
    }
    
    super.destroy(fromScene);
  }
}