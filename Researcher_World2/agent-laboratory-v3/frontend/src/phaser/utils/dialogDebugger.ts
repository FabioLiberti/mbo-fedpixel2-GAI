// frontend/src/phaser/utils/dialogDebugger.ts

import Phaser from 'phaser';
import { DialogController } from '../controllers/DialogController';
import { FLDialogType } from '../types/DialogTypes';
import { Agent } from '../sprites/Agent';

export class DialogDebugger {
  private scene: Phaser.Scene;
  private dialogController: DialogController;
  private container!: Phaser.GameObjects.Container; // Utilizziamo ! per definite assignment
  private agents: Agent[] = [];
  private isVisible: boolean = false;
  
  constructor(scene: Phaser.Scene, dialogController: DialogController, agents: Agent[]) {
    this.scene = scene;
    this.dialogController = dialogController;
    this.agents = agents;
    this.createDebugPanel();
  }
  
  private createDebugPanel(): void {
    // Crea un container per tutti gli elementi di debug
    this.container = this.scene.add.container(10, 10);
    this.container.setDepth(10000);
    
    // Sfondo del pannello
    const bg = this.scene.add.rectangle(0, 0, 200, 250, 0x000000, 0.7);
    bg.setOrigin(0, 0);
    this.container.add(bg);
    
    // Titolo
    const title = this.scene.add.text(10, 10, "Dialog Debugger", {
      color: '#ffffff',
      fontSize: '16px'
    });
    this.container.add(title);
    
    // Pulsanti per i tipi di dialogo
    const types = [
      { key: FLDialogType.GENERAL, label: 'General' },
      { key: FLDialogType.MODEL, label: 'Model Update' },
      { key: FLDialogType.DATA, label: 'Data Sharing' },
      { key: FLDialogType.PRIVACY, label: 'Privacy' },
      { key: FLDialogType.RESEARCH, label: 'Research' }
    ];
    
    let y = 40;
    types.forEach((type, i) => {
      const button = this.scene.add.text(20, y, type.label, {
        backgroundColor: '#333333',
        padding: { left: 10, right: 10, top: 5, bottom: 5 },
        color: '#ffffff'
      }).setInteractive();
      
      button.on('pointerdown', () => {
        this.triggerRandomDialog(type.key);
      });
      
      this.container.add(button);
      y += 35;
    });
    
    // Pulsante per chiudere
    const closeButton = this.scene.add.text(160, 10, "X", {
      color: '#ffffff'
    }).setInteractive();
    
    closeButton.on('pointerdown', () => {
      this.toggle();
    });
    
    this.container.add(closeButton);
    
    // Inizialmente nascondi il debugger
    this.container.setVisible(false);
    this.isVisible = false;
    
    // Aggiungi tasto per mostrare/nascondere (D)
    this.scene.input.keyboard.on('keydown-D', () => {
      this.toggle();
    });
  }
  
  private triggerRandomDialog(type: FLDialogType): void {
    if (this.agents.length < 2) {
      console.warn('Not enough agents for dialog test');
      return;
    }
    
    // Scegli due agenti casuali
    const idx1 = Math.floor(Math.random() * this.agents.length);
    let idx2;
    do {
      idx2 = Math.floor(Math.random() * this.agents.length);
    } while (idx2 === idx1);
    
    const agent1 = this.agents[idx1];
    const agent2 = this.agents[idx2];
    
    // Avvia il dialogo
    console.log(`Triggering ${type} dialog between ${agent1.name} and ${agent2.name}`);
    
    // Utilizziamo createDialog invece di startAgentDialog che non esiste
    this.dialogController.createDialog({
      sourceId: agent1.getId(),
      targetId: agent2.getId(),
      type: type,
      text: this.getRandomDialogText(type),
      showEffect: true
    });
  }
  
  /**
   * Genera un testo casuale per il dialogo di debug in base al tipo
   */
  private getRandomDialogText(type: FLDialogType): string {
    const texts: Record<FLDialogType, string[]> = {
      [FLDialogType.GENERAL]: [
        "Ciao, come sta andando la ricerca?",
        "Hai visto gli ultimi risultati?",
        "Dovremmo coordinarci meglio sul progetto."
      ],
      [FLDialogType.MODEL]: [
        "Ho aggiornato il modello con nuovi parametri!",
        "La precisione è migliorata del 5% con l'ultimo update.",
        "Il modello sta convergendo bene."
      ],
      [FLDialogType.DATA]: [
        "Sto condividendo i dati anonimizzati con te.",
        "Questi dati sono cruciali per il nostro esperimento.",
        "Dobbiamo migliorare la qualità dei nostri dataset."
      ],
      [FLDialogType.PRIVACY]: [
        "Ho implementato misure di differential privacy.",
        "Il privacy budget è sotto controllo.",
        "Questi dati sono protetti secondo gli standard GDPR."
      ],
      [FLDialogType.RESEARCH]: [
        "Ho una nuova intuizione sul problema!",
        "Questo approccio potrebbe essere rivoluzionario.",
        "Dobbiamo documentare i nostri risultati."
      ]
    };
    
    const options = texts[type] || texts[FLDialogType.GENERAL];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.container.setVisible(this.isVisible);
  }
  
  public destroy(): void {
    this.container.destroy();
  }
  
  // Metodo per aggiornare la lista degli agenti
  public updateAgents(agents: Agent[]): void {
    this.agents = agents;
  }
}