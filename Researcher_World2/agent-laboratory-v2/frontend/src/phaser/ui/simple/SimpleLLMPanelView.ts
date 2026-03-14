// frontend/src/phaser/ui/simple/SimpleLLMPanelView.ts

import * as Phaser from 'phaser';
import { SimpleLLMLogEntry } from './SimpleLLMPanelModel';
import { SimpleLLMPanelController } from './SimpleLLMPanelController';

/**
 * Classe che rappresenta la vista grafica del pannello di controllo LLM semplificato
 */
export class SimpleLLMPanelView {
  private scene: Phaser.Scene;
  private controller: SimpleLLMPanelController;
  private container: Phaser.GameObjects.Container;
  
  // Elementi UI
  private background!: Phaser.GameObjects.Graphics;
  private closeButton!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private backendStatusText!: Phaser.GameObjects.Text;
  
  // Elementi di controllo
  private toggleContainer!: Phaser.GameObjects.Container;
  private toggleSwitch!: Phaser.GameObjects.Graphics;
  private toggleText!: Phaser.GameObjects.Text;
  
  private frequencyContainer!: Phaser.GameObjects.Container;
  private frequencySlider!: Phaser.GameObjects.Graphics;
  private frequencyThumb!: Phaser.GameObjects.Graphics;
  private frequencyText!: Phaser.GameObjects.Text;
  
  private messageTypeContainer!: Phaser.GameObjects.Container;
  private messageTypeButtons: Phaser.GameObjects.Graphics[] = [];
  private messageTypeTexts: Phaser.GameObjects.Text[] = [];
  
  private generateButton!: Phaser.GameObjects.Container;
  private generateButtonBg!: Phaser.GameObjects.Graphics;
  private generateButtonText!: Phaser.GameObjects.Text;
  
  // Statistiche
  private statsContainer!: Phaser.GameObjects.Container;
  private statsText: Phaser.GameObjects.Text[] = [];
  
  // Log
  private logContainer!: Phaser.GameObjects.Container;
  private logEntries: Phaser.GameObjects.Container[] = [];
  private logScrollArea!: Phaser.GameObjects.Graphics;
  private logScrollMask!: Phaser.GameObjects.Graphics;
  private logScrollContent!: Phaser.GameObjects.Container;
  private scrollbar!: Phaser.GameObjects.Graphics;
  private scrollThumb!: Phaser.GameObjects.Graphics;
  
  // Dimensioni e posizionamento
  private width: number = 400;
  private height: number = 650;
  private padding: number = 15;
  private logAreaHeight: number = 250;
  
  // Stato di scrolling
  private isScrolling: boolean = false;
  private scrollStartY: number = 0;
  
  // Colori
  private readonly colors = {
    background: 0x1a1a2e,
    accent: 0x3f51b5,
    text: 0xffffff,
    textDim: 0xbbbbbb,
    toggleOn: 0x4caf50,
    toggleOff: 0xbdbdbd,
    slider: 0x2196f3,
    buttonPrimary: 0x2196f3,
    buttonHover: 0x42a5f5,
    messageDialog: 0x1e3a5f,
    messageSimulated: 0x303030,
    llmText: 0x4caf50,
    simulatedText: 0xff9800,
    standardText: 0x2196f3,
    backendConnected: 0x4caf50,
    backendDisconnected: 0xf44336
  };
  
  /**
   * Costruttore della vista
   */
  constructor(scene: Phaser.Scene, controller: SimpleLLMPanelController, x: number = 20, y: number = 60) {
    this.scene = scene;
    this.controller = controller;
    
    // Crea il container principale
    this.container = this.scene.add.container(x, y);
    this.container.setDepth(1000); // Sopra altri elementi
    
    // Inizializza l'interfaccia grafica
    this.createUI();
    
    // Imposta la vista nel controller
    this.controller.setView(this);
    
    // Nascondi il pannello all'inizio
    this.hide();
  }
  
  /**
   * Crea tutti gli elementi dell'interfaccia grafica
   */
  private createUI(): void {
    // Crea lo sfondo
    this.background = this.scene.add.graphics();
    this.drawBackground();
    this.container.add(this.background);
    
    // Crea titolo e pulsante di chiusura
    this.createHeader();
    
    // Crea i controlli
    this.createControls();
    
    // Crea la sezione statistiche
    this.createStatsSection();
    
    // Crea la sezione log
    this.createLogSection();
  }
  
