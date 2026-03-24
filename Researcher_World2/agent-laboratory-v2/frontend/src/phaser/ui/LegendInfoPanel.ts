// frontend/src/phaser/ui/LegendInfoPanel.ts

import * as Phaser from 'phaser';

/**
 * Interfaccia che definisce la struttura dei dati di un agente
 */
export interface AgentTypeInfo {
  title: string;
  description: string;
  skills: string[];
  role: string;
  background: string;
  color: string;
  spritesheetPath: string;
  iconPath?: string;
}

/**
 * Pannello informativo che mostra i dettagli di un tipo di agente
 * Può essere visualizzato/nascosto e posizionato nella scena
 */
export class LegendInfoPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private descriptionText!: Phaser.GameObjects.Text;
  private skillsText!: Phaser.GameObjects.Text;
  private roleText!: Phaser.GameObjects.Text;
  private backgroundText!: Phaser.GameObjects.Text;
  private closeButton!: Phaser.GameObjects.Text;
  private agentSprite!: Phaser.GameObjects.Sprite;
  private placeholderCircle: Phaser.GameObjects.Graphics | null = null;
  
  private width: number = 300;
  private height: number = 450; // Aumentata da 350 a 450 per avere più spazio
  private padding: number = 15;
  private isVisible: boolean = false;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Crea un container per raggruppare tutti gli elementi del pannello
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000); // Assicura che sia sopra altri elementi
    
    // Inizializza gli elementi grafici
    this.initializeGraphics();
    
    // Inizialmente nascosto
    this.hide();
  }
  
  /**
   * Inizializza gli elementi grafici del pannello
   */
  private initializeGraphics(): void {
    // Crea lo sfondo
    this.background = this.scene.add.graphics();
    this.container.add(this.background);
    
    // Immagine agente (sprite o icona grande)
    this.agentSprite = this.scene.add.sprite(this.width / 2, 60, '');
    this.agentSprite.setScale(2);
    this.container.add(this.agentSprite);
    
    // Crea i testi
    const textStyle = { 
      fontSize: '14px', 
      color: '#ffffff', 
      wordWrap: { width: this.width - (this.padding * 2) } 
    };
    
    const headerStyle = { 
      fontSize: '18px', 
      color: '#ffffff', 
      fontStyle: 'bold'
    };
    
    // Titolo
    this.titleText = this.scene.add.text(this.width / 2, 120, '', headerStyle);
    this.titleText.setOrigin(0.5, 0);
    this.container.add(this.titleText);
    
    // Descrizione
    this.descriptionText = this.scene.add.text(this.padding, 150, '', textStyle);
    this.container.add(this.descriptionText);
    
    // Ruolo
    const roleLabel = this.scene.add.text(this.padding, 200, 'Ruolo:', { ...textStyle, fontStyle: 'bold' });
    this.container.add(roleLabel);
    
    this.roleText = this.scene.add.text(this.padding, 220, '', textStyle);
    this.container.add(this.roleText);
    
    // Skills
    const skillsLabel = this.scene.add.text(this.padding, 260, 'Competenze:', { ...textStyle, fontStyle: 'bold' });
    this.container.add(skillsLabel);
    
    this.skillsText = this.scene.add.text(this.padding, 280, '', textStyle);
    this.container.add(this.skillsText);
    
    // Background
    const bgLabel = this.scene.add.text(this.padding, 350, 'Background:', { ...textStyle, fontStyle: 'bold' });
    this.container.add(bgLabel);
    
    this.backgroundText = this.scene.add.text(this.padding, 370, '', textStyle);
    this.container.add(this.backgroundText);
    
    // Pulsante chiusura
    this.closeButton = this.scene.add.text(
      this.width - this.padding, 
      this.padding, 
      'X', 
      { fontSize: '16px', color: '#ffffff', backgroundColor: '#aa0000', padding: { left: 5, right: 5, top: 2, bottom: 2 } }
    );
    this.closeButton.setOrigin(1, 0);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.on('pointerdown', () => this.hide());
    this.container.add(this.closeButton);
  }
  
  /**
   * Aggiorna il contenuto del pannello con le informazioni di un tipo di agente
   * e lo posiziona adiacente alla legenda, allineato in alto
   */
  public showAgentInfo(agentType: string, info: AgentTypeInfo, x: number, y: number): void {
    // Assicurati che il pannello non esca dallo schermo
    const screenWidth = this.scene.cameras.main.width;
    const screenHeight = this.scene.cameras.main.height;
    
    // Controlla che il pannello non vada fuori dallo schermo a destra
    if (x + this.width > screenWidth) {
      x = Math.max(10, screenWidth - this.width - 10); // 10px di margine
    }
    
    // Controlla che il pannello non vada fuori dallo schermo in basso
    if (y + this.height > screenHeight) {
      y = screenHeight - this.height - 10; // 10px di margine
    }
    
    // Posiziona il pannello allineato all'altezza della legenda (y viene passato come altezza superiore)
    this.container.setPosition(x, y);
    
    // Aggiorna contenuti
    this.titleText.setText(info.title);
    this.descriptionText.setText(info.description);
    this.roleText.setText(info.role);
    this.backgroundText.setText(info.background);
    
    // Formatta e aggiorna le skills
    const skillsList = info.skills.map(skill => `• ${skill}`).join('\n');
    this.skillsText.setText(skillsList);
    
    // Aggiorna colore di sfondo
    const bgColor = Phaser.Display.Color.HexStringToColor(info.color).color;
    const bgColorDark = Phaser.Display.Color.HexStringToColor(this.darkenColor(info.color)).color;
    
    // Ridisegna lo sfondo
    this.background.clear();
    this.background.fillStyle(bgColorDark, 0.95);
    this.background.fillRoundedRect(0, 0, this.width, this.height, 10);
    this.background.lineStyle(2, bgColor, 1);
    this.background.strokeRoundedRect(0, 0, this.width, this.height, 10);
    
    // Rimuovi il placeholder precedente se esiste
    if (this.placeholderCircle) {
      this.placeholderCircle.destroy();
      this.placeholderCircle = null;
    }
    
    // Aggiorna l'immagine dell'agente — preferisci iconPath (grande) se disponibile
    const iconKey = `icon_${agentType}`;
    if (info.iconPath && this.scene.textures.exists(iconKey)) {
      this.agentSprite.setTexture(iconKey);
      this.agentSprite.setVisible(true);
      // Scala per adattare l'icona grande (target ~80px altezza)
      const targetH = 80;
      const scale = targetH / this.agentSprite.height;
      this.agentSprite.setScale(scale);
    } else if (this.scene.textures.exists(agentType)) {
      this.agentSprite.setTexture(agentType);
      this.agentSprite.setFrame(0);
      this.agentSprite.setVisible(true);
      this.agentSprite.setScale(2);
      if (this.scene.anims.exists(`${agentType}_idle`)) {
        this.agentSprite.play(`${agentType}_idle`);
      }
    } else {
      this.agentSprite.setVisible(false);
      const ph = this.scene.add.graphics();
      ph.fillStyle(bgColor, 1);
      ph.fillCircle(this.width / 2, 60, 30);
      this.placeholderCircle = ph;
      this.container.add(ph);
    }
    
    // Mostra il pannello
    this.show();
  }
  
  /**
   * Mostra il pannello
   */
  public show(): void {
    this.container.setVisible(true);
    this.isVisible = true;
    
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
        this.isVisible = false;
        
        // Pulisci il placeholder se esiste quando nascondi il pannello
        if (this.placeholderCircle) {
          this.placeholderCircle.destroy();
          this.placeholderCircle = null;
        }
      }
    });
  }
  
  /**
   * Restituisce lo stato di visibilità del pannello
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }
  
  /**
   * Restituisce il riferimento al container
   */
  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
  
  /**
   * Utility per scurire un colore esadecimale
   */
  private darkenColor(hexColor: string): string {
    const color = Phaser.Display.Color.HexStringToColor(hexColor);
    const darkerColor = Phaser.Display.Color.IntegerToColor(color.color);
    
    // Scurisci il colore del 30%
    darkerColor.red = Math.max(0, Math.floor(darkerColor.red * 0.7));
    darkerColor.green = Math.max(0, Math.floor(darkerColor.green * 0.7));
    darkerColor.blue = Math.max(0, Math.floor(darkerColor.blue * 0.7));
    
    return darkerColor.rgba;
  }
}