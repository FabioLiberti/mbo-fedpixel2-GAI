// frontend/src/phaser/ui/AgentsLegend.ts

import * as Phaser from 'phaser';
import { LegendInfoPanel, AgentTypeInfo } from './LegendInfoPanel';
import { LLMControlPanel } from './LLMControlPanel'; // Nuova importazione

/**
 * Componente che visualizza una legenda con tutti i tipi di agenti
 * Mostra sia l'immagine dello sprite che la classe dell'agente
 */
export class AgentsLegend {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private agentItems: Phaser.GameObjects.Container[] = [];
  private toggleButton!: Phaser.GameObjects.Text;
  private isExpanded: boolean = false;
  private infoPanel: LegendInfoPanel;
  
  // Nuove proprietà per LLM
  private llmControlPanel: LLMControlPanel | null = null;
  private llmButton: Phaser.GameObjects.Container | null = null;
  private isLLMPanelOpen: boolean = false;
  
  private agentTypes: Record<string, AgentTypeInfo> = {};
  private width: number = 200;
  private itemHeight: number = 50;
  private padding: number = 10;
  private isVisible: boolean = false;
  private expandedHeight: number = 0;
  private collapsedHeight: number = 40;
  
  constructor(scene: Phaser.Scene, x: number, y: number, agentTypes: Record<string, AgentTypeInfo>) {
    this.scene = scene;
    this.agentTypes = agentTypes;
    
    // Calcola l'altezza espansa in base al numero di tipi di agenti
    const agentTypeCount = Object.keys(this.agentTypes).length;
    this.expandedHeight = this.collapsedHeight + (agentTypeCount * this.itemHeight) + this.padding;
    
    // Crea un container per raggruppare tutti gli elementi della legenda
    this.container = this.scene.add.container(x, y);
    this.container.setDepth(500); // Assicura che sia sopra la maggior parte degli elementi
    
    // Crea il pannello informativo
    this.infoPanel = new LegendInfoPanel(this.scene);
    
    // Inizializza la grafica
    this.initializeGraphics();
    
    // Aggiungi i tipi di agenti
    this.createAgentItems();
    
    // Aggiungi sezioni aggiuntive alla legenda
    this.createLLMSection();
    
    // Per default inizia collassato
    this.collapse();
    
    // Mostra la legenda
    this.show();
  }
  
  /**
   * Inizializza gli elementi grafici della legenda
   */
  private initializeGraphics(): void {
    // Crea lo sfondo
    this.background = this.scene.add.graphics();
    this.container.add(this.background);
    
    // Titolo
    this.title = this.scene.add.text(
      this.width / 2, 
      this.padding, 
      'Agenti', 
      { 
        fontSize: '18px', 
        color: '#ffffff', 
        fontStyle: 'bold' 
      }
    );
    this.title.setOrigin(0.5, 0);
    this.container.add(this.title);
    
    // Pulsante di toggle
    this.toggleButton = this.scene.add.text(
      this.width - this.padding, 
      this.padding, 
      '▼', 
      { 
        fontSize: '16px', 
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { left: 5, right: 5, top: 2, bottom: 2 }
      }
    );
    this.toggleButton.setOrigin(1, 0);
    this.toggleButton.setInteractive({ useHandCursor: true });
    this.toggleButton.on('pointerdown', () => {
      this.isExpanded ? this.collapse() : this.expand();
    });
    this.container.add(this.toggleButton);
  }
  
