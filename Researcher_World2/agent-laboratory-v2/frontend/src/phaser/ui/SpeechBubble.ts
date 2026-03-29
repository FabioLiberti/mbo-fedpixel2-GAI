// frontend/src/phaser/ui/SpeechBubble.ts

import Phaser from 'phaser';
import { FLDialogType } from '../types/DialogTypes';

// Max bubble size as fraction of camera
const MAX_WIDTH_RATIO = 0.16;
const MAX_HEIGHT_RATIO = 0.18;
const MAX_TEXT_LENGTH = 80;

// Shared color palette (same as ThoughtBubble / DecisionBubble)
function getTypeColor(type: FLDialogType): { fill: number; border: number } {
  switch (type) {
    case FLDialogType.RESEARCH: return { fill: 0x6b4c00, border: 0xff8800 };
    case FLDialogType.MODEL:    return { fill: 0x1a6b4a, border: 0x00cc88 };
    case FLDialogType.DATA:     return { fill: 0x2a4a7a, border: 0x0088ff };
    case FLDialogType.PRIVACY:  return { fill: 0x5a2a7a, border: 0xaa44ff };
    default:                    return { fill: 0x3a3a4a, border: 0x888888 };
  }
}

export class SpeechBubble {
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private message: string;
  private type: FLDialogType;
  private isLLMDialog: boolean;
  private container: Phaser.GameObjects.Container;

  private text!: Phaser.GameObjects.Text;
  private remainingTime: number = 3000;
  private isDestroyed: boolean = false;
  private isHidden: boolean = false;

  private isResponse: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    message: string,
    type: FLDialogType = FLDialogType.GENERAL,
    options?: {
      width?: number;
      padding?: number;
      targetPos?: { x: number; y: number };
      isLLMDialog?: boolean;
      isResponse?: boolean;
    }
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.message = message.length > MAX_TEXT_LENGTH
      ? message.slice(0, MAX_TEXT_LENGTH) + '\u2026'
      : message;
    this.type = type;
    this.isLLMDialog = options?.isLLMDialog || false;
    this.isResponse = options?.isResponse || false;

    this.container = this.scene.add.container(x, y);
    this.container.setDepth(1000);

    this.createBubble(options);
    this.playAppearAnimation();
  }

  private createBubble(options?: {
    width?: number;
    padding?: number;
    targetPos?: { x: number; y: number };
    isLLMDialog?: boolean;
  }): void {
    const padding = options?.padding || 8;
    const cam = this.scene.cameras.main;
    const maxW = Math.floor(cam.width * MAX_WIDTH_RATIO);
    const requestedW = options?.width || 120;
    const bubbleWidth = Math.min(requestedW, maxW);

    // --- Colors ---
    // Response bubbles get a distinct teal tint; questions keep the type color
    const { fill, border } = this.isResponse
      ? { fill: 0x1a4a4a, border: 0x22aa88 }
      : getTypeColor(this.type);
    let fillColor = fill;
    if (this.isLLMDialog) {
      fillColor = Phaser.Display.Color.ValueToColor(fill).lighten(10).desaturate(10).color;
    }

    // --- Text ---
    this.text = this.scene.add.text(0, 0, this.message, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: '#ffffff',
      wordWrap: { width: bubbleWidth },
      fontStyle: this.isLLMDialog ? 'italic' : 'normal',
      stroke: '#000000',
      strokeThickness: 1
    });
    this.text.setOrigin(0.5);

    // --- Dimensions ---
    const width = Math.max(this.text.width + padding * 2, 36);
    const maxH = Math.floor(cam.height * MAX_HEIGHT_RATIO);
    const height = Math.min(Math.max(this.text.height + padding * 2, 24), maxH);

    // --- Background ---
    const bg = this.scene.add.graphics();
    bg.fillStyle(fillColor, 0.95);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
    if (this.isLLMDialog) {
      bg.lineStyle(2, 0x3366CC, 0.9);
    } else {
      bg.lineStyle(1, border, 0.6);
    }
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);
    this.container.add(bg);

    // --- Tail ---
    const tail = this.scene.add.graphics();
    tail.fillStyle(fillColor, 0.95);
    tail.fillTriangle(0, height / 2, -5, height / 2 + 7, 5, height / 2 + 7);
    tail.lineStyle(1, this.isLLMDialog ? 0x3366CC : border, 0.6);
    tail.strokeTriangle(0, height / 2, -5, height / 2 + 7, 5, height / 2 + 7);
    this.container.add(tail);

    // --- AI badge ---
    if (this.isLLMDialog) {
      this.addLLMIndicator(width, height);
    }

    this.container.add(this.text);

    // Bounds clamping
    const bx = Phaser.Math.Clamp(this.x, width / 2 + 4, cam.width - width / 2 - 4);
    const by = Phaser.Math.Clamp(this.y, height / 2 + 4, cam.height - height / 2 - 20);
    this.container.setPosition(bx, by);
  }

  private addLLMIndicator(bubbleW: number, bubbleH: number): void {
    const offsetX = bubbleW / 2 - 5;
    const offsetY = -bubbleH / 2 - 2;

    const ic = this.scene.add.container(offsetX, offsetY);

    const g = this.scene.add.graphics();
    g.fillStyle(0x3366CC, 0.85);
    g.fillRoundedRect(-3, -3, 22, 14, 5);
    ic.add(g);

    const t = this.scene.add.text(8, 4, 'AI', {
      fontFamily: 'Arial', fontSize: '8px', color: '#FFFFFF', fontStyle: 'bold'
    });
    t.setOrigin(0.5, 0.5);
    ic.add(t);

    this.scene.tweens.add({
      targets: ic, scaleX: 1.1, scaleY: 1.1,
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    this.container.add(ic);
  }

  private playAppearAnimation(): void {
    this.container.setAlpha(0);
    this.container.setScale(0.5);
    this.scene.tweens.add({
      targets: this.container, alpha: 1, scale: 1,
      duration: 200, ease: 'Back.easeOut'
    });
  }

  private playDisappearAnimation(): void {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, scale: 0.5,
      duration: 200, ease: 'Back.easeIn',
      onComplete: () => { this.container.destroy(); this.isDestroyed = true; }
    });
  }

  public updatePosition(x: number, y: number): void {
    if (this.isDestroyed) return;
    this.x = x;
    this.y = y;
    const cam = this.scene.cameras.main;
    const bx = Phaser.Math.Clamp(x, 40, cam.width - 40);
    const by = Phaser.Math.Clamp(y, 40, cam.height - 40);
    this.container.setPosition(bx, by);
  }

  public setDuration(duration: number): void {
    this.remainingTime = duration;
    if (this.isLLMDialog) this.remainingTime *= 1.5;
  }

  public show(): void {
    if (!this.isHidden) return;
    this.isHidden = false;
    this.container.setAlpha(1);
  }

  public hide(): void {
    if (this.isHidden) return;
    this.isHidden = true;
    this.container.setAlpha(0);
  }

  public update(delta: number): boolean {
    if (this.isDestroyed || this.isHidden) return !this.isDestroyed;
    this.remainingTime -= delta;
    if (this.remainingTime <= 0) { this.playDisappearAnimation(); return false; }
    return true;
  }

  public destroy(): void {
    if (!this.isDestroyed) { this.container.destroy(); this.isDestroyed = true; }
  }
}
