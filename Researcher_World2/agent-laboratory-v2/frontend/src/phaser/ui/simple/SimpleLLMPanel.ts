// frontend/src/phaser/ui/simple/SimpleLLMPanel.ts

import * as Phaser from 'phaser';
import { SimpleLLMPanelController } from './SimpleLLMPanelController';
import { SimpleLLMPanelView } from './SimpleLLMPanelView';
import { DialogController } from '../../controllers/DialogController';

/**
 * Classe principale per il pannello di controllo LLM semplificato
 * Punto di ingresso che gestisce controller e vista
 */
export class SimpleLLMPanel {
  private scene: Phaser.Scene;
  private controller: SimpleLLMPanelController;
  private view: SimpleLLMPanelView;
  private isVisible: boolean = false;
  
  /**
   * Costruttore
   * @param scene La scena Phaser in cui inserire il pannello
   * @param x Posizione X del pannello
   * @param y Posizione Y del pannello
   */
  constructor(scene: Phaser.Scene, x: number = 20, y: number = 60) {
    this.scene = scene;
    
    // Inizializza controller
    this.controller = new SimpleLLMPanelController(scene);
    
    // Inizializza vista
    this.view = new SimpleLLMPanelView(scene, this.controller, x, y);
  }
  
  /**
   * Imposta il controller dei dialoghi
   */
  public setDialogController(controller: DialogController): void {
    this.controller.setDialogController(controller);
  }
  
  /**
   * Mostra il pannello
   */
  public show(): void {
    this.view.show();
    this.isVisible = true;
  }
  
  /**
   * Nasconde il pannello
   */
  public hide(): void {
    this.view.hide();
    this.isVisible = false;
  }
  
  /**
   * Toggle visibilità pannello
   */
  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Restituisce lo stato di visibilità
   */
  public isShown(): boolean {
    return this.isVisible;
  }
  
  /**
   * Genera un messaggio LLM
   */
  public generateMessage(): void {
    this.controller.generateMessage();
  }
  
  /**
   * Distrugge il pannello
   */
  public destroy(): void {
    this.view.destroy();
    this.controller.destroy();
  }
}