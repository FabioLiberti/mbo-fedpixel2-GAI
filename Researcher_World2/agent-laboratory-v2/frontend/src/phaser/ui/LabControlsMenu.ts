// frontend/src/phaser/ui/LabControlsMenu.ts
//
// Pannello condiviso "Controlli Lab" — unico per tutte e tre le scene.
// Contiene: Navigazione, Agenti, LLM, Test/Debug, Info Laboratorio.

import * as Phaser from 'phaser';
import { SimpleLLMPanel } from './simple/SimpleLLMPanel';
import { LLMControlPanel } from './LLMControlPanel';
import { DialogController } from '../controllers/DialogController';
import { Agent } from '../sprites/Agent';
import { integrateAgentsLegend } from '../examples/AgentsLegendIntegration';

// ── Configuration ────────────────────────────────────────────────────

export interface LabControlConfig {
  labId: string;
  labName: string;
  labDescription: string;
  theme: {
    primary: number;    // button / accent colour (e.g. terracotta, teal, blue)
    secondary: number;  // panel background
    accent: number;     // text / border colour
  };
  /** Navigation links to other scenes */
  navigation: Array<{ label: string; sceneKey: string }>;
}

/** Minimal scene interface — every lab scene already satisfies this. */
export interface ILabControlScene extends Phaser.Scene {
  agents: Agent[];
  agentController: any;          // GlobalAgentController | null
  agentsLegend: any;             // AgentsLegend | null
  debugGraphics: Phaser.GameObjects.Graphics | null;
  debugText: Phaser.GameObjects.Text | null;
  theme: { name: string; colorPalette: Record<string, number> };
  updateDebugInfo(text: string): void;
}

// ── LabControlsMenu ──────────────────────────────────────────────────

export class LabControlsMenu {
  private scene: ILabControlScene & Phaser.Scene;
  private config: LabControlConfig;

  // Phaser containers
  private panel: Phaser.GameObjects.Container | null = null;
  private toggleBtn: Phaser.GameObjects.Container | null = null;
  private isOpen = false;

  // Sub-panels
  private simpleLLMPanel: SimpleLLMPanel | null = null;
  private llmControlPanel: LLMControlPanel | null = null;
  private dialogController: DialogController | null = null;

  // Panel geometry
  private readonly panelW = 240;
  private panelH = 0; // computed in build

  constructor(scene: ILabControlScene & Phaser.Scene, config: LabControlConfig) {
    this.scene = scene;
    this.config = config;
    this.build();
  }

  // ── Public API ───────────────────────────────────────────────────

  setDialogController(controller: DialogController): void {
    this.dialogController = controller;
    if (this.simpleLLMPanel) this.simpleLLMPanel.setDialogController(controller);
    if (this.llmControlPanel) this.llmControlPanel.setDialogController(controller);
  }

  destroy(): void {
    this.simpleLLMPanel?.destroy(); this.simpleLLMPanel = null;
    this.llmControlPanel?.destroy(); this.llmControlPanel = null;
    this.panel?.destroy(); this.panel = null;
    this.toggleBtn?.destroy(); this.toggleBtn = null;
  }

  // ── Build ────────────────────────────────────────────────────────

