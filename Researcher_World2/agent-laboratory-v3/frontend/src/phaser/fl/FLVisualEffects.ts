// frontend/src/phaser/fl/FLVisualEffects.ts

import Phaser from 'phaser';
import { Agent } from '../sprites/Agent';
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
  manager: any;
}

/**
 * Estensione dell'interfaccia Scene per includere getLabPosition
 */
interface ExtendedScene extends Phaser.Scene {
  getLabPosition?: (labTypeId: LabTypeId) => Phaser.Math.Vector2 | null;
}

/**
 * Gestisce gli effetti visivi per il Federated Learning nel gioco.
 * Include: indicatori stato agente, glow/pulse, connessioni animate, particelle.
 */
export class FLVisualEffects {
  private scene: ExtendedScene;
  private indicatorConfig: FLIndicatorConfig;
  private connectionConfig: FLConnectionConfig;
  private indicators: Map<Agent, {
    container: Phaser.GameObjects.Container;
    state: FLState;
    pulseTween: Phaser.Tweens.Tween | null;
  }>;
  private agentGlows: Map<Agent, {
    glow: Phaser.GameObjects.Ellipse;
    tween: Phaser.Tweens.Tween | null;
    state: FLState;
  }>;
  private connections: Map<string, {
    line: Phaser.GameObjects.Graphics;
    particles: ParticleSystem | null;
    active: boolean;
  }>;
  private dashOffset: number = 0;
  private updateEvent: Phaser.Events.EventEmitter | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene as ExtendedScene;
    this.indicators = new Map();
    this.agentGlows = new Map();
    this.connections = new Map();

    // Configurazione di default per gli indicatori
    this.indicatorConfig = {
      scale: 0.5,
      alpha: 0.85,
      colors: {
        [FLState.IDLE]: 0xcccccc,
        [FLState.TRAINING]: 0x3498db,     // Blu
        [FLState.SENDING]: 0xe67e22,      // Arancione
        [FLState.AGGREGATING]: 0x9b59b6,  // Viola
        [FLState.RECEIVING]: 0x2ecc71     // Verde
      }
    };

    // Configurazione di default per le connessioni
    this.connectionConfig = {
      lineWidth: 1.5,
      alpha: 0.6,
      dashLength: 6,
      dashGap: 4,
      colors: {
        idle: 0x555555,
        active: 0x3498db
      },
      particleConfig: {
        count: 3,
        speed: 80,
        size: 2,
        alpha: 0.6
      }
    };

