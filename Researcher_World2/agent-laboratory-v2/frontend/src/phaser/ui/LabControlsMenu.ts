// frontend/src/phaser/ui/LabControlsMenu.ts
//
// Pannello condiviso "Controlli Lab" — unico per tutte e tre le scene.
// Contiene: Navigazione, Agenti, LLM, Test/Debug, Info Laboratorio.
// Responsive: larghezza e altezza cappate alla dimensione del canvas.

import * as Phaser from 'phaser';
import { SimpleLLMPanel } from './simple/SimpleLLMPanel';
import { LLMControlPanel } from './LLMControlPanel';
import { DialogController } from '../controllers/DialogController';
import { integrateAgentsLegend } from '../examples/AgentsLegendIntegration';
import type { IAgentScene as ILabControlScene } from '../types/IAgentScene';

// Re-export for consumers that import ILabControlScene from here
export type { IAgentScene as ILabControlScene } from '../types/IAgentScene';

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

// ── Size limits (fraction of camera) ────────────────────────────────
const MAX_PANEL_W_RATIO = 0.35;   // max 35% of canvas width
const MAX_PANEL_H_RATIO = 0.85;   // max 85% of canvas height
const MIN_PANEL_W = 180;
const MAX_PANEL_W = 240;

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

  // Canvas diagnostic
  private diagDiv: HTMLDivElement | null = null;
  private diagTimer: Phaser.Time.TimerEvent | null = null;

  // Panel geometry (computed in build)
  private panelW = 0;
  private panelH = 0;

  constructor(scene: ILabControlScene & Phaser.Scene, config: LabControlConfig) {
    this.scene = scene;
    this.config = config;
    // Chiudi eventuali sotto-pannelli React rimasti aperti da scene precedenti
    document.dispatchEvent(new CustomEvent('llm-panel-toggle', { detail: { visible: false } }));
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
    if (this.diagDiv) { this.diagDiv.remove(); this.diagDiv = null; }
    if (this.diagTimer) { this.diagTimer.remove(); this.diagTimer = null; }
    this.panel?.destroy(); this.panel = null;
    this.toggleBtn?.destroy(); this.toggleBtn = null;
  }

  // ── Build ────────────────────────────────────────────────────────

  private build(): void {
    const { primary, secondary, accent } = this.config.theme;
    const cam = this.scene.cameras.main;

    // Responsive panel width
    const maxW = Math.floor(cam.width * MAX_PANEL_W_RATIO);
    this.panelW = Phaser.Math.Clamp(maxW, MIN_PANEL_W, MAX_PANEL_W);
    const W = this.panelW;

    // Button dimensions scaled to panel
    const btnW = W - 30;
    const btnH = 26;
    const btnStep = 30;   // vertical step between buttons
    const sectionGap = 6;
    const sectionTitleH = 22;

    // --- Collect sections ---
    interface Section { title: string; buttons: { label: string; cb: () => void }[] }
    const sections: Section[] = [];

    // 1. Agenti
    sections.push({
      title: 'Agenti',
      buttons: [
        { label: 'Legenda Agenti', cb: () => this.toggleAgentsLegend() },
        { label: 'Stimola Movimento', cb: () => this.stimulateMovement() },
      ],
    });

    // 2. LLM Dialoghi (pannello React)
    sections.push({
      title: 'LLM Dialoghi',
      buttons: [
        { label: 'Apri/Chiudi Dialoghi', cb: () => this.toggleLLMDialogPanel() },
      ],
    });

    // 3. LLM Strumenti
    sections.push({
      title: 'LLM Strumenti',
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
        { label: 'Diagnostica Canvas', cb: () => this.toggleCanvasDiagnostic() },
      ],
    });

    // 5. Analytics
    sections.push({
      title: 'Analytics',
      buttons: [
        { label: 'Report Dialoghi', cb: () => this.showAnalyticsReport() },
        { label: 'Reset Analytics', cb: () => this.resetAnalytics() },
      ],
    });

    // 6. Informazioni
    sections.push({
      title: 'Informazioni',
      buttons: [
        { label: 'Info Laboratorio', cb: () => this.showLabInfo() },
      ],
    });

    // --- Compute total height (compact) ---
    let totalH = 40; // title bar + separator
    for (const s of sections) {
      totalH += sectionTitleH;
      totalH += s.buttons.length * btnStep;
      totalH += sectionGap;
    }
    totalH += 8; // bottom padding

    // Cap height to canvas
    const maxH = Math.floor(cam.height * MAX_PANEL_H_RATIO);
    this.panelH = Math.min(totalH, maxH);

    // --- Panel container ---
    const panelX = cam.width - 40;
    const panelY = cam.height - 40;

    const p = this.scene.add.container(panelX, panelY);
    this.panel = p;
    p.setDepth(1000);
    p.setScrollFactor(0);

    // IMPORTANT: start invisible — avoid dark-rectangle flash
    p.setVisible(false);
    p.setAlpha(0);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(secondary, 0.92);
    bg.fillRoundedRect(-W, -this.panelH, W, this.panelH, 8);
    bg.lineStyle(2, primary, 1);
    bg.strokeRoundedRect(-W, -this.panelH, W, this.panelH, 8);
    p.add(bg);

    // Title
    const title = this.scene.add.text(-W / 2, -this.panelH + 16, 'Controlli Lab', {
      fontSize: '15px', color: this.hexStr(accent), fontStyle: 'bold',
    }).setOrigin(0.5);
    p.add(title);

    // Separator
    const sep = this.scene.add.graphics();
    sep.lineStyle(1.5, primary, 0.8);
    sep.lineBetween(-W + 12, -this.panelH + 34, -12, -this.panelH + 34);
    p.add(sep);

    // --- Render sections ---
    let curY = -this.panelH + 42;

    for (const section of sections) {
      // Section title
      const sTitle = this.scene.add.text(-W + 14, curY, section.title, {
        fontSize: '12px', color: this.hexStr(accent), fontStyle: 'bold',
      });
      p.add(sTitle);
      curY += sectionTitleH;

      // Buttons
      for (const btn of section.buttons) {
        this.addButton(-W / 2, curY, btn.label, btn.cb, primary, accent, btnW, btnH);
        curY += btnStep;
      }
      curY += sectionGap;
    }

    // --- Toggle button (circle, bottom-right) ---
    this.createToggleButton(primary, accent);

    // Panel stays invisible — only shown on toggle click
  }

  // ── Button factory ───────────────────────────────────────────────

  private addButton(
    x: number, y: number, label: string, cb: () => void,
    primary: number, accent: number, bw: number, bh: number,
  ): void {
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    const drawBg = (alpha: number, borderAlpha: number) => {
      bg.clear();
      bg.fillStyle(primary, alpha);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 4);
      bg.lineStyle(1, accent, borderAlpha);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 4);
    };
    drawBg(0.7, 0.5);

    const txt = this.scene.add.text(0, 0, label, {
      fontSize: '12px', color: this.hexStr(accent), align: 'center',
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
    const tb = this.scene.add.container(cam.width - 24, cam.height - 24);
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
    drawCircle(primary, 16);

    const icon = this.scene.add.text(0, 0, '≡', { fontSize: '20px', color: this.hexStr(accent) }).setOrigin(0.5);
    tb.add([circle, icon]);

    tb.setInteractive(new Phaser.Geom.Rectangle(-16, -16, 32, 32), Phaser.Geom.Rectangle.Contains);
    tb.on('pointerover', () => drawCircle(primary, 18));
    tb.on('pointerout', () => drawCircle(primary, 16));
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
      // Show then slide in
      this.panel.setVisible(true);
      this.panel.setAlpha(1);
      this.panel.x = targetX + this.panelW + 20; // start off-screen
      this.scene.tweens.add({ targets: this.panel, x: targetX, duration: 250, ease: 'Power2' });
    } else {
      // Slide out then hide
      this.scene.tweens.add({
        targets: this.panel, x: targetX + this.panelW + 20, duration: 250, ease: 'Power2',
        onComplete: () => {
          if (this.panel) {
            this.panel.setVisible(false);
            this.panel.setAlpha(0);
          }
        },
      });
    }
  }

  // ── Action handlers ──────────────────────────────────────────────

  private toggleAgentsLegend(): void {
    try {
      if (this.scene.agentsLegend) {
        // Chiudi solo la legenda
        this.scene.agentsLegend.getContainer().destroy();
        this.scene.agentsLegend = null;
      } else {
        this.closeAllSubPanels();
        this.closePanel();
        integrateAgentsLegend(this.scene);
      }
    } catch (err) { console.error('[LabControlsMenu] toggleAgentsLegend:', err); }
  }

  private stimulateMovement(): void {
    const cam = this.scene.cameras.main;
    this.scene.agents.forEach(agent => {
      agent.moveTo(Math.random() * cam.width, Math.random() * cam.height);
    });
  }

  /** Apre/chiude il pannello React LLMDialogPanel via DOM event */
  private toggleLLMDialogPanel(): void {
    this.closeAllSubPanels();
    this.closePanel();
    document.dispatchEvent(new CustomEvent('llm-panel-toggle', { detail: {} }));
  }

  /** Chiude il pannello laterale per evitare sovrapposizioni */
  private closePanel(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.setOpen(false);
    }
  }

  /** Chiude tutti i sotto-pannelli aperti a sinistra */
  private closeAllSubPanels(): void {
    // Chiudi AgentsLegend
    if (this.scene.agentsLegend) {
      const legends = this.scene.children.getAll().filter(
        (c: Phaser.GameObjects.GameObject) => c.name === 'legend-label' || c.name === 'legend-title'
      );
      legends.forEach((el: Phaser.GameObjects.GameObject) => this.scene.children.remove(el));
      this.scene.agentsLegend.getContainer().destroy();
      this.scene.agentsLegend = null;
    }
    // Chiudi LLM Dashboard
    if (this.llmControlPanel) {
      this.llmControlPanel.hide();
      this.llmControlPanel.destroy();
      this.llmControlPanel = null;
    }
    // Chiudi SimpleLLMPanel
    if (this.simpleLLMPanel) {
      this.simpleLLMPanel.destroy();
      this.simpleLLMPanel = null;
    }
    // Chiudi LLM Dialog Panel (React) — forza chiusura esplicita
    document.dispatchEvent(new CustomEvent('llm-panel-toggle', { detail: { visible: false } }));
  }

  private toggleLLMPanel(): void {
    try {
      if (this.llmControlPanel) {
        this.llmControlPanel.hide();
        this.llmControlPanel.destroy();
        this.llmControlPanel = null;
        return;
      }
      this.closeAllSubPanels();
      this.closePanel();
      const x = 20;
      this.llmControlPanel = new LLMControlPanel(this.scene, x, 50, () => {
        this.llmControlPanel?.hide();
        this.llmControlPanel?.destroy();
        this.llmControlPanel = null;
      });
      if (this.dialogController) this.llmControlPanel.setDialogController(this.dialogController);
    } catch (err) { console.error('[LabControlsMenu] toggleLLMPanel:', err); }
  }

  private toggleSimpleLLMPanel(): void {
    try {
      if (this.simpleLLMPanel) {
        this.simpleLLMPanel.destroy();
        this.simpleLLMPanel = null;
        return;
      }
      this.closeAllSubPanels();
      this.closePanel();
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

    // Cap info panel to canvas size
    const infoW = Math.min(500, cam.width - 40);
    const infoH = Math.min(400, cam.height - 40);

    const info = this.scene.add.container(cam.centerX, cam.centerY).setDepth(1000);

    const bg = this.scene.add.graphics();
    bg.fillStyle(secondary, 0.95);
    bg.fillRoundedRect(-infoW / 2, -infoH / 2, infoW, infoH, 10);
    bg.lineStyle(3, primary, 1);
    bg.strokeRoundedRect(-infoW / 2, -infoH / 2, infoW, infoH, 10);
    info.add(bg);

    info.add(this.scene.add.text(0, -infoH / 2 + 30, this.config.labName, {
      fontSize: '20px', color: this.hexStr(accent), fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5));

    info.add(this.scene.add.text(0, -infoH / 2 + 70, this.config.labDescription, {
      fontSize: '13px', color: '#ffffff', align: 'center',
      wordWrap: { width: infoW - 40 },
    }).setOrigin(0.5, 0));

    const close = this.scene.add.text(infoW / 2 - 20, -infoH / 2 + 10, 'X', {
      fontSize: '18px', color: '#ffffff', backgroundColor: '#aa0000',
      padding: { left: 6, right: 6, top: 4, bottom: 4 },
    });
    close.setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => info.destroy());
    info.add(close);
  }

  // ── Analytics ──────────────────────────────────────────────────

  private analyticsOverlay: HTMLDivElement | null = null;

  private showAnalyticsReport(): void {
    // Toggle off
    if (this.analyticsOverlay) {
      this.analyticsOverlay.remove();
      this.analyticsOverlay = null;
      return;
    }

    const analytics = this.scene.dialogAnalytics;
    if (!analytics) {
      console.warn('[LabControlsMenu] DialogAnalytics not available');
      return;
    }

    const report = analytics.getReport();

    // Also print to console
    analytics.printReport();

    // Build HTML overlay
    const div = document.createElement('div');
    div.id = 'analytics-overlay';
    div.style.cssText =
      'position:fixed;top:20px;left:20px;z-index:99999;background:#1a1a2eee;color:#e0e0e0;' +
      'font:12px/1.5 monospace;padding:16px;max-height:80vh;max-width:600px;overflow:auto;' +
      'border:2px solid #4fc3f7;border-radius:8px;pointer-events:auto;';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Chiudi';
    closeBtn.style.cssText =
      'position:absolute;top:8px;right:8px;background:#c62828;color:#fff;border:none;' +
      'padding:4px 10px;border-radius:4px;cursor:pointer;font:12px monospace;';
    closeBtn.onclick = () => { div.remove(); this.analyticsOverlay = null; };
    div.appendChild(closeBtn);

    let html = `<h3 style="color:#4fc3f7;margin:0 0 12px">📊 Dialog Analytics Report</h3>`;
    html += `<div>Totale dialoghi: <b>${report.totalDialogs}</b></div>`;
    if (report.timespan) {
      html += `<div style="color:#888">Periodo: ${report.timespan.first.slice(11, 19)} → ${report.timespan.last.slice(11, 19)}</div>`;
    }

    // By Category
    html += `<h4 style="color:#ffb74d;margin:12px 0 4px">Per Categoria</h4>`;
    html += '<table style="width:100%;border-collapse:collapse">';
    for (const [cat, count] of Object.entries(report.byCategory).sort((a, b) => b[1] - a[1])) {
      const pct = report.totalDialogs > 0 ? ((count / report.totalDialogs) * 100).toFixed(1) : '0';
      html += `<tr><td style="padding:2px 8px">${cat}</td><td style="text-align:right"><b>${count}</b></td><td style="text-align:right;color:#888">${pct}%</td></tr>`;
    }
    html += '</table>';

    // By Agent
    html += `<h4 style="color:#ffb74d;margin:12px 0 4px">Per Agente</h4>`;
    html += '<table style="width:100%;border-collapse:collapse">';
    html += '<tr style="color:#888"><td>Nome</td><td>Ruolo</td><td>Tot</td><td>Init</td><td>Tgt</td></tr>';
    for (const [, ag] of Object.entries(report.byAgent).sort((a, b) => b[1].count - a[1].count)) {
      html += `<tr><td style="padding:2px 4px">${ag.name}</td><td style="color:#888">${ag.role.replace(/_portrait$/, '')}</td>` +
        `<td style="text-align:right"><b>${ag.count}</b></td>` +
        `<td style="text-align:right;color:#4caf50">${ag.asInitiator}</td>` +
        `<td style="text-align:right;color:#ff9800">${ag.asTarget}</td></tr>`;
    }
    html += '</table>';

    // By Role Pair
    html += `<h4 style="color:#ffb74d;margin:12px 0 4px">Per Coppia Ruoli</h4>`;
    html += '<table style="width:100%;border-collapse:collapse">';
    html += '<tr style="color:#888"><td>Coppia</td><td>N</td><td>Dist.media</td><td>Stessa stanza</td></tr>';
    for (const [pair, data] of Object.entries(report.byRolePair).sort((a, b) => b[1].count - a[1].count)) {
      html += `<tr><td style="padding:2px 4px">${pair}</td>` +
        `<td style="text-align:right"><b>${data.count}</b></td>` +
        `<td style="text-align:right">${data.avgDistance}px</td>` +
        `<td style="text-align:right">${data.sameRoomPct}%</td></tr>`;
    }
    html += '</table>';

    // By Room
    html += `<h4 style="color:#ffb74d;margin:12px 0 4px">Per Stanza</h4>`;
    html += '<table style="width:100%;border-collapse:collapse">';
    for (const [room, count] of Object.entries(report.byRoom).sort((a, b) => b[1] - a[1])) {
      html += `<tr><td style="padding:2px 8px">${room}</td><td style="text-align:right"><b>${count}</b></td></tr>`;
    }
    html += '</table>';

    // Proximity
    html += `<h4 style="color:#ffb74d;margin:12px 0 4px">Prossimità (px)</h4>`;
    const p = report.proximityStats;
    html += `<div>Media: <b>${p.avgDistance}</b> | Min: ${p.minDistance} | Max: ${p.maxDistance} | Mediana: ${p.medianDistance}</div>`;

    // Movement Triggers
    if (Object.keys(report.movementTriggers).length > 0) {
      html += `<h4 style="color:#ffb74d;margin:12px 0 4px">Movimenti Innescati</h4>`;
      html += '<table style="width:100%;border-collapse:collapse">';
      for (const [room, count] of Object.entries(report.movementTriggers).sort((a, b) => b[1] - a[1])) {
        html += `<tr><td style="padding:2px 8px">${room}</td><td style="text-align:right"><b>${count}</b></td></tr>`;
      }
      html += '</table>';
    }

    // Recent dialogs
    html += `<h4 style="color:#ffb74d;margin:12px 0 4px">Ultimi Dialoghi</h4>`;
    for (const d of report.recentDialogs.slice(-10)) {
      const time = d.wallClock.slice(11, 19);
      const dist = d.distance !== null ? `${d.distance}px` : '-';
      const target = d.targetName ? ` → ${d.targetName}` : '';
      const room = d.speakerRoom ?? '?';
      const cat = d.dialogCategory;
      const resp = d.isResponse ? ' [R]' : '';
      html += `<div style="margin:2px 0;font-size:11px;border-left:3px solid ${d.isResponse ? '#22aa88' : '#4fc3f7'};padding-left:6px">` +
        `<span style="color:#888">${time}</span> <b>${d.speakerName}</b>${target}${resp} ` +
        `<span style="color:#888">[${cat}]</span> <span style="color:#666">room:${room} dist:${dist}</span><br>` +
        `"${d.text.slice(0, 80)}${d.text.length > 80 ? '...' : ''}"</div>`;
    }

    const content = document.createElement('div');
    content.innerHTML = html;
    div.appendChild(content);
    document.body.appendChild(div);
    this.analyticsOverlay = div;
  }

  private resetAnalytics(): void {
    const analytics = this.scene.dialogAnalytics;
    if (analytics) {
      analytics.reset();
      // Close overlay if open
      if (this.analyticsOverlay) {
        this.analyticsOverlay.remove();
        this.analyticsOverlay = null;
      }
    }
  }

  // ── Canvas diagnostic ───────────────────────────────────────────

  private toggleCanvasDiagnostic(): void {
    // Toggle off if already active
    if (this.diagDiv) {
      this.diagDiv.remove();
      this.diagDiv = null;
      if (this.diagTimer) { this.diagTimer.remove(); this.diagTimer = null; }
      return;
    }

    const scene = this.scene;
    const children = scene.children.getAll();
    const lines: string[] = [];

    let idx = 0;
    for (const child of children) {
      const go = child as Phaser.GameObjects.GameObject & {
        x?: number; y?: number; width?: number; height?: number;
        displayWidth?: number; displayHeight?: number;
        scaleX?: number; scaleY?: number;
        depth?: number; alpha?: number; visible?: boolean;
        type?: string; texture?: { key?: string };
        list?: Phaser.GameObjects.GameObject[];
        commandBuffer?: number[];
      };

      const type = go.type ?? go.constructor?.name ?? '?';
      const depth = go.depth ?? 0;
      const alpha = go.alpha ?? 1;
      const visible = go.visible ?? true;

      const isGraphics = type === 'Graphics';
      const isContainer = type === 'Container';
      const childCount = isContainer && go.list ? go.list.length : 0;
      const cmdLen = isGraphics && go.commandBuffer ? go.commandBuffer.length : 0;

      const dw = go.displayWidth ?? (go.width ?? 0) * (go.scaleX ?? 1);
      const dh = go.displayHeight ?? (go.height ?? 0) * (go.scaleY ?? 1);

      if (isGraphics || isContainer || dw > 150 || dh > 150) {
        const texKey = go.texture?.key ?? '';
        const extra = isGraphics ? ` cmds=${cmdLen}` : isContainer ? ` kids=${childCount}` : '';
        lines.push(
          `#${idx} ${type} tex=${texKey} (${Math.round(go.x ?? 0)},${Math.round(go.y ?? 0)}) ` +
          `${Math.round(dw)}x${Math.round(dh)} d=${depth} a=${alpha.toFixed(1)} v=${visible}${extra}`
        );
      }
      idx++;
    }

    // DOM overlays scan
    const domLines: string[] = [];
    const gameDiv = document.getElementById('phaser-game');
    if (gameDiv) {
      const rect = gameDiv.getBoundingClientRect();
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        const pos = style.position;
        if (pos === 'absolute' || pos === 'fixed') {
          const elRect = el.getBoundingClientRect();
          if (elRect.width > 50 && elRect.height > 50 &&
              elRect.right > rect.left && elRect.left < rect.right &&
              elRect.bottom > rect.top && elRect.top < rect.bottom &&
              style.display !== 'none' && style.visibility !== 'hidden' &&
              parseFloat(style.opacity) > 0) {
            const tag = el.tagName.toLowerCase();
            const cls = typeof el.className === 'string' ? el.className.slice(0, 40) : '';
            domLines.push(
              `DOM <${tag}> cls="${cls}" ${Math.round(elRect.width)}x${Math.round(elRect.height)} ` +
              `at(${Math.round(elRect.left)},${Math.round(elRect.top)}) bg=${style.backgroundColor} z=${style.zIndex}`
            );
          }
        }
      });
    }

    // DOM overlay for results
    const div = document.createElement('div');
    div.id = 'phaser-diag';
    div.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:#000c;color:#ff0;' +
      'font:12px/1.4 monospace;padding:8px;max-height:50vh;overflow:auto;white-space:pre;pointer-events:auto;';
    div.textContent =
      `PHASER: ${lines.length} objects (${children.length} total)\n` + lines.join('\n') +
      `\n\nDOM OVERLAYS: ${domLines.length}\n` + domLines.join('\n');
    document.body.appendChild(div);
    this.diagDiv = div;

    // Repeat scan every 5s (6 times) to catch transient elements
    let repeatCount = 0;
    this.diagTimer = scene.time.addEvent({
      delay: 5000,
      repeat: 5,
      callback: () => {
        if (!this.diagDiv) return;
        repeatCount++;
        const now = scene.children.getAll();
        const containers = now.filter((c: any) => c.type === 'Container');
        const graphics = now.filter((c: any) => c.type === 'Graphics');
        const large = now.filter((c: any) => ((c as any).displayWidth ?? 0) > 100 || ((c as any).displayHeight ?? 0) > 100);
        const info = `\n--- REPEAT #${repeatCount} (t+${repeatCount * 5}s) total=${now.length} containers=${containers.length} graphics=${graphics.length} large=${large.length}`;
        const details = containers.map((c: any) => {
          const kids = (c.list || []).map((k: any, i: number) => {
            const kType = k.type ?? k.constructor?.name ?? '?';
            const kw = k.displayWidth ?? k.width ?? 0;
            const kh = k.displayHeight ?? k.height ?? 0;
            const tex = k.texture?.key ?? '';
            const text = k.text ? k.text.slice(0, 30) : '';
            return `    kid#${i} ${kType} ${Math.round(kw)}x${Math.round(kh)} tex=${tex} ${text ? `"${text}"` : ''}`;
          }).join('\n');
          return `  Container (${Math.round(c.x)},${Math.round(c.y)}) kids=${c.list?.length ?? 0} d=${c.depth} v=${c.visible} a=${c.alpha?.toFixed(1)}\n${kids}`;
        }).join('\n');
        this.diagDiv.textContent += info + (details ? '\n' + details : '');
      },
    });

    // Auto-close after 40s
    scene.time.delayedCall(40000, () => {
      if (this.diagDiv) { this.diagDiv.remove(); this.diagDiv = null; }
      if (this.diagTimer) { this.diagTimer.remove(); this.diagTimer = null; }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private hexStr(n: number): string {
    return '#' + n.toString(16).padStart(6, '0');
  }
}