  private build(): void {
    const { primary, secondary, accent } = this.config.theme;
    const W = this.panelW;
    const cam = this.scene.cameras.main;

    // --- Collect sections to compute total height ---
    interface Section { title: string; buttons: { label: string; cb: () => void }[] }
    const sections: Section[] = [];

    // Navigazione rimossa — si usa la sidebar

    // 1. Agenti
    sections.push({
      title: 'Agenti',
      buttons: [
        { label: 'Legenda Agenti', cb: () => this.toggleAgentsLegend() },
        { label: 'Stimola Movimento', cb: () => this.stimulateMovement() },
      ],
    });

    // 3. LLM
    sections.push({
      title: 'LLM',
      buttons: [
        { label: 'LLM Dashboard', cb: () => this.toggleLLMPanel() },
        { label: 'LLM Simple', cb: () => this.toggleSimpleLLMPanel() },
      ],
    });

    // 4. Test e Debug
    sections.push({
      title: 'Test e Debug',
      buttons: [
        { label: 'Test Dialogo', cb: () => this.testDialog() },
        { label: 'Debug Dialoghi (D)', cb: () => this.toggleDebugDialogs() },
        { label: 'Assets Debug', cb: () => this.toggleAssetsDebug() },
      ],
    });

    // 5. Informazioni
    sections.push({
      title: 'Informazioni',
      buttons: [
        { label: 'Info Laboratorio', cb: () => this.showLabInfo() },
      ],
    });

    // Calculate panel height: title(40) + per-section(sectionTitle 30 + buttons * 40 + gap 10)
    let totalH = 50; // title bar + separator
    for (const s of sections) {
      totalH += 30; // section title
      totalH += s.buttons.length * 40; // buttons
      totalH += 10; // gap
    }
    totalH += 10; // bottom padding
    this.panelH = totalH;

    // --- Panel container ---
    const panelX = cam.width - 40;
    const panelY = cam.height - 40;

    const p = this.scene.add.container(panelX, panelY);
    this.panel = p;
    p.setDepth(1000);
    p.setScrollFactor(0);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(secondary, 0.92);
    bg.fillRoundedRect(-W, -this.panelH, W, this.panelH, 10);
    bg.lineStyle(2, primary, 1);
    bg.strokeRoundedRect(-W, -this.panelH, W, this.panelH, 10);
    p.add(bg);

    // Title
    const title = this.scene.add.text(-W / 2, -this.panelH + 20, 'Controlli Lab', {
      fontSize: '18px', color: this.hexStr(accent), fontStyle: 'bold',
    }).setOrigin(0.5);
    p.add(title);

    // Separator
    const sep = this.scene.add.graphics();
    sep.lineStyle(2, primary, 0.8);
    sep.lineBetween(-W + 20, -this.panelH + 40, -20, -this.panelH + 40);
    p.add(sep);

    // --- Render sections ---
    let curY = -this.panelH + 55;

    for (const section of sections) {
      // Section title
      const sTitle = this.scene.add.text(-W + 20, curY, section.title, {
        fontSize: '15px', color: this.hexStr(accent), fontStyle: 'bold',
      });
      p.add(sTitle);
      curY += 28;

      // Buttons
      for (const btn of section.buttons) {
        this.addButton(-W / 2, curY, btn.label, btn.cb, primary, accent);
        curY += 40;
      }
      curY += 10; // section gap
    }

    // --- Toggle button (circle, bottom-right) ---
    this.createToggleButton(primary, accent);

    // Start closed
    this.setOpen(false);
  }

  // ── Button factory ───────────────────────────────────────────────

