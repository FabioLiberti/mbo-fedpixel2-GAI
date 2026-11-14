// src/phaser/sprites/MedicalResearcher.ts

import Phaser from 'phaser';
import { ResearcherAgent } from './ResearcherAgent';

export class MedicalResearcher extends ResearcherAgent {
  private infoText: Phaser.GameObjects.Text | undefined;
  
  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, config: any) {
    super(scene, x, y, texture, {
      ...config,
      researcherType: 'researcher',
      specialization: 'clinical-data'
    });
    
    // Personalizza il comportamento per i ricercatori medici
    this.showMedicalResearcherInfo();
  }
  
  private showMedicalResearcherInfo(): void {
    // Utilizziamo un doppio cast per evitare problemi di compatibilità
    const phaserScene = this.scene as unknown as Phaser.Scene;
    
    // Crea un popup informativo
    this.infoText = phaserScene.add.text(this.x, this.y - 35, 
      "Medical Researcher",
      {
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: '#1a5276',
        padding: {
          left: 4,
          right: 4,
          top: 2,
          bottom: 2
        }
      }
    );
    
    // Verifica che infoText sia definito prima di chiamare setOrigin
    if (this.infoText) {
      this.infoText.setOrigin(0.5);
    }
    
    // Autodissolve dopo breve tempo se phaserScene.time esiste
    if (phaserScene.time) {
      phaserScene.time.delayedCall(2000, () => {
        if (this.infoText) {
          // Verifica che phaserScene.tweens esista
          if (phaserScene.tweens) {
            phaserScene.tweens.add({
              targets: this.infoText,
              alpha: 0,
              duration: 300,
              onComplete: () => {
                if (this.infoText) {
                  this.infoText.destroy();
                  this.infoText = undefined;
                }
              }
            });
          } else {
            // Fallback se tweens non è disponibile
            this.infoText.destroy();
            this.infoText = undefined;
          }
        }
      });
    }
  }
  
  update(time: number, delta: number): void {
    super.update(time, delta);
    
    // Aggiorna la posizione del testo info se esiste
    if (this.infoText) {
      this.infoText.setPosition(this.x, this.y - 35);
    }
  }
  
  destroy(fromScene?: boolean): void {
    if (this.infoText) {
      this.infoText.destroy();
    }
    super.destroy(fromScene);
  }
}