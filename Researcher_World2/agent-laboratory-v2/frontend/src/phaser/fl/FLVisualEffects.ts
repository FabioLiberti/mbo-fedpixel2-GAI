// frontend/src/phaser/fl/FLVisualEffects.ts

import Phaser from 'phaser';
import { Agent } from '../sprites/Agent';
// Rimuoviamo l'import inutilizzato di LabType
import { LAB_TYPES, LabTypeId } from '../types/LabTypeConstants';
import { FLState } from './FLState';

/**
 * Configurazione per gli indicatori visivi FL
 */
interface FLIndicatorConfig {
  scale: number;
  alpha: number;
  colors: {
    [key in FLState]: number;
  };
}

/**
 * Configurazione per le linee di connessione FL
 */
interface FLConnectionConfig {
  lineWidth: number;
  alpha: number;
  dashLength: number;
  dashGap: number;
  colors: {
    idle: number;
    active: number;
  };
  particleConfig: {
    count: number;
    speed: number;
    size: number;
    alpha: number;
  };
}

/**
 * Rappresentazione di un sistema di particelle nel contesto dell'applicazione
 */
interface ParticleSystem {
  emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  manager: any; // Utilizziamo any per evitare errori di tipo
}

/**
 * Estensione dell'interfaccia Scene per includere getLabPosition
 */
interface ExtendedScene extends Phaser.Scene {
  getLabPosition?: (labTypeId: LabTypeId) => Phaser.Math.Vector2 | null;
}

/**
 * Gestisce gli effetti visivi per il Federated Learning nel gioco
 */
export class FLVisualEffects {
  private scene: ExtendedScene;
  private indicatorConfig: FLIndicatorConfig;
  private connectionConfig: FLConnectionConfig;
  private indicators: Map<Agent, Phaser.GameObjects.Container>;
  private connections: Map<string, {
    line: Phaser.GameObjects.Graphics;
    particles: ParticleSystem | null;
    active: boolean;
  }>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene as ExtendedScene;
    this.indicators = new Map();
    this.connections = new Map();

    // Configurazione di default per gli indicatori
    this.indicatorConfig = {
      scale: 0.5,
      alpha: 0.85,
      colors: {
        [FLState.IDLE]: 0xcccccc,
        [FLState.TRAINING]: 0x3498db, // Blu
        [FLState.SENDING]: 0xe67e22,  // Arancione
        [FLState.AGGREGATING]: 0x9b59b6, // Viola
        [FLState.RECEIVING]: 0x2ecc71  // Verde
      }
    };