  private addButton(x: number, y: number, label: string, cb: () => void, primary: number, accent: number): void {
    const bw = 200, bh = 30;
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    const drawBg = (alpha: number, borderAlpha: number) => {
      bg.clear();
      bg.fillStyle(primary, alpha);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 5);
      bg.lineStyle(1, accent, borderAlpha);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 5);
    };
    drawBg(0.7, 0.5);

    const txt = this.scene.add.text(0, 0, label, {
      fontSize: '14px', color: this.hexStr(accent), align: 'center',
    }).setOrigin(0.5);

    container.add([bg, txt]);
    container.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);
    container.on('pointerover', () => drawBg(0.9, 0.8));
    container.on('pointerout', () => drawBg(0.7, 0.5));
    container.on('pointerdown', () => drawBg(0.5, 0.3));
    container.on('pointerup', () => { drawBg(0.9, 0.8); cb(); });

    this.panel!.add(container);
  }

  // ── Toggle button ────────────────────────────────────────────────

  private createToggleButton(primary: number, accent: number): void {
    const cam = this.scene.cameras.main;
    const tb = this.scene.add.container(cam.width - 30, cam.height - 30);
    this.toggleBtn = tb;
    tb.setDepth(1001);
    tb.setScrollFactor(0);

    const circle = this.scene.add.graphics();
    const drawCircle = (fill: number, r: number) => {
      circle.clear();
      circle.fillStyle(fill, 0.9);
      circle.fillCircle(0, 0, r);
      circle.lineStyle(2, accent, 1);
      circle.strokeCircle(0, 0, r);
    };
    drawCircle(primary, 20);

    const icon = this.scene.add.text(0, 0, '≡', { fontSize: '24px', color: this.hexStr(accent) }).setOrigin(0.5);
    tb.add([circle, icon]);

    tb.setInteractive(new Phaser.Geom.Rectangle(-20, -20, 40, 40), Phaser.Geom.Rectangle.Contains);
    tb.on('pointerover', () => drawCircle(primary, 22));
    tb.on('pointerout', () => drawCircle(primary, 20));
    tb.on('pointerup', () => {
      this.isOpen = !this.isOpen;
      this.setOpen(this.isOpen);
      icon.setText(this.isOpen ? '×' : '≡');
    });
  }

  private setOpen(open: boolean): void {
    if (!this.panel) return;
    const cam = this.scene.cameras.main;
    const targetX = cam.width - 40;

    if (open) {
      this.panel.setVisible(true);
      this.scene.tweens.add({ targets: this.panel, x: targetX, duration: 300, ease: 'Power2' });
    } else {
      this.scene.tweens.add({
        targets: this.panel, x: targetX + 250, duration: 300, ease: 'Power2',
        onComplete: () => { this.panel?.setVisible(false); },
      });
    }
  }

  // ── Action handlers ──────────────────────────────────────────────

  private toggleAgentsLegend(): void {
    try {
      if (this.scene.agentsLegend) {
        const legends = this.scene.children.getAll().filter(
          (c: Phaser.GameObjects.GameObject) => c.name === 'legend-label' || c.name === 'legend-title'
        );
        legends.forEach((el: Phaser.GameObjects.GameObject) => this.scene.children.remove(el));
        this.scene.children.remove(this.scene.agentsLegend);
        this.scene.agentsLegend = null;
      } else {
        integrateAgentsLegend(this.scene as any);
        // Hide auto-generated titles
        const titles = this.scene.children.getAll().filter(
          (c: Phaser.GameObjects.GameObject) => c.name === 'legend-label' || c.name === 'legend-title'
        );
        titles.forEach((el: Phaser.GameObjects.GameObject) => (el as any).setVisible?.(false));
      }
    } catch (err) { console.error('[LabControlsMenu] toggleAgentsLegend:', err); }
  }

  private stimulateMovement(): void {
    const cam = this.scene.cameras.main;
    this.scene.agents.forEach(agent => {
      agent.moveTo(Math.random() * cam.width, Math.random() * cam.height);
    });
  }

  /** Chiude il pannello laterale per evitare sovrapposizioni */
  private closePanel(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.setOpen(false);
    }
  }

  private toggleLLMPanel(): void {
    try {
      if (this.llmControlPanel) {
        this.llmControlPanel.hide();
        setTimeout(() => { this.llmControlPanel?.destroy(); this.llmControlPanel = null; }, 300);
        return;
      }
      this.closePanel();
      // Posiziona a sinistra, lontano dal pannello Controlli Lab (destra)
      const x = 20;
      this.llmControlPanel = new LLMControlPanel(this.scene, x, 50, () => {
        this.llmControlPanel?.hide();
        setTimeout(() => { this.llmControlPanel?.destroy(); this.llmControlPanel = null; }, 300);
      });
      if (this.dialogController) this.llmControlPanel.setDialogController(this.dialogController);
    } catch (err) { console.error('[LabControlsMenu] toggleLLMPanel:', err); }
  }

  private toggleSimpleLLMPanel(): void {
    try {
      if (this.simpleLLMPanel) {
        this.simpleLLMPanel.toggle();
        return;
      }
      this.closePanel();
      // Posiziona a sinistra, lontano dal pannello Controlli Lab (destra)
      const x = 20;
      this.simpleLLMPanel = new SimpleLLMPanel(this.scene, x, 120);
      if (this.dialogController) this.simpleLLMPanel.setDialogController(this.dialogController);
      this.simpleLLMPanel.show();
    } catch (err) { console.error('[LabControlsMenu] toggleSimpleLLMPanel:', err); }
  }

  private testDialog(): void {
    if (this.scene.agents.length >= 2) {
      const [a1, a2] = this.scene.agents;
      this.scene.game.events.emit('agent-interaction', {
        agentId1: a1.getId(), agentId2: a2.getId(), type: 'test-dialog',
      });
    }
  }

  private toggleDebugDialogs(): void {
    if (this.scene.agentController?.toggleDebugger) {
      this.scene.agentController.toggleDebugger();
    }
  }

  private toggleAssetsDebug(): void {
    const { debugGraphics: dg, debugText: dt } = this.scene;
    if (dg && dt) {
      const show = !dg.visible;
      dg.setVisible(show);
      dt.setVisible(show);
      if (show) {
        const keys = this.scene.textures.getTextureKeys();
        this.scene.updateDebugInfo(
          `Scene: ${this.scene.scene.key}\nTextures: ${keys.length}\nAgents: ${this.scene.agents.length}`
        );
      }
    }
  }

  private showLabInfo(): void {
    const { primary, secondary, accent } = this.config.theme;
    const cam = this.scene.cameras.main;
    const info = this.scene.add.container(cam.centerX, cam.centerY).setDepth(1000);

    const bg = this.scene.add.graphics();
    bg.fillStyle(secondary, 0.95);
    bg.fillRoundedRect(-250, -200, 500, 400, 10);
    bg.lineStyle(3, primary, 1);
    bg.strokeRoundedRect(-250, -200, 500, 400, 10);
    info.add(bg);

    info.add(this.scene.add.text(0, -170, this.config.labName, {
      fontSize: '24px', color: this.hexStr(accent), fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5));

    info.add(this.scene.add.text(0, -80, this.config.labDescription, {
      fontSize: '15px', color: '#ffffff', align: 'center', wordWrap: { width: 450 },
    }).setOrigin(0.5, 0));

    const close = this.scene.add.text(230, -180, 'X', {
      fontSize: '20px', color: '#ffffff', backgroundColor: '#aa0000',
      padding: { left: 8, right: 8, top: 5, bottom: 5 },
    });
    close.setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => info.destroy());
    info.add(close);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private hexStr(n: number): string {
    return '#' + n.toString(16).padStart(6, '0');
  }
}
