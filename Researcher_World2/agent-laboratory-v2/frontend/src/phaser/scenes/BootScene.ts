import * as Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SCENE_KEYS } from '../game';

/**
 * BootScene è la prima scena che viene caricata ed è responsabile del 
 * pre-caricamento delle risorse essenziali prima di passare alla scena principale.
 */
export class BootScene extends BaseScene {
  // UI di caricamento
  private loadingBar!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  
  // Flag e contatori di debug
  private debugMode: boolean = true;
  private assetsLoaded: string[] = [];
  private errorMessages: string[] = [];

  constructor() {
    super('BootScene');
  }

  preload(): void {
    console.log('BootScene: Preloading assets...');
    
    // Creazione UI di caricamento
    this.createLoadingUI();
    
    // Configurazione gestione errori
    this.setupErrorHandler();
    
    console.log("Beginning asset loading...");
    
    // Caricamento assets UI base
    this.loadUIAssets();
    
    // Caricamento miniature laboratori con approccio multi-path
    this.loadLabMiniatures();
    
    // Caricamento sprite base per agenti
    this.loadAgentSprites();
    
    // Caricamento texture per connessioni della mappa
    this.loadMapAssets();
    
    // Aggiornamento progresso caricamento
    this.load.on('progress', (value: number) => {
      this.updateLoadingProgress(value);
    });
    
    // Completamento caricamento
    this.load.on('complete', () => {
      console.log('Asset loading complete!');
      this.displayLoadingSummary();
    });
  }

