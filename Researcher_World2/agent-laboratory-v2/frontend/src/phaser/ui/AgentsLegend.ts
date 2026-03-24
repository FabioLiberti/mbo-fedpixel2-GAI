// frontend/src/phaser/ui/AgentsLegend.ts

import * as Phaser from 'phaser';
import { LegendInfoPanel, AgentTypeInfo } from './LegendInfoPanel';

/**
 * Componente che visualizza una legenda con tutti i tipi di agenti
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

  private agentTypes: Record<string, AgentTypeInfo> = {};
  private width: number = 240;
  private itemHeight: number = 42;
  private padding: number = 8;
  private isVisible: boolean = false;
  private expandedHeight: number = 0;
  private collapsedHeight: number = 36;
  private iconSize: number = 34;

  constructor(scene: Phaser.Scene, x: number, y: number, agentTypes: Record<string, AgentTypeInfo>) {
    this.scene = scene;
    this.agentTypes = agentTypes;

    const agentTypeCount = Object.keys(this.agentTypes).length;
    this.expandedHeight = this.collapsedHeight + (agentTypeCount * this.itemHeight) + this.padding;

    this.container = this.scene.add.container(x, y);
    this.container.setDepth(500);
    this.container.setScrollFactor(0);

    this.infoPanel = new LegendInfoPanel(this.scene);

    this.initializeGraphics();
    this.loadIconsAndCreateItems();
  }

  private initializeGraphics(): void {
    this.background = this.scene.add.graphics();
    this.container.add(this.background);

    // Titolo compatto con icona
    this.title = this.scene.add.text(
      this.padding + 4, this.padding,
      '👥 Agenti',
      { fontSize: '15px', color: '#e0e0e0', fontStyle: 'bold' }
    );
    this.container.add(this.title);

    // Toggle button
    this.toggleButton = this.scene.add.text(
      this.width - this.padding, this.padding,
      '▼',
      { fontSize: '14px', color: '#aaaaaa', padding: { left: 4, right: 4, top: 2, bottom: 2 } }
    );
    this.toggleButton.setOrigin(1, 0);
    this.toggleButton.setInteractive({ useHandCursor: true });
    this.toggleButton.on('pointerdown', () => {
      this.isExpanded ? this.collapse() : this.expand();
    });
    this.container.add(this.toggleButton);
  }

  public addDebugToggleButton(_callback: () => void): void {
    // Rimosso
  }

  private loadIconsAndCreateItems(): void {
    const toLoad: { key: string; path: string }[] = [];
    Object.entries(this.agentTypes).forEach(([agentType, info]) => {
      if (info.iconPath) {
        const iconKey = `icon_${agentType}`;
        if (!this.scene.textures.exists(iconKey)) {
          toLoad.push({ key: iconKey, path: info.iconPath });
        }
      }
    });

    if (toLoad.length > 0) {
      toLoad.forEach(({ key, path }) => this.scene.load.image(key, path));
      this.scene.load.once('complete', () => {
        this.createAgentItems();
        this.expand();
        this.show();
      });
      this.scene.load.start();
    } else {
      this.createAgentItems();
      this.expand();
      this.show();
    }
  }

  private createAgentItems(): void {
    this.agentItems.forEach(item => item.destroy());
    this.agentItems = [];

    let yPos = this.collapsedHeight;

    Object.entries(this.agentTypes).forEach(([agentType, info], index) => {
      const itemContainer = this.scene.add.container(0, yPos);
      const bgColor = Phaser.Display.Color.HexStringToColor(info.color).color;

      // Sfondo riga alternata
      const itemBg = this.scene.add.graphics();
      const rowAlpha = index % 2 === 0 ? 0.15 : 0.08;
      itemBg.fillStyle(bgColor, rowAlpha);
      itemBg.fillRect(0, 0, this.width, this.itemHeight);
      // Bordo sottile sinistro colorato
      itemBg.fillStyle(bgColor, 0.8);
      itemBg.fillRect(0, 0, 3, this.itemHeight);
      itemContainer.add(itemBg);

      // Icona con sfondo circolare scuro
      const iconX = this.padding + this.iconSize / 2 + 4;
      const iconY = this.itemHeight / 2;
      const iconBg = this.scene.add.graphics();
      iconBg.fillStyle(0x2a2a2a, 1);
      iconBg.fillCircle(iconX, iconY, this.iconSize / 2 + 2);
      iconBg.lineStyle(1.5, bgColor, 0.6);
      iconBg.strokeCircle(iconX, iconY, this.iconSize / 2 + 2);
      itemContainer.add(iconBg);

      const iconKey = `icon_${agentType}`;
      if (info.iconPath && this.scene.textures.exists(iconKey)) {
        const iconImage = this.scene.add.image(iconX, iconY, iconKey);
        const scale = this.iconSize / Math.max(iconImage.width, iconImage.height);
        iconImage.setScale(scale);
        itemContainer.add(iconImage);
      } else if (this.scene.textures.exists(agentType)) {
        const agentSprite = this.scene.add.sprite(iconX, iconY, agentType, 0);
        agentSprite.setScale(1.4);
        itemContainer.add(agentSprite);
      }

      // Testo titolo
      const textX = this.padding + this.iconSize + 14;
      const titleText = this.scene.add.text(textX, iconY, info.title, {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      titleText.setOrigin(0, 0.5);
      itemContainer.add(titleText);

      // Interattività
      itemBg.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, this.width, this.itemHeight),
        Phaser.Geom.Rectangle.Contains
      );

      itemBg.on('pointerdown', () => {
        const infoPanelX = this.container.x + this.width + 8;
        const infoPanelY = this.container.y;
        this.infoPanel.showAgentInfo(agentType, info, infoPanelX, infoPanelY);
      });

      itemBg.on('pointerover', () => {
        itemBg.clear();
        itemBg.fillStyle(bgColor, 0.35);
        itemBg.fillRect(0, 0, this.width, this.itemHeight);
        itemBg.fillStyle(bgColor, 1);
        itemBg.fillRect(0, 0, 3, this.itemHeight);
        titleText.setColor('#ffdd44');
      });

      itemBg.on('pointerout', () => {
        itemBg.clear();
        itemBg.fillStyle(bgColor, rowAlpha);
        itemBg.fillRect(0, 0, this.width, this.itemHeight);
        itemBg.fillStyle(bgColor, 0.8);
        itemBg.fillRect(0, 0, 3, this.itemHeight);
        titleText.setColor('#ffffff');
      });

      this.container.add(itemContainer);
      this.agentItems.push(itemContainer);
      yPos += this.itemHeight;
    });
  }

  public expand(): void {
    this.isExpanded = true;
    this.toggleButton.setText('▲');
    this.agentItems.forEach(item => item.setVisible(true));
    this.redrawBackground(this.expandedHeight);
    if (this.infoPanel.getIsVisible()) this.infoPanel.hide();
  }

  public collapse(): void {
    this.isExpanded = false;
    this.toggleButton.setText('▼');
    this.agentItems.forEach(item => item.setVisible(false));
    this.redrawBackground(this.collapsedHeight);
    if (this.infoPanel.getIsVisible()) this.infoPanel.hide();
  }

  private redrawBackground(height: number): void {
    this.background.clear();
    // Sfondo principale
    this.background.fillStyle(0x1a1a2e, 0.92);
    this.background.fillRoundedRect(0, 0, this.width, height, 8);
    // Bordo
    this.background.lineStyle(1.5, 0x555577, 0.7);
    this.background.strokeRoundedRect(0, 0, this.width, height, 8);
    // Linea separatrice sotto il titolo
    this.background.lineStyle(1, 0x444466, 0.5);
    this.background.lineBetween(8, this.collapsedHeight - 2, this.width - 8, this.collapsedHeight - 2);
  }

  public show(): void {
    this.container.setVisible(true);
    this.isVisible = true;
  }

  public hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
    this.infoPanel.hide();
  }

  public toggleVisibility(): void {
    this.isVisible ? this.hide() : this.show();
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public static async loadAgentTypesConfig(scene: Phaser.Scene): Promise<Record<string, AgentTypeInfo>> {
    return new Promise((resolve, reject) => {
      scene.load.json('agentTypesConfig', 'assets/config/agentTypes.json');
      scene.load.once('complete', () => {
        try {
          const config = scene.cache.json.get('agentTypesConfig');
          resolve(config);
        } catch (error) {
          console.error('Error loading agent types config:', error);
          reject(error);
        }
      });
      scene.load.start();
    });
  }
}
