// frontend/src/phaser/sprites/ResearcherAgent.ts

import Phaser from 'phaser';
import { Agent, AgentState, AgentConfig } from './Agent';

// Tipi di ricercatori
export type ResearcherType = 'phd-student' | 'researcher' | 'professor' | 'ml-engineer' | 'data-engineer' | 'privacy-specialist';

// Specializzazioni possibili
export type Specialization = 
  'data-science' | 
  'privacy-engineering' | 
  'optimization-theory' | 
  'secure-aggregation' | 
  'non-iid-data' | 
  'communication-efficiency' | 
  'fl-architecture' | 
  'theoretical-guarantees' | 
  'privacy-economics' | 
  'model-optimization' | 
  'systems-integration' | 
  'empirical-evaluation' | 
  'data-pipeline' | 
  'heterogeneous-data' | 
  'quality-assurance' | 
  'differential-privacy' | 
  'attack-simulation' | 
  'compliance-verification';

// Estensione dell'enum AgentState per includere stati specifici dei ricercatori
export enum ResearcherAgentState {
  ANALYZING = 'analyzing',
  WORKING = 'working',
  RESTING = 'resting',
  MOVING = 'moving'
}

export class ResearcherAgent extends Agent {
  private researcherType: ResearcherType;
  protected researcherSpecialization: Specialization;
  private researchProgress: number = 0;
  private collaborationStrength: number = 0;
  protected nextActionTime: number = 0;
  
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    config: AgentConfig & { 
      researcherType: ResearcherType, 
      specialization: Specialization 
    }
  ) {
    // Chiamata al costruttore della classe base
    super(scene, x, y, texture, {
      role: config.researcherType,  // Usiamo il researcherType come role
      name: config.name || `${config.researcherType.charAt(0).toUpperCase() + config.researcherType.slice(1)}`,
      speed: config.speed || 50,
      state: config.state,
      specialization: config.specialization
    });
    
    this.researcherType = config.researcherType;
    this.researcherSpecialization = config.specialization;
    
    // Configura proprietà specifiche in base al tipo
    this.configureByType();
    
    // Inizializza timer per cambi di stato
    this.nextActionTime = Date.now() + Phaser.Math.Between(3000, 6000);
  }
  
  update(time: number, delta: number): void {
    super.update(time, delta);
    
    // Logica di comportamento autonomo
    this.updateBehavior(time);
    
    // Aggiorna la progresso della ricerca quando lavora
    if (this.currentState === AgentState.WORKING) {
      this.researchProgress += (delta / 1000) * 0.1;
      
      // Visualizza qualche effetto quando fa progressi significativi
      if (Math.floor(this.researchProgress) % 5 === 0 && 
          Math.floor(this.researchProgress) > 0 &&
          Math.random() < 0.02) {
        this.showResearchProgress();
      }
    }
  }
  
  // Configura proprietà specifiche in base al tipo di ricercatore
  private configureByType(): void {
    switch (this.researcherType) {
      case 'phd-student':
        this.speed = 70; // Più veloce
        // Imposta colore nameTag
        this.updateNameTag('#e1f5fe');
        break;
        
      case 'researcher':
        this.speed = 50; // Velocità normale
        // Imposta colore nameTag
        this.updateNameTag('#e8f5e9');
        break;
        
      case 'professor':
        this.speed = 40; // Più lento
        // Imposta colore nameTag
        this.updateNameTag('#fff3e0');
        break;
        
      case 'ml-engineer':
      case 'data-engineer':
      case 'privacy-specialist':
        this.speed = 60;
        // Imposta colore nameTag
        this.updateNameTag('#f3e5f5');
        break;
    }
    
    // Imposta il testo del tag con nome
    this.updateNameTagText(this.formatTitle());
  }
  
  // Metodo per aggiornare il colore del nameTag
  private updateNameTag(color: string): void {
    if (this.nameText) {
      this.nameText.setBackgroundColor(color);
    }
  }
  
  // Metodo per aggiornare il testo del nameTag
  private updateNameTagText(text: string): void {
    if (this.nameText) {
      this.nameText.setText(text);
    }
  }
  
  // Formatta il titolo/ruolo per il tag nome
  private formatTitle(): string {
    let title = '';
    
    switch (this.researcherType) {
      case 'phd-student':
        title = 'PhD Student';
        break;
      case 'researcher':
        title = 'Researcher';
        break;
      case 'professor':
        title = 'Professor';
        break;
      case 'ml-engineer':
        title = 'ML Engineer';
        break;
      case 'data-engineer':
        title = 'Data Engineer';
        break;
      case 'privacy-specialist':
        title = 'Privacy Spec.';
        break;
    }
    
    return title;
  }
  
  // Aggiorna il comportamento autonomo
  private updateBehavior(time: number): void {
    // Cambia stato casualmente dopo un certo intervallo
    if (time > this.nextActionTime) {
      // Imposta un nuovo timer
      this.nextActionTime = time + Phaser.Math.Between(5000, 15000);
      
      // Non cambiare stato se già in movimento
      if (this.currentState === AgentState.WALKING) return;
      
      // Seleziona casualmente un nuovo stato
      const states = [
        AgentState.IDLE, 
        AgentState.WORKING, 
        AgentState.WALKING, 
        AgentState.DISCUSSING
      ];
      
      const newState = Phaser.Utils.Array.GetRandom(states);
      
      // Se il nuovo stato è 'walking', trova una nuova destinazione
      if (newState === AgentState.WALKING) {
        // Utilizziamo un doppio cast per evitare problemi di compatibilità
        const phaserScene = this.scene as unknown as Phaser.Scene;
        const width = phaserScene.cameras.main.width;
        const height = phaserScene.cameras.main.height;
        
        // Trova una posizione casuale nella scena e spostati lì
        this.moveTo(
          Phaser.Math.Between(50, width - 50),
          Phaser.Math.Between(50, height - 50)
        );
      } else {
        // Imposta il nuovo stato
        this.changeState(newState);
      }
    }
  }
  
  // Mostra una piccola animazione per il progresso della ricerca
  private showResearchProgress(): void {
    // Utilizziamo un doppio cast per evitare problemi di compatibilità
    const phaserScene = this.scene as unknown as Phaser.Scene;
    const idea = phaserScene.add.text(this.x, this.y - 30, '💡', {
      fontSize: '20px'
    });
    
    phaserScene.tweens.add({
      targets: idea,
      y: idea.y - 30,
      alpha: { from: 1, to: 0 },
      duration: 1000,
      onComplete: () => {
        idea.destroy();
      }
    });
  }
  
  // Getter per il tipo specifico del ricercatore
  getResearcherType(): ResearcherType {
    return this.researcherType;
  }
  
  // Getter per la specializzazione specifica
  getResearcherSpecialization(): Specialization {
    return this.researcherSpecialization;
  }
  
  // Getter per il progresso della ricerca
  getResearchProgress(): number {
    return this.researchProgress;
  }
}