  create(): void {
    console.log('BootScene: Create phase started');
    
    // Se ci sono stati errori di caricamento, mostrali
    if (this.errorMessages.length > 0) {
      this.showErrorSummary();
      return;
    }
    
    // Elenca tutte le texture caricate con successo
    console.log("Successfully loaded textures:", Object.keys(this.textures.list));
    
    // Breve ritardo prima di passare alla scena principale
    let countdown = 2;
    const countdownInterval = setInterval(() => {
      countdown--;
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        console.log('BootScene: Transitioning to WorldMapScene');
        this.scene.start(SCENE_KEYS.WORLD_MAP);
      }
    }, 1000);
  }
  
  private createLoadingUI(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Sfondo
    this.add.rectangle(width/2, height/2, width, height, 0x000000);
    
    // Testo di caricamento
    this.loadingText = this.add.text(width/2, height/2 - 50, 'Loading Assets...', {
      fontSize: '24px',
      color: '#FFFFFF'
    }).setOrigin(0.5);
    
    // Sfondo barra di caricamento
    this.loadingBar = this.add.graphics();
    this.loadingBar.fillStyle(0x222222, 1);
    this.loadingBar.fillRect(width/2 - 160, height/2 - 25, 320, 50);
    
    // Barra di progresso
    this.progressBar = this.add.graphics();
  }
  
  private updateLoadingProgress(value: number): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Pulisci progresso precedente
    this.progressBar.clear();
    
    // Disegna nuovo progresso
    this.progressBar.fillStyle(0x00aa00, 1);
    this.progressBar.fillRect(width/2 - 150, height/2 - 15, 300 * value, 30);
    
    // Aggiorna testo
    const percent = Math.floor(value * 100);
    this.loadingText.setText(`Loading Assets... ${percent}%`);
  }
  
  private setupErrorHandler(): void {
    // Registra errori di caricamento
    this.load.on('filecomplete', (key: string) => {
      this.assetsLoaded.push(key);
      console.log(`Asset loaded: ${key}`);
    });
    
    this.load.on('loaderror', (file: any) => {
      console.error(`Error loading file: ${file.key} (${file.url})`);
      
      // Registra solo la prima occorrenza di ciascun percorso
      const errorMsg = `Failed to load: ${file.key} (${file.url})`;
      if (!this.errorMessages.includes(errorMsg)) {
        this.errorMessages.push(errorMsg);
      }
    });
  }
  
  private displayLoadingSummary(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Pulisci UI di progresso
    this.loadingBar.destroy();
    this.progressBar.destroy();
    this.loadingText.destroy();
    
    // Mostra riepilogo
    this.add.text(width/2, height/2 - 50, 'Asset Loading Complete', {
      fontSize: '24px',
      color: '#00FF00'
    }).setOrigin(0.5);
    
    // Mostra conteggio asset caricati
    this.add.text(width/2, height/2, 
      `Loaded ${Object.keys(this.textures.list).length - 1} textures`, {
      fontSize: '16px',
      color: '#FFFFFF'
    }).setOrigin(0.5);
    
    // Mostra conteggio errori, se presenti
    if (this.errorMessages.length > 0) {
      this.add.text(width/2, height/2 + 30, 
        `Errors: ${this.errorMessages.length} (see console for details)`, {
        fontSize: '16px',
        color: '#FF0000'
      }).setOrigin(0.5);
    }
    
    // Countdown alla prossima scena
    let countdown = 2;
    const countdownText = this.add.text(width/2, height/2 + 70, 
      `Continuing in ${countdown}...`, {
      fontSize: '14px',
      color: '#AAAAAA'
    }).setOrigin(0.5);
    
    const timer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        countdown--;
        if (countdown <= 0) {
          timer.destroy();
        } else {
          countdownText.setText(`Continuing in ${countdown}...`);
        }
      },
      callbackScope: this,
      repeat: countdown
    });
  }
  
  private showErrorSummary(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Titolo
    this.add.text(width/2, 100, 'Asset Loading Errors', {
      fontSize: '24px',
      color: '#FF0000'
    }).setOrigin(0.5);
    
    // Crea elenco errori scrollabile
    this.add.text(width/2, 150, 
      this.errorMessages.slice(0, 15).join('\n'), {
      fontSize: '12px',
      color: '#FFFFFF',
      align: 'left',
      wordWrap: { width: width - 100 }
    }).setOrigin(0.5, 0);
    
    // Aggiungi pulsante continua a prescindere dagli errori
    const continueButton = this.add.text(width/2, height - 100, 'Continue Anyway', {
      fontSize: '18px',
      color: '#FFFFFF',
      backgroundColor: '#AA0000',
      padding: { x: 15, y: 10 }
    }).setOrigin(0.5).setInteractive();
    
    continueButton.on('pointerdown', () => {
      this.scene.start(SCENE_KEYS.WORLD_MAP);
    });
  }

  private loadUIAssets(): void {
    // UI elements - tenta caricamento da percorsi multipli
    this.logAndLoad('image', 'logo', 'assets/ui/placeholder.png');
    this.logAndLoad('image', 'info-button', 'assets/ui/info-button.png');
    this.logAndLoad('image', 'info-button', 'assets/ui/placeholder.png');
    this.logAndLoad('image', 'settings-button', 'assets/ui/settings-button.png');
    this.logAndLoad('image', 'settings-button', 'assets/ui/placeholder.png');
    this.logAndLoad('image', 'close-button', 'assets/ui/close-button.png');
    this.logAndLoad('image', 'close-button', 'assets/ui/placeholder.png');
    
    // Background per la mappa mondiale
    this.logAndLoad('image', 'world-map-background', 'assets/ui/world-map-background.png');
    this.logAndLoad('image', 'world_map', 'assets/images/world_map.jpg');
    
    // Icone generiche
    this.logAndLoad('image', 'data-exchange-icon', 'assets/ui/data-exchange-icon.ico');
    this.logAndLoad('image', 'data_transfer', 'assets/images/data_transfer.png');
    this.logAndLoad('image', 'data_transfer', 'assets/images/data_transfer.jpg');
  }

  private loadLabMiniatures(): void {
    // Caricamento miniature laboratori con percorsi multipli
    const labIds = ['mercatorum', 'blekinge', 'opbg'];
    const extensions = ['.jpg', '.png', '.jpeg'];
    const pathFormats = [
      'assets/ui/%s-logo%s',
      'assets/ui/%s-miniature%s',
      'assets/images/labs/%s_preview%s',
      'assets/images/labs/%s_miniature%s',
      'assets/images/labs/%s%s',
      'assets/images/%s_miniature%s',
      'assets/images/%s%s'
    ];
    
    // Tenta varie combinazioni per trovare i percorsi corretti
    labIds.forEach(labId => {
      // Carica versioni personalizzate
      this.logAndLoad('image', `${labId}-miniature`, `assets/ui/${labId}-logo.png`);
      this.logAndLoad('image', `lab_${labId}_miniature`, `assets/ui/${labId}-logo.png`);
      this.logAndLoad('image', `${labId}`, `assets/images/labs/${labId}_preview.png`);
      
      // Tenta più combinazioni automaticamente
      pathFormats.forEach(format => {
        extensions.forEach(ext => {
          const key = `lab_${labId}_miniature`;
          const path = format.replace(/%s/g, (_, i) => i === 0 ? labId : ext);
          this.logAndLoad('image', key, path);
          
          // Carica anche con chiave del laboratorio
          this.logAndLoad('image', labId, path);
        });
      });
    });
    
    // Default/fallback
    this.logAndLoad('image', 'default_lab', 'assets/images/labs/default_preview.png');
  }

  private loadAgentSprites(): void {
    // Caricamento spritesheet principali (128x48, 4 frame da 32x48)
    // Caricati qui UNA volta, riutilizzati da tutte le scene (WorldMap, Lab scenes)
    const agentTypes = ['professor', 'researcher', 'student', 'doctor'];
    agentTypes.forEach(type => {
      if (!this.textures.exists(type)) {
        this.load.spritesheet(type, `assets/characters/${type}_spritesheet.png`, {
          frameWidth: 32,
          frameHeight: 48,
        });
        console.log(`Loading spritesheet: ${type}`);
      }
    });

    // Caricamento sprite statici per ricercatori (fallback)
    const researcherTypes = [
      'professor', 'professor_senior', 'researcher', 'student', 'student_postdoc',
      'doctor', 'engineer', 'sw_engineer', 'privacy_specialist'
    ];

    researcherTypes.forEach(type => {
      [
        `assets/images/agents/${type}.png`,
        `assets/images/agents/${type}.jpg`,
        `assets/sprites/${type}.png`,
      ].forEach(path => {
        this.logAndLoad('image', `researcher_${type}`, path);
      });
    });

    // Punto semplice per rappresentare agenti sulla mappa
    this.logAndLoad('image', 'agent-dot', 'assets/ui/placeholder.png');

    // Sprite di default
    this.logAndLoad('image', 'default_researcher', 'assets/images/agents/researcher.png');
  }

  private loadMapAssets(): void {
    // Asset per la visualizzazione delle connessioni sulla mappa
    this.logAndLoad('image', 'lab-connection', 'assets/ui/placeholder.png');
    this.logAndLoad('image', 'lab-connection-active', 'assets/ui/placeholder.png');
    this.logAndLoad('image', 'default_map', 'assets/images/default_map.jpg');
  }
  
  private logAndLoad(type: string, key: string, path: string): void {
    // Evita caricamento duplicato
    if (this.textures.exists(key)) {
      console.log(`Skipping duplicate load for ${key}`);
      return;
    }
    
    console.log(`Loading ${type}: ${key} from ${path}`);
    
    try {
      // Aggiungi al loader
      if (type === 'image') {
        this.load.image(key, path);
      } else if (type === 'spritesheet') {
        // Se spritesheet, aggiungi config appropriata
        this.load.spritesheet(key, path, { frameWidth: 32, frameHeight: 32 });
      }
    } catch (e) {
      console.error(`Error setting up load for ${key}:`, e);
    }
  }
}