    // Configurazione di default per le connessioni
    this.connectionConfig = {
      lineWidth: 1,
      alpha: 0.6,
      dashLength: 5,
      dashGap: 5,
      colors: {
        idle: 0xcccccc,
        active: 0x3498db
      },
      particleConfig: {
        count: 3,
        speed: 100,
        size: 2,
        alpha: 0.6
      }
    };
  }

  /**
   * Crea o aggiorna l'indicatore di stato FL per un agente
   * @param agent L'agente a cui associare l'indicatore
   * @param state Lo stato FL dell'agente
   */
  updateAgentState(agent: Agent, state: FLState): void {
    if (!agent || !agent.active) return;
    
    if (!this.indicators.has(agent)) {
      this.createIndicator(agent, state);
    } else {
      this.updateIndicator(agent, state);
    }
  }

  /**
   * Crea un nuovo indicatore per un agente
   */
  private createIndicator(agent: Agent, state: FLState): void {
    const container = this.scene.add.container(0, 0);
    
    // Creiamo un cerchietto con il colore appropriato
    const circle = this.scene.add.circle(0, 0, 4, this.indicatorConfig.colors[state]);
    
    // Aggiungiamo un bordo sottile
    const border = this.scene.add.circle(0, 0, 4, 0xffffff);
    border.setStrokeStyle(0.5, 0x000000, 0.5);
    
    container.add([border, circle]);
    container.setScale(this.indicatorConfig.scale);
    container.setAlpha(this.indicatorConfig.alpha);
    
    // Posiziona l'indicatore sopra l'agente
    this.positionIndicator(container, agent);
    
    this.indicators.set(agent, container);
    
    // Aggiorniamo la posizione dell'indicatore quando l'agente si muove
    agent.on('move', () => {
      this.positionIndicator(container, agent);
    });
  }

  /**
   * Aggiorna lo stato di un indicatore esistente
   */
  private updateIndicator(agent: Agent, state: FLState): void {
    const container = this.indicators.get(agent);
    if (!container) return;
    
    // Aggiorniamo solo il colore del cerchio interno
    const circle = container.getAt(1) as Phaser.GameObjects.Arc;
    circle.fillColor = this.indicatorConfig.colors[state];
    
    // Se l'agente è inattivo o nello stato IDLE, riduciamo l'opacità
    container.setAlpha(state === FLState.IDLE ? 0.4 : this.indicatorConfig.alpha);
  }

  /**
   * Posiziona l'indicatore sopra l'agente
   */
  private positionIndicator(container: Phaser.GameObjects.Container, agent: Agent): void {
    container.setPosition(
      agent.x,
      agent.y - agent.displayHeight / 2 - 10 // Sopra l'agente con piccolo offset
    );
  }

  /**
   * Crea o aggiorna una connessione tra due laboratori
   * @param sourceLabType Laboratorio di origine
   * @param targetLabType Laboratorio di destinazione
   * @param active Se la connessione è attualmente attiva (trasferimento in corso)
   * @param sourcePoint Punto di origine (opzionale)
   * @param targetPoint Punto di destinazione (opzionale)
   */
  updateConnection(
    sourceLabType: LabTypeId,
    targetLabType: LabTypeId,
    active: boolean,
    sourcePoint?: Phaser.Math.Vector2,
    targetPoint?: Phaser.Math.Vector2
  ): void {
    const connectionId = `${sourceLabType}-${targetLabType}`;
    
    if (!this.connections.has(connectionId)) {
      this.createConnection(sourceLabType, targetLabType, active, sourcePoint, targetPoint);
    } else {
      const connection = this.connections.get(connectionId);
      
      if (connection && connection.active !== active) {
        connection.active = active;
        this.updateConnectionVisuals(connectionId, connection, active);
      }
    }
  }

  /**
   * Crea una nuova connessione tra laboratori
   */
  private createConnection(
    sourceLabType: LabTypeId,
    targetLabType: LabTypeId,
    active: boolean,
    sourcePoint?: Phaser.Math.Vector2,
    targetPoint?: Phaser.Math.Vector2
  ): void {
    // Ottenere o calcolare i punti di inizio e fine
    const start = sourcePoint || this.getLabPosition(sourceLabType);
    const end = targetPoint || this.getLabPosition(targetLabType);
    
    if (!start || !end) return;
    
    // Creare la linea
    const line = this.scene.add.graphics();
    this.drawDashedLine(line, start, end, active);
    
    // In Phaser 3, utilizziamo un approccio alternativo più semplice per le particelle
    let particles = null;
    
    // Verificare se il sistema di particelle è supportato prima di crearlo
    try {
      particles = this.createSimpleParticles(start, end, active);
    } catch (error) {
      console.warn('Particle system creation failed:', error);
      // Fallback - non utilizziamo particelle
    }
    
    this.connections.set(`${sourceLabType}-${targetLabType}`, {
      line,
      particles,
      active
    });
  }

  /**
   * Aggiorna la visualizzazione di una connessione esistente
   */
  private updateConnectionVisuals(
    connectionId: string,
    connection: {
      line: Phaser.GameObjects.Graphics;
      particles: ParticleSystem | null;
      active: boolean;
    },
    active: boolean
  ): void {
    const parts = connectionId.split('-');
    if (parts.length !== 2) return;
    
    // Conversione sicura dei tipi
    const sourceLabType = parts[0] as LabTypeId;
    const targetLabType = parts[1] as LabTypeId;
    
    // Aggiornare la linea
    connection.line.clear();
    
    const start = this.getLabPosition(sourceLabType);
    const end = this.getLabPosition(targetLabType);
    
    if (!start || !end) return;
    
    this.drawDashedLine(connection.line, start, end, active);
    
    // Aggiornare le particelle se esistenti
    if (connection.particles) {
      try {
        if (active) {
          // Utilizziamo sempre start() che è il metodo corretto
          connection.particles.emitter.start();
        } else {
          // Utilizziamo sempre stop() che è il metodo corretto
          connection.particles.emitter.stop();
        }
      } catch (error) {
        console.warn('Could not update particle emitter:', error);
      }
    }
  }

  /**
   * Disegna una linea tratteggiata tra due punti
   */
  private drawDashedLine(
    graphics: Phaser.GameObjects.Graphics,
    start: Phaser.Math.Vector2,
    end: Phaser.Math.Vector2,
    active: boolean
  ): void {
    const color = active 
      ? this.connectionConfig.colors.active 
      : this.connectionConfig.colors.idle;
    
    graphics.clear();
    graphics.lineStyle(
      this.connectionConfig.lineWidth,
      color,
      this.connectionConfig.alpha
    );
    
    const { dashLength, dashGap } = this.connectionConfig;
    
    // Calcola la distanza e direzione
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const normal = { x: dx / distance, y: dy / distance };
    
    // Disegna linea tratteggiata
    let drawn = 0;
    while (drawn < distance) {
      const dashStart = {
        x: start.x + normal.x * drawn,
        y: start.y + normal.y * drawn
      };
      
      const dashEnd = {
        x: start.x + normal.x * Math.min(drawn + dashLength, distance),
        y: start.y + normal.y * Math.min(drawn + dashLength, distance)
      };
      
      graphics.beginPath();
      graphics.moveTo(dashStart.x, dashStart.y);
      graphics.lineTo(dashEnd.x, dashEnd.y);
      graphics.strokePath();
      
      drawn += dashLength + dashGap;
    }
  }

  /**
   * Crea un sistema di particelle semplificato compatibile con Phaser 3
   */
  private createSimpleParticles(
    start: Phaser.Math.Vector2,
    end: Phaser.Math.Vector2,
    active: boolean
  ): ParticleSystem | null {
    // Fallback sicuro - creiamo un emettitore di particelle solo se la scena supporta particles
    if (!this.scene.add.particles) {
      return null;
    }
    
    try {
      // Creare una texture circolare per le particelle
      const particleTexture = 'fl-particle';
      if (!this.scene.textures.exists(particleTexture)) {
        const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffffff);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture(particleTexture, 8, 8);
        graphics.destroy();
      }
      
      // Calcola l'angolo e la distanza tra i punti
      const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
      
      // Creiamo un manager di particelle
      const manager = this.scene.add.particles(particleTexture);
      
      // Creiamo l'emettitore
      const emitter = manager.createEmitter({
        x: start.x,
        y: start.y,
        speed: this.connectionConfig.particleConfig.speed,
        angle: Phaser.Math.RadToDeg(angle),
        scale: { start: this.connectionConfig.particleConfig.size / 8, end: this.connectionConfig.particleConfig.size * 0.5 / 8 },
        alpha: { start: this.connectionConfig.particleConfig.alpha, end: 0 },
        lifespan: 2000,
        quantity: 1,
        frequency: 500,
        tint: this.connectionConfig.colors.active
      });
      
      // Avvia o ferma l'emettitore in base al flag active
      if (active) {
        emitter.start();
      } else {
        emitter.stop();
      }
      
      return { emitter, manager };
    } catch (error) {
      console.warn('Failed to create particle system:', error);
      return null;
    }
  }

  /**
   * Ottiene la posizione di un laboratorio
   */
  private getLabPosition(labTypeId: LabTypeId): Phaser.Math.Vector2 | null {
    // Implementazione di base - queste posizioni dovrebbero essere ottenute dinamicamente
    // in base alla posizione effettiva dei laboratori nella scena
    const positions: Record<string, Phaser.Math.Vector2> = {
      [LAB_TYPES.MERCATORUM]: new Phaser.Math.Vector2(200, 200),
      [LAB_TYPES.BLEKINGE]: new Phaser.Math.Vector2(400, 200),
      [LAB_TYPES.OPBG]: new Phaser.Math.Vector2(300, 400)
    };
    
    // Prima prova con la mappa predefinita
    if (positions[labTypeId]) {
      return positions[labTypeId];
    }
    
    // Se non funziona, prova a ottenere la posizione dalla scena WorldMapScene
    if (this.scene.getLabPosition) {
      try {
        return this.scene.getLabPosition(labTypeId);
      } catch (error) {
        console.warn(`Could not get lab position for ${labTypeId} from scene:`, error);
      }
    }
    
    return null;
  }

  /**
   * Rimuove un indicatore di stato per un agente
   */
  removeAgentIndicator(agent: Agent): void {
    const indicator = this.indicators.get(agent);
    if (indicator) {
      indicator.destroy();
      this.indicators.delete(agent);
    }
  }

  /**
   * Rimuove una connessione tra laboratori
   */
  removeConnection(sourceLabType: LabTypeId, targetLabType: LabTypeId): void {
    const connectionId = `${sourceLabType}-${targetLabType}`;
    const connection = this.connections.get(connectionId);
    
    if (connection) {
      // Rimuovi la linea
      connection.line.destroy();
      
      // Rimuovi le particelle in modo sicuro
      if (connection.particles) {
        try {
          // Ferma l'emettitore
          connection.particles.emitter.stop();
          
          // Distruggi il manager delle particelle
          connection.particles.manager.destroy();
        } catch (error) {
          console.warn('Error cleaning up particle emitter:', error);
        }
      }
      
      this.connections.delete(connectionId);
    }
  }

  /**
   * Aggiorna le posizioni delle connessioni quando le posizioni dei laboratori cambiano
   */
  updateConnectionPositions(): void {
    this.connections.forEach((connection, connectionId) => {
      const parts = connectionId.split('-');
      if (parts.length !== 2) return;
      
      // Conversione sicura dei tipi
      const sourceLabType = parts[0] as LabTypeId;
      const targetLabType = parts[1] as LabTypeId;
      
      const start = this.getLabPosition(sourceLabType);
      const end = this.getLabPosition(targetLabType);
      
      if (start && end) {
        // Aggiorna la linea
        connection.line.clear();
        this.drawDashedLine(connection.line, start, end, connection.active);
        
        // Aggiorna l'emettitore di particelle se esiste
        if (connection.particles) {
          try {
            // Recupera l'emettitore
            const emitter = connection.particles.emitter;
            
            // Ferma temporaneamente l'emettitore
            const wasActive = connection.active;
            emitter.stop();
            
            // Aggiorna la posizione dell'emettitore
            emitter.setPosition(start.x, start.y);
            
            // Aggiorna l'angolo
            const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
            emitter.setAngle(Phaser.Math.RadToDeg(angle));
            
            // Riattiva l'emettitore se era attivo prima
            if (wasActive) {
              emitter.start();
            }
          } catch (error) {
            console.warn('Error updating particle emitter position:', error);
          }
        }
      }
    });
  }

  /**
   * Pulisce tutti gli indicatori e le connessioni
   */
  clear(): void {
    // Rimuove tutti gli indicatori
    this.indicators.forEach(indicator => indicator.destroy());
    this.indicators.clear();
    
    // Rimuove tutte le connessioni
    this.connections.forEach(connection => {
      // Rimuovi la linea
      connection.line.destroy();
      
      // Rimuovi le particelle in modo sicuro
      if (connection.particles) {
        try {
          // Ferma l'emettitore
          connection.particles.emitter.stop();
          
          // Distruggi il manager delle particelle
          connection.particles.manager.destroy();
        } catch (error) {
          console.warn('Error cleaning up particle emitter during clear:', error);
        }
      }
    });
    
    this.connections.clear();
  }
}