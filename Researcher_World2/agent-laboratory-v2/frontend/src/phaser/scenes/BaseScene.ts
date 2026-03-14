// frontend/src/phaser/scenes/BaseScene.ts

import Phaser from 'phaser';
import { createAssetLoader } from '../loader';
import { ASSETS } from '../assetConfig';

/**
 * Scena base che implementa funzionalità comuni a tutte le scene del gioco
 */
export class BaseScene extends Phaser.Scene {
  // Loader degli asset
  protected assetLoader: any; // Utilizzato any temporaneamente per evitare problemi di tipo
  
  // Mappa delle animazioni create
  protected animations: Map<string, Phaser.Animations.Animation> = new Map();
  
  constructor(key: string) {
    super({
      key: key,
      active: false,
      visible: false
    });
    
    console.log(`BaseScene constructor called with key: ${key}`);
  }
  
  /**
   * Inizializza la scena
   */
  init(): void {
    console.log(`Initializing BaseScene for ${this.scene.key}`);
    this.animations.clear();
    
    // Inizializza l'assetLoader nella init per assicurarsi che this.scene sia disponibile
    this.assetLoader = createAssetLoader(this);
  }
  
  /**
   * Precarica gli asset comuni a tutte le scene
   */
  preload(): void {
    console.log(`Preloading assets for BaseScene ${this.scene.key}`);
    
    // Carica asset dei personaggi usando i percorsi corretti dall'assetConfig
    // Nota: Modifica qui per usare i file sprite corretti
    this.assetLoader.loadSpritesheet('professor', ASSETS.characters.professor.path, ASSETS.characters.professor.config);
    this.assetLoader.loadSpritesheet('researcher', ASSETS.characters.researcher.path, ASSETS.characters.researcher.config);
    this.assetLoader.loadSpritesheet('student', '/assets/characters/student.png', { frameWidth: 32, frameHeight: 48 });
    this.assetLoader.loadSpritesheet('doctor', '/assets/characters/doctor.png', { frameWidth: 32, frameHeight: 48 });
    
    // Aggiunto debug per verificare i percorsi
    console.log(`Loading professor from: ${ASSETS.characters.professor.path}`);
    console.log(`Loading researcher from: ${ASSETS.characters.researcher.path}`);
    
    // Carica elementi UI comuni
    this.assetLoader.loadImage('ui_button', '/assets/ui/button.png');
    this.assetLoader.loadImage('placeholder', '/assets/placeholder.png');
    
    // Forza il caricamento immediato
    this.load.on('complete', () => {
      console.log('Asset loading complete');
      this.createAnimations();
    });
    
    this.load.start();
  }
  
  /**
   * Crea animazioni comuni per tutti i personaggi
   */
  protected createAnimations(): void {
    console.log('Creating animations');
    
    // Verifica se le animazioni sono già state create
    if (this.animations.size > 0) {
      console.log('Animations already created, skipping...');
      return;
    }
    
    // Array di tipi di personaggi
    const characterTypes = ['student', 'researcher', 'professor', 'doctor'];
    
    // Array di direzioni
    const directions = ['down', 'left', 'right', 'up'];
    
    // Array di azioni
    const actions = ['idle', 'walk'];
    
    // Creazione animazioni per ogni tipo di personaggio, direzione e azione
    characterTypes.forEach(charType => {
      // Verifica e reporta se la texture esiste
      const textureExists = this.textures.exists(charType);
      console.log(`Texture "${charType}" exists: ${textureExists}`);
      
      if (!textureExists) {
        console.warn(`Texture "${charType}" does not exist, skipping animations`);
        return;
      }
      
      // Ottieni la texture per controllare i frame
      const texture = this.textures.get(charType);
      console.log(`Texture ${charType} has ${texture.frameTotal} frames`);
      
      // Crea animazioni base se mancano quelle specifiche per direzione
      
      // Animazione idle
      try {
        const idleKey = `${charType}_idle`;
        if (!this.anims.exists(idleKey)) {
          this.anims.create({
            key: idleKey,
            frames: this.anims.generateFrameNumbers(charType, { start: 0, end: 0 }),
            frameRate: 1,
            repeat: 0
          });
          this.animations.set(idleKey, this.anims.get(idleKey));
          console.log(`Created animation: ${idleKey}`);
        }
      } catch (error) {
        console.error(`Error creating idle animation for "${charType}":`, error);
      }
      
      // Animazione walk
      try {
        const walkKey = `${charType}_walk`;
        if (!this.anims.exists(walkKey)) {
          this.anims.create({
            key: walkKey,
            frames: this.anims.generateFrameNumbers(charType, { start: 0, end: 2 }),
            frameRate: 8,
            repeat: -1
          });
          this.animations.set(walkKey, this.anims.get(walkKey));
          console.log(`Created animation: ${walkKey}`);
        }
      } catch (error) {
        console.error(`Error creating walk animation for "${charType}":`, error);
      }
      
      // Creazione animazioni avanzate per direzione e azione
      directions.forEach((direction, dirIndex) => {
        actions.forEach(action => {
          const animKey = `${charType}_${action}_${direction}`;
          
          // Salta se l'animazione esiste già
          if (this.anims.exists(animKey)) {
            console.log(`Animation "${animKey}" already exists, skipping`);
            return;
          }
          
          try {
            // Definisci i frame in base alla direzione e all'azione
            let startFrame = dirIndex * 3; // 3 frame per direzione
            
            if (action === 'walk') {
              // Per l'animazione walk, usa tutti e 3 i frame
              this.anims.create({
                key: animKey,
                frames: this.anims.generateFrameNumbers(charType, { 
                  start: startFrame, 
                  end: startFrame + 2 
                }),
                frameRate: 8,
                repeat: -1
              });
              
              // Salva il riferimento all'animazione
              this.animations.set(animKey, this.anims.get(animKey));
              
              console.log(`Created animation: ${animKey}`);
            } else if (action === 'idle') {
              // Per l'animazione idle, usa solo il primo frame
              this.anims.create({
                key: animKey,
                frames: this.anims.generateFrameNumbers(charType, { 
                  frames: [startFrame] 
                }),
                frameRate: 1,
                repeat: 0
              });
              
              // Salva il riferimento all'animazione
              this.animations.set(animKey, this.anims.get(animKey));
              
              console.log(`Created animation: ${animKey}`);
            }
          } catch (error) {
            console.error(`Error creating animation "${animKey}":`, error);
          }
        });
      });
    });
    
    console.log(`Created ${this.animations.size} animations`);
  }
  
