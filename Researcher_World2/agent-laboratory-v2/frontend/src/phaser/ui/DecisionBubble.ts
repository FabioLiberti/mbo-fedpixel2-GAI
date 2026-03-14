// frontend/src/phaser/ui/DecisionBubble.ts

import Phaser from 'phaser';
import { FLDialogType as DialogType } from '../types/DialogTypes';

export interface DecisionBubbleOptions {
  width?: number;
  padding?: number;
  isLLMGenerated?: boolean;
  isPlan?: boolean;
}

/**
 * Visualizza le decisioni o i piani degli agenti
 */
export class DecisionBubble {
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private bubble: Phaser.GameObjects.Container;
  private content: string;
  private background!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Image | null = null;
  private type: DialogType;
  private options: DecisionBubbleOptions;
  private isLLMGenerated: boolean;
  private isPlan: boolean;
  private llmIndicator: Phaser.GameObjects.Container | null = null;
  private isHidden: boolean = false;
  
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    content: string,
    type: DialogType,
    options: DecisionBubbleOptions = {}
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.content = content;
    this.type = type;
    this.options = {
      width: options.width || 180,
      padding: options.padding || 10,
      isLLMGenerated: options.isLLMGenerated || false,
      isPlan: options.isPlan || false
    };
    this.isLLMGenerated = this.options.isLLMGenerated || false;
    this.isPlan = this.options.isPlan || false;
    
    this.bubble = this.createBubble();
    this.scene.add.existing(this.bubble);
    
    // Aggiungi indicatore LLM se generato da LLM
    if (this.isLLMGenerated) {
      this.addLLMIndicator();
    }
  }
  
  private createBubble(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(this.x, this.y);
    
    // Crea lo sfondo della bolla
    this.background = this.scene.add.graphics();
    container.add(this.background);
    
    // Colore basato sul tipo e se è un piano o una decisione
    let color = 0xffffff;
    let borderColor = 0x000000;
    let iconKey = '';
    
    if (this.isPlan) {
      // Stile per piano
      color = 0xffe0c0;
      borderColor = 0xff8800;
      iconKey = 'plan-icon';
    } else {
      // Stile per decisione
      switch (this.type) {
        case DialogType.RESEARCH:
          color = 0xffe0a0;
          borderColor = 0xff8800;
          iconKey = 'research-icon';
          break;
        case DialogType.MODEL:
          color = 0xa0ffe0;
          borderColor = 0x00cc88;
          iconKey = 'model-icon';
          break;
        case DialogType.DATA:
          color = 0xa0c0ff;
          borderColor = 0x0088ff;
          iconKey = 'data-icon';
          break;
        case DialogType.PRIVACY:
          color = 0xe0a0ff;
          borderColor = 0xaa44ff;
          iconKey = 'privacy-icon';
          break;
        default:
          color = 0xf0f0f0;
          borderColor = 0x808080;
          iconKey = 'decision-icon';
      }
    }
    
    // Se è generato da LLM, applica una tinta blu chiara
    if (this.isLLMGenerated) {
      // Mescola il colore originale con blu chiaro
      color = Phaser.Display.Color.ValueToColor(color)
        .lighten(10)
        .desaturate(10)
        .color;
    }
    
    // Crea il testo
    const style = {
      fontSize: '12px',
      color: '#000000',
      wordWrap: { width: this.options.width! - (this.options.padding! * 2) },
      fontStyle: this.isLLMGenerated ? 'italic' : 'normal'
    };
    
    this.text = this.scene.add.text(0, 0, this.content, style);
    
    // Aggiungi icona se disponibile
    let iconWidth = 0;
    let iconPadding = 0;
    
    try {
      if (this.scene.textures.exists(iconKey)) {
        this.icon = this.scene.add.image(0, 0, iconKey);
        
        if (this.icon) {
          this.icon.setScale(0.5);
          iconWidth = this.icon.width * 0.5;
          iconPadding = 8;
          container.add(this.icon);
        }
      }
    } catch (error) {
      console.warn(`[DecisionBubble] Icon ${iconKey} not found`);
    }
    
    // Posiziona il testo
    this.text.setPosition(this.options.padding! + iconWidth + iconPadding, this.options.padding!);
    container.add(this.text);
    
    // Dimensioni della bolla
    const width = this.options.width!;
    const height = this.text.height + (this.options.padding! * 2);
    
    // Disegna lo sfondo
    this.background.fillStyle(color, 0.9);
    this.background.fillRoundedRect(0, 0, width, height, 8);
    
    // Contorno con stile diverso per LLM
    if (this.isLLMGenerated) {
      this.background.lineStyle(2, 0x3366CC, 0.8);
    } else {
      this.background.lineStyle(2, borderColor, 0.6);
    }
    this.background.strokeRoundedRect(0, 0, width, height, 8);
    
    // Posiziona l'icona, se presente
    if (this.icon) {
      this.icon.setPosition(this.options.padding! + iconWidth/2, height/2);
    }
    
    // Centra la bolla sopra la posizione specificata
    container.setPosition(this.x - width / 2, this.y - height - 20);
    
    return container;
  }
  
  /**
   * Aggiunge un indicatore che mostra che la decisione è stata generata da un LLM
   */
  private addLLMIndicator(): void {
    // Posiziona l'indicatore LLM nell'angolo superiore destro della nuvoletta
    const width = this.options.width!;
    const offsetX = width - 15;
    const offsetY = 10;
    
    // Crea un container per l'indicatore
    const indicatorContainer = this.scene.add.container(offsetX, offsetY);
    
    // Crea un background con bordo arrotondato
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x3366CC, 0.85);  // Blu più scuro e più visibile
    graphics.fillRoundedRect(-3, -3, 26, 16, 6);
    
    // Crea l'etichetta "AI"
    const indicator = this.scene.add.text(10, 5, "AI", {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: '#FFFFFF',  // Testo bianco per maggiore contrasto
      fontStyle: 'bold'
    });
    indicator.setOrigin(0.5, 0.5);
    
    // Aggiungi gli elementi al container
    indicatorContainer.add(graphics);
    indicatorContainer.add(indicator);
    
    // Effetto pulsante migliorato
    this.scene.tweens.add({
      targets: indicatorContainer,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Salva il riferimento all'indicatore
    this.llmIndicator = indicatorContainer;
    
    // Aggiungi il container alla nuvoletta
    this.bubble.add(indicatorContainer);
  }
  
  /**
   * Aggiorna la posizione della bolla
   */
  updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    
    const width = this.options.width!;
    const height = this.text.height + (this.options.padding! * 2);
    
    this.bubble.setPosition(this.x - width / 2, this.y - height - 20);
  }
  
  /**
   * Mostra la bolla di decisione
   */
  public show(): void {
    if (!this.isHidden) return;
    
    this.isHidden = false;
    this.bubble.setAlpha(1);
  }
  
  /**
   * Nasconde la bolla di decisione senza distruggerla
   */
  public hide(): void {
    if (this.isHidden) return;
    
    this.isHidden = true;
    this.bubble.setAlpha(0);
  }
  
  /**
   * Distrugge la bolla
   */
  destroy(): void {
    if (this.bubble) {
      this.bubble.destroy();
    }
  }
}