  /**
   * Crea la sezione LLM nella legenda
   */
  private createLLMSection(): void {
    // Creiamo una nuova sezione per i controlli LLM
    // La posizione si basa sull'altezza espansa della sezione degli agenti
    const sectionY = this.expandedHeight + 10;
    
    // Titolo della sezione
    const llmTitle = this.scene.add.text(
      this.width / 2, 
      sectionY, 
      'LLM Controls', 
      { 
        fontSize: '16px', 
        color: '#ffffff', 
        fontStyle: 'bold' 
      }
    );
    llmTitle.setOrigin(0.5, 0);
    this.container.add(llmTitle);
    
    // Pulsante per aprire/chiudere il pannello LLM
    const buttonY = sectionY + 30;
    const buttonContainer = this.scene.add.container(this.width / 2, buttonY);
    
    // Sfondo del pulsante
    const buttonBackground = this.scene.add.graphics();
    buttonBackground.fillStyle(0x4477cc, 1);
    buttonBackground.fillRoundedRect(-80, -15, 160, 30, 8);
    buttonBackground.lineStyle(2, 0x5588ee, 1);
    buttonBackground.strokeRoundedRect(-80, -15, 160, 30, 8);
    
    // Etichetta del pulsante
    const buttonText = this.scene.add.text(
      0, 
      0, 
      'LLM Dashboard', 
      { 
        fontSize: '14px', 
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    buttonText.setOrigin(0.5);
    
    // Icona del pulsante (AI)
    const icon = this.scene.add.text(
      -65,
      0,
      "AI",
      {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#2255aa',
        padding: { left: 4, right: 4, top: 2, bottom: 2 }
      }
    );
    icon.setOrigin(0.5);
    
    // Aggiungi elementi al container del pulsante
    buttonContainer.add(buttonBackground);
    buttonContainer.add(buttonText);
    buttonContainer.add(icon);
    
    // Rendi il pulsante interattivo
    buttonBackground.setInteractive(new Phaser.Geom.Rectangle(-80, -15, 160, 30), Phaser.Geom.Rectangle.Contains);
    
    // Evento click sul pulsante
    buttonBackground.on('pointerdown', () => {
      this.toggleLLMPanel();
    });
    
    // Effetti hover
    buttonBackground.on('pointerover', () => {
      buttonBackground.clear();
      buttonBackground.fillStyle(0x5588ee, 1);
      buttonBackground.fillRoundedRect(-80, -15, 160, 30, 8);
      buttonBackground.lineStyle(2, 0x6699ff, 1);
      buttonBackground.strokeRoundedRect(-80, -15, 160, 30, 8);
    });
    
    buttonBackground.on('pointerout', () => {
      buttonBackground.clear();
      buttonBackground.fillStyle(0x4477cc, 1);
      buttonBackground.fillRoundedRect(-80, -15, 160, 30, 8);
      buttonBackground.lineStyle(2, 0x5588ee, 1);
      buttonBackground.strokeRoundedRect(-80, -15, 160, 30, 8);
    });
    
    // Salva il riferimento e aggiungi al container principale
    this.llmButton = buttonContainer;
    this.container.add(buttonContainer);
    
    // Aggiorna l'altezza espansa per includere la sezione LLM
    this.expandedHeight = buttonY + 50;
  }
  
  /**
   * Apre o chiude il pannello di controllo LLM
   */
  private toggleLLMPanel(): void {
    // Se il pannello non esiste, crealo
    if (!this.llmControlPanel) {
      try {
        // Posiziona il pannello accanto alla legenda
        const panelX = this.container.x + this.width + 20;
        const panelY = this.container.y;
        
        // Crea il pannello LLM
        this.llmControlPanel = new LLMControlPanel(
          this.scene, 
          panelX, 
          panelY,
          // Callback per chiudere il pannello
          () => { this.closeLLMPanel(); }
        );
        
        // Ottieni il controller dei dialoghi dalla scena
        const dialogController = (this.scene as any).agentController?.dialogController;
        if (dialogController) {
          this.llmControlPanel.setDialogController(dialogController);
        } else {
          console.warn('DialogController not found in scene');
        }
        
        this.isLLMPanelOpen = true;
        
        // Cambia il testo del pulsante
        if (this.llmButton) {
          const buttonText = this.llmButton.getByName('buttonText') as Phaser.GameObjects.Text;
          if (buttonText) {
            buttonText.setText('Close Dashboard');
          }
        }
      } catch (error) {
        console.error('Error creating LLM panel:', error);
      }
    } else {
      // Se il pannello esiste, chiudilo o mostralo
      if (this.isLLMPanelOpen) {
        this.closeLLMPanel();
      } else {
        this.openLLMPanel();
      }
    }
  }
  
  /**
   * Chiude il pannello di controllo LLM
   */
  private closeLLMPanel(): void {
    if (this.llmControlPanel) {
      this.llmControlPanel.hide();
      this.isLLMPanelOpen = false;
      
      // Cambia il testo del pulsante
      if (this.llmButton) {
        const buttonText = this.llmButton.list.find(
          (item) => item.type === 'Text' && (item as Phaser.GameObjects.Text).text !== 'AI'
        ) as Phaser.GameObjects.Text;
        
        if (buttonText) {
          buttonText.setText('LLM Dashboard');
        }
      }
    }
  }
  
  /**
   * Apre il pannello di controllo LLM
   */
  private openLLMPanel(): void {
    if (this.llmControlPanel) {
      this.llmControlPanel.show();
      this.isLLMPanelOpen = true;
      
      // Cambia il testo del pulsante
      if (this.llmButton) {
        const buttonText = this.llmButton.list.find(
          (item) => item.type === 'Text' && (item as Phaser.GameObjects.Text).text !== 'AI'
        ) as Phaser.GameObjects.Text;
        
        if (buttonText) {
          buttonText.setText('Close Dashboard');
        }
      }
    }
  }
  
  /**
   * Aggiunge un pulsante per attivare/disattivare la modalità debug
   * Mantenuta per compatibilità ma non mostra più il pulsante nella legenda
   */
  public addDebugToggleButton(callback: () => void): void {
    // Non fare nulla - il pulsante debug è stato rimosso
    console.log("Debug toggle button feature has been removed from AgentsLegend");
  }
  
  /**
   * Crea gli item per ogni tipo di agente
   */
  private createAgentItems(): void {
    // Rimuovi gli item esistenti
    this.agentItems.forEach(item => item.destroy());
    this.agentItems = [];
    
    // Posizione base per il primo item
    let yPos = this.collapsedHeight;
    
    // Crea un item per ogni tipo di agente
    Object.entries(this.agentTypes).forEach(([agentType, info], index) => {
      // Container per l'item
      const itemContainer = this.scene.add.container(0, yPos);
      
      // Sfondo per l'item
      const itemBg = this.scene.add.graphics();
      const bgColor = Phaser.Display.Color.HexStringToColor(info.color).color;
      itemBg.fillStyle(bgColor, 0.2);
      itemBg.fillRect(0, 0, this.width, this.itemHeight);
      
      // Aggiungi bordo quando l'item è pari (per leggibilità)
      if (index % 2 === 0) {
        itemBg.lineStyle(1, bgColor, 0.5);
        itemBg.strokeRect(0, 0, this.width, this.itemHeight);
      }
      
      itemContainer.add(itemBg);
      
      // Sprite dell'agente
      let agentSprite: Phaser.GameObjects.Sprite;
      
      // Verifica se la texture esiste
      if (this.scene.textures.exists(agentType)) {
        agentSprite = this.scene.add.sprite(this.padding + 16, this.itemHeight / 2, agentType, 0);
        agentSprite.setScale(1.2);
      } else {
        // Crea un placeholder colorato se la texture non esiste
        const placeholderGraphics = this.scene.add.graphics();
        placeholderGraphics.fillStyle(bgColor, 0.8);
        placeholderGraphics.fillCircle(this.padding + 16, this.itemHeight / 2, 16);
        itemContainer.add(placeholderGraphics);
        
        // Mettiamo uno sprite vuoto che useremo solo per l'interattività
        agentSprite = this.scene.add.sprite(this.padding + 16, this.itemHeight / 2, '');
        agentSprite.setVisible(false);
      }
      
      itemContainer.add(agentSprite);
      
      // Testo con il titolo dell'agente
      const titleText = this.scene.add.text(
        this.padding + 40, 
        this.itemHeight / 2, 
        info.title, 
        { 
          fontSize: '14px', 
          color: '#ffffff',
          fontStyle: 'bold'
        }
      );
      titleText.setOrigin(0, 0.5);
      itemContainer.add(titleText);
      
      // Rendi l'item interattivo
      itemBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.width, this.itemHeight), Phaser.Geom.Rectangle.Contains);
      
      // Gestisci click sull'item
      itemBg.on('pointerdown', () => {
        // Calcola la posizione esatta per il pannello informativo
        // che deve essere adiacente alla legenda
        
        // Ottieni le coordinate assolute del contenitore della legenda
        const legendX = this.container.x;
        const legendY = this.container.y;
        
        // Posiziona il pannello info immediatamente a destra della legenda
        // Il +5 aggiunge un piccolo spazio tra la legenda e il pannello info
        const infoPanelX = legendX + this.width + 5;
        
        // Allinea verticalmente con il top della legenda
        // per mantenere l'allineamento superiore richiesto
        const infoPanelY = legendY;
        
        // Mostra il pannello informativo nella nuova posizione
        this.infoPanel.showAgentInfo(agentType, info, infoPanelX, infoPanelY);
      });
      
      // Effetto hover
      itemBg.on('pointerover', () => {
        itemBg.clear();
        itemBg.fillStyle(bgColor, 0.4);
        itemBg.fillRect(0, 0, this.width, this.itemHeight);
        
        if (index % 2 === 0) {
          itemBg.lineStyle(1, bgColor, 0.7);
          itemBg.strokeRect(0, 0, this.width, this.itemHeight);
        }
      });
      
      itemBg.on('pointerout', () => {
        itemBg.clear();
        itemBg.fillStyle(bgColor, 0.2);
        itemBg.fillRect(0, 0, this.width, this.itemHeight);
        
        if (index % 2 === 0) {
          itemBg.lineStyle(1, bgColor, 0.5);
          itemBg.strokeRect(0, 0, this.width, this.itemHeight);
        }
      });
      
      // Aggiungi l'item al container e alla lista
      this.container.add(itemContainer);
      this.agentItems.push(itemContainer);
      
      // Incrementa la posizione Y per il prossimo item
      yPos += this.itemHeight;
    });
  }
  
