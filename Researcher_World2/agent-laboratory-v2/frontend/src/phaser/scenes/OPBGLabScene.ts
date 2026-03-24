// frontend/src/phaser/scenes/OPBGLabScene.ts

import { BaseScene } from './BaseScene';
import { Agent, AgentState } from '../sprites/Agent';
import { LabTheme } from './BaseLabScene';
import { debugTextures, debugTextureKey } from '../utils/textureDebugHelper';
import { createAgent } from '../sprites/agentFactory';
import { AgentsLegend } from '../ui/AgentsLegend';
import { LabControlsMenu, type LabControlConfig } from '../ui/LabControlsMenu';
import { GlobalAgentController } from '../controllers/GlobalAgentController';
import { DialogEventTracker } from '../controllers/DialogEventTracker';
import { LAB_TYPES } from '../types/LabTypeConstants';

// Configurazione agenti OPBG (allineata al backend - 3 agenti)
const AGENT_CONFIG = {
  opbg: {
    agents: [
      {
        type: 'doctor',
        name: 'Matteo Ferri',
        position: { x: 300, y: 250 },
        specialization: 'clinical_data'
      },
      {
        type: 'student_postdoc',
        name: 'Marco Romano',
        position: { x: 150, y: 200 },
        specialization: 'data_science'
      },
      {
        type: 'engineer',
        name: 'Lorenzo Mancini',
        position: { x: 200, y: 150 },
        specialization: 'model_optimization'
      },
      {
        type: 'researcher',
        name: 'Giulia Conti',
        position: { x: 250, y: 180 },
        specialization: 'privacy_engineering'
      }
    ]
  }
};

export class OPBGLabScene extends BaseScene {
  // Agenti e interazioni
  public agents: Agent[] = [];
  protected interactionZones: Phaser.GameObjects.Zone[] = [];

  // Grid per il pathfinding
  protected grid: number[][] = [];

  // Elementi di debug
  public debugGraphics: Phaser.GameObjects.Graphics | null = null;
  public debugText: Phaser.GameObjects.Text | null = null;
  private assetsLoaded: boolean = false;
  private textureTestContainers: Phaser.GameObjects.Container[] = [];
  private rawSprites: Phaser.GameObjects.Sprite[] = [];

  public agentsLegend: AgentsLegend | null = null;

  // Controller e pannelli condivisi
  public agentController: GlobalAgentController | null = null;
  public dialogEventTracker: DialogEventTracker | null = null;
  private labControls: LabControlsMenu | null = null;
  
  // Tema del laboratorio OPBG
  protected theme: LabTheme = {
    name: "OPBG IRCCS Lab",
    backgroundColor: 0xf0f0f0, // Bianco
    tilesetKey: 'tiles_opbg',
    colorPalette: {
      primary: 0x00b8d4,    // Verde acqua
      secondary: 0xffb6c1,  // Rosa pallido
      accent: 0x4fc7ff,     // Blu cielo
      background: 0xffffff  // Bianco
    }
  };

  constructor() {
    super('OPBGLabScene');
    console.log('OPBGLabScene constructor called');
  }

  init(): void {
    console.log('OPBGLabScene init START');
    try {
      super.init();
      this.grid = [];
      this.agents = [];
      this.interactionZones = [];
      this.assetsLoaded = false;
      this.textureTestContainers = [];
      this.rawSprites = [];
      console.log('OPBGLabScene init COMPLETE');
    } catch (error) {
      console.error('Error in OPBGLabScene init:', error);
    }
  }

