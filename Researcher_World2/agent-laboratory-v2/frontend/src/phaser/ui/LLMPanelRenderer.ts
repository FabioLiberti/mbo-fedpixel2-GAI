// frontend/src/phaser/ui/LLMPanelRenderer.ts

import * as Phaser from 'phaser';
import { LLMLogEntry } from './LLMPanelState';

/**
 * Classe responsabile del rendering del pannello di controllo LLM
 */
export class LLMPanelRenderer {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private closeButton!: Phaser.GameObjects.Text;
  
  // Elementi UI
  private llmToggle!: Phaser.GameObjects.Container;
  private llmToggleSwitch!: Phaser.GameObjects.Graphics; // Riferimento al toggle switch
  private llmToggleText!: Phaser.GameObjects.Text; // Riferimento al testo ON/OFF
  private frequencySlider!: Phaser.GameObjects.Container;
  private messageTypeSelector!: Phaser.GameObjects.Container;
  private messageTypeButtons: Phaser.GameObjects.Graphics[] = []; // Array dei pulsanti tipo messaggio
  private messageTypeTexts: Phaser.GameObjects.Text[] = []; // Array dei testi tipo messaggio
  private generateButton!: Phaser.GameObjects.Container;
  private statsDisplay!: Phaser.GameObjects.Container;
  private logContainer!: Phaser.GameObjects.Container;
  private backendStatusIndicator!: Phaser.GameObjects.Text;
  
  // UI di scroll per i log
  private logScrollArea!: Phaser.GameObjects.Graphics;
  private logContent!: Phaser.GameObjects.Container;
  private logMask!: Phaser.GameObjects.Graphics;
  private scrollBar!: Phaser.GameObjects.Graphics;
  private scrollThumb!: Phaser.GameObjects.Graphics;
  private isScrolling: boolean = false;
  private scrollStartY: number = 0;
  
  // Dimensioni
  private width: number = 300;
  private height: number = 420;
  private padding: number = 15;
  
