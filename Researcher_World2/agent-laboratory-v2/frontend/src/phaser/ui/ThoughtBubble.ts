// frontend/src/phaser/ui/ThoughtBubble.ts

import Phaser from 'phaser';
import { FLDialogType as DialogType } from '../types/DialogTypes';

export interface ThoughtBubbleOptions {
  width?: number;
  padding?: number;
  isLLMGenerated?: boolean;
}

/**
 * Visualizza i pensieri degli agenti come nuvole di pensiero
 */
export class ThoughtBubble {
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private bubble: Phaser.GameObjects.Container;
  private content: string;
  private background!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;
  private thoughtCircles: Phaser.GameObjects.Graphics[] = [];
  private type: DialogType;
  private options: ThoughtBubbleOptions;
  private isLLMGenerated: boolean;
  private llmIndicator: Phaser.GameObjects.Container | null = null;
  private isHidden: boolean = false;
  
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    content: string,
    type: DialogType,
    options: ThoughtBubbleOptions = {}
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.content = content;
    this.type = type;
    this.options = {
      width: options.width || 160,
      padding: options.padding || 8,
      isLLMGenerated: options.isLLMGenerated || false
    };
    this.isLLMGenerated = this.options.isLLMGenerated || false;
    
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
    
    // Colore basato sul tipo di dialogo
    let color = 0xffffff;
    switch (this.type) {
      case DialogType.RESEARCH:
        color = 0xffe0a0;
        break;
      case DialogType.MODEL:
        color = 0xa0ffe0;
        break;
      case DialogType.DATA:
        color = 0xa0c0ff;
        break;
      case DialogType.PRIVACY:
        color = 0xe0a0ff;
        break;
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
    this.text.setPosition(this.options.padding!, this.options.padding!);
    container.add(this.text);
    
    // Dimensioni della bolla
    const width = this.options.width!;
    const height = this.text.height + (this.options.padding! * 2);
    
    // Disegna lo sfondo
    this.background.fillStyle(color, 0.8);
    this.background.fillRoundedRect(0, 0, width, height, 10);
    
    // Contorno con stile diverso per LLM
    if (this.isLLMGenerated) {
      this.background.lineStyle(2, 0x3366CC, 0.8);
    } else {
      this.background.lineStyle(1, 0x000000, 0.5);
    }
    this.background.strokeRoundedRect(0, 0, width, height, 10);
    
    // Aggiungi i cerchietti per la nuvola di pensiero
    this.addThoughtCircles(container);
    
    // Centra la bolla sopra la posizione specificata
    container.setPosition(this.x - width / 2, this.y - height - 20);
    
    return container;
  }
  
  /**
   * Aggiunge un indicatore che mostra che il pensiero è stato generato da un LLM
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
  
  private addThoughtCircles(container: Phaser.GameObjects.Container): void {
    // Crea cerchietti che vanno dall'agente alla nuvola di pensiero
    const pathGraphics = this.scene.add.graphics();
    
    // Colore dei cerchietti
    pathGraphics.fillStyle(0xFFFFFF, 0.8);
    pathGraphics.lineStyle(1, 0x000000, 0.5);
    
    // Posizioni dei cerchietti (relativi al container)
    const positions = [
      { x: this.options.width! / 2, y: this.text.height + this.options.padding! * 2 + 5, size: 4 },
      { x: this.options.width! / 2 - 5, y: this.text.height + this.options.padding! * 2 + 10, size: 6 },
      { x: this.options.width! / 2 - 10, y: this.text.height + this.options.padding! * 2 + 15, size: 8 }
    ];
    
    // Disegna i cerchietti
    positions.forEach(pos => {
      pathGraphics.fillCircle(pos.x, pos.y, pos.size);
      pathGraphics.strokeCircle(pos.x, pos.y, pos.size);
    });
    
    container.add(pathGraphics);
    this.thoughtCircles.push(pathGraphics);
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
   * Mostra la bolla di pensiero
   */
  public show(): void {
    if (!this.isHidden) return;
    
    this.isHidden = false;
    this.bubble.setAlpha(1);
  }
  
  /**
   * Nasconde la bolla di pensiero senza distruggerla
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