    // Hook nel scene update per aggiornare posizioni indicatori e dash animation
    this.scene.events.on('update', this.onSceneUpdate, this);
  }

  // =========================================================================
  // Scene update loop — indicator tracking + dash animation
  // =========================================================================

  private onSceneUpdate(): void {
    // Aggiorna posizione indicatori e glow seguendo gli agenti
    this.indicators.forEach((data, agent) => {
      if (!agent.active) return;
      this.positionIndicator(data.container, agent);
    });
    this.agentGlows.forEach((data, agent) => {
      if (!agent.active) return;
      data.glow.setPosition(agent.x, agent.y);
    });

    // Anima dash offset per connessioni attive
    this.dashOffset = (this.dashOffset + 0.3) % (this.connectionConfig.dashLength + this.connectionConfig.dashGap);
    let hasActiveConnection = false;
    this.connections.forEach((conn) => {
      if (conn.active) hasActiveConnection = true;
    });
    if (hasActiveConnection) {
      this.redrawActiveConnections();
    }
  }

  // =========================================================================
  // Agent state indicators (colored dot above agent)
  // =========================================================================

  updateAgentState(agent: Agent, state: FLState): void {
    if (!agent || !agent.active) return;

    if (!this.indicators.has(agent)) {
      this.createIndicator(agent, state);
    } else {
      this.updateIndicator(agent, state);
    }

    // Gestisci glow effect sullo sprite
    this.updateAgentGlow(agent, state);
  }

  private createIndicator(agent: Agent, state: FLState): void {
    const container = this.scene.add.container(0, 0);

    const border = this.scene.add.circle(0, 0, 5, 0x000000, 0.3);
    const circle = this.scene.add.circle(0, 0, 4, this.indicatorConfig.colors[state]);

    container.add([border, circle]);
    container.setScale(this.indicatorConfig.scale);
    container.setAlpha(state === FLState.IDLE ? 0.3 : this.indicatorConfig.alpha);
    container.setDepth(1000);

    this.positionIndicator(container, agent);

    const pulseTween = this.createPulseTween(container, state);

    this.indicators.set(agent, { container, state, pulseTween });
  }

  private updateIndicator(agent: Agent, state: FLState): void {
    const data = this.indicators.get(agent);
    if (!data) return;

    // Nessun cambiamento di stato → skip
    if (data.state === state) return;
    data.state = state;

    const circle = data.container.getAt(1) as Phaser.GameObjects.Arc;
    circle.fillColor = this.indicatorConfig.colors[state];

    data.container.setAlpha(state === FLState.IDLE ? 0.3 : this.indicatorConfig.alpha);

    // Aggiorna pulse tween
    if (data.pulseTween) {
      data.pulseTween.stop();
      data.pulseTween = null;
    }
    data.pulseTween = this.createPulseTween(data.container, state);
  }

  private createPulseTween(container: Phaser.GameObjects.Container, state: FLState): Phaser.Tweens.Tween | null {
    if (state === FLState.IDLE) return null;

    const configs: Partial<Record<FLState, { scaleMax: number; duration: number }>> = {
      [FLState.TRAINING]:    { scaleMax: 0.7, duration: 800 },
      [FLState.SENDING]:     { scaleMax: 0.65, duration: 500 },
      [FLState.AGGREGATING]: { scaleMax: 0.75, duration: 600 },
      [FLState.RECEIVING]:   { scaleMax: 0.65, duration: 500 },
    };
    const cfg = configs[state];
    if (!cfg) return null;

    return this.scene.tweens.add({
      targets: container,
      scaleX: cfg.scaleMax,
      scaleY: cfg.scaleMax,
      duration: cfg.duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private positionIndicator(container: Phaser.GameObjects.Container, agent: Agent): void {
    container.setPosition(
      agent.x,
      agent.y - agent.displayHeight / 2 - 10
    );
  }

  // =========================================================================
  // Agent glow effect (ellipse under sprite, colored by FL state)
  // =========================================================================

  private updateAgentGlow(agent: Agent, state: FLState): void {
    if (state === FLState.IDLE) {
      // Rimuovi glow per stato idle
      this.removeAgentGlow(agent);
      return;
    }

    const color = this.indicatorConfig.colors[state];

    if (!this.agentGlows.has(agent)) {
      // Crea nuovo glow
      const glow = this.scene.add.ellipse(
        agent.x, agent.y,
        agent.displayWidth * 1.6,
        agent.displayHeight * 0.5,
        color, 0.25
      );
      glow.setDepth(agent.depth - 1);

      const tween = this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.15, to: 0.35 },
        scaleX: { from: 1.0, to: 1.15 },
        scaleY: { from: 1.0, to: 1.1 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.agentGlows.set(agent, { glow, tween, state });
    } else {
      const data = this.agentGlows.get(agent)!;
      if (data.state !== state) {
        data.state = state;
        data.glow.fillColor = color;
      }
    }
  }

  private removeAgentGlow(agent: Agent): void {
    const data = this.agentGlows.get(agent);
    if (data) {
      if (data.tween) data.tween.stop();
      data.glow.destroy();
      this.agentGlows.delete(agent);
    }
  }

  // =========================================================================
  // Connection lines between labs
  // =========================================================================

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
      const connection = this.connections.get(connectionId)!;
      if (connection.active !== active) {
        connection.active = active;
        this.updateConnectionVisuals(connectionId, connection, active);
      }
    }
  }

  private createConnection(
    sourceLabType: LabTypeId,
    targetLabType: LabTypeId,
    active: boolean,
    sourcePoint?: Phaser.Math.Vector2,
    targetPoint?: Phaser.Math.Vector2
  ): void {
    const start = sourcePoint || this.getLabPosition(sourceLabType);
    const end = targetPoint || this.getLabPosition(targetLabType);
    if (!start || !end) return;

    const line = this.scene.add.graphics();
    this.drawDashedLine(line, start, end, active, 0);

    let particles: ParticleSystem | null = null;
    if (active) {
      try {
        particles = this.createSimpleParticles(start, end, active);
      } catch (error) {
        console.warn('Particle system creation failed:', error);
      }
    }

    this.connections.set(`${sourceLabType}-${targetLabType}`, {
      line, particles, active
    });
  }

  private updateConnectionVisuals(
    connectionId: string,
    connection: { line: Phaser.GameObjects.Graphics; particles: ParticleSystem | null; active: boolean },
    active: boolean
  ): void {
    const parts = connectionId.split('-');
    if (parts.length !== 2) return;

    const sourceLabType = parts[0] as LabTypeId;
    const targetLabType = parts[1] as LabTypeId;

    const start = this.getLabPosition(sourceLabType);
    const end = this.getLabPosition(targetLabType);
    if (!start || !end) return;

    connection.line.clear();
    this.drawDashedLine(connection.line, start, end, active, this.dashOffset);

    // Gestisci particelle
    if (active && !connection.particles) {
      try {
        connection.particles = this.createSimpleParticles(start, end, true);
      } catch (e) { /* ignore */ }
    }
    if (connection.particles) {
      try {
        if (active) {
          connection.particles.emitter.start();
        } else {
          connection.particles.emitter.stop();
        }
      } catch (e) {
        console.warn('Could not update particle emitter:', e);
      }
    }
  }

  /**
   * Ridisegna le connessioni attive con dash offset animato
   */
  private redrawActiveConnections(): void {
    this.connections.forEach((connection, connectionId) => {
      if (!connection.active) return;
      const parts = connectionId.split('-');
      if (parts.length !== 2) return;

      const start = this.getLabPosition(parts[0] as LabTypeId);
      const end = this.getLabPosition(parts[1] as LabTypeId);
      if (!start || !end) return;

      connection.line.clear();
      this.drawDashedLine(connection.line, start, end, true, this.dashOffset);
    });
  }

  /**
   * Disegna una linea tratteggiata tra due punti con offset per animazione
   */
  private drawDashedLine(
    graphics: Phaser.GameObjects.Graphics,
    start: Phaser.Math.Vector2,
    end: Phaser.Math.Vector2,
    active: boolean,
    offset: number
  ): void {
    const color = active
      ? this.connectionConfig.colors.active
      : this.connectionConfig.colors.idle;
    const lineWidth = active ? this.connectionConfig.lineWidth * 1.5 : this.connectionConfig.lineWidth;
    const alpha = active ? 0.8 : this.connectionConfig.alpha;

    graphics.lineStyle(lineWidth, color, alpha);

    const { dashLength, dashGap } = this.connectionConfig;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;
    const normal = { x: dx / distance, y: dy / distance };

    let drawn = -offset;  // negative offset creates animation illusion
    while (drawn < distance) {
      const segStart = Math.max(0, drawn);
      const segEnd = Math.min(drawn + dashLength, distance);

      if (segEnd > 0 && segStart < distance) {
        graphics.beginPath();
        graphics.moveTo(
          start.x + normal.x * segStart,
          start.y + normal.y * segStart
        );
        graphics.lineTo(
          start.x + normal.x * segEnd,
          start.y + normal.y * segEnd
        );
        graphics.strokePath();
      }

      drawn += dashLength + dashGap;
    }
  }

  // =========================================================================
  // Particle system for active connections
  // =========================================================================

  private createSimpleParticles(
    start: Phaser.Math.Vector2,
    end: Phaser.Math.Vector2,
    active: boolean
  ): ParticleSystem | null {
    if (!this.scene.add.particles) return null;

    try {
      const particleTexture = 'fl-particle';
      if (!this.scene.textures.exists(particleTexture)) {
        const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffffff);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture(particleTexture, 8, 8);
        graphics.destroy();
      }

      const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
      const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);

      const manager = this.scene.add.particles(particleTexture);

      const emitter = manager.createEmitter({
        x: start.x,
        y: start.y,
        speed: this.connectionConfig.particleConfig.speed,
        angle: { min: Phaser.Math.RadToDeg(angle) - 5, max: Phaser.Math.RadToDeg(angle) + 5 },
        scale: { start: this.connectionConfig.particleConfig.size / 8, end: 0.05 },
        alpha: { start: this.connectionConfig.particleConfig.alpha, end: 0 },
        lifespan: (distance / this.connectionConfig.particleConfig.speed) * 1000,
        quantity: 1,
        frequency: 400,
        tint: this.connectionConfig.colors.active,
      });

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

  // =========================================================================
  // Lab position helper
  // =========================================================================

  private getLabPosition(labTypeId: LabTypeId): Phaser.Math.Vector2 | null {
    // Prima prova dalla scena (WorldMapScene ha getLabPosition)
    if (this.scene.getLabPosition) {
      try {
        const pos = this.scene.getLabPosition(labTypeId);
        if (pos) return pos;
      } catch (error) {
        // fallback sotto
      }
    }

    // Posizioni di fallback
    const positions: Record<string, Phaser.Math.Vector2> = {
      [LAB_TYPES.MERCATORUM]: new Phaser.Math.Vector2(200, 200),
      [LAB_TYPES.BLEKINGE]: new Phaser.Math.Vector2(400, 200),
      [LAB_TYPES.OPBG]: new Phaser.Math.Vector2(300, 400)
    };

    return positions[labTypeId] || null;
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  removeAgentIndicator(agent: Agent): void {
    const data = this.indicators.get(agent);
    if (data) {
      if (data.pulseTween) data.pulseTween.stop();
      data.container.destroy();
      this.indicators.delete(agent);
    }
    this.removeAgentGlow(agent);
  }

  removeConnection(sourceLabType: LabTypeId, targetLabType: LabTypeId): void {
    const connectionId = `${sourceLabType}-${targetLabType}`;
    const connection = this.connections.get(connectionId);

    if (connection) {
      connection.line.destroy();
      if (connection.particles) {
        try {
          connection.particles.emitter.stop();
          connection.particles.manager.destroy();
        } catch (error) {
          console.warn('Error cleaning up particle emitter:', error);
        }
      }
      this.connections.delete(connectionId);
    }
  }

  updateConnectionPositions(): void {
    this.connections.forEach((connection, connectionId) => {
      const parts = connectionId.split('-');
      if (parts.length !== 2) return;

      const start = this.getLabPosition(parts[0] as LabTypeId);
      const end = this.getLabPosition(parts[1] as LabTypeId);

      if (start && end) {
        connection.line.clear();
        this.drawDashedLine(connection.line, start, end, connection.active, this.dashOffset);

        if (connection.particles) {
          try {
            const emitter = connection.particles.emitter;
            const wasActive = connection.active;
            emitter.stop();
            emitter.setPosition(start.x, start.y);
            const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
            emitter.setAngle(Phaser.Math.RadToDeg(angle));
            if (wasActive) emitter.start();
          } catch (error) {
            console.warn('Error updating particle emitter position:', error);
          }
        }
      }
    });
  }

  clear(): void {
    // Rimuovi scene update listener
    this.scene.events.off('update', this.onSceneUpdate, this);

    // Rimuovi indicatori
    this.indicators.forEach(data => {
      if (data.pulseTween) data.pulseTween.stop();
      data.container.destroy();
    });
    this.indicators.clear();

    // Rimuovi glow
    this.agentGlows.forEach(data => {
      if (data.tween) data.tween.stop();
      data.glow.destroy();
    });
    this.agentGlows.clear();

    // Rimuovi connessioni
    this.connections.forEach(connection => {
      connection.line.destroy();
      if (connection.particles) {
        try {
          connection.particles.emitter.stop();
          connection.particles.manager.destroy();
        } catch (error) {
          console.warn('Error cleaning up particle emitter during clear:', error);
        }
      }
    });
    this.connections.clear();
  }
}