  // Area log migliorata
  private logAreaHeight: number = 230; // Aumentato lo spazio per i log
  
  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    onClose?: () => void
  ) {
    this.scene = scene;
    this.container = container;
    
    // Inizializza grafica di base
    this.initializeGraphics();
    
    // Gestisci l'evento di chiusura
    if (onClose) {
      this.closeButton.on('pointerdown', onClose);
    } else {
      this.closeButton.on('pointerdown', () => this.hide());
    }
  }
  
  /**
   * Inizializza gli elementi grafici del pannello
   */
  public initializeGraphics(): void {
    // Crea lo sfondo
    this.background = this.scene.add.graphics();
    this.container.add(this.background);
    
    // Disegna lo sfondo
    this.drawBackground();
    
    // Titolo
    this.titleText = this.scene.add.text(
      this.width / 2,
      this.padding,
      'LLM Control Panel',
      {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    this.titleText.setOrigin(0.5, 0);
    this.container.add(this.titleText);
    
    // Indicatore stato backend
    this.backendStatusIndicator = this.scene.add.text(
      this.width - this.padding,
      this.padding + 25,
      'Backend: Checking...',
      {
        fontSize: '12px',
        color: '#bbbbbb',
        align: 'right'
      }
    );
    this.backendStatusIndicator.setOrigin(1, 0);
    this.container.add(this.backendStatusIndicator);
    
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
    this.container.add(this.closeButton);
  }
  
  /**
   * Disegna lo sfondo del pannello
   */
  private drawBackground(): void {
    this.background.clear();
    this.background.fillStyle(0x1a1a2e, 0.95);
    this.background.fillRoundedRect(0, 0, this.width, this.height, 10);
    this.background.lineStyle(2, 0x3f51b5, 1);
    this.background.strokeRoundedRect(0, 0, this.width, this.height, 10);
  }
  
  /**
   * Crea la sezione dei controlli
   */
  public createControlsSection(
    isLLMEnabled: boolean,
    messageFrequency: number,
    selectedMessageType: string,
    onToggleChange: (value: boolean) => void,
    onFrequencyChange: (value: number) => void,
    onTypeChange: (value: string) => void,
    onGenerateClick: () => void
  ): void {
    const sectionTitle = this.scene.add.text(
      this.padding,
      this.padding + 40,
      'Controls',
      {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    this.container.add(sectionTitle);
    
    // Separatore
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, 0x3f51b5, 0.8);
    separator.lineBetween(this.padding, sectionTitle.y + 30, this.width - this.padding, sectionTitle.y + 30);
    this.container.add(separator);
    
    // Toggle LLM
    this.createLLMToggle(this.padding, sectionTitle.y + 50, isLLMEnabled, onToggleChange);
    
    // Slider frequenza messaggi
    this.createFrequencySlider(this.padding, sectionTitle.y + 90, messageFrequency, onFrequencyChange);
    
    // Selettore tipo messaggio
    this.createMessageTypeSelector(this.padding, sectionTitle.y + 140, selectedMessageType, onTypeChange);
    
    // Pulsante genera messaggio
    this.createGenerateButton(this.padding, sectionTitle.y + 190, onGenerateClick);
  }
  
  /**
   * Crea il toggle per attivare/disattivare LLM
   */
  private createLLMToggle(
    x: number, 
    y: number, 
    isEnabled: boolean,
    onChange: (value: boolean) => void
  ): void {
    // Container per il toggle
    this.llmToggle = this.scene.add.container(x, y);
    
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
    this.llmToggle.add(label);
    
    // Sfondo toggle
    this.llmToggleSwitch = this.scene.add.graphics();
    this.updateToggleVisual(isEnabled);
    this.llmToggle.add(this.llmToggleSwitch);
    
    // Testo stato
    this.llmToggleText = this.scene.add.text(
      220,
      0,
      isEnabled ? 'ON' : 'OFF',
      {
        fontSize: '14px',
        color: isEnabled ? '#4caf50' : '#bdbdbd'
      }
    );
    this.llmToggleText.setOrigin(0, 0.5);
    this.llmToggle.add(this.llmToggleText);
    
    // Interattività
    this.llmToggleSwitch.setInteractive(new Phaser.Geom.Rectangle(140, -10, 60, 20), Phaser.Geom.Rectangle.Contains);
    this.llmToggleSwitch.on('pointerdown', () => {
      const newValue = !isEnabled;
      
      // Aggiorna visivamente il toggle
      this.updateToggleVisual(newValue);
      
      // Aggiorna il testo dello stato
      this.llmToggleText.setText(newValue ? 'ON' : 'OFF');
      this.llmToggleText.setColor(newValue ? '#4caf50' : '#bdbdbd');
      
      // Notifica il cambiamento
      onChange(newValue);
    });
    
    // Effetti hover
    this.llmToggleSwitch.on('pointerover', () => {
      this.llmToggleSwitch.clear();
      this.llmToggleSwitch.fillStyle(0x444444, 1);
      this.llmToggleSwitch.fillRoundedRect(140, -10, 60, 20, 10);
      this.llmToggleSwitch.fillStyle(isEnabled ? 0x5dbf5e : 0xcdcdcd, 1);
      this.llmToggleSwitch.fillRoundedRect(140 + (isEnabled ? 30 : 0), -10, 30, 20, 10);
    });
    
    this.llmToggleSwitch.on('pointerout', () => {
      this.updateToggleVisual(isEnabled);
    });
    
    // Aggiungi al container principale
    this.container.add(this.llmToggle);
  }

  /**
   * Aggiorna lo stato visivo del toggle
   */
  public updateToggleVisual(isEnabled: boolean): void {
    if (!this.llmToggleSwitch) return;
    
    this.llmToggleSwitch.clear();
    this.llmToggleSwitch.fillStyle(0x333333, 1);
    this.llmToggleSwitch.fillRoundedRect(140, -10, 60, 20, 10);
    this.llmToggleSwitch.fillStyle(isEnabled ? 0x4caf50 : 0xbdbdbd, 1);
    this.llmToggleSwitch.fillRoundedRect(140 + (isEnabled ? 30 : 0), -10, 30, 20, 10);
  }
  
  /**
   * Crea lo slider per la frequenza dei messaggi
   */
  private createFrequencySlider(
    x: number, 
    y: number, 
    frequency: number,
    onChange: (value: number) => void
  ): void {
    // Container per lo slider
    this.frequencySlider = this.scene.add.container(x, y);
    
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
    this.frequencySlider.add(label);
    
    // Valore percentuale
    const valueText = this.scene.add.text(
      280,
      0,
      `${Math.round(frequency * 100)}%`,
      {
        fontSize: '14px',
        color: '#ffffff',
        align: 'right'
      }
    );
    valueText.setOrigin(1, 0.5);
    this.frequencySlider.add(valueText);
    
    // Traccia dello slider
    const sliderTrack = this.scene.add.graphics();
    sliderTrack.fillStyle(0x333333, 1);
    sliderTrack.fillRoundedRect(0, 30, 280, 10, 5);
    this.frequencySlider.add(sliderTrack);
    
    // Maniglia dello slider
    const sliderThumb = this.scene.add.graphics();
    sliderThumb.fillStyle(0x2196f3, 1);
    sliderThumb.fillCircle(frequency * 280, 35, 12);
    this.frequencySlider.add(sliderThumb);
    
    // Interattività slider
    sliderTrack.setInteractive(new Phaser.Geom.Rectangle(0, 25, 280, 20), Phaser.Geom.Rectangle.Contains);
    
    // Funzione per aggiornare lo slider
    const updateSlider = (x: number) => {
      const clampedX = Phaser.Math.Clamp(x, 0, 280);
      const newFrequency = clampedX / 280;
      
      // Aggiorna posizione maniglia
      sliderThumb.clear();
      sliderThumb.fillStyle(0x2196f3, 1);
      sliderThumb.fillCircle(newFrequency * 280, 35, 12);
      
      // Aggiorna testo valore
      valueText.setText(`${Math.round(newFrequency * 100)}%`);
      
      // Notifica il cambiamento
      onChange(newFrequency);
    };
    
    // Gestione eventi click/drag
    sliderTrack.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
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
    
    // Aggiungi al container principale
    this.container.add(this.frequencySlider);
  }
  
  /**
   * Crea un selettore per il tipo di messaggio
   */
  private createMessageTypeSelector(
    x: number, 
    y: number, 
    selectedType: string,
    onChange: (value: string) => void
  ): void {
    // Container per il selettore
    this.messageTypeSelector = this.scene.add.container(x, y);
    
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
    this.messageTypeSelector.add(label);
    
    // Opzioni
    const options = [
      { id: 'dialog', label: 'Dialog' },
      { id: 'thinking', label: 'Thinking' },
      { id: 'decision', label: 'Decision' }
    ];
    
    // Pulisci gli array
    this.messageTypeButtons = [];
    this.messageTypeTexts = [];
    
    // Crea pulsanti per ogni opzione
    const buttonWidth = 80;
    const buttonHeight = 30;
    const buttonSpacing = 10;
    
    options.forEach((option, index) => {
      // Posizione del pulsante
      const buttonX = index * (buttonWidth + buttonSpacing);
      
      // Sfondo pulsante
      const buttonBg = this.scene.add.graphics();
      const isSelected = selectedType === option.id;
      
      buttonBg.fillStyle(isSelected ? 0x3f51b5 : 0x333333, 1);
      buttonBg.fillRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
      buttonBg.lineStyle(1, isSelected ? 0x5c6bc0 : 0x555555, 1);
      buttonBg.strokeRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
      
      // Memorizza riferimento al pulsante
      this.messageTypeButtons.push(buttonBg);
      
      this.messageTypeSelector.add(buttonBg);
      
      // Testo pulsante
      const buttonText = this.scene.add.text(
        buttonX + buttonWidth / 2,
        30 + buttonHeight / 2,
        option.label,
        {
          fontSize: '12px',
          color: isSelected ? '#ffffff' : '#aaaaaa'
        }
      );
      buttonText.setOrigin(0.5);
      
      // Memorizza riferimento al testo
      this.messageTypeTexts.push(buttonText);
      
      this.messageTypeSelector.add(buttonText);
      
      // Interattività
      buttonBg.setInteractive(new Phaser.Geom.Rectangle(buttonX, 30, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
      buttonBg.on('pointerdown', () => {
        // Notifica il cambiamento
        onChange(option.id);
      });
      
      // Effetti hover
      buttonBg.on('pointerover', () => {
        if (selectedType !== option.id) {
          buttonBg.clear();
          buttonBg.fillStyle(0x444444, 1);
          buttonBg.fillRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
          buttonBg.lineStyle(1, 0x666666, 1);
          buttonBg.strokeRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
        }
      });
      
      buttonBg.on('pointerout', () => {
        if (selectedType !== option.id) {
          buttonBg.clear();
          buttonBg.fillStyle(0x333333, 1);
          buttonBg.fillRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
          buttonBg.lineStyle(1, 0x555555, 1);
          buttonBg.strokeRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
        }
      });
    });
    
    // Aggiungi al container principale
    this.container.add(this.messageTypeSelector);
  }
  
  /**
   * Aggiorna lo stato visivo dei pulsanti del tipo di messaggio
   */
  public updateMessageTypeButtons(selectedType: string): void {
    try {
      // Le opzioni sono fisse
      const options = [
        { id: 'dialog', label: 'Dialog' },
        { id: 'thinking', label: 'Thinking' },
        { id: 'decision', label: 'Decision' }
      ];
      
      const buttonWidth = 80;
      const buttonHeight = 30;
      const buttonSpacing = 10;
      
      // Aggiorna lo stato di ogni pulsante
      options.forEach((option, index) => {
        const isSelected = selectedType === option.id;
        const buttonX = index * (buttonWidth + buttonSpacing);
        
        // Aggiorna grafica del pulsante
        if (this.messageTypeButtons[index]) {
          const buttonBg = this.messageTypeButtons[index];
          buttonBg.clear();
          buttonBg.fillStyle(isSelected ? 0x3f51b5 : 0x333333, 1);
          buttonBg.fillRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
          buttonBg.lineStyle(1, isSelected ? 0x5c6bc0 : 0x555555, 1);
          buttonBg.strokeRoundedRect(buttonX, 30, buttonWidth, buttonHeight, 5);
        }
        
        // Aggiorna testo del pulsante
        if (this.messageTypeTexts[index]) {
          const buttonText = this.messageTypeTexts[index];
          buttonText.setColor(isSelected ? '#ffffff' : '#aaaaaa');
        }
      });
    } catch (error) {
      console.error('Error updating message type buttons:', error);
    }
  }
  
  /**
   * Crea il pulsante per generare un messaggio LLM
   */
  private createGenerateButton(
    x: number, 
    y: number, 
    onClick: () => void
  ): void {
    // Container per il pulsante
    this.generateButton = this.scene.add.container(x, y);
    
    // Sfondo pulsante
    const buttonBg = this.scene.add.graphics();
    buttonBg.fillStyle(0x2196f3, 1);
    buttonBg.fillRoundedRect(0, 0, 330, 40, 8);
    buttonBg.lineStyle(2, 0x64b5f6, 1);
    buttonBg.strokeRoundedRect(0, 0, 330, 40, 8);
    this.generateButton.add(buttonBg);
    
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
    const buttonText = this.scene.add.text(
      165,
      20,
      'Generate LLM Message',
      {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    buttonText.setOrigin(0.5);
    this.generateButton.add(buttonText);
    
    // Interattività
    buttonBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, 330, 40), Phaser.Geom.Rectangle.Contains);
    buttonBg.on('pointerdown', onClick);
    
    // Effetti hover
    buttonBg.on('pointerover', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x42a5f5, 1);
      buttonBg.fillRoundedRect(0, 0, 330, 40, 8);
      buttonBg.lineStyle(2, 0x90caf9, 1);
      buttonBg.strokeRoundedRect(0, 0, 330, 40, 8);
    });
    
    buttonBg.on('pointerout', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x2196f3, 1);
      buttonBg.fillRoundedRect(0, 0, 330, 40, 8);
      buttonBg.lineStyle(2, 0x64b5f6, 1);
      buttonBg.strokeRoundedRect(0, 0, 330, 40, 8);
    });
    
    // Aggiungi al container principale
    this.container.add(this.generateButton);
  }
  
  /**
   * Aggiorna il testo del pulsante di generazione
   */
  public updateGenerateButtonText(isBackendConnected: boolean): void {
    const children = this.generateButton.list;
    // Il testo del pulsante è il terzo elemento (dopo sfondo e icona)
    const buttonText = children[2] as Phaser.GameObjects.Text;
    if (buttonText && buttonText.setText) {
      buttonText.setText(isBackendConnected ? 'Generate LLM Message' : 'Generate Simulated Message');
    }
  }
  
  /**
   * Crea la sezione delle statistiche
   */
  public createStatsSection(stats: { 
    llm: number, 
    standard: number, 
    simulated: number,
    frequency: string,
    llmStatus: string
  }): void {
    // Y base per questa sezione (dopo i controlli)
    const sectionY = 280;
    
    // Titolo sezione
    const sectionTitle = this.scene.add.text(
      this.padding,
      sectionY,
      'Statistics',
      {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    this.container.add(sectionTitle);
    
    // Separatore
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, 0x3f51b5, 0.8);
    separator.lineBetween(this.padding, sectionY + 30, this.width - this.padding, sectionY + 30);
    this.container.add(separator);
    
    // Container per le statistiche
    this.statsDisplay = this.scene.add.container(this.padding, sectionY + 40);
    
    // Struttura dati per le statistiche
    const statsItems = [
      { label: 'LLM Dialogs:', value: `${stats.llm}` },
      { label: 'Simulated Dialogs:', value: `${stats.simulated}` },
      { label: 'Standard Dialogs:', value: `${stats.standard}` },
      { label: 'Message Frequency:', value: stats.frequency },
      { label: 'LLM Status:', value: stats.llmStatus }
    ];
    
    // Crea testi per ogni statistica
    statsItems.forEach((stat, index) => {
      // Etichetta
      const label = this.scene.add.text(
        0,
        index * 25,
        stat.label,
        {
          fontSize: '14px',
          color: '#bbbbbb'
        }
      );
      this.statsDisplay.add(label);
      
      // Valore
      const value = this.scene.add.text(
        180,
        index * 25,
        stat.value,
        {
          fontSize: '14px',
          color: '#ffffff',
          fontStyle: 'bold'
        }
      );
      value.setOrigin(0, 0);
      this.statsDisplay.add(value);
    });
    
    // Aggiungi al container principale
    this.container.add(this.statsDisplay);
  }
  
  /**
   * Aggiorna le statistiche visualizzate
   */
  public updateStats(stats: { 
    llm: number, 
    standard: number, 
    simulated: number,
    frequency: string,
    llmStatus: string
  }): void {
    try {
      // Pulisci il container delle statistiche
      this.statsDisplay.removeAll(true);
      
      // Struttura dati per le statistiche
      const statsItems = [
        { label: 'LLM Dialogs:', value: `${stats.llm}` },
        { label: 'Simulated Dialogs:', value: `${stats.simulated}` },
        { label: 'Standard Dialogs:', value: `${stats.standard}` },
        { label: 'Message Frequency:', value: stats.frequency },
        { label: 'LLM Status:', value: stats.llmStatus }
      ];
      
      // Crea testi per ogni statistica
      statsItems.forEach((stat, index) => {
        // Etichetta
        const label = this.scene.add.text(
          0,
          index * 25,
          stat.label,
          {
            fontSize: '14px',
            color: '#bbbbbb'
          }
        );
        this.statsDisplay.add(label);
        
        // Valore
        const value = this.scene.add.text(
          180,
          index * 25,
          stat.value,
          {
            fontSize: '14px',
            color: '#ffffff',
            fontStyle: 'bold'
          }
        );
        value.setOrigin(0, 0);
        this.statsDisplay.add(value);
      });
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }
  
  /**
   * Crea la sezione log messaggi LLM
   */
  public createLogSection(messageLog: LLMLogEntry[], getColorForType: (type: string, isSimulated: boolean) => string): void {
    try {
      // Y base per questa sezione (dopo le statistiche)
      const sectionY = 400; // Spostato più in basso per dare più spazio
      
      // Titolo sezione
      const sectionTitle = this.scene.add.text(
        this.padding,
        sectionY,
        'LLM Messages Log',
        {
          fontSize: '18px',
          color: '#ffffff',
          fontStyle: 'bold'
        }
      );
      this.container.add(sectionTitle);
      
      // Separatore
      const separator = this.scene.add.graphics();
      separator.lineStyle(1, 0x3f51b5, 0.8);
      separator.lineBetween(this.padding, sectionY + 30, this.width - this.padding, sectionY + 30);
      this.container.add(separator);
      
      // Area di scroll per i log
      const logAreaWidth = this.width - (this.padding * 2);
      
      // Sfondo area log
      this.logScrollArea = this.scene.add.graphics();
      this.logScrollArea.fillStyle(0x212121, 0.5);
      this.logScrollArea.fillRect(this.padding, sectionY + 40, logAreaWidth, this.logAreaHeight);
      this.container.add(this.logScrollArea);
      
      // Container per il contenuto dei log
      this.logContent = this.scene.add.container(this.padding, sectionY + 40);
      
      // Maschera per il clipping
      this.logMask = this.scene.add.graphics();
      this.logMask.fillRect(this.padding, sectionY + 40, logAreaWidth, this.logAreaHeight);
      
      // Applica la maschera al container dei log
      const mask = new Phaser.Display.Masks.GeometryMask(this.scene as any, this.logMask);
      this.logContent.setMask(mask);

      // Scrollbar
      this.scrollBar = this.scene.add.graphics();
      this.scrollBar.fillStyle(0x333333, 1);
      this.scrollBar.fillRect(this.width - this.padding - 10, sectionY + 40, 10, this.logAreaHeight);
      this.container.add(this.scrollBar);
      
      this.scrollThumb = this.scene.add.graphics();
      this.scrollThumb.fillStyle(0x666666, 1);
      this.scrollThumb.fillRect(this.width - this.padding - 10, sectionY + 40, 10, 50);
      this.scrollThumb.setInteractive(new Phaser.Geom.Rectangle(0, 0, 10, 50), Phaser.Geom.Rectangle.Contains);
      this.container.add(this.scrollThumb);
      
      // Eventi di scrolling
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
      
      // Evento mousewheel per scrolling
      this.scene.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
        // Controlla se il puntatore è sopra l'area log
        const bounds = new Phaser.Geom.Rectangle(
          this.container.x + this.padding,
          this.container.y + sectionY + 40,
          logAreaWidth,
          this.logAreaHeight
        );
        
        if (bounds.contains(pointer.x, pointer.y)) {
          this.scrollLogContent(deltaY * 2);
        }
      });
      
      // Aggiungi area di scroll interattiva per scroll diretta
      const scrollInteractiveArea = this.scene.add.graphics();
      scrollInteractiveArea.setInteractive(new Phaser.Geom.Rectangle(this.padding, sectionY + 40, logAreaWidth - 10, this.logAreaHeight), Phaser.Geom.Rectangle.Contains);
      
      // Gestione eventi di scroll diretti
      let isDraggingContent = false;
      let lastY = 0;
      
      scrollInteractiveArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
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
      
      // Aggiungi al container principale
      this.container.add(scrollInteractiveArea);
      this.container.add(this.logContent);
      
      // Aggiorna la visualizzazione del log
      this.updateLogDisplay(messageLog, getColorForType);
    } catch (error) {
      console.error('Error creating log section:', error);
    }
  }
  
  /**
   * Scorre il contenuto dei log
   */
  private scrollLogContent(deltaY: number): void {
    if (!this.logContent) return;
    
    // Altezza totale del contenuto (approssima 60px per entry)
    const contentHeight = Math.max(this.logContent.list.length / 2 * 60, 1);
    
    // Se il contenuto è più corto del viewport, non fare nulla
    if (contentHeight <= this.logAreaHeight) return;
    
    // Calcola nuova posizione Y
    let newY = this.logContent.y - deltaY;
    
    // Usa valori assoluti per la posizione invece di relativi
    const baseY = 400 + 40; // la Y iniziale del container
    const limitMinY = baseY - (contentHeight - this.logAreaHeight);
    const limitMaxY = baseY;
    
    newY = Phaser.Math.Clamp(newY, limitMinY, limitMaxY);
    
    // Aggiorna posizione del contenuto
    this.logContent.y = newY;
    
    // Aggiorna posizione scrollbar
    this.updateScrollThumbPosition(contentHeight, this.logAreaHeight);
  }
  
  /**
   * Aggiorna posizione dello scroll thumb
   */
  private updateScrollThumbPosition(contentHeight: number, viewportHeight: number): void {
    if (!this.scrollThumb) return;
    
    // Se il contenuto è più corto del viewport, nascondi la scrollbar
    if (contentHeight <= viewportHeight) {
      this.scrollThumb.setVisible(false);
      return;
    } else {
      this.scrollThumb.setVisible(true);
    }
    
    // Altezza proporzionale dello thumb
    const thumbHeight = Math.max(30, (viewportHeight / contentHeight) * viewportHeight);
    
    // Calcola posizione dello thumb
    const scrollRange = viewportHeight - thumbHeight;
    const scrollMax = contentHeight - viewportHeight;
    const baseY = 400 + 40; // La Y iniziale del container
    const normalizedPosition = (baseY - this.logContent.y) / scrollMax;
    const thumbY = normalizedPosition * scrollRange;
    
    // Aggiorna grafica dello thumb
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
   * Aggiorna la visualizzazione del log
   */
  public updateLogDisplay(messageLog: LLMLogEntry[], getColorForType: (type: string, isSimulated: boolean) => string): void {
    try {
      if (!this.logContent) return;
      
      // Pulisci il container
      this.logContent.removeAll(true);
      
      // Se non ci sono messaggi, mostra testo placeholder
      if (messageLog.length === 0) {
        const placeholderText = this.scene.add.text(
          (this.width - this.padding * 2) / 2,
          this.logAreaHeight / 2,
          'No LLM messages yet',
          {
            fontSize: '14px',
            color: '#888888',
            align: 'center'
          }
        );
        placeholderText.setOrigin(0.5);
        this.logContent.add(placeholderText);
        return;
      }
      
      // Altrimenti, crea un elemento per ogni messaggio nel log
      messageLog.forEach((entry, index) => {
        // Container per l'entry
        const entryContainer = this.scene.add.container(0, index * 60);
        
        // Sfondo
        const entryBg = this.scene.add.graphics();
        entryBg.fillStyle(entry.isSimulated ? 0x303030 : 0x1e3a5f, 0.7); // Colore diverso per msg simulati
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
        
        // ID Agente (con nome se disponibile)
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
        
        // Tipo e indicatore simulato
        const typeText = this.scene.add.text(
          this.width - this.padding * 2 - 25,
          7,
          entry.isSimulated ? `${entry.type} (sim)` : entry.type,
          {
            fontSize: '10px',
            color: getColorForType(entry.type, entry.isSimulated || false)
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
        
        // Effetto hover
        entryBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.width - this.padding * 2 - 15, 55), Phaser.Geom.Rectangle.Contains);
        
        entryBg.on('pointerover', () => {
          entryBg.clear();
          entryBg.fillStyle(entry.isSimulated ? 0x444444 : 0x2a4b78, 0.7);
          entryBg.fillRoundedRect(0, 0, this.width - this.padding * 2 - 15, 55, 5);
        });
        
        entryBg.on('pointerout', () => {
          entryBg.clear();
          entryBg.fillStyle(entry.isSimulated ? 0x303030 : 0x1e3a5f, 0.7);
          entryBg.fillRoundedRect(0, 0, this.width - this.padding * 2 - 15, 55, 5);
        });
        
        entryBg.on('pointerdown', () => {
          // Chiama l'evento showFullMessageDialog per il messaggio corrente
          this.scene.events.emit('show-full-message', entry);
        });
        
        // Aggiungi al container dei log
        this.logContent.add(entryContainer);
      });
      
      // Aggiorna posizione thumb dello scrollbar
      this.updateScrollThumbPosition(messageLog.length * 60, this.logAreaHeight);
    } catch (error) {
      console.error('Error updating log display:', error);
    }
  }
  
  /**
   * Visualizza una finestra di dialogo con il messaggio completo
   */
  public showFullMessageDialog(entry: LLMLogEntry): void {
    try {
      // Converti il timestamp in formato leggibile
      const time = new Date(entry.timestamp);
      const dateString = `${time.toLocaleDateString()} ${time.toLocaleTimeString()}`;
      
      // Crea un container temporaneo per il popup
      const dialogContainer = this.scene.add.container(this.scene.cameras.main.width / 2, this.scene.cameras.main.height / 2);
      dialogContainer.setDepth(2000); // Al di sopra di tutto
      
      // Sfondo semi-trasparente per tutta la scena
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
      
      // Finestra di dialogo
      const dialogWidth = 360;
      const dialogHeight = 300;
      
      const dialogBg = this.scene.add.graphics();
      dialogBg.fillStyle(0x212121, 0.95);
      dialogBg.fillRoundedRect(-dialogWidth/2, -dialogHeight/2, dialogWidth, dialogHeight, 8);
      dialogBg.lineStyle(2, 0x3f51b5, 1);
      dialogBg.strokeRoundedRect(-dialogWidth/2, -dialogHeight/2, dialogWidth, dialogHeight, 8);
      dialogContainer.add(dialogBg);
      
      // Previeni la propagazione del click
      dialogBg.setInteractive(new Phaser.Geom.Rectangle(-dialogWidth/2, -dialogHeight/2, dialogWidth, dialogHeight), Phaser.Geom.Rectangle.Contains);
      dialogBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
      });
      
      // Determinazione del tipo di dialogo
      let dialogTypeText = "";
      if (entry.isSimulated) {
        dialogTypeText = "Simulated Dialogue";
      } else if (entry.type === "dialog") {
        dialogTypeText = "LLM Dialogue";
      } else {
        dialogTypeText = "Standard Dialogue";
      }
      
      // Titolo (con indicatore tipo dialogo)
      const titleText = this.scene.add.text(
        0,
        -dialogHeight/2 + 20,
        `${dialogTypeText} - ${entry.type}`,
        {
          fontSize: '20px',
          color: '#ffffff',
          fontStyle: 'bold'
        }
      );
      titleText.setOrigin(0.5, 0.5);
      dialogContainer.add(titleText);
      
      // ID dialogo
      const dialogId = `Dialog-${Math.floor(entry.timestamp/1000)}`;
      const dialogIdText = this.scene.add.text(
        -dialogWidth/2 + 20,
        -dialogHeight/2 + 50,
        `ID: ${dialogId}`,
        {
          fontSize: '14px',
          color: '#bbbbbb',
          fontStyle: 'bold'
        }
      );
      dialogContainer.add(dialogIdText);
      
      // Informazioni agente e timestamp
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
      
      // Informazioni modello LLM
      const modelInfo = entry.modelInfo || {
        name: 'unknown',
        temperature: 0.7,
        maxTokens: 1024
      };
      const modelTypeLabel = entry.isSimulated ? "Simulated Using:" : "LLM Model:";
      const modelInfoText = this.scene.add.text(
        -dialogWidth/2 + 20,
        -dialogHeight/2 + 120,
        `${modelTypeLabel} ${modelInfo.name}\nTemperature: ${modelInfo.temperature}\nMax Tokens: ${modelInfo.maxTokens || 1024}`,
        {
          fontSize: '14px',
          color: entry.isSimulated ? '#ff9800' : '#4caf50'  // Colore diverso per simulato
        }
      );
      dialogContainer.add(modelInfoText);
      
      // Linea separatrice
      const separator = this.scene.add.graphics();
      separator.lineStyle(1, 0x3f51b5, 0.5);
      separator.lineBetween(-dialogWidth/2 + 20, -dialogHeight/2 + 170, dialogWidth/2 - 20, -dialogHeight/2 + 170);
      dialogContainer.add(separator);

      // Etichetta messaggio
      const messageLabel = this.scene.add.text(
        -dialogWidth/2 + 20,
        -dialogHeight/2 + 180,
        "Message:",
        {
          fontSize: '14px',
          color: '#bbbbbb',
          fontStyle: 'bold'
        }
      );
      dialogContainer.add(messageLabel);
      
      // Contenuto messaggio (con scroll se necessario)
      const messageContainer = this.scene.add.container(-dialogWidth/2 + 20, -dialogHeight/2 + 205);
      dialogContainer.add(messageContainer);
      
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
      
      // Crea una maschera di scroll se il testo è troppo lungo
      if (messageText.height > dialogHeight - 250) {
        const maskGraphics = this.scene.add.graphics();
        maskGraphics.fillRect(
          -dialogWidth/2 + 20,
          -dialogHeight/2 + 205,
          dialogWidth - 50,
          dialogHeight - 250
        );
        
        const mask = new Phaser.Display.Masks.GeometryMask(this.scene as any, maskGraphics);
        messageContainer.setMask(mask);
        
        // Aggiungi scrollbar
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
        
        // Aggiungi interattività per lo scrolling
        dialogBg.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
          // Limita lo scroll
          let newY = messageContainer.y - deltaY;
          const minY = -dialogHeight/2 + 205 - (messageText.height - (dialogHeight - 250));
          const maxY = -dialogHeight/2 + 205;
          
          newY = Phaser.Math.Clamp(newY, minY, maxY);
          messageContainer.y = newY;
          
          // Aggiorna posizione thumb
          const scrollRange = scrollHeight - thumbHeight;
          const scrollMax = messageText.height - (dialogHeight - 250);
          const scrollPosition = -dialogHeight/2 + 205 - messageContainer.y;
          const thumbY = (scrollPosition / scrollMax) * scrollRange;
          
          scrollThumb.clear();
          scrollThumb.fillStyle(0x666666, 1);
          scrollThumb.fillRect(dialogWidth/2 - 20, -dialogHeight/2 + 205 + thumbY, 5, thumbHeight);
        });
        
        // Aggiungi interattività di trascinamento per il testo
        const textScrollArea = this.scene.add.graphics();
        textScrollArea.fillStyle(0xffffff, 0.01); // Quasi invisibile
        textScrollArea.fillRect(-dialogWidth/2 + 20, -dialogHeight/2 + 205, dialogWidth - 50, scrollHeight);
        textScrollArea.setInteractive(new Phaser.Geom.Rectangle(0, 0, dialogWidth - 50, scrollHeight), Phaser.Geom.Rectangle.Contains);
        dialogContainer.add(textScrollArea);
        
        let isDraggingText = false;
        let lastDragY = 0;
        
        textScrollArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
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
            
            // Aggiorna posizione thumb
            const scrollRange = scrollHeight - thumbHeight;
            const scrollMax = messageText.height - (dialogHeight - 250);
            const scrollPosition = -dialogHeight/2 + 205 - messageContainer.y;
            const thumbY = (scrollPosition / scrollMax) * scrollRange;
            
            scrollThumb.clear();
            scrollThumb.fillStyle(0x666666, 1);
            scrollThumb.fillRect(dialogWidth/2 - 20, -dialogHeight/2 + 205 + thumbY, 5, thumbHeight);
          }
        });
        
        this.scene.input.on('pointerup', () => {
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
        // Chiudi il dialogo
        dialogContainer.destroy();
      });
      dialogContainer.add(closeButton);
      
      // Pulsante OK in basso
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
        // Chiudi il dialogo
        dialogContainer.destroy();
      });
      dialogContainer.add(okButton);
      
      // Effetto di comparsa
      dialogContainer.setScale(0.8);
      dialogContainer.setAlpha(0);
      this.scene.tweens.add({
        targets: dialogContainer,
        scale: 1,
        alpha: 1,
        duration: 200,
        ease: 'Back.easeOut'
      });
    } catch (error) {
      console.error('Error showing full message dialog:', error);
    }
  }
  
  /**
   * Aggiorna l'indicatore visivo dello stato del backend
   */
  public updateBackendStatusIndicator(isConnected: boolean): void {
    try {
      if (this.backendStatusIndicator && this.backendStatusIndicator.scene) {
        const statusText = isConnected ? 'Backend: Connected' : 'Backend: Disconnected';
        const statusColor = isConnected ? '#4caf50' : '#f44336';
        
        this.backendStatusIndicator.setText(statusText);
        
        // Usa try-catch per catturare eventuali errori durante l'impostazione del colore
        try {
          this.backendStatusIndicator.setColor(statusColor);
        } catch (colorError) {
          console.warn('Could not set color for backend status indicator:', colorError);
          // Tenta di ricreare il testo se c'è un errore nel cambio colore
          const oldX = this.backendStatusIndicator.x;
          const oldY = this.backendStatusIndicator.y;
          const oldOriginX = this.backendStatusIndicator.originX;
          const oldOriginY = this.backendStatusIndicator.originY;
          
          // Rimuovi il vecchio testo
          this.container.remove(this.backendStatusIndicator);
          
          // Crea nuovo testo
          this.backendStatusIndicator = this.scene.add.text(
            oldX,
            oldY,
            statusText,
            {
              fontSize: '12px',
              color: statusColor,
              align: 'right'
            }
          );
          this.backendStatusIndicator.setOrigin(oldOriginX, oldOriginY);
          this.container.add(this.backendStatusIndicator);
        }
      }
    } catch (error) {
      console.error('Error updating backend status indicator:', error);
    }
  }
  
  /**
   * Riposiziona il pannello per evitare sovrapposizioni
   */
  public repositionPanel(x: number, y: number): void {
    // Controlla se il pannello si sposta fuori dai confini dello schermo
    const rightEdge = x + this.width;
    const bottomEdge = y + this.height;
    
    // Ottieni dimensioni camera
    const cameraWidth = this.scene.cameras.main.width;
    const cameraHeight = this.scene.cameras.main.height;
    
    // Correggi posizione se necessario
    let newX = x;
    let newY = y;
    
    if (rightEdge > cameraWidth) {
      newX = cameraWidth - this.width - 10; // 10px di margine
    }
    
    if (bottomEdge > cameraHeight) {
      newY = cameraHeight - this.height - 10; // 10px di margine
    }
    
    // Posiziona il pannello nella parte sinistra dello schermo
    // con un piccolo offset dall'alto per evitare sovrapposizioni con elementi UI
    newX = 20; // Margine fisso da sinistra
    newY = 60; // Margine fisso dall'alto
    
    // Applica la nuova posizione
    this.container.setPosition(newX, newY);
  }
  
  /**
   * Gestisce il ridimensionamento della finestra
   */
  public handleResize(): void {
    // Ridisegna lo sfondo
    this.drawBackground();
    
    // Aggiorna posizione per evitare sovrapposizioni
    this.repositionPanel(this.container.x, this.container.y);
  }
  
  /**
   * Mostra il pannello con un'animazione
   */
  public show(): void {
    this.container.setVisible(true);
    
    // Aggiungi un effetto di fade-in
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
    // Aggiungi un effetto di fade-out
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
   * Distrugge gli elementi UI e pulisce gli event listeners
   */
  public destroy(): void {
    // Rimuovi event listeners
    this.scene.input.off('pointermove');
    this.scene.input.off('pointerup');
    this.scene.input.off('wheel');
    
    // Rimuovi il container e tutti i suoi figli
    if (this.container && this.container.scene) {
      this.container.destroy();
    }
  }
}