  /**
   * Crea placeholder per asset mancanti
   * @param requiredAssetKeys Array di chiavi di asset richiesti
   */
  protected createPlaceholdersForMissingAssets(requiredAssetKeys: string[]): void {
    console.log(`Checking for missing assets from list: ${requiredAssetKeys.join(', ')}`);
    
    // Verifica ogni asset
    requiredAssetKeys.forEach(key => {
      if (!this.textures.exists(key)) {
        console.warn(`Asset "${key}" not found, creating placeholder`);
        
        // Crea un placeholder grafico
        const graphics = this.add.graphics();
        graphics.fillStyle(0xff00ff, 1); // Magenta per visibilità
        graphics.fillRect(0, 0, 32, 32);
        graphics.lineStyle(2, 0x000000, 1);
        graphics.strokeRect(0, 0, 32, 32);
        
        // Aggiungi una X per marcare come placeholder
        graphics.lineStyle(2, 0x000000, 1);
        graphics.lineBetween(0, 0, 32, 32);
        graphics.lineBetween(0, 32, 32, 0);
        
        // Crea una texture dal graphics
        const rt = this.add.renderTexture(0, 0, 32, 32);
        rt.draw(graphics, 0, 0);
        
        // Genera una texture utilizzabile per l'asset mancante
        rt.saveTexture(key);
        
        // Pulisci gli oggetti temporanei
        rt.destroy();
        graphics.destroy();
        
        console.log(`Created placeholder texture for "${key}"`);
      }
    });
  }
  
  /**
   * Metodo di update principale
   */
  update(time: number, delta: number): void {
    // Override nei sottotipi
  }
  
  /**
   * Mostra un messaggio di debug sulla console e opzionalmente a schermo
   */
  debug(message: string, showOnScreen: boolean = false): void {
    console.log(`[${this.scene.key}] ${message}`);
    
    if (showOnScreen && process.env.NODE_ENV === 'development') {
      // Dimensioni del testo in base alla risoluzione
      const fontSize = Math.min(16, Math.max(12, window.innerWidth / 50));
      
      // Crea o aggiorna il testo di debug
      if (!this.children.getByName('debugText')) {
        this.add.text(10, 10, message, {
          fontSize: `${fontSize}px`,
          color: '#ffffff',
          backgroundColor: '#000000'
        }).setName('debugText').setDepth(1000).setScrollFactor(0);
      } else {
        const debugText = this.children.getByName('debugText') as Phaser.GameObjects.Text;
        debugText.text = message;
      }
    }
  }
  
  /**
   * Crea un semplice pulsante con testo
   */
  createTextButton(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Text {
    const button = this.add.text(x, y, text, {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: {
        left: 10,
        right: 10,
        top: 5,
        bottom: 5
      }
    });
    
    button.setInteractive({ useHandCursor: true });
    
    button.on('pointerover', () => {
      button.setBackgroundColor('#555555');
    });
    
    button.on('pointerout', () => {
      button.setBackgroundColor('#333333');
    });
    
    button.on('pointerdown', () => {
      button.setBackgroundColor('#111111');
    });
    
    button.on('pointerup', () => {
      button.setBackgroundColor('#555555');
      onClick();
    });
    
    return button;
  }
}