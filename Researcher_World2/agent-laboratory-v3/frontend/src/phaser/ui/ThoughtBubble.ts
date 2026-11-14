// frontend/src/phaser/ui/ThoughtBubble.ts

import Phaser from 'phaser';
import { FLDialogType as DialogType } from '../types/DialogTypes';

export interface ThoughtBubbleOptions {
  width?: number;
  padding?: number;
  isLLMGenerated?: boolean;
}

// Max bubble size as fraction of camera
const MAX_WIDTH_RATIO = 0.16;
const MAX_HEIGHT_RATIO = 0.20;
const MAX_TEXT_LENGTH = 80;

// Shared color palette (same as SpeechBubble / DecisionBubble)
function getTypeColor(type: DialogType): { fill: number; border: number } {
  switch (type) {
    case DialogType.RESEARCH: return { fill: 0x6b4c00, border: 0xff8800 };
    case DialogType.MODEL:    return { fill: 0x1a6b4a, border: 0x00cc88 };
    case DialogType.DATA:     return { fill: 0x2a4a7a, border: 0x0088ff };
    case DialogType.PRIVACY:  return { fill: 0x5a2a7a, border: 0xaa44ff };
    default:                  return { fill: 0x3a3a4a, border: 0x888888 };
  }
}

export class ThoughtBubble {
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private bubble: Phaser.GameObjects.Container;
  private content: string;
  private background!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;
  private options: ThoughtBubbleOptions;
  private isLLMGenerated: boolean;
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
    this.content = content.length > MAX_TEXT_LENGTH
      ? content.slice(0, MAX_TEXT_LENGTH) + '\u2026'
      : content;

    const cam = this.scene.cameras.main;
    const maxW = Math.floor(cam.width * MAX_WIDTH_RATIO);
    const requestedW = options.width || 160;

    this.options = {
      width: Math.min(requestedW, maxW),
      padding: options.padding || 8,
      isLLMGenerated: options.isLLMGenerated || false
    };
    this.isLLMGenerated = this.options.isLLMGenerated || false;

    const { fill, border } = getTypeColor(type);
    let fillColor = fill;
    if (this.isLLMGenerated) {
      fillColor = Phaser.Display.Color.ValueToColor(fill).lighten(10).desaturate(10).color;
    }

    this.bubble = this.createBubble(fillColor, border);
    this.scene.add.existing(this.bubble);

    if (this.isLLMGenerated) {
      this.addLLMIndicator();
    }
  }

  private createBubble(fillColor: number, borderColor: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(this.x, this.y);
    const width = this.options.width!;
    const padding = this.options.padding!;

    // --- Text ---
    this.text = this.scene.add.text(0, 0, this.content, {
      fontSize: '10px',
      color: '#ffffff',
      wordWrap: { width: width - padding * 2 },
      fontStyle: this.isLLMGenerated ? 'italic' : 'normal',
      stroke: '#000000',
      strokeThickness: 1
    });
    this.text.setPosition(padding, padding);

    // --- Height ---
    const cam = this.scene.cameras.main;
    const maxH = Math.floor(cam.height * MAX_HEIGHT_RATIO);
    let height = this.text.height + padding * 2;
    if (height > maxH) {
      height = maxH;
      const mask = this.scene.add.graphics();
      mask.fillRect(0, 0, width, height);
      this.text.setMask(mask.createGeometryMask());
      container.add(mask);
    }

    // --- Background ---
    this.background = this.scene.add.graphics();
    this.background.fillStyle(fillColor, 0.95);
    this.background.fillRoundedRect(0, 0, width, height, 8);
    if (this.isLLMGenerated) {
      this.background.lineStyle(2, 0x3366CC, 0.9);
    } else {
      this.background.lineStyle(1, borderColor, 0.6);
    }
    this.background.strokeRoundedRect(0, 0, width, height, 8);
    container.add(this.background);
    container.add(this.text);

    // --- Thought circles ---
    const circles = this.scene.add.graphics();
    circles.fillStyle(fillColor, 0.8);
    circles.lineStyle(1, borderColor, 0.5);
    const cx = width / 2;
    [
      { x: cx,     y: height + 3, r: 3 },
      { x: cx - 4, y: height + 7, r: 4 },
      { x: cx - 8, y: height + 12, r: 5 }
    ].forEach(c => { circles.fillCircle(c.x, c.y, c.r); circles.strokeCircle(c.x, c.y, c.r); });
    container.add(circles);

    // --- Position (above agent, clamped) ---
    let bx = this.x - width / 2;
    let by = this.y - height - 15;
    bx = Phaser.Math.Clamp(bx, 4, cam.width - width - 4);
    by = Phaser.Math.Clamp(by, 4, cam.height - height - 20);
    container.setPosition(bx, by);

    return container;
  }

  private addLLMIndicator(): void {
    const width = this.options.width!;
    const ic = this.scene.add.container(width - 15, 8);

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

    this.bubble.add(ic);
  }

  updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    const cam = this.scene.cameras.main;
    const width = this.options.width!;
    const height = this.text.height + (this.options.padding! * 2);

    let bx = this.x - width / 2;
    let by = this.y - height - 15;
    bx = Phaser.Math.Clamp(bx, 4, cam.width - width - 4);
    by = Phaser.Math.Clamp(by, 4, cam.height - height - 20);
    this.bubble.setPosition(bx, by);
  }

  public show(): void {
    if (!this.isHidden) return;
    this.isHidden = false;
    this.bubble.setAlpha(1);
  }

  public hide(): void {
    if (this.isHidden) return;
    this.isHidden = true;
    this.bubble.setAlpha(0);
  }

  destroy(): void {
    if (this.bubble) this.bubble.destroy();
  }
}
