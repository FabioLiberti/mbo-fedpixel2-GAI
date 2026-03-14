// frontend/src/phaser/ui/LabControlsMenu.ts

import * as Phaser from 'phaser';
import { SimpleLLMPanel } from './simple/SimpleLLMPanel';
import { LLMControlPanel } from './LLMControlPanel';
import { DialogController } from '../controllers/DialogController';

/**
 * Menu per i controlli del laboratorio che include il semplice pannello LLM
 */
export class LabControlsMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  //private menuBackground: Phaser.GameObjects.Graphics;
  private menuBackground!: Phaser.GameObjects.Graphics; // Aggiunta ! per l'inizializzazione definitiva
  private menuButtons: Phaser.GameObjects.Text[] = [];
  private isVisible: boolean = false;
  private isExpanded: boolean = false;
  private simpleLLMPanel: SimpleLLMPanel | null = null;
  private llmControlPanel: LLMControlPanel | null = null;
  private dialogController: DialogController | null = null;
  
  // Dimensioni
  private menuWidth: number = 180;
  private menuButtonHeight: number = 40;
  private expandedHeight: number = 0; // Verrà calcolato in base al numero di pulsanti
  private collapsedHeight: number = 50;
  private padding: number = 10;
  
  /**
   * Costruttore
   * @param scene La scena Phaser in cui inserire il menu
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Crea container
    this.container = this.scene.add.container(this.scene.cameras.main.width - this.menuWidth - 10, 10);
    this.container.setDepth(1000);
    
    // Inizializza elementi grafici
    this.createMenuElements();
    
    // Registra evento resize
    this.scene.scale.on('resize', this.handleResize, this);
    
    // Mostra menu collassato inizialmente
    this.show();
  }
  
  /**
   * Crea gli elementi del menu
   */
  private createMenuElements(): void {
    // Crea sfondo
    this.menuBackground = this.scene.add.graphics();
    this.container.add(this.menuBackground);
    
    // Titolo menu
    const titleText = this.scene.add.text(
      this.menuWidth / 2,
      25,
      'Controlli Lab',
      {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    titleText.setOrigin(0.5, 0.5);
    this.container.add(titleText);
    
    // Pulsante espandi/collassa
    const toggleButton = this.scene.add.text(
      this.menuWidth - 30,
      25,
      '▼',
      {
        fontSize: '16px',
        color: '#ffffff'
      }
    );
    toggleButton.setOrigin(0.5, 0.5);
    toggleButton.setInteractive({ useHandCursor: true });
    toggleButton.on('pointerdown', () => this.toggleMenu());
    this.container.add(toggleButton);
    
    // Definisci pulsanti del menu
    const menuItems = [
      { id: 'agents', label: 'Agenti' },
      { id: 'simple-llm', label: 'Simple LLM Panel' },
      { id: 'advanced-llm', label: 'Legacy LLM Panel' },
      { id: 'fl-dashboard', label: 'FL Dashboard' },
      { id: 'test-dialog', label: 'Test Dialogo' },
      { id: 'debug', label: 'Debug' }
    ];
    
    // Crea pulsanti del menu
    menuItems.forEach((item, index) => {
      const y = this.collapsedHeight + (index * this.menuButtonHeight) + this.padding;
      
      const button = this.scene.add.text(
        this.menuWidth / 2,
        y,
        item.label,
        {
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#3f51b5',
          padding: { left: 10, right: 10, top: 5, bottom: 5 }
        }
      );
      button.setOrigin(0.5, 0.5);
      button.setInteractive({ useHandCursor: true });
      button.visible = false; // Nascosto inizialmente
      
      // Gestisci clic sul pulsante
      button.on('pointerdown', () => this.handleMenuItemClick(item.id));
      
      // Effetti hover
      button.on('pointerover', () => {
        button.setBackgroundColor('#5c6bc0');
      });
      
      button.on('pointerout', () => {
        button.setBackgroundColor('#3f51b5');
      });
      
      this.menuButtons.push(button);
      this.container.add(button);
    });
    
    // Calcola altezza totale menu espanso
    this.expandedHeight = this.collapsedHeight + (menuItems.length * this.menuButtonHeight) + (this.padding * 2);
    
    // Disegna sfondo iniziale
    this.drawMenuBackground();
  }
  
  /**
   * Disegna lo sfondo del menu
   */
  private drawMenuBackground(): void {
    this.menuBackground.clear();
    
    // Determina altezza corrente
    const currentHeight = this.isExpanded ? this.expandedHeight : this.collapsedHeight;
    
    // Disegna sfondo
    this.menuBackground.fillStyle(0x1a1a2e, 0.9);
    this.menuBackground.fillRoundedRect(0, 0, this.menuWidth, currentHeight, 8);
    this.menuBackground.lineStyle(2, 0x3f51b5, 1);
    this.menuBackground.strokeRoundedRect(0, 0, this.menuWidth, currentHeight, 8);
  }
  
  /**
   * Gestisce il click su una voce di menu
   */
  private handleMenuItemClick(itemId: string): void {
    switch (itemId) {
      case 'simple-llm':
        this.toggleSimpleLLMPanel();
        break;
      case 'advanced-llm':
        this.toggleLegacyLLMPanel();
        break;
      case 'test-dialog':
        this.testDialog();
        break;
      case 'fl-dashboard':
        this.showFLDashboard();
        break;
      case 'agents':
        this.showAgentsLegend();
        break;
      case 'debug':
        this.toggleDebug();
        break;
    }
  }
  
  /**
   * Inizializza e mostra/nasconde il simple LLM panel
   */
  private toggleSimpleLLMPanel(): void {
    if (!this.simpleLLMPanel) {
      // Inizializza il pannello se non esiste
      this.simpleLLMPanel = new SimpleLLMPanel(this.scene);
      
      // Imposta dialog controller se presente
      if (this.dialogController) {
        this.simpleLLMPanel.setDialogController(this.dialogController);
      }
    }
    
    // Toggle visibilità
    if (this.simpleLLMPanel.isShown()) {
      this.simpleLLMPanel.hide();
    } else {
      this.simpleLLMPanel.show();
      
      // Nascondi legacy panel se attivo
      if (this.llmControlPanel && this.llmControlPanel.getIsVisible()) {
        this.llmControlPanel.hide();
      }
    }
  }
  
  /**
   * Inizializza e mostra/nasconde il legacy LLM control panel
   */
  private toggleLegacyLLMPanel(): void {
    if (!this.llmControlPanel) {
      // Inizializza il pannello se non esiste
      this.llmControlPanel = new LLMControlPanel(
        this.scene,
        20,
        60
      );
      
      // Imposta dialog controller se presente
      if (this.dialogController) {
        this.llmControlPanel.setDialogController(this.dialogController);
      }
    }
    
    // Toggle visibilità
    if (this.llmControlPanel.getIsVisible()) {
      this.llmControlPanel.hide();
    } else {
      this.llmControlPanel.show();
      
      // Nascondi simple panel se attivo
      if (this.simpleLLMPanel && this.simpleLLMPanel.isShown()) {
        this.simpleLLMPanel.hide();
      }
    }
  }
  
  /**
   * Mostra dashboard FL
   */
  private showFLDashboard(): void {
    // Emetti evento per mostrare la dashboard FL
    this.scene.events.emit('show-fl-dashboard');
    
    // Collassa menu
    this.collapseMenu();
  }
  
  /**
   * Mostra legenda agenti
   */
  private showAgentsLegend(): void {
    // Emetti evento per mostrare la legenda agenti
    this.scene.events.emit('show-agents-legend');
    
    // Collassa menu
    this.collapseMenu();
  }
  
  /**
   * Test dialogo
   */
  private testDialog(): void {
    // Emetti evento per testare il dialogo
    this.scene.events.emit('test-dialog');
    
    // Collassa menu
    this.collapseMenu();
  }
  
  /**
   * Toggle debug
   */
  private toggleDebug(): void {
    // Emetti evento per toggle debug
    this.scene.events.emit('toggle-debug');
    
    // Collassa menu
    this.collapseMenu();
  }
  
  /**
   * Toggle visibilità menu espanso/collassato
   */
  private toggleMenu(): void {
    this.isExpanded = !this.isExpanded;
    
    // Aggiorna visibilità pulsanti
    this.menuButtons.forEach(button => {
      button.visible = this.isExpanded;
    });
    
    // Ridisegna sfondo
    this.drawMenuBackground();
  }
  
  /**
   * Collassa il menu
   */
  private collapseMenu(): void {
    if (this.isExpanded) {
      this.toggleMenu();
    }
  }
  
  /**
   * Gestisce il ridimensionamento della finestra
   */
  private handleResize(): void {
    // Aggiorna posizione del container
    this.container.setPosition(this.scene.cameras.main.width - this.menuWidth - 10, 10);
  }
  
  /**
   * Imposta il controller dei dialoghi
   */
  public setDialogController(controller: DialogController): void {
    this.dialogController = controller;
    
    // Aggiorna i componenti esistenti
    if (this.simpleLLMPanel) {
      this.simpleLLMPanel.setDialogController(controller);
    }
    
    if (this.llmControlPanel) {
      this.llmControlPanel.setDialogController(controller);
    }
  }
  
  /**
   * Mostra il menu
   */
  public show(): void {
    this.container.setVisible(true);
    this.isVisible = true;
  }
  
  /**
   * Nasconde il menu
   */
  public hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
  }
  
  /**
   * Distrugge il menu e pulisce le risorse
   */
  public destroy(): void {
    // Rimuovi listener resize
    this.scene.scale.off('resize', this.handleResize, this);
    
    // Distruggi componenti
    if (this.simpleLLMPanel) {
      this.simpleLLMPanel.destroy();
      this.simpleLLMPanel = null;
    }
    
    if (this.llmControlPanel) {
      this.llmControlPanel.destroy();
      this.llmControlPanel = null;
    }
    
    // Distruggi container principale
    if (this.container && this.container.scene) {
      this.container.destroy();
    }
  }
}