  preload() {
    console.log('OPBGLabScene preload START');
    try {
      // Chiama il preload del padre per caricare gli asset comuni
      super.preload();
      
      // Aggiungi listener per tracciare lo stato di caricamento
      this.load.on('progress', (value: number) => {
        console.log(`Load progress: ${Math.round(value * 100)}%`);
        this.updateDebugInfo(`Loading: ${Math.round(value * 100)}%`);
      });
      
      this.load.on('complete', () => {
        console.log('All assets loaded successfully');
        this.assetsLoaded = true;
        this.updateDebugInfo('Assets loaded - creating scene elements');
      });
      
      this.load.on('loaderror', (file: any) => {
        console.error(`Error loading file: ${file.key} from ${file.url}`);
        this.updateDebugInfo(`Error loading: ${file.key}`);
      });
      
      // OPBG: doctor, student_postdoc, engineer, researcher
      this.load.spritesheet('doctor', 'assets/characters/doctor_spritesheet.png', {
        frameWidth: 32,
        frameHeight: 48
      });

      this.load.spritesheet('student_postdoc', 'assets/characters/student_spritesheet.png', {
        frameWidth: 32,
        frameHeight: 48
      });

      this.load.spritesheet('engineer', 'assets/characters/engineer_spritesheet.png', {
        frameWidth: 32,
        frameHeight: 48
      });

      this.load.spritesheet('researcher', 'assets/characters/researcher_spritesheet.png', {
        frameWidth: 32,
        frameHeight: 48
      });

      // Carica risorse specifiche per questo laboratorio
      this.load.image('opbg_background', 'assets/labs/opbg/background.png');
      this.load.image('opbg_furniture', 'assets/labs/opbg/furniture.png');
      this.load.image('medical_icons', 'assets/labs/opbg/medical_icons.png');
      
      // Carica tileset specifico
      this.load.image(this.theme.tilesetKey, 'assets/tileset/opbg-tiles.png');
      
      // Carica la mappa
      this.load.tilemapJSON('opbg-map', 'assets/tilemaps/opbg-map.json');
      
      // Carica il file di configurazione degli agenti specifici per laboratorio
      this.load.json('labAgentTypesConfig', 'assets/config/labAgentTypes.json');
      
      // Carica il logo OPBG
      this.load.image('opbg-logo', 'assets/ui/opbg-logo.png');
      
      // Carica immagini di attrezzature mediche stilizzate
      this.load.image('medical_equipment', 'assets/labs/opbg/medical_equipment.png');
      this.load.image('patient_icons', 'assets/labs/opbg/patient_icons.png');
      
      console.log('OPBGLabScene preload COMPLETE');
    } catch (error) {
      console.error('Error in OPBGLabScene preload:', error);
      this.updateDebugInfo(`Preload error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  create() {
    console.log('OPBGLabScene create START');
    
    // Verifica immediata della texture 'doctor'
    if (this.textures.exists('doctor')) {
        console.log("Texture 'doctor' disponibile con", this.textures.get('doctor').frameTotal, "frames");
    } else {
        console.error("Texture 'doctor' NON disponibile");
    }

    try {
      // Inizializza gli elementi di debug (nascosti di default)
      this.createDebugElements();
      if (this.debugGraphics) this.debugGraphics.setVisible(false);
      if (this.debugText) this.debugText.setVisible(false);

      // Imposta un colore di sfondo acceso per debug
      this.cameras.main.setBackgroundColor(0xFF00FF); // Magenta vivace per debug
      
      // Crea placeholder per le texture mancanti
      this.createImprovedPlaceholders();
      
      // Esegui il debug completo delle texture
      this.runTextureDebug();
      
      // Visualizza asset disponibili
      this.displayLoadedAssets();
      
      // Crea texture di placeholder se necessario
      this.createMissingTextures();
      
      // Dopo il debug, usa il colore reale
      setTimeout(() => {
        this.cameras.main.setBackgroundColor(this.theme.backgroundColor);
      }, 1000);
      
      // Crea animazioni per i personaggi
      this.createAllCharacterAnimations();
      
      // Crea lo sfondo con tema ospedaliero pediatrico
      this.createHospitalBackground();
      
      // Crea una mappa base (temporanea)
      this.createTemporaryMap();
      
      // Inizializza la griglia per il pathfinding
      this.initializeGrid();
      
      // Crea le zone di interazione
      this.createInteractionZones();
      
      // Crea agenti da configurazione
      this.createAgentsFromConfig();
      
      // Setup della camera
      this.setupCamera();
      
      // Inizializza DialogEventTracker + GlobalAgentController
      this.dialogEventTracker = new DialogEventTracker(this);
      this.agentController = new GlobalAgentController(this, LAB_TYPES.OPBG);
      this.agentController.setSimulationAgents(this.agents);
      this.agentController.initDebugger();

      // Pannello "Controlli Lab" condiviso
      const controlConfig: LabControlConfig = {
        labId: 'opbg',
        labName: 'OPBG IRCCS Lab',
        labDescription:
          'Laboratorio di ricerca specializzato in federated learning\n' +
          'applicato alla medicina pediatrica e clinica.\n\n' +
          'Specializzazione in:\n' +
          '• Privacy engineering per dati sanitari sensibili\n' +
          '• Medical imaging con federated learning\n' +
          '• Equità e bias nei modelli clinici\n' +
          '• Compliance normativa per dati pediatrici',
        theme: {
          primary: this.theme.colorPalette.primary,    // 0x00b8d4
          secondary: 0x1a1a2e,                         // dark navy
          accent: 0xf5f5dc,                            // cream
        },
        navigation: [
          { label: '← Vai a Mercatorum Lab', sceneKey: 'MercatorumLabScene' },
          { label: '→ Vai a Blekinge Lab', sceneKey: 'BlekingeLabScene' },
        ],
      };
      this.labControls = new LabControlsMenu(this as any, controlConfig);
      const dc = this.agentController.getDialogController();
      if (dc) this.labControls.setDialogController(dc);

      // Titolo del laboratorio con stile "child-friendly"
      // Crea un container per tutto il titolo
      const titleContainer = this.add.container(this.cameras.main.centerX, 25);
      titleContainer.setDepth(10);

      // Calcoliamo la dimensione necessaria per il testo
      const tempText = this.add.text(
      0, 
      0,
      'OPBG IRCCS Lab',
      { 
          fontSize: '40px',
          fontFamily: 'Arial',
          fontStyle: 'bold'
      }
      );
      // Otteniamo la larghezza del testo e aggiungiamo del padding
      const textWidth = tempText.width + 60;
      const textHeight = tempText.height + 30;
      tempText.destroy(); // Rimuoviamo il testo temporaneo

      // Creiamo uno sfondo in stile child-friendly
      const titleBackground = this.add.graphics();
      // Ombra dello sfondo
      titleBackground.fillStyle(0xaaaaaa, 0.5);
      titleBackground.fillRoundedRect(-textWidth/2 - 5, -textHeight/2 - 5, textWidth + 10, textHeight + 10, 15);
      // Sfondo principale con colore verde acqua leggero
      titleBackground.fillStyle(0xb3e5fc, 0.8);
      titleBackground.fillRoundedRect(-textWidth/2, -textHeight/2, textWidth, textHeight, 15);
      // Bordo colorato in stile pediatrico
      titleBackground.lineStyle(3, 0x00b8d4, 1);
      titleBackground.strokeRoundedRect(-textWidth/2, -textHeight/2, textWidth, textHeight, 15);
      titleBackground.setDepth(5);

      // Aggiungiamo decorazioni "a bolle" per lo stile pediatrico
      const bubbles = this.add.graphics();
      bubbles.fillStyle(0xffb6c1, 0.6); // Rosa pallido
      bubbles.fillCircle(-textWidth/2 + 15, -textHeight/2 + 15, 8);
      bubbles.fillCircle(textWidth/2 - 15, -textHeight/2 + 15, 6);
      bubbles.fillStyle(0x4fc7ff, 0.6); // Blu cielo
      bubbles.fillCircle(-textWidth/2 + 12, textHeight/2 - 12, 7);
      bubbles.fillCircle(textWidth/2 - 12, textHeight/2 - 12, 9);
      bubbles.setDepth(6);
      
      // Aggiungiamo il background al container
      titleContainer.add(titleBackground);
      titleContainer.add(bubbles);

      // Ombra più profonda (livello 3)
      const textShadow3 = this.add.text(
      4, 
      4,
      'OPBG IRCCS Lab',
      { 
          fontSize: '40px',
          color: '#999999',
          align: 'center',
          fontFamily: 'Arial',
          fontStyle: 'bold'
      }
      );
      textShadow3.setOrigin(0.5);
      textShadow3.setDepth(7);
      textShadow3.setAlpha(0.5);
      titleContainer.add(textShadow3);

      // Ombra media (livello 2)
      const textShadow2 = this.add.text(
      3, 
      3,
      'OPBG IRCCS Lab',
      { 
          fontSize: '40px',
          color: '#aaaaaa',
          align: 'center',
          fontFamily: 'Arial',
          fontStyle: 'bold'
      }
      );
      textShadow2.setOrigin(0.5);
      textShadow2.setDepth(8);
      textShadow2.setAlpha(0.5);
      titleContainer.add(textShadow2);

      // Ombra vicina (livello 1)
      const textShadow = this.add.text(
      2, 
      2,
      'OPBG IRCCS Lab',
      { 
          fontSize: '40px',
          color: '#bbbbbb',
          align: 'center',
          fontFamily: 'Arial',
          fontStyle: 'bold'
      }
      );
      textShadow.setOrigin(0.5);
      textShadow.setDepth(9);
      textShadow.setAlpha(0.6);
      titleContainer.add(textShadow);

      // Testo principale con colore vivace
      const text = this.add.text(
      0, 
      0,
      'OPBG IRCCS Lab',
      { 
          fontSize: '40px',
          color: '#00b8d4', // Verde acqua
          align: 'center',
          fontFamily: 'Arial',
          fontStyle: 'bold'
      }
      );
      text.setOrigin(0.5);
      text.setDepth(10);
      titleContainer.add(text);

      // Aggiungiamo un effetto di brillantezza al testo che cambia tra colori pediatrici
      const colors = [0x00b8d4, 0xffb6c1, 0x4fc7ff];
      let colorIndex = 0;
      
      const glowTimeline = this.tweens.createTimeline();
      colors.forEach((color, index) => {
          glowTimeline.add({
              targets: text,
              duration: 2000,
              ease: 'Sine.easeInOut',
              alpha: { from: 0.8, to: 1 },
              yoyo: true,
              onUpdate: () => {
                  // Cambia colore gradualmente
                  const glowEffect = this.add.graphics();
                  glowEffect.fillStyle(color, 0.03);
                  glowEffect.fillCircle(0, 0, 30);
                  glowEffect.setDepth(9);
                  glowEffect.setBlendMode(Phaser.BlendModes.ADD);
                  titleContainer.add(glowEffect);
                  
                  // Pulisci vecchi effetti ogni tanto
                  if (Math.random() > 0.9) {
                      for (let i = 0; i < 5; i++) {
                          if (titleContainer.list.length > 10) {
                              titleContainer.list.pop();
                          }
                      }
                  }
              }
          });
      });
      
      glowTimeline.loop = -1;
      glowTimeline.play();

      // Aggiungiamo decorazioni di icone mediche stilizzate in stile pediatrico
      const medicalIcons = this.add.graphics();
      medicalIcons.fillStyle(0xffb6c1, 0.8); // Rosa pallido
      
      // Icona di un cuore stilizzato
      medicalIcons.fillCircle(textWidth/2 - 35, -textHeight/2 + 15, 6);
      medicalIcons.fillCircle(textWidth/2 - 25, -textHeight/2 + 15, 6);
      medicalIcons.fillTriangle(
          textWidth/2 - 40, -textHeight/2 + 18,
          textWidth/2 - 20, -textHeight/2 + 18,
          textWidth/2 - 30, -textHeight/2 + 28
      );
      
      // Icona di uno stetoscopio stilizzato
      medicalIcons.fillStyle(0x4fc7ff, 0.8); // Blu cielo
      medicalIcons.fillCircle(-textWidth/2 + 30, textHeight/2 - 15, 5);
      medicalIcons.fillRect(-textWidth/2 + 30, textHeight/2 - 10, 2, 10);
      medicalIcons.fillRect(-textWidth/2 + 25, textHeight/2 - 10, 10, 2);
      
      medicalIcons.setDepth(12);
      titleContainer.add(medicalIcons);

      console.log('OPBGLabScene create COMPLETE');
      
      // Forza l'attivazione della scena se non è già attiva
      if (!this.scene.isActive()) {
        console.log('OPBGLabScene not active, attempting to force activation');
        this.scene.setActive(true);
        this.scene.setVisible(true);
      }
      
    } catch (error) {
      console.error('Error in OPBGLabScene create:', error);
      this.updateDebugInfo(`Create error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Crea nuove texture placeholder direttamente nel formato corretto
   */
  private createMissingTextures(): void {
    try {
      const characterTypes = ['doctor', 'student_postdoc', 'engineer', 'researcher'];
      
      characterTypes.forEach(type => {
        if (!this.textures.exists(type)) {
          console.log(`Creating missing texture for ${type}`);
          this.createDirectPlaceholderTexture(type, 32, 48);
        } else {
          console.log(`Texture ${type} already exists`);
        }
      });
    } catch (error) {
      console.error('Error in createMissingTextures:', error);
    }
  }

  /**
   * Crea texture placeholder migliorate per vari tipi di personaggi
   */
  private createImprovedPlaceholders(): void {
    try {
      console.log('Creating improved placeholders for missing textures');
      
      // Lista dei tipi di personaggi che richiedono placeholder
      const characterTypes = ['doctor', 'student_postdoc', 'engineer', 'researcher'];
      
      // Definizione dei colori per tipo
      const typeColors: Record<string, { main: string; accent: string }> = {
        doctor: { main: '#8E24AA', accent: '#6A1B9A' },
        student_postdoc: { main: '#E65100', accent: '#BF360C' },
        engineer: { main: '#F44336', accent: '#C62828' },
        researcher: { main: '#43A047', accent: '#2E7D32' }
      };
      
      // Per ogni tipo, crea una texture placeholder migliorata
      characterTypes.forEach(type => {
        // Verifica se la texture esiste già
        if (this.textures.exists(type)) {
          console.log(`Texture ${type} già esiste, saltando creazione placeholder`);
          return;
        }
        
        console.log(`Creando texture placeholder migliorata per ${type}`);
        
        // Dimensioni frame
        const frameWidth = 32;
        const frameHeight = 48;
        
        // Numero di frame
        const frameCount = 4;
        
        // Dimensioni totali texture
        const canvasWidth = frameWidth;
        const canvasHeight = frameHeight * frameCount;
        
        // Crea un canvas
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error(`Impossibile ottenere contesto 2D per placeholder ${type}`);
          return;
        }
        
        // Ottieni i colori per questo tipo
        const colors = typeColors[type as keyof typeof typeColors] || 
                      { main: '#FF00FF', accent: '#AA00AA' };
        
        // Disegna i frame
        for (let frame = 0; frame < frameCount; frame++) {
          const frameY = frame * frameHeight;
          
          // Pulisci l'area del frame
          ctx.fillStyle = colors.main;
          ctx.fillRect(0, frameY, frameWidth, frameHeight);
          
          // Disegna il contorno
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.strokeRect(1, frameY + 1, frameWidth - 2, frameHeight - 2);
          
          // Disegna forme diverse per frame diversi (per simulare un'animazione)
          ctx.fillStyle = colors.accent;
          
          // Testa stilizzata
          ctx.beginPath();
          ctx.arc(frameWidth / 2, frameY + 12, 6, 0, Math.PI * 2);
          ctx.fill();
          
          // Corpo stilizzato che varia per frame
          ctx.fillStyle = '#FFFFFF';
          if (frame % 2 === 0) {
            // Frame pari - figura diritta
            ctx.fillRect(frameWidth / 2 - 5, frameY + 19, 10, 20);
          } else {
            // Frame dispari - figura in movimento
            ctx.fillRect(frameWidth / 2 - 5, frameY + 19, 10, 16);
            
            // Gambe in movimento
            ctx.beginPath();
            ctx.moveTo(frameWidth / 2 - 4, frameY + 35);
            ctx.lineTo(frameWidth / 2 - 1, frameY + 45);
            ctx.lineTo(frameWidth / 2 + 1, frameY + 45);
            ctx.lineTo(frameWidth / 2 + 4, frameY + 35);
            ctx.closePath();
            ctx.fill();
          }

          // Aggiungi elemento distintivo per tipo
          if (type === 'doctor') {
            // Stetoscopio stilizzato
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(frameWidth / 2, frameY + 24, 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(frameWidth / 2, frameY + 27);
            ctx.lineTo(frameWidth / 2, frameY + 32);
            ctx.stroke();
          } else if (type === 'engineer') {
            // Chiave inglese stilizzata
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(frameWidth / 2 + 8, frameY + 25);
            ctx.lineTo(frameWidth / 2 + 3, frameY + 30);
            ctx.lineTo(frameWidth / 2 + 8, frameY + 35);
            ctx.stroke();
          }
          
          // Etichetta con il tipo
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '6px Arial';
          ctx.textAlign = 'center';
          
          // Visualizza un'etichetta diversa su ciascun frame
          let label = type;
          if (frame === 1) label = 'frame ' + frame;
          if (frame === 2) label = 'walking';
          if (frame === 3) label = 'moving';
          
          ctx.fillText(label, frameWidth / 2, frameY + frameHeight - 5);
        }
        
        // Aggiungi il canvas come texture
        this.textures.addCanvas(type, canvas);
        
        // Definisci esplicitamente i frame
        const texture = this.textures.get(type);
        
        // Aggiungi frame individuali
        for (let i = 0; i < frameCount; i++) {
          texture.add(i, 0, 0, i * frameHeight, frameWidth, frameHeight);
        }
        
        // Aggiorna la texture
        texture.refresh();
        
        console.log(`Placeholder per ${type} creato con ${texture.frameTotal} frame`);
      });
      
      // Dopo aver creato i placeholder, crea le animazioni 
      // (perché le animazioni possono essere create solo dopo che le texture esistono)
      this.createCharacterAnimations();
      
    } catch (error) {
      console.error('Error in createImprovedPlaceholders:', error);
    }
  }

  /**
   * Crea una texture placeholder direttamente senza RenderTexture
   */
  private createDirectPlaceholderTexture(key: string, width: number, height: number): void {
    try {
      // Crea un canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height * 4; // Spazio per 4 frame
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Colori più vivaci per ambiente pediatrico
      const colors: Record<string, string> = {
        doctor: '#8E24AA',
        student_postdoc: '#E65100',
        engineer: '#F44336',
        researcher: '#43A047'
      };

      const color = colors[key] || '#FF00FF';
      
      // Disegna 4 frame diversi
      for (let i = 0; i < 4; i++) {
        // Sfondo
        ctx.fillStyle = color;
        ctx.fillRect(0, i * height, width, height);
        
        // Bordo
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, i * height + 2, width - 4, height - 4);
        
        // Texture design
        ctx.fillStyle = '#FFFFFF';
        
        if (i === 0 || i === 2) {
          // Triangolo per frame 0 e 2 (idle)
          ctx.beginPath();
          ctx.moveTo(width / 2, i * height + 10);
          ctx.lineTo(width / 2 - 8, i * height + 30);
          ctx.lineTo(width / 2 + 8, i * height + 30);
          ctx.closePath();
          ctx.fill();
        } else {
          // Cerchio per frame 1 e 3 (walking)
          ctx.beginPath();
          ctx.arc(width / 2, i * height + 20, 8, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fill();
        }
        
        // Testo con tipo personaggio
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '6px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(key, width / 2, i * height + height - 10);
      }
      
      // Crea la texture in Phaser
      this.textures.addCanvas(key, canvas);
      
      // Definisci i frame manualmente 
      const texture = this.textures.get(key);
      
      // Aggiungi i frame
      for (let i = 0; i < 4; i++) {
        texture.add(i, 0, 0, i * height, width, height);
      }
      
      // Aggiorna la texture
      texture.refresh();
      
      console.log(`Created direct placeholder texture for ${key} with ${texture.frameTotal} frames`);
    } catch (error) {
      console.error(`Error creating direct placeholder for ${key}:`, error);
    }
  }
  
  /**
   * Crea animazioni per tutti i tipi di personaggio
   * utilizzando le texture disponibili (reali o placeholder)
   */
  private createCharacterAnimations(): void {
    try {
      console.log('Creating animations for all character types');
      
      const characters = ['doctor', 'student_postdoc', 'engineer', 'researcher'];
      
      characters.forEach(char => {
        // Verifica se la texture esiste
        if (!this.textures.exists(char)) {
          console.error(`Cannot create animations for ${char}: texture does not exist`);
          return;
        }
        
        const texture = this.textures.get(char);
        if (!texture || texture.frameTotal <= 0) {
          console.error(`Cannot create animations for ${char}: texture has no frames`);
          return;
        }
        
        // frameTotal includes __BASE frame, subtract 1 for actual usable frames
        const actualFrames = Math.max(1, texture.frameTotal - 1);
        console.log(`Creating animations for ${char} with ${actualFrames} actual frames`);

        if (!this.anims.exists(`${char}_idle`)) {
          this.anims.create({
            key: `${char}_idle`,
            frames: this.anims.generateFrameNumbers(char, { frames: [0] }),
            frameRate: 1,
            repeat: 0
          });
        }

        if (!this.anims.exists(`${char}_walk`)) {
          const endWalk = Math.min(3, actualFrames - 1);
          this.anims.create({
            key: `${char}_walk`,
            frames: this.anims.generateFrameNumbers(char, { start: 0, end: endWalk }),
            frameRate: 6,
            repeat: -1
          });
        }

        if (!this.anims.exists(`${char}_working`)) {
          const endWork = Math.min(1, actualFrames - 1);
          this.anims.create({
            key: `${char}_working`,
            frames: this.anims.generateFrameNumbers(char, { start: 0, end: endWork }),
            frameRate: 3,
            repeat: -1
          });
        }

        if (!this.anims.exists(`${char}_discussing`)) {
          const discussFrames = actualFrames >= 4
            ? { frames: [0, 1, 0, 2] }
            : actualFrames >= 2
                ? { frames: [0, 1] }
                : { frames: [0] };
          this.anims.create({
            key: `${char}_discussing`,
            frames: this.anims.generateFrameNumbers(char, discussFrames),
            frameRate: 4,
            repeat: -1
          });
        }
      });

      console.log('All character animations created');
    } catch (error) {
      console.error('Error creating character animations:', error);
    }
  }

  /**
   * Metodo per eseguire un debug approfondito delle texture
   */
  private runTextureDebug(): void {
    try {
      console.log('Running texture debug checks');
      
      // Utilizziamo l'helper per il debug delle texture
      debugTextures(this);
      
      // Debug dettagliato delle texture che ci interessano
      const textureKeysToDebug = [
        'doctor', 'student_postdoc', 'engineer', 'researcher'
      ];
      
      textureKeysToDebug.forEach(key => {
        if (this.textures.exists(key)) {
          debugTextureKey(this, key);
        } else {
          console.warn(`Texture ${key} does not exist for debug`);
        }
      });
      
      this.updateDebugInfo('Texture debug completed. Check console for details.');
    } catch (error) {
      console.error('Error in runTextureDebug:', error);
    }
  }
  
  /**
   * Crea animazioni per tutti i tipi di personaggi
   */
  private createAllCharacterAnimations(): void {
    try {
      console.log('Creating animations for all character types');
      
      const characters = ['doctor', 'student_postdoc', 'engineer', 'researcher'];
      
      characters.forEach(char => {
        // Verifica se la texture esiste e ha frame
        if (!this.textures.exists(char)) {
          console.warn(`Cannot create animations for ${char}: texture does not exist`);
          return;
        }
        
        const texture = this.textures.get(char);
        if (!texture || texture.frameTotal <= 0) {
          console.warn(`Cannot create animations for ${char}: texture has no frames`);
          return;
        }
        
        // frameTotal includes __BASE frame, subtract 1 for actual usable frames
        const actualFrames = Math.max(1, texture.frameTotal - 1);
        console.log(`[All] Creating animations for ${char} with ${actualFrames} actual frames`);

        if (!this.anims.exists(`${char}_idle`)) {
          this.anims.create({
            key: `${char}_idle`,
            frames: this.anims.generateFrameNumbers(char, { start: 0, end: 0 }),
            frameRate: 1,
            repeat: 0
          });
        }

        if (!this.anims.exists(`${char}_walk`)) {
          const endWalk = Math.min(3, actualFrames - 1);
          this.anims.create({
            key: `${char}_walk`,
            frames: this.anims.generateFrameNumbers(char, { start: 0, end: endWalk }),
            frameRate: 6,
            repeat: -1
          });
        }

        if (!this.anims.exists(`${char}_working`)) {
          const endWork = Math.min(1, actualFrames - 1);
          this.anims.create({
            key: `${char}_working`,
            frames: this.anims.generateFrameNumbers(char, { start: 0, end: endWork }),
            frameRate: 3,
            repeat: -1
          });
        }

        if (!this.anims.exists(`${char}_discussing`)) {
          const discussFrames = actualFrames >= 4
            ? { frames: [0, 1, 0, 2] }
            : actualFrames >= 2
                ? { frames: [0, 1] }
                : { frames: [0] };
          this.anims.create({
            key: `${char}_discussing`,
            frames: this.anims.generateFrameNumbers(char, discussFrames),
            frameRate: 4,
            repeat: -1
          });
        }
      });

      console.log('All character animations created');
    } catch (error) {
      console.error('Error creating character animations:', error);
    }
  }

  /**
   * Crea lo sfondo con tema ospedaliero pediatrico
   */
  private createHospitalBackground() {
    try {
      console.log('Creating hospital background');
      
      // Prima verifica se l'immagine di sfondo è stata caricata
      if (this.textures.exists('opbg_background')) {
        console.log('Using loaded background image');
        const background = this.add.image(
          this.cameras.main.width / 2, 
          this.cameras.main.height / 2, 
          'opbg_background'
        );
        background.setDepth(-10);
        
        // Aggiusta le dimensioni per coprire lo schermo mantenendo le proporzioni
        if (background.width > 0 && background.height > 0) {
          // Calcola il fattore di scala appropriato
          const scaleX = this.cameras.main.width / background.width;
          const scaleY = this.cameras.main.height / background.height;
          const scale = Math.max(scaleX, scaleY); // Usa il valore maggiore per coprire tutto lo schermo
          
          background.setScale(scale);
          
          // Centra l'immagine
          background.setPosition(this.cameras.main.width / 2, this.cameras.main.height / 2);
        }
        
        this.updateDebugInfo('Using loaded background image');
        return;
      }
      
      // Se non è disponibile l'immagine, crea un pattern grafico
      this.updateDebugInfo('Creating fallback background pattern');
      
      // Crea un background a tema ospedaliero pediatrico
      const graphics = this.add.graphics();
      
      // Sfondo bianco
      graphics.fillStyle(this.theme.backgroundColor, 1);
      graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
      
      // Pattern a griglia leggera (simile a piastrelle)
      graphics.lineStyle(1, 0xeeeeee, 1);
      
      for (let x = 0; x < this.cameras.main.width; x += 32) {
        graphics.moveTo(x, 0);
        graphics.lineTo(x, this.cameras.main.height);
      }
      
      for (let y = 0; y < this.cameras.main.height; y += 32) {
        graphics.moveTo(0, y);
        graphics.lineTo(this.cameras.main.width, y);
      }
      
      // Bande decorative colorate in stile "child-friendly"
      const colors = [
        this.theme.colorPalette.primary,   // Verde acqua
        this.theme.colorPalette.secondary, // Rosa pallido
        this.theme.colorPalette.accent     // Blu cielo
      ];
      
      for (let i = 0; i < 5; i++) {
        const y = i * 100 + 50;
        const color = colors[i % colors.length];
        
        graphics.fillStyle(color, 0.1);
        graphics.fillRect(0, y, this.cameras.main.width, 20);
      }
      
      // Aggiungi decorazioni a bolle/cerchi in stile pediatrico
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * this.cameras.main.width;
        const y = Math.random() * this.cameras.main.height;
        const size = 5 + Math.random() * 15;
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        graphics.fillStyle(color, 0.05 + Math.random() * 0.1);
        graphics.fillCircle(x, y, size);
      }
      
      graphics.strokePath();
      graphics.setDepth(-10);
    } catch (error) {
      console.error('Error in createHospitalBackground:', error);
      this.updateDebugInfo(`Background error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Crea una mappa temporanea fino a quando non abbiamo un tilemap
   */
  private createTemporaryMap() {
    try {
      console.log('Creating temporary map');
      
      // Prima verifica se l'immagine del mobilio è stata caricata
      if (this.textures.exists('opbg_furniture')) {
        console.log('Using loaded furniture image');
        const furniture = this.add.image(
          this.cameras.main.width / 2, 
          this.cameras.main.height / 2, 
          'opbg_furniture'
        );
        furniture.setDepth(-5);
        
        // Impostazioni per debug
        this.updateDebugInfo('Using loaded furniture image');
        
        // Creazione di una griglia di base per il pathdinding
        this.createGridFromImage(furniture);
        return;
      }
      
      this.updateDebugInfo('Creating fallback furniture graphics');
      
      // Creazione di una griglia di base per il laboratorio
      const gridSize = 32;
      const width = Math.ceil(this.cameras.main.width / gridSize);
      const height = Math.ceil(this.cameras.main.height / gridSize);
      
      // Crea una griglia vuota
      this.grid = Array(height).fill(0).map(() => Array(width).fill(0));
      
      // Aggiungi elementi ospedalieri al laboratorio
      const furniture = this.add.graphics();
      
      // Area server room (dati sensibili)
      furniture.fillStyle(this.theme.colorPalette.primary, 0.2);
      furniture.lineStyle(2, this.theme.colorPalette.primary, 0.8);
      furniture.fillRoundedRect(
        width * gridSize / 2 - 80, 
        height * gridSize / 2 - 40, 
        160, 
        80,
        10
      );
      furniture.strokeRoundedRect(
        width * gridSize / 2 - 80, 
        height * gridSize / 2 - 40, 
        160, 
        80,
        10
      );
      
      // Testo identificativo
      this.add.text(
        width * gridSize / 2,
        height * gridSize / 2,
        'Server Room\nDati Sensibili',
        {
          fontSize: '14px',
          color: '#333333',
          align: 'center'
        }
      ).setOrigin(0.5);
      
      // Marca server room come non percorribile
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      for (let y = centerY - 1; y <= centerY + 1; y++) {
        for (let x = centerX - 2; x <= centerX + 2; x++) {
          if (y >= 0 && y < height && x >= 0 && x < width) {
            this.grid[y][x] = 1;
          }
        }
      }
      
      // Postazioni di lavoro
      furniture.fillStyle(this.theme.colorPalette.secondary, 0.7);
      
      // Postazioni sul lato sinistro
      for (let y = 2; y < height - 2; y += 3) {
        // Scrivania
        furniture.fillRect(gridSize, y * gridSize, gridSize * 2, gridSize);
        
        // Monitor doppi sopra la scrivania
        furniture.fillStyle(0x333333, 1);
        furniture.fillRect(gridSize + 5, y * gridSize - 20, gridSize / 2, gridSize / 3);
        furniture.fillRect(gridSize + gridSize / 2 + 10, y * gridSize - 20, gridSize / 2, gridSize / 3);
        
        // Schermi
        furniture.fillStyle(0xb3e5fc, 1);
        furniture.fillRect(gridSize + 7, y * gridSize - 18, gridSize / 2 - 4, gridSize / 3 - 4);
        furniture.fillRect(gridSize + gridSize / 2 + 12, y * gridSize - 18, gridSize / 2 - 4, gridSize / 3 - 4);
        
        furniture.fillStyle(this.theme.colorPalette.secondary, 0.7);
        
        // Marca come non percorribile
        if (y >= 0 && y < height) {
          this.grid[y][1] = 1;
          this.grid[y][2] = 1;
        }
      }
      
      // Area clinica con letti ospedalieri
      furniture.fillStyle(this.theme.colorPalette.accent, 0.2);
      furniture.lineStyle(2, this.theme.colorPalette.accent, 0.8);
      furniture.fillRoundedRect(
        width * gridSize - 200, 
        height * gridSize / 2 - 60, 
        180, 
        120,
        10
      );
      furniture.strokeRoundedRect(
        width * gridSize - 200, 
        height * gridSize / 2 - 60, 
        180, 
        120,
        10
      );
      
      // Testo identificativo
      this.add.text(
        width * gridSize - 110,
        height * gridSize / 2 - 50,
        'Area Clinica',
        {
          fontSize: '14px',
          color: '#333333',
          align: 'center'
        }
      ).setOrigin(0.5);
      
      // Letti ospedalieri
      furniture.fillStyle(0xffffff, 1);
      
      // Primo letto
      furniture.fillRect(width * gridSize - 180, height * gridSize / 2 - 30, 60, 30);
      furniture.fillStyle(0xb3e5fc, 0.5);
      furniture.fillRect(width * gridSize - 178, height * gridSize / 2 - 28, 56, 26);
      
      // Secondo letto
      furniture.fillStyle(0xffffff, 1);
      furniture.fillRect(width * gridSize - 100, height * gridSize / 2 - 30, 60, 30);
      furniture.fillStyle(0xb3e5fc, 0.5);
      furniture.fillRect(width * gridSize - 98, height * gridSize / 2 - 28, 56, 26);
      
      // Terzo letto
      furniture.fillStyle(0xffffff, 1);
      furniture.fillRect(width * gridSize - 180, height * gridSize / 2 + 30, 60, 30);
      furniture.fillStyle(0xb3e5fc, 0.5);
      furniture.fillRect(width * gridSize - 178, height * gridSize / 2 + 32, 56, 26);
      
      // Quarto letto
      furniture.fillStyle(0xffffff, 1);
      furniture.fillRect(width * gridSize - 100, height * gridSize / 2 + 30, 60, 30);
      furniture.fillStyle(0xb3e5fc, 0.5);
      furniture.fillRect(width * gridSize - 98, height * gridSize / 2 + 32, 56, 26);
      
      // Marca area clinica come parzialmente non percorribile
      for (let y = Math.floor(height / 2) - 2; y <= Math.floor(height / 2) + 2; y++) {
        for (let x = width - 6; x < width; x++) {
          if (y >= 0 && y < height && x >= 0 && x < width) {
            // Marca solo i punti dove ci sono i letti
            if ((y === Math.floor(height / 2) - 1 || y === Math.floor(height / 2) + 1) && 
                (x === width - 5 || x === width - 3)) {
              this.grid[y][x] = 1;
            }
          }
        }
      }
      
      // Aggiungi alcuni dettagli pediatrici colorati
      furniture.fillStyle(this.theme.colorPalette.secondary, 0.5);
      // Disegni a forma di stelle
      furniture.fillStar(50, 50, 5, 10, 15);
      furniture.fillStar(width * gridSize - 50, 50, 5, 10, 15);
      
      furniture.fillStyle(this.theme.colorPalette.primary, 0.5);
      // Disegni a forma di cuore (approssimati con cerchi e triangoli)
      furniture.fillCircle(50, height * gridSize - 50, 10);
      furniture.fillCircle(70, height * gridSize - 50, 10);
      furniture.fillTriangle(
        40, height * gridSize - 45,
        80, height * gridSize - 45,
        60, height * gridSize - 25
      );
      
      furniture.setDepth(-5);
    } catch (error) {
      console.error('Error in createTemporaryMap:', error);
      this.updateDebugInfo(`Map error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Crea una griglia di pathfinding basata su un'immagine
   */
  private createGridFromImage(image: Phaser.GameObjects.Image): void {
    try {
      const gridSize = 32;
      const width = Math.ceil(this.cameras.main.width / gridSize);
      const height = Math.ceil(this.cameras.main.height / gridSize);
      
      // Crea una griglia base
      this.grid = Array(height).fill(0).map(() => Array(width).fill(0));
      
      // In una versione avanzata, qui analizzeremmo i pixel dell'immagine
      // Per semplicità, creiamo solo una zona non attraversabile al centro (server room)
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      
      // Marca un'area centrale come non attraversabile (server room)
      for (let y = centerY - 1; y <= centerY + 1; y++) {
        for (let x = centerX - 2; x <= centerX + 2; x++) {
          if (y >= 0 && y < height && x >= 0 && x < width) {
            this.grid[y][x] = 1;
          }
        }
      }
      
      // Marca i letti come non attraversabili
      const bedPositions = [
        { x: width - 5, y: centerY - 1 },
        { x: width - 3, y: centerY - 1 },
        { x: width - 5, y: centerY + 1 },
        { x: width - 3, y: centerY + 1 }
      ];
      
      bedPositions.forEach(pos => {
        if (pos.y >= 0 && pos.y < height && pos.x >= 0 && pos.x < width) {
          this.grid[pos.y][pos.x] = 1;
        }
      });
    } catch (error) {
      console.error('Error in createGridFromImage:', error);
    }
  }
  
  /**
   * Inizializza la griglia per il pathfinding
   */
  protected initializeGrid(): void {
    try {
      // Nota: in una versione completa, qui leggeremmo da un tilemap
      // Per ora utilizziamo la griglia creata in createTemporaryMap
      console.log('Grid initialized with dimensions:', this.grid.length, 'x', this.grid[0]?.length);
    } catch (error) {
      console.error('Error in initializeGrid:', error);
    }
  }
  
  /**
   * Crea le zone di interazione nel laboratorio
   */
  protected createInteractionZones(): void {
    try {
      console.log('Creating interaction zones');
      const gridSize = 32;
      
      // Area server room per dati sensibili
      const serverZone = this.add.zone(
        this.cameras.main.width / 2, 
        this.cameras.main.height / 2, 
        gridSize * 4, 
        gridSize * 2
      );
      serverZone.setName('server_room');
      serverZone.setInteractive();
      
      // Debug: visualizza la zona
      const zoneGraphics = this.add.graphics();
      zoneGraphics.lineStyle(2, 0x00ff00, 0.5);
      zoneGraphics.strokeRect(
        serverZone.x - serverZone.width / 2, 
        serverZone.y - serverZone.height / 2, 
        serverZone.width, 
        serverZone.height
      );
      
      this.interactionZones.push(serverZone);
      
      // Area clinica con letti ospedalieri
      const clinicalZone = this.add.zone(
        this.cameras.main.width - 120, 
        this.cameras.main.height / 2, 
        gridSize * 6, 
        gridSize * 4
      );
      clinicalZone.setName('clinical_area');
      clinicalZone.setInteractive();
      
      // Debug: visualizza la zona
      zoneGraphics.lineStyle(2, 0x00ff00, 0.5);
      zoneGraphics.strokeRect(
        clinicalZone.x - clinicalZone.width / 2, 
        clinicalZone.y - clinicalZone.height / 2, 
        clinicalZone.width, 
        clinicalZone.height
      );
      
      this.interactionZones.push(clinicalZone);
      
      // Area postazioni per analisi medicali
      const analysisZone = this.add.zone(
        gridSize * 2, 
        gridSize * 3, 
        gridSize * 3, 
        gridSize * 4
      );
      analysisZone.setName('analysis_station');
      analysisZone.setInteractive();
      
      // Debug: visualizza la zona
      zoneGraphics.lineStyle(2, 0x00ff00, 0.5);
      zoneGraphics.strokeRect(
        analysisZone.x - analysisZone.width / 2, 
        analysisZone.y - analysisZone.height / 2, 
        analysisZone.width, 
        analysisZone.height
      );
      
      this.interactionZones.push(analysisZone);
      
      // Area bacheca con immagini di pazienti
      const boardZone = this.add.zone(
        this.cameras.main.width / 2, 
        gridSize, 
        this.cameras.main.width - 200, 
        gridSize * 2
      );
      boardZone.setName('patient_board');
      boardZone.setInteractive();
      
      // Debug: visualizza la zona
      zoneGraphics.lineStyle(2, 0x00ff00, 0.5);
      zoneGraphics.strokeRect(
        boardZone.x - boardZone.width / 2, 
        boardZone.y - boardZone.height / 2, 
        boardZone.width, 
        boardZone.height
      );
      
      this.interactionZones.push(boardZone);
    } catch (error) {
      console.error('Error in createInteractionZones:', error);
    }
  }
  
  /**
   * Configura la camera
   */
  protected setupCamera(): void {
    try {
      console.log('Setting up camera');
      // Imposta i limiti della camera alle dimensioni del canvas
      this.cameras.main.setBounds(0, 0, this.cameras.main.width, this.cameras.main.height);
      
      // Zoom iniziale
      this.cameras.main.setZoom(1);
      
      // Posiziona la camera al centro
      this.cameras.main.centerOn(this.cameras.main.width / 2, this.cameras.main.height / 2);
      
      // Zoom e trascinamento disabilitati nelle scene lab
    } catch (error) {
      console.error('Error in setupCamera:', error);
    }
  }
  
  /**
   * Crea i pulsanti di navigazione tra laboratori
   */
  // createNavigationButtons — ora gestito da LabControlsMenu
  
  /**
   * Aggiorna tutti gli agenti
   */
  protected updateAgents(time: number, delta: number): void {
    this.agents.forEach(agent => {
      if (typeof agent.update === 'function') {
        agent.update(time, delta);
      }
    });
  }
  
  /**
   * Controlla le interazioni tra agenti e con l'ambiente
   */
  protected checkInteractions(): void {
    try {
      // Controlla interazioni agente-agente
      for (let i = 0; i < this.agents.length; i++) {
        for (let j = i + 1; j < this.agents.length; j++) {
          const agent1 = this.agents[i];
          const agent2 = this.agents[j];
          
          const distance = Phaser.Math.Distance.Between(
            agent1.x, agent1.y,
            agent2.x, agent2.y
          );
          
          // Se gli agenti sono abbastanza vicini, possono interagire
          if (distance < 32) {
            this.handleAgentInteraction(agent1, agent2);
          }
        }
      }
      
      // Controlla interazioni agente-zona
      this.agents.forEach(agent => {
        this.interactionZones.forEach(zone => {
          const bounds = zone.getBounds();
          if (bounds.contains(agent.x, agent.y)) {
            this.handleZoneInteraction(agent, zone);
          }
        });
      });
    } catch (error) {
      console.error('Error in checkInteractions:', error);
    }
  }
  
  /**
   * Gestisce l'interazione tra due agenti
   */
  protected handleAgentInteraction(agent1: Agent, agent2: Agent): void {
    try {
      // Debug: mostra un'interazione tra agenti
      console.log(`Agent interaction between ${agent1.name} and ${agent2.name}`);
      
      // Esempio: crea una bolla di dialogo temporanea
      const dialogPosition = {
        x: (agent1.x + agent2.x) / 2,
        y: Math.min(agent1.y, agent2.y) - 20
      };
      
      const dialogBubble = this.add.graphics();
      dialogBubble.fillStyle(0xffffff, 0.9); // Bianco per la bolla di dialogo
      dialogBubble.fillRoundedRect(dialogPosition.x - 40, dialogPosition.y - 15, 80, 30, 10);
      dialogBubble.setDepth(100);
      
      // Emoji per la conversazione in tema medico
      const dialogText = this.add.text(
        dialogPosition.x, 
        dialogPosition.y, 
        '🩺', // Emoji medica
        { fontSize: '20px' }
      );
      dialogText.setOrigin(0.5);
      dialogText.setDepth(101);
      
      // Rimuovi la bolla dopo un po'
      this.time.delayedCall(2000, () => {
        dialogBubble.destroy();
        dialogText.destroy();
      });
    } catch (error) {
      console.error('Error in handleAgentInteraction:', error);
    }
  }
  
  /**
   * Gestisce l'interazione tra un agente e una zona
   */
  protected handleZoneInteraction(agent: Agent, zone: Phaser.GameObjects.Zone): void {
    try {
      // Debug: mostra un'interazione con la zona
      console.log(`Agent ${agent.name} interacting with zone ${zone.name}`);
      
      // Esempio: mostra un'icona sopra l'agente in base alla zona
      let iconText = '❓';
      
      if (zone.name === 'server_room') {
        iconText = '🔒'; // Privacy dei dati
      } else if (zone.name === 'clinical_area') {
        iconText = '🛏️'; // Letto ospedaliero
      } else if (zone.name === 'analysis_station') {
        iconText = '💻'; // Computer
      } else if (zone.name === 'patient_board') {
        iconText = '📋'; // Cartella clinica
      }
      
      const iconPosition = {
        x: agent.x,
        y: agent.y - 30
      };
      
      // Aggiungi l'icona
      const icon = this.add.text(
        iconPosition.x, 
        iconPosition.y, 
        iconText, 
        { fontSize: '24px' }
      );
      icon.setOrigin(0.5);
      icon.setDepth(100);
      
      // Rimuovi l'icona dopo un po'
      this.time.delayedCall(1500, () => {
        icon.destroy();
      });
    } catch (error) {
      console.error('Error in handleZoneInteraction:', error);
    }
  }
  
  /**
   * Trova un percorso tra due punti usando una versione semplificata dell'algoritmo A*
   */
  protected findPath(startX: number, startY: number, targetX: number, targetY: number): {x: number, y: number}[] {
    // Implementazione semplificata che restituisce un percorso diretto
    // In una versione completa, qui andrebbe implementato l'algoritmo A*
    const path = [
      { x: startX, y: startY },
      { x: targetX, y: targetY }
    ];
    
    return path;
  }

  /**
   * Crea agenti utilizzando la configurazione predefinita
   */
  private createAgentsFromConfig(): void {
    try {
      console.log('Creating agents from configuration');
      
      // Ottieni configurazione per OPBG
      const opbgConfig = AGENT_CONFIG.opbg;
      
      if (!opbgConfig || !opbgConfig.agents || opbgConfig.agents.length === 0) {
        console.warn('No agent configuration found for OPBG');
        return;
      }
      
      // Crea agenti dalla configurazione
      opbgConfig.agents.forEach((agentConfig: {
        type: string;
        name: string;
        position: { x: number; y: number };
        specialization?: string;
      }) => {
        try {
          console.log(`Creating agent: ${agentConfig.name} (${agentConfig.type})`);
          
          // Verifica se la texture esiste
          if (!this.textures.exists(agentConfig.type)) {
            console.warn(`Texture for ${agentConfig.type} does not exist, creating placeholder`);
            this.createDirectPlaceholderTexture(agentConfig.type, 32, 48);
          }
          
          // Crea l'agente con scala 2.5 (o scegli un altro valore appropriato)
          const agent = createAgent(this, {
            type: agentConfig.type,
            name: agentConfig.name,
            position: agentConfig.position,
            role: agentConfig.type,
            scale: 5 // Definisce un fattore di scala maggiore per tutti gli agenti
          });
          
          // Aggiungi l'agente alla scena e alla lista
          this.add.existing(agent);
          this.agents.push(agent);
          
          // Imposta lo stato iniziale
          agent.changeState(AgentState.IDLE);
          
          console.log(`Agent ${agentConfig.name} created successfully`);
        } catch (error) {
          console.error(`Error creating agent ${agentConfig.name}:`, error);
        }
      });
      
      console.log(`Created ${this.agents.length} agents`);
    } catch (error) {
      console.error('Error in createAgentsFromConfig:', error);
    }
  }
  
  /**
   * Crea elementi per il debug visivo
   */
  private createDebugElements(): void {
    try {
      // Crea un pannello di debug per mostrare informazioni sugli asset
      this.debugGraphics = this.add.graphics();
      
      if (this.debugGraphics) {
        this.debugGraphics.fillStyle(0x000000, 0.7);
        this.debugGraphics.fillRect(10, 10, 400, 200);
        this.debugGraphics.setDepth(1000);
        this.debugGraphics.setScrollFactor(0);
      }
      
      // Testo di debug
      this.debugText = this.add.text(
        20, 
        20, 
        'Debug info loading...', 
        { 
          fontSize: '14px',
          color: '#FFFFFF',
          fontFamily: 'monospace',
          wordWrap: { width: 380 }
        }
      );
      
      if (this.debugText) {
        this.debugText.setDepth(1001);
        this.debugText.setScrollFactor(0);
      }
      
      // Pulsante per nascondere/mostrare il debug
      const toggleButton = this.add.text(
        410, 
        10, 
        'X', 
        { 
          fontSize: '16px',
          color: '#FFFFFF',
          backgroundColor: '#FF0000',
          padding: { left: 5, right: 5, top: 2, bottom: 2 }
        }
      );
      
      if (toggleButton) {
        toggleButton.setDepth(1001);
        toggleButton.setScrollFactor(0);
        toggleButton.setVisible(false);
        toggleButton.setInteractive({ useHandCursor: true });
        toggleButton.on('pointerdown', () => {
          if (this.debugGraphics !== null && this.debugText !== null) {
            const visible = !this.debugGraphics.visible;
            this.debugGraphics.setVisible(visible);
            this.debugText.setVisible(visible);
            toggleButton.setText(visible ? 'X' : 'D');
          }
        });
      }
    } catch (error) {
      console.error('Error creating debug elements:', error);
    }
  }
  
  /**
   * Aggiorna le informazioni di debug
   */
  private updateDebugInfo(text: string): void {
    // MODIFICATO: verifica che il debugText sia definito e ancora valido
    if (this.debugText && this.debugText.scene) {
      try {
        this.debugText.setText(text);
      } catch (error) {
        console.error('Error in updateDebugInfo:', error);
      }
    } else {
      console.log('Debug info update (skipped - no valid debug text):', text);
    }
  }
  
  /**
   * Visualizza informazioni sugli asset caricati
   */
  private displayLoadedAssets(): void {
    try {
      const textureKeys = this.textures.getTextureKeys();
      const infoText = `
        Scene: ${this.scene.key}
        Loaded textures: ${textureKeys.length}
        Keys: ${textureKeys.slice(0, 5).join(', ')}${textureKeys.length > 5 ? '...' : ''}
        Animation count: ${this.anims.getAll().length}
      `;
      
      this.updateDebugInfo(infoText);
      console.log(infoText);
    } catch (error) {
      console.error('Error displaying loaded assets:', error);
    }
  }

  /**
   * Crea una legenda specifica per il laboratorio OPBG
   */
  // createOPBGLegend, createLabInfoButton, showLabInfo — ora gestiti da LabControlsMenu

  update(time: number, delta: number) {
    try {
      // Aggiorna tutti gli agenti
      this.updateAgents(time, delta);
      
      // Controlla le interazioni
      this.checkInteractions();
    } catch (error) {
      console.error('Error in OPBGLabScene update:', error);
    }
  }

  /**************************
  *************************** 
/**
 * Metodo chiamato quando la scena viene distrutta
 * Esegue la pulizia di tutte le risorse
 */
destroy(): void {
  try {
    // Assicurati che tutti gli elementi siano distrutti
    if (this.agentsLegend) {
      this.agentsLegend = null;
    }
    
    // Pulisci tutti gli agenti
    this.agents.forEach(agent => {
      if (agent) agent.destroy();
    });
    this.agents = [];
    
    // Pulisci le zone di interazione
    this.interactionZones.forEach(zone => {
      if (zone) zone.destroy();
    });
    this.interactionZones = [];
    
    // Pulisci gli elementi di debug
    if (this.debugText) {
      this.debugText.destroy();
      this.debugText = null;
    }
    
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
    
    // Pulisci i contenitori di test
    if (this.textureTestContainers) {
      this.textureTestContainers.forEach(container => {
        if (container) container.destroy();
      });
      this.textureTestContainers = [];
    }
    
    // Pulisci gli sprite di test
    if (this.rawSprites) {
      this.rawSprites.forEach(sprite => {
        if (sprite) sprite.destroy();
      });
      this.rawSprites = [];
    }
    
    console.log(`Scene ${this.scene.key} resources cleaned up`);
  } catch (error) {
    console.error(`Error cleaning up scene ${this.scene.key}:`, error);
  }
}
}