  /**
   * Espande la legenda mostrando tutti i tipi di agenti
   */
  public expand(): void {
    this.isExpanded = true;
    
    // Aggiorna il pulsante di toggle
    this.toggleButton.setText('▲');
    
    // Mostra tutti gli item
    this.agentItems.forEach(item => item.setVisible(true));
    
    // Mostra il pulsante LLM
    if (this.llmButton) {
      this.llmButton.setVisible(true);
    }
    
    // Ridisegna lo sfondo
    this.redrawBackground(this.expandedHeight);
    
    // Se il pannello informativo è visibile, adatta la sua posizione
    // in base alla nuova dimensione della legenda
    if (this.infoPanel.getIsVisible()) {
      // Nascondi il pannello, verrà riaperto dall'utente se necessario
      this.infoPanel.hide();
    }
  }
  
  /**
   * Collassa la legenda mostrando solo il titolo
   */
  public collapse(): void {
    this.isExpanded = false;
    
    // Aggiorna il pulsante di toggle
    this.toggleButton.setText('▼');
    
    // Nascondi tutti gli item
    this.agentItems.forEach(item => item.setVisible(false));
    
    // Nascondi il pulsante LLM
    if (this.llmButton) {
      this.llmButton.setVisible(false);
    }
    
    // Ridisegna lo sfondo
    this.redrawBackground(this.collapsedHeight);
    
    // Nascondi anche il pannello informativo se è visibile
    if (this.infoPanel.getIsVisible()) {
      this.infoPanel.hide();
    }
    
    // Nascondi anche il pannello LLM se è aperto
    this.closeLLMPanel();
  }
  