  /**
   * Crea l'intestazione del pannello
   */
  private createHeader(): void {
    // Titolo
    this.titleText = this.scene.add.text(
      this.width / 2,
      this.padding,
      'Simple LLM Control',
      {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    this.titleText.setOrigin(0.5, 0);
    this.container.add(this.titleText);
    
    // Stato backend
    this.backendStatusText = this.scene.add.text(
      this.width - this.padding,
      this.titleText.y + this.titleText.height + 5,
      'Backend: Checking...',
      {
        fontSize: '12px',
        color: '#bbbbbb',
        align: 'right'
      }
    );
    this.backendStatusText.setOrigin(1, 0);
    this.container.add(this.backendStatusText);
    
    // Pulsante di chiusura
    this.closeButton = this.scene.add.text(
      this.width - this.padding,
      this.padding,
      'X',
      {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#aa0000',
        padding: { left: 5, right: 5, top: 2, bottom: 2 }
      }
    );
    this.closeButton.setOrigin(1, 0);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.on('pointerdown', () => this.hide());
    this.container.add(this.closeButton);
  }
  
  /**
   * Crea i controlli del pannello
   */
  private createControls(): void {
    const controlsY = this.padding + 50;
    
    // Titolo sezione controlli
    const controlsTitle = this.scene.add.text(
      this.padding,
      controlsY,
      'Controls',
      {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    this.container.add(controlsTitle);
    
    // Separatore
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, this.colors.accent, 0.8);
    separator.lineBetween(this.padding, controlsY + 30, this.width - this.padding, controlsY + 30);
    this.container.add(separator);
    
    // Toggle LLM
    this.createToggle(this.padding, controlsY + 50);
    
    // Frequenza messaggi
    this.createFrequencySlider(this.padding, controlsY + 90);
    
    // Selettore tipo messaggio
    this.createMessageTypeSelector(this.padding, controlsY + 140);
    
    // Pulsante genera messaggio
    this.createGenerateButton(this.padding, controlsY + 190);
  }
  
  /**
   * Crea il toggle per attivare/disattivare LLM
   */
  private createToggle(x: number, y: number): void {
    // Container per il toggle
    this.toggleContainer = this.scene.add.container(x, y);
    
    // Etichetta
    const label = this.scene.add.text(
      0,
      0,
      'LLM Messages:',
      {
        fontSize: '14px',
        color: '#ffffff'
      }
    );
    this.toggleContainer.add(label);
    
    // Switch
    this.toggleSwitch = this.scene.add.graphics();
    this.drawToggleSwitch(true); // Default ON
    this.toggleContainer.add(this.toggleSwitch);
    
    // Testo stato
    this.toggleText = this.scene.add.text(
      220,
      0,
      'ON',
      {
        fontSize: '14px',
        color: '#4caf50'
      }
    );
    this.toggleText.setOrigin(0, 0.5);
    this.toggleContainer.add(this.toggleText);
    
    // Interattività
    this.toggleSwitch.setInteractive(new Phaser.Geom.Rectangle(140, -10, 60, 20), Phaser.Geom.Rectangle.Contains);
    this.toggleSwitch.on('pointerdown', () => {
      const currentState = this.toggleText.text === 'ON';
      const newState = !currentState;
      
      // Aggiorna UI
      this.updateToggleState(newState);
      
      // Notifica controller
      this.controller.handleToggleLLM(newState);
    });
    
    // Effetti hover
    this.toggleSwitch.on('pointerover', () => {
      const currentState = this.toggleText.text === 'ON';
      this.toggleSwitch.clear();
      this.toggleSwitch.fillStyle(0x444444, 1);
      this.toggleSwitch.fillRoundedRect(140, -10, 60, 20, 10);
      this.toggleSwitch.fillStyle(currentState ? 0x5dbf5e : 0xcdcdcd, 1);
      this.toggleSwitch.fillRoundedRect(140 + (currentState ? 30 : 0), -10, 30, 20, 10);
    });
    
    this.toggleSwitch.on('pointerout', () => {
      const currentState = this.toggleText.text === 'ON';
      this.drawToggleSwitch(currentState);
    });
    
    this.container.add(this.toggleContainer);
  }
  
  /**
   * Disegna lo switch del toggle
   */
  private drawToggleSwitch(isEnabled: boolean): void {
    this.toggleSwitch.clear();
    this.toggleSwitch.fillStyle(0x333333, 1);
    this.toggleSwitch.fillRoundedRect(140, -10, 60, 20, 10);
    this.toggleSwitch.fillStyle(isEnabled ? this.colors.toggleOn : this.colors.toggleOff, 1);
    this.toggleSwitch.fillRoundedRect(140 + (isEnabled ? 30 : 0), -10, 30, 20, 10);
  }
  
  /**
   * Crea lo slider per la frequenza dei messaggi
   */
  private createFrequencySlider(x: number, y: number): void {
    // Container per lo slider
    this.frequencyContainer = this.scene.add.container(x, y);
    
    // Etichetta
    const label = this.scene.add.text(
      0,
      0,
      'Message Frequency:',
      {
        fontSize: '14px',
        color: '#ffffff'
      }
    );
    this.frequencyContainer.add(label);
    
    // Valore percentuale
    this.frequencyText = this.scene.add.text(
      280,
      0,
      '50%',
      {
        fontSize: '14px',
        color: '#ffffff',
        align: 'right'
      }
    );
    this.frequencyText.setOrigin(1, 0.5);
    this.frequencyContainer.add(this.frequencyText);
    
    // Traccia slider
    this.frequencySlider = this.scene.add.graphics();
    this.frequencySlider.fillStyle(0x333333, 1);
    this.frequencySlider.fillRoundedRect(0, 30, 280, 10, 5);
    this.frequencyContainer.add(this.frequencySlider);
    
    // Thumb slider
    this.frequencyThumb = this.scene.add.graphics();
    this.frequencyThumb.fillStyle(this.colors.slider, 1);
    this.frequencyThumb.fillCircle(140, 35, 12); // 50% default
    this.frequencyContainer.add(this.frequencyThumb);
    
    // Interattività
    this.frequencySlider.setInteractive(new Phaser.Geom.Rectangle(0, 25, 280, 20), Phaser.Geom.Rectangle.Contains);
    
    // Funzione per aggiornare lo slider
    const updateSlider = (x: number): void => {
      const clampedX = Phaser.Math.Clamp(x, 0, 280);
      const newFrequency = clampedX / 280;
      
      this.updateFrequency(newFrequency);
      
      // Notifica controller
      this.controller.handleFrequencyChange(newFrequency);
    };
    
    // Eventi
    this.frequencySlider.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - this.container.x - x;
      updateSlider(localX);
      
      // Avvia modalità drag
      this.scene.input.on('pointermove', (movePointer: Phaser.Input.Pointer) => {
        if (movePointer.isDown) {
          const moveX = movePointer.x - this.container.x - x;
          updateSlider(moveX);
        }
      });
      
      // Termina modalità drag
      this.scene.input.once('pointerup', () => {
        this.scene.input.off('pointermove');
      });
    });
    
    this.container.add(this.frequencyContainer);
  }
  
  /**
   * Crea i pulsanti per selezionare il tipo di messaggio
   */
  private createMessageTypeSelector(x: number, y: number): void {
    // Container per i pulsanti
    this.messageTypeContainer = this.scene.add.container(x, y);
    
    // Etichetta
    const label = this.scene.add.text(
      0,
      0,
      'Message Type:',
      {
        fontSize: '14px',
        color: '#ffffff'
      }
    );
    this.messageTypeContainer.add(label);
    
    // Opzioni disponibili
    const options = [
      { id: 'dialog', label: 'Dialog' },
      { id: 'thinking', label: 'Thinking' },
      { id: 'decision', label: 'Decision' }
    ];
    
    // Dimensioni pulsanti
    const buttonWidth = 80;
    const buttonHeight = 30;
    const buttonSpacing = 10;
    
    // Crea pulsanti
    options.forEach((option, index) => {
      const buttonX = index * (buttonWidth + buttonSpacing);
      const isSelected = option.id === 'dialog'; // Default dialog
      
      // Grafica pulsante
      const button = this.scene.add.graphics();
      button.fillStyle(isSelected ? this.colors.accent : 0x333333, 1);
      button.fillRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
      button.lineStyle(1, isSelected ? 0x5c6bc0 : 0x555555, 1);
      button.strokeRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
      
      // Memorizza riferimento pulsante
      this.messageTypeButtons.push(button);
      this.messageTypeContainer.add(button);
      
      // Testo pulsante
      const text = this.scene.add.text(
        buttonX + buttonWidth / 2,
        30 + buttonHeight / 2,
        option.label,
        {
          fontSize: '12px',
          color: isSelected ? '#ffffff' : '#aaaaaa'
        }
      );
      text.setOrigin(0.5);
      
      // Memorizza riferimento testo
      this.messageTypeTexts.push(text);
      this.messageTypeContainer.add(text);
      
      // Interattività
      button.setInteractive(new Phaser.Geom.Rectangle(buttonX, 30, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
      
      button.on('pointerdown', () => {
        // Notifica controller
        this.controller.handleMessageTypeChange(option.id);
      });
      
      // Effetti hover
      button.on('pointerover', () => {
        if (!isSelected) {
          button.clear();
          button.fillStyle(0x444444, 1);
          button.fillRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
          button.lineStyle(1, 0x666666, 1);
          button.strokeRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
        }
      });
      
      button.on('pointerout', () => {
        const currentSelected = this.controller.getModel().getSelectedMessageType();
        const isButtonSelected = option.id === currentSelected;
        
        if (!isButtonSelected) {
          button.clear();
          button.fillStyle(0x333333, 1);
          button.fillRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
          button.lineStyle(1, 0x555555, 1);
          button.strokeRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
        }
      });
    });
    
    this.container.add(this.messageTypeContainer);
  }
  
  /**
   * Crea il pulsante per generare un messaggio
   */
  private createGenerateButton(x: number, y: number): void {
    // Container per il pulsante
    this.generateButton = this.scene.add.container(x, y);
    
    // Sfondo pulsante
    this.generateButtonBg = this.scene.add.graphics();
    this.generateButtonBg.fillStyle(this.colors.buttonPrimary, 1);
    this.generateButtonBg.fillRoundedRect(0, 0, 370, 40, 8);
    this.generateButtonBg.lineStyle(2, 0x64b5f6, 1);
    this.generateButtonBg.strokeRoundedRect(0, 0, 370, 40, 8);
    this.generateButton.add(this.generateButtonBg);
    
    // Icona AI
    const aiIcon = this.scene.add.text(
      20,
      20,
      'AI',
      {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#1976d2',
        padding: { left: 6, right: 6, top: 3, bottom: 3 }
      }
    );
    aiIcon.setOrigin(0.5);
    this.generateButton.add(aiIcon);
    
    // Testo pulsante
    this.generateButtonText = this.scene.add.text(
      185,
      20,
      'Generate LLM Message',
      {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    this.generateButtonText.setOrigin(0.5);
    this.generateButton.add(this.generateButtonText);
    
    // Interattività
    this.generateButtonBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, 370, 40), Phaser.Geom.Rectangle.Contains);
    
    this.generateButtonBg.on('pointerdown', () => {
      // Notifica controller
      this.controller.generateMessage();
    });
    
    // Effetti hover
    this.generateButtonBg.on('pointerover', () => {
      this.generateButtonBg.clear();
      this.generateButtonBg.fillStyle(this.colors.buttonHover, 1);
      this.generateButtonBg.fillRoundedRect(0, 0, 370, 40, 8);
      this.generateButtonBg.lineStyle(2, 0x90caf9, 1);
      this.generateButtonBg.strokeRoundedRect(0, 0, 370, 40, 8);
    });
    
    this.generateButtonBg.on('pointerout', () => {
      this.generateButtonBg.clear();
      this.generateButtonBg.fillStyle(this.colors.buttonPrimary, 1);
      this.generateButtonBg.fillRoundedRect(0, 0, 370, 40, 8);
      this.generateButtonBg.lineStyle(2, 0x64b5f6, 1);
      this.generateButtonBg.strokeRoundedRect(0, 0, 370, 40, 8);
    });
    
    this.container.add(this.generateButton);
  }
  
  /**
   * Crea la sezione delle statistiche
   */
  private createStatsSection(): void {
    const sectionY = 300;
    
    // Titolo sezione
    const statsTitle = this.scene.add.text(
      this.padding,
      sectionY,
      'Statistics',
      {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    this.container.add(statsTitle);
    
    // Separatore
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, this.colors.accent, 0.8);
    separator.lineBetween(this.padding, sectionY + 30, this.width - this.padding, sectionY + 30);
    this.container.add(separator);
    
    // Container statistiche
    this.statsContainer = this.scene.add.container(this.padding, sectionY + 40);
    
    // Categorie statistiche
    const statsItems = [
      { label: 'LLM Dialogs:', value: '0', color: this.colors.llmText },
      { label: 'Simulated Dialogs:', value: '0', color: this.colors.simulatedText },
      { label: 'Standard Dialogs:', value: '0', color: this.colors.standardText }
    ];
    
    // Crea elementi testo
    statsItems.forEach((item, index) => {
      // Etichetta
      const label = this.scene.add.text(
        0,
        index * 25,
        item.label,
        {
          fontSize: '14px',
          color: '#bbbbbb'
        }
      );
      this.statsContainer.add(label);
      
      // Valore
      const value = this.scene.add.text(
        180,
        index * 25,
        item.value,
        {
          fontSize: '14px',
          color: this.getColorString(item.color),
          fontStyle: 'bold'
        }
      );
      value.setOrigin(0, 0);
      this.statsText.push(value);
      this.statsContainer.add(value);
    });
    
    this.container.add(this.statsContainer);
  }
  
  /**
   * Crea la sezione del log dei messaggi
   */
  private createLogSection(): void {
    const sectionY = 400;
    
    // Titolo sezione
    const logTitle = this.scene.add.text(
      this.padding,
      sectionY,
      'Message Log',
      {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    this.container.add(logTitle);
    
    // Separatore
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, this.colors.accent, 0.8);
    separator.lineBetween(this.padding, sectionY + 30, this.width - this.padding, sectionY + 30);
    this.container.add(separator);
    
    // Area log
    const logAreaWidth = this.width - (this.padding * 2);
    
    // Sfondo area log
    this.logScrollArea = this.scene.add.graphics();
    this.logScrollArea.fillStyle(0x212121, 0.5);
    this.logScrollArea.fillRect(this.padding, sectionY + 40, logAreaWidth, this.logAreaHeight);
    this.container.add(this.logScrollArea);
    
    // Container per contenuto log
    this.logScrollContent = this.scene.add.container(this.padding, sectionY + 40);
    
    // Maschera per clipping
    this.logScrollMask = this.scene.add.graphics();
    this.logScrollMask.fillRect(this.padding, sectionY + 40, logAreaWidth, this.logAreaHeight);
    
    // Applica maschera
    const phaserScene = this.scene as any;
    const mask = new Phaser.Display.Masks.GeometryMask(phaserScene, this.logScrollMask);
    this.logScrollContent.setMask(mask);
    
    // Scrollbar
    this.scrollbar = this.scene.add.graphics();
    this.scrollbar.fillStyle(0x333333, 1);
    this.scrollbar.fillRect(this.width - this.padding - 10, sectionY + 40, 10, this.logAreaHeight);
    this.container.add(this.scrollbar);
    
    // Thumb scrollbar
    this.scrollThumb = this.scene.add.graphics();
    this.scrollThumb.fillStyle(0x666666, 1);
    this.scrollThumb.fillRect(this.width - this.padding - 10, sectionY + 40, 10, 50);
    this.scrollThumb.setInteractive(new Phaser.Geom.Rectangle(0, 0, 10, 50), Phaser.Geom.Rectangle.Contains);
    this.container.add(this.scrollThumb);
    
    // Eventi scrolling
    this.setupScrollEvents(sectionY);
    
    // Crea area interattiva per il log
    const logInteractive = this.scene.add.graphics();
    logInteractive.setInteractive(new Phaser.Geom.Rectangle(this.padding, sectionY + 40, logAreaWidth - 15, this.logAreaHeight), Phaser.Geom.Rectangle.Contains);
    
    let isDraggingContent = false;
    let lastY = 0;
    
    // Drag diretto del contenuto
    logInteractive.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      isDraggingContent = true;
      lastY = pointer.y;
    });
    
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (isDraggingContent) {
        const deltaY = pointer.y - lastY;
        lastY = pointer.y;
        this.scrollLogContent(-deltaY);
      }
    });
    
    this.scene.input.on('pointerup', () => {
      isDraggingContent = false;
    });
    
    // Messaggi placeholder quando non ci sono log
    const placeholderText = this.scene.add.text(
      logAreaWidth / 2,
      this.logAreaHeight / 2,
      'No messages yet',
      {
        fontSize: '14px',
        color: '#888888'
      }
    );
    placeholderText.setOrigin(0.5);
    this.logScrollContent.add(placeholderText);
    
    // Aggiungi oggetti al container principale
    this.container.add(logInteractive);
    this.container.add(this.logScrollContent);
  }
  
  /**
   * Configura gli eventi di scrolling
   */
  private setupScrollEvents(baseY: number): void {
    // Thumb interattivo
    this.scrollThumb.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isScrolling = true;
      this.scrollStartY = pointer.y;
    });
    
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isScrolling) {
        const deltaY = pointer.y - this.scrollStartY;
        this.scrollStartY = pointer.y;
        this.scrollLogContent(deltaY * 5);
      }
    });
    
    this.scene.input.on('pointerup', () => {
      this.isScrolling = false;
    });
    
    // Mousewheel
    this.scene.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
      const bounds = new Phaser.Geom.Rectangle(
        this.container.x + this.padding,
        this.container.y + baseY + 40,
        this.width - this.padding * 2,
        this.logAreaHeight
      );
      
      if (bounds.contains(pointer.x, pointer.y)) {
        this.scrollLogContent(deltaY * 2);
      }
    });
  }
  
  /**
   * Scorre il contenuto del log
   */
  private scrollLogContent(deltaY: number): void {
    if (!this.logScrollContent || this.logEntries.length === 0) return;
    
    // Altezza totale del contenuto
    const contentHeight = Math.max(this.logEntries.length * 60, 1);
    
    // Se il contenuto è più corto della viewport, non fare nulla
    if (contentHeight <= this.logAreaHeight) return;
    
    // Calcola nuova posizione Y
    let newY = this.logScrollContent.y - deltaY;
    
    // Valori base per calcolare limiti
    const baseY = 400 + 40; // Y iniziale
    const minY = baseY - (contentHeight - this.logAreaHeight);
    const maxY = baseY;
    
    // Limita lo scrolling
    newY = Phaser.Math.Clamp(newY, minY, maxY);
    
    // Aggiorna posizione
    this.logScrollContent.y = newY;
    
    // Aggiorna thumb scrollbar
    this.updateScrollThumbPosition(contentHeight);
  }
  
  /**
   * Aggiorna la posizione del thumb della scrollbar
   */
  private updateScrollThumbPosition(contentHeight: number): void {
    if (!this.scrollThumb || contentHeight <= this.logAreaHeight) {
      this.scrollThumb.setVisible(false);
      return;
    }
    
    this.scrollThumb.setVisible(true);
    
    // Calcola dimensione proporzionale del thumb
    const thumbHeight = Math.max(30, (this.logAreaHeight / contentHeight) * this.logAreaHeight);
    
    // Calcola posizione
    const scrollRange = this.logAreaHeight - thumbHeight;
    const scrollMax = contentHeight - this.logAreaHeight;
    const baseY = 400 + 40; // Y iniziale
    const normalizedPos = (baseY - this.logScrollContent.y) / scrollMax;
    const thumbY = normalizedPos * scrollRange;
    
    // Aggiorna grafica
    this.scrollThumb.clear();
    this.scrollThumb.fillStyle(0x666666, 1);
    this.scrollThumb.fillRect(
      this.width - this.padding - 10,
      baseY + thumbY,
      10,
      thumbHeight
    );
  }
  
  /**
   * Disegna lo sfondo del pannello
   */
  private drawBackground(): void {
    this.background.clear();
    this.background.fillStyle(this.colors.background, 0.95);
    this.background.fillRoundedRect(0, 0, this.width, this.height, 10);
    this.background.lineStyle(2, this.colors.accent, 1);
    this.background.strokeRoundedRect(0, 0, this.width, this.height, 10);
  }
  
  /**
   * Converte un colore numerico in stringa CSS
   */
  private getColorString(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
  
  /**
   * Aggiorna lo stato del toggle
   */
  public updateToggleState(enabled: boolean): void {
    if (!this.toggleSwitch || !this.toggleText) return;
    
    // Aggiorna grafica toggle
    this.drawToggleSwitch(enabled);
    
    // Aggiorna testo
    this.toggleText.setText(enabled ? 'ON' : 'OFF');
    this.toggleText.setColor(enabled ? '#4caf50' : '#bdbdbd');
  }
  
  /**
   * Aggiorna la frequenza dei messaggi
   */
  public updateFrequency(value: number): void {
    if (!this.frequencyThumb || !this.frequencyText) return;
    
    // Aggiorna posizione thumb
    this.frequencyThumb.clear();
    this.frequencyThumb.fillStyle(this.colors.slider, 1);
    this.frequencyThumb.fillCircle(value * 280, 35, 12);
    
    // Aggiorna testo percentuale
    this.frequencyText.setText(`${Math.round(value * 100)}%`);
  }
  
  /**
   * Aggiorna il tipo di messaggio selezionato
   */
  public updateSelectedMessageType(messageType: string): void {
    const options = ['dialog', 'thinking', 'decision'];
    const buttonWidth = 80;
    const buttonHeight = 30;
    const buttonSpacing = 10;
    
    options.forEach((option, index) => {
      const isSelected = option === messageType;
      const buttonX = index * (buttonWidth + buttonSpacing);
      
      // Aggiorna grafica pulsante
      if (this.messageTypeButtons[index]) {
        const button = this.messageTypeButtons[index];
        button.clear();
        button.fillStyle(isSelected ? this.colors.accent : 0x333333, 1);
        button.fillRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
        button.lineStyle(1, isSelected ? 0x5c6bc0 : 0x555555, 1);
        button.strokeRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
      }
      
      // Aggiorna testo pulsante
      if (this.messageTypeTexts[index]) {
        const text = this.messageTypeTexts[index];
        text.setColor(isSelected ? '#ffffff' : '#aaaaaa');
      }
    });
  }
  
  /**
   * Aggiorna lo stato del backend
   */
  public updateBackendStatus(connected: boolean): void {
    if (!this.backendStatusText) return;
    
    const statusText = connected ? 'Backend: Connected' : 'Backend: Disconnected';
    const statusColor = connected ? this.getColorString(this.colors.backendConnected) : this.getColorString(this.colors.backendDisconnected);
    
    this.backendStatusText.setText(statusText);
    this.backendStatusText.setColor(statusColor);
    
    // Aggiorna testo pulsante generazione
    if (this.generateButtonText) {
      this.generateButtonText.setText(connected ? 'Generate LLM Message' : 'Generate Simulated Message');
    }
  }
  
  /**
   * Aggiorna le statistiche
   */
  public updateStats(stats: { llm: number, simulated: number, standard: number }): void {
    if (this.statsText.length < 3) return;
    
    // Aggiorna contatori
    this.statsText[0].setText(stats.llm.toString());
    this.statsText[1].setText(stats.simulated.toString());
    this.statsText[2].setText(stats.standard.toString());
  }
  
  /**
   * Aggiorna le voci di log
   */
  public updateLogEntries(entries: SimpleLLMLogEntry[]): void {
    // Rimuovi elementi esistenti
    this.logEntries.forEach(entry => entry.destroy());
    this.logEntries = [];
    this.logScrollContent.removeAll();
    
    // Se non ci sono messaggi, mostra placeholder
    if (entries.length === 0) {
      const placeholderText = this.scene.add.text(
        (this.width - this.padding * 2) / 2,
        this.logAreaHeight / 2,
        'No messages yet',
        {
          fontSize: '14px',
          color: '#888888'
        }
      );
      placeholderText.setOrigin(0.5);
      this.logScrollContent.add(placeholderText);
      return;
    }
    
    // Crea nuove voci
    entries.forEach((entry, index) => {
      // Container per voce
      const entryContainer = this.scene.add.container(0, index * 60);
      
      // Sfondo
      const entryBg = this.scene.add.graphics();
      const bgColor = entry.category === 'simulated' ? this.colors.messageSimulated : this.colors.messageDialog;
      
      entryBg.fillStyle(bgColor, 0.7);
      entryBg.fillRoundedRect(0, 0, this.width - this.padding * 2 - 15, 55, 5);
      entryContainer.add(entryBg);
      
      // Orario
      const time = new Date(entry.timestamp);
      const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
      
      const timeText = this.scene.add.text(
        10,
        7,
        timeString,
        {
          fontSize: '10px',
          color: '#888888'
        }
      );
      entryContainer.add(timeText);
      
      // Nome agente
      const agentText = this.scene.add.text(
        85,
        7,
        entry.agentName ? `${entry.agentName} (${entry.agentId})` : `Agent ${entry.agentId}`,
        {
          fontSize: '10px',
          color: '#888888'
        }
      );
      entryContainer.add(agentText);
      
      // Tipo e categoria
      let typeColor = '#bbbbbb';
      switch (entry.category) {
        case 'llm': typeColor = this.getColorString(this.colors.llmText); break;
        case 'simulated': typeColor = this.getColorString(this.colors.simulatedText); break;
        case 'standard': typeColor = this.getColorString(this.colors.standardText); break;
      }
      
      const categoryIndicator = entry.category === 'simulated' ? ' (sim)' : '';
      const typeText = this.scene.add.text(
        this.width - this.padding * 2 - 25,
        7,
        `${entry.type}${categoryIndicator}`,
        {
          fontSize: '10px',
          color: typeColor
        }
      );
      typeText.setOrigin(1, 0);
      entryContainer.add(typeText);
      
      // Testo messaggio (troncato)
      let messageText = entry.text;
      if (messageText.length > 120) {
        messageText = messageText.substring(0, 117) + '...';
      }
      
      const textDisplay = this.scene.add.text(
        10,
        25,
        messageText,
        {
          fontSize: '12px',
          color: '#ffffff',
          wordWrap: { width: this.width - this.padding * 2 - 35 }
        }
      );
      entryContainer.add(textDisplay);
      
      // Interattività
      entryBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.width - this.padding * 2 - 15, 55), Phaser.Geom.Rectangle.Contains);
      
      // Hover effect
      entryBg.on('pointerover', () => {
        entryBg.clear();
        entryBg.fillStyle(entry.category === 'simulated' ? 0x444444 : 0x2a4b78, 0.7);
        entryBg.fillRoundedRect(0, 0, this.width - this.padding * 2 - 15, 55, 5);
      });
      
      entryBg.on('pointerout', () => {
        entryBg.clear();
        entryBg.fillStyle(entry.category === 'simulated' ? this.colors.messageSimulated : this.colors.messageDialog, 0.7);
        entryBg.fillRoundedRect(0, 0, this.width - this.padding * 2 - 15, 55, 5);
      });
      
      // Click per dettagli
      entryBg.on('pointerdown', () => {
        this.controller.showMessageDetails(entry.id);
      });
      
      // Aggiungi al log
      this.logEntries.push(entryContainer);
      this.logScrollContent.add(entryContainer);
    });
    
    // Aggiorna scrollbar
    this.updateScrollThumbPosition(entries.length * 60);
  }
  
  /**
   * Mostra i dettagli di un messaggio
   */
  public showMessageDetails(entry: SimpleLLMLogEntry): void {
    // Converti timestamp in formato leggibile
    const time = new Date(entry.timestamp);
    const dateString = `${time.toLocaleDateString()} ${time.toLocaleTimeString()}`;
    
    // Crea container per il popup
    const dialogContainer = this.scene.add.container(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2
    );
    dialogContainer.setDepth(2000);
    
    // Overlay modalità
    const modalOverlay = this.scene.add.graphics();
    modalOverlay.fillStyle(0x000000, 0.7);
    modalOverlay.fillRect(
      -this.scene.cameras.main.width,
      -this.scene.cameras.main.height,
      this.scene.cameras.main.width * 2,
      this.scene.cameras.main.height * 2
    );
    modalOverlay.setInteractive(new Phaser.Geom.Rectangle(
      -this.scene.cameras.main.width,
      -this.scene.cameras.main.height,
      this.scene.cameras.main.width * 2,
      this.scene.cameras.main.height * 2
    ), Phaser.Geom.Rectangle.Contains);
    modalOverlay.on('pointerdown', () => {
      dialogContainer.destroy();
    });
    dialogContainer.add(modalOverlay);
    
    // Dimensioni finestra
    const dialogWidth = 500;
    const dialogHeight = 400;
    
    // Sfondo finestra
    const dialogBg = this.scene.add.graphics();
    dialogBg.fillStyle(0x212121, 0.95);
    dialogBg.fillRoundedRect(-dialogWidth/2, -dialogHeight/2, dialogWidth, dialogHeight, 8);
    dialogBg.lineStyle(2, this.colors.accent, 1);
    dialogBg.strokeRoundedRect(-dialogWidth/2, -dialogHeight/2, dialogWidth, dialogHeight, 8);
    dialogContainer.add(dialogBg);
    
    // Blocca propagazione click
    dialogBg.setInteractive(new Phaser.Geom.Rectangle(-dialogWidth/2, -dialogHeight/2, dialogWidth, dialogHeight), Phaser.Geom.Rectangle.Contains);
    dialogBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
    });
    
    // Titolo con tipo messaggio
    let dialogTypeText = '';
    let typeColor = '';
    
    switch (entry.category) {
      case 'llm':
        dialogTypeText = 'LLM Dialogue';
        typeColor = this.getColorString(this.colors.llmText);
        break;
      case 'simulated':
        dialogTypeText = 'Simulated Dialogue';
        typeColor = this.getColorString(this.colors.simulatedText);
        break;
      case 'standard':
        dialogTypeText = 'Standard Dialogue';
        typeColor = this.getColorString(this.colors.standardText);
        break;
    }
    
    const titleText = this.scene.add.text(
      0,
      -dialogHeight/2 + 20,
      `${dialogTypeText} - ${entry.type}`,
      {
        fontSize: '20px',
        color: typeColor,
        fontStyle: 'bold'
      }
    );
    titleText.setOrigin(0.5, 0.5);
    dialogContainer.add(titleText);
    
    // ID messaggio
    const messageIdText = this.scene.add.text(
      -dialogWidth/2 + 20,
      -dialogHeight/2 + 50,
      `Message ID: ${entry.id}`,
      {
        fontSize: '14px',
        color: '#bbbbbb'
      }
    );
    dialogContainer.add(messageIdText);
    
    // Info agente e timestamp
    const infoText = this.scene.add.text(
      -dialogWidth/2 + 20,
      -dialogHeight/2 + 75,
      `Agent: ${entry.agentName || entry.agentId}\nTime: ${dateString}`,
      {
        fontSize: '14px',
        color: '#bbbbbb'
      }
    );
    dialogContainer.add(infoText);
    
    // Info modello
    const modelInfo = entry.modelInfo || {
      name: 'unknown',
      temperature: 0.7,
      maxTokens: 1024
    };
    
    const modelTypeLabel = entry.category === 'simulated' ? 'Simulated using:' : 'LLM Model:';
    const modelColor = entry.category === 'simulated' ? '#ff9800' : '#4caf50';
    
    const modelInfoText = this.scene.add.text(
      -dialogWidth/2 + 20,
      -dialogHeight/2 + 120,
      `${modelTypeLabel} ${modelInfo.name}\nTemperature: ${modelInfo.temperature}\nMax Tokens: ${modelInfo.maxTokens || 1024}`,
      {
        fontSize: '14px',
        color: modelColor
      }
    );
    dialogContainer.add(modelInfoText);
    
    // Separatore
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, this.colors.accent, 0.5);
    separator.lineBetween(-dialogWidth/2 + 20, -dialogHeight/2 + 170, dialogWidth/2 - 20, -dialogHeight/2 + 170);
    dialogContainer.add(separator);
    
    // Etichetta messaggio
    const messageLabel = this.scene.add.text(
      -dialogWidth/2 + 20,
      -dialogHeight/2 + 180,
      'Message:',
      {
        fontSize: '14px',
        color: '#bbbbbb',
        fontStyle: 'bold'
      }
    );
    dialogContainer.add(messageLabel);
    
    // Container per testo scrollabile
    const messageContainer = this.scene.add.container(-dialogWidth/2 + 20, -dialogHeight/2 + 205);
    dialogContainer.add(messageContainer);
    
    // Testo messaggio
    const messageText = this.scene.add.text(
      0,
      0,
      entry.text,
      {
        fontSize: '14px',
        color: '#ffffff',
        wordWrap: { width: dialogWidth - 40 }
      }
    );
    messageContainer.add(messageText);
    
    // Scrolling se necessario
    if (messageText.height > dialogHeight - 250) {
      // Crea maschera
      const maskGraphics = this.scene.add.graphics();
      maskGraphics.fillRect(
        -dialogWidth/2 + 20,
        -dialogHeight/2 + 205,
        dialogWidth - 50,
        dialogHeight - 250
      );
      
      const phaserScene = this.scene as any;
      const mask = new Phaser.Display.Masks.GeometryMask(phaserScene, maskGraphics);
      messageContainer.setMask(mask);
      
      // Scrollbar
      const scrollHeight = dialogHeight - 250;
      const thumbHeight = Math.max(30, (scrollHeight / messageText.height) * scrollHeight);
      
      const scrollBar = this.scene.add.graphics();
      scrollBar.fillStyle(0x333333, 1);
      scrollBar.fillRect(dialogWidth/2 - 20, -dialogHeight/2 + 205, 5, scrollHeight);
      dialogContainer.add(scrollBar);
      
      const scrollThumb = this.scene.add.graphics();
      scrollThumb.fillStyle(0x666666, 1);
      scrollThumb.fillRect(dialogWidth/2 - 20, -dialogHeight/2 + 205, 5, thumbHeight);
      dialogContainer.add(scrollThumb);
      
      // Interattività scrolling via mousewheel
      dialogBg.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
        // Limita lo scroll
        let newY = messageContainer.y - deltaY;
        const minY = -dialogHeight/2 + 205 - (messageText.height - (dialogHeight - 250));
        const maxY = -dialogHeight/2 + 205;
        
        newY = Phaser.Math.Clamp(newY, minY, maxY);
        messageContainer.y = newY;
        
        // Aggiorna thumb
        const scrollRange = scrollHeight - thumbHeight;
        const scrollMax = messageText.height - (dialogHeight - 250);
        const scrollPosition = -dialogHeight/2 + 205 - messageContainer.y;
        const thumbY = (scrollPosition / scrollMax) * scrollRange;
        
        scrollThumb.clear();
        scrollThumb.fillStyle(0x666666, 1);
        scrollThumb.fillRect(dialogWidth/2 - 20, -dialogHeight/2 + 205 + thumbY, 5, thumbHeight);
      });
      
      // Interattività scrolling con drag
      const textArea = this.scene.add.graphics();
      textArea.fillStyle(0xffffff, 0.01); // Quasi invisibile
      textArea.fillRect(-dialogWidth/2 + 20, -dialogHeight/2 + 205, dialogWidth - 50, scrollHeight);
      textArea.setInteractive(new Phaser.Geom.Rectangle(0, 0, dialogWidth - 50, scrollHeight), Phaser.Geom.Rectangle.Contains);
      dialogContainer.add(textArea);
      
      let isDraggingText = false;
      let lastDragY = 0;
      
      textArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        isDraggingText = true;
        lastDragY = pointer.y;
      });
      
      this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (isDraggingText) {
          const deltaY = pointer.y - lastDragY;
          lastDragY = pointer.y;
          
          // Limita lo scroll
          let newY = messageContainer.y + deltaY;
          const minY = -dialogHeight/2 + 205 - (messageText.height - (dialogHeight - 250));
          const maxY = -dialogHeight/2 + 205;
          
          newY = Phaser.Math.Clamp(newY, minY, maxY);
          messageContainer.y = newY;
          
          // Aggiorna thumb
          const scrollRange = scrollHeight - thumbHeight;
          const scrollMax = messageText.height - (dialogHeight - 250);
          const scrollPosition = -dialogHeight/2 + 205 - messageContainer.y;
          const thumbY = (scrollPosition / scrollMax) * scrollRange;
          
          scrollThumb.clear();
          scrollThumb.fillStyle(0x666666, 1);
          scrollThumb.fillRect(dialogWidth/2 - 20, -dialogHeight/2 + 205 + thumbY, 5, thumbHeight);
        }
      });
      
      this.scene.input.once('pointerup', () => {
        isDraggingText = false;
      });
    }
    
    // Pulsante di chiusura
    const closeButton = this.scene.add.text(
      dialogWidth/2 - 20,
      -dialogHeight/2 + 20,
      'X',
      {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#aa0000',
        padding: { left: 6, right: 6, top: 3, bottom: 3 }
      }
    );
    closeButton.setOrigin(0.5);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on('pointerdown', () => {
      dialogContainer.destroy();
    });
    dialogContainer.add(closeButton);
    
    // Pulsante di chiusura inferiore
    const okButton = this.scene.add.text(
      0,
      dialogHeight/2 - 30,
      'Close',
      {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#2196f3',
        padding: { left: 20, right: 20, top: 8, bottom: 8 }
      }
    );
    okButton.setOrigin(0.5);
    okButton.setInteractive({ useHandCursor: true });
    okButton.on('pointerdown', () => {
      dialogContainer.destroy();
    });
    dialogContainer.add(okButton);
    
    // Animazione apertura
    dialogContainer.setScale(0.8);
    dialogContainer.setAlpha(0);
    this.scene.tweens.add({
      targets: dialogContainer,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }
  
  /**
   * Mostra il pannello
   */
  public show(): void {
    this.container.setVisible(true);
    
    // Effetto fade-in
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    });
  }
  
  /**
   * Nasconde il pannello
   */
  public hide(): void {
    // Effetto fade-out
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
      }
    });
  }
  
  /**
   * Distrugge la vista e pulisce le risorse
   */
  public destroy(): void {
    // Rimuovi eventi
    this.scene.input.off('pointermove');
    this.scene.input.off('pointerup');
    this.scene.input.off('wheel');
    
    // Distruggi container
    if (this.container && this.container.scene) {
      this.container.destroy();
    }
  }
}