  /**
   * Ridisegna lo sfondo con l'altezza specificata
   */
  private redrawBackground(height: number): void {
    this.background.clear();
    this.background.fillStyle(0x222222, 0.85);
    this.background.fillRoundedRect(0, 0, this.width, height, 5);
    this.background.lineStyle(2, 0x444444, 1);
    this.background.strokeRoundedRect(0, 0, this.width, height, 5);
  }
  
  /**
   * Mostra la legenda
   */
  public show(): void {
    this.container.setVisible(true);
    this.isVisible = true;
  }
  
  /**
   * Nasconde la legenda
   */
  public hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
    
    // Nascondi anche il pannello informativo
    this.infoPanel.hide();
    
    // Nascondi anche il pannello LLM
    this.closeLLMPanel();
  }
  
  /**
   * Toggle visibilità della legenda
   */
  public toggleVisibility(): void {
    this.isVisible ? this.hide() : this.show();
  }
  
  /**
   * Restituisce il riferimento al container
   */
  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
  
  /**
   * Metodo per caricare il file di configurazione degli agenti
   * @param scene La scena Phaser
   * @returns Una Promise che risolve con i dati degli agenti
   */
  public static async loadAgentTypesConfig(scene: Phaser.Scene): Promise<Record<string, AgentTypeInfo>> {
    return new Promise((resolve, reject) => {
      // Carica il file JSON
      scene.load.json('agentTypesConfig', 'assets/config/agentTypes.json');
      
      // Gestisci il completamento del caricamento
      scene.load.once('complete', () => {
        try {
          const config = scene.cache.json.get('agentTypesConfig');
          resolve(config);
        } catch (error) {
          console.error('Error loading agent types config:', error);
          reject(error);
        }
      });
      
      // Avvia il caricamento
      scene.load.start();
    });
  }
}