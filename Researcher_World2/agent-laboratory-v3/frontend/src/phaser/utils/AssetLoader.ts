// frontend/src/phaser/utils/AssetLoader.ts

import Phaser from 'phaser';

/**
 * Applica dei fix per risolvere problemi comuni nel caricamento degli asset in Phaser
 * Questa funzione risolve problemi relativi a texture e cache
 */
export function applyAssetLoaderFix(): void {
  console.log('[AssetLoader] Applying asset loader fixes');

  // Patch per prevenire errori quando si tenta di accedere a una texture inesistente
  const originalGet = Phaser.Textures.TextureManager.prototype.get;
  
  Phaser.Textures.TextureManager.prototype.get = function(key: string): Phaser.Textures.Texture {
    try {
      if (!this.exists(key)) {
        console.warn(`[AssetLoader] Attempted to get non-existent texture: "${key}"`);
        // Controlla se esiste la texture di placeholder
        if (!this.exists('__missing_texture__')) {
          // Crea una texture placeholder
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            // Sfondo magenta (comune per texture mancanti)
            ctx.fillStyle = '#FF00FF';
            ctx.fillRect(0, 0, 32, 32);
            
            // Aggiungi un pattern a scacchiera
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 16, 16);
            ctx.fillRect(16, 16, 16, 16);
          }
          
          this.addCanvas('__missing_texture__', canvas);
        }
        return this.get('__missing_texture__');
      }
      return originalGet.call(this, key);
    } catch (error) {
      console.error(`[AssetLoader] Error getting texture "${key}":`, error);
      
      // Se c'è un errore e la texture placeholder esiste, restituiscila
      if (this.exists('__missing_texture__')) {
        return this.get('__missing_texture__');
      }
      
      // Altrimenti, lascia che l'errore avvenga con il metodo originale
      return originalGet.call(this, key);
    }
  };
  
  // Assicurati che il game object possa essere visualizzato anche con texture mancanti
  const originalSetTexture = Phaser.GameObjects.Sprite.prototype.setTexture;
  
  Phaser.GameObjects.Sprite.prototype.setTexture = function(key: string, frame?: string | number): Phaser.GameObjects.Sprite {
    try {
      return originalSetTexture.call(this, key, frame);
    } catch (error) {
      console.warn(`[AssetLoader] Failed to set texture "${key}" on sprite:`, error);
      
      // Prova a impostare la texture di placeholder
      try {
        // Accesso sicuro alla scena e al gestore di texture
        const scene = this.scene as unknown as Phaser.Scene;
        if (scene?.textures?.exists('__missing_texture__')) {
          return originalSetTexture.call(this, '__missing_texture__');
        }
      } catch (innerError) {
        console.error('[AssetLoader] Failed to apply fallback texture:', innerError);
      }
      
      // Se non possiamo applicare il fallback, restituisci l'oggetto corrente
      return this;
    }
  };
  
  console.log('[AssetLoader] Applied loader fixes and fallbacks');
}

/**
 * Crea un asset loader per la scena specificata
 * @param scene La scena Phaser
 */
export function createAssetLoader(scene: Phaser.Scene) {
  return {
    /**
     * Carica un'immagine
     * @param key Chiave dell'asset
     * @param path Percorso dell'asset
     */
    loadImage(key: string, path: string): void {
      if (scene.textures.exists(key)) {
        console.log(`[AssetLoader] Texture ${key} already exists, skipping load`);
        return;
      }
      
      try {
        scene.load.image(key, path);
      } catch (error) {
        console.error(`[AssetLoader] Error loading image ${key} from ${path}:`, error);
      }
    },
    
    /**
     * Carica un tilemap JSON
     * @param key Chiave dell'asset
     * @param path Percorso dell'asset
     */
    loadTilemapJSON(key: string, path: string): void {
      if (scene.cache.tilemap.exists(key)) {
        console.log(`[AssetLoader] Tilemap ${key} already exists, skipping load`);
        return;
      }
      
      try {
        scene.load.tilemapTiledJSON(key, path);
      } catch (error) {
        console.error(`[AssetLoader] Error loading tilemap ${key} from ${path}:`, error);
      }
    },
    
    /**
     * Carica un atlas
     * @param key Chiave dell'asset
     * @param imagePath Percorso dell'immagine
     * @param jsonPath Percorso del JSON
     */
    loadAtlas(key: string, imagePath: string, jsonPath: string): void {
      if (scene.textures.exists(key)) {
        console.log(`[AssetLoader] Atlas ${key} already exists, skipping load`);
        return;
      }
      
      try {
        scene.load.atlas(key, imagePath, jsonPath);
      } catch (error) {
        console.error(`[AssetLoader] Error loading atlas ${key}:`, error);
      }
    },
    
    /**
     * Carica un spritesheet
     * @param key Chiave dell'asset
     * @param path Percorso dell'asset
     * @param config Configurazione del spritesheet
     */
    loadSpritesheet(key: string, path: string, config: Phaser.Types.Loader.FileTypes.ImageFrameConfig): void {
      if (scene.textures.exists(key)) {
        console.log(`[AssetLoader] Spritesheet ${key} already exists, skipping load`);
        return;
      }
      
      try {
        scene.load.spritesheet(key, path, config);
      } catch (error) {
        console.error(`[AssetLoader] Error loading spritesheet ${key} from ${path}:`, error);
      }
    },
    
    /**
     * Crea una texture placeholder per gli asset mancanti
     * @param key Chiave dell'asset
     * @param type Tipo di asset (image, spritesheet, ecc.)
     * @param width Larghezza dell'asset
     * @param height Altezza dell'asset
     */
    loadPlaceholder(key: string, type: string, width: number = 32, height: number = 32): void {
      try {
        const graphics = scene.add.graphics();
        
        // Sfondo magenta (comune per texture mancanti)
        graphics.fillStyle(0xFF00FF, 1);
        graphics.fillRect(0, 0, width, height);
        
        // Aggiungi un pattern che indica una texture mancante
        graphics.lineStyle(2, 0x000000, 1);
        graphics.strokeRect(0, 0, width, height);
        graphics.lineBetween(0, 0, width, height);
        graphics.lineBetween(width, 0, 0, height);
        
        // Se è un placeholder per spritesheet, aggiungi più dettagli
        if (type === 'spritesheet') {
          // Disegna una griglia per indicare i frame
          const frameSize = 8;
          graphics.lineStyle(1, 0x000000, 0.5);
          
          for (let x = frameSize; x < width; x += frameSize) {
            graphics.lineBetween(x, 0, x, height);
          }
          
          for (let y = frameSize; y < height; y += frameSize) {
            graphics.lineBetween(0, y, width, y);
          }
        }
        
        // Crea una texture dalla grafica
        const texture = scene.textures.createCanvas(key, width, height);
        const context = texture.getContext();
        context.drawImage(graphics.canvas, 0, 0);
        texture.refresh();
        
        // Pulisci la grafica temporanea
        graphics.destroy();
        
        console.log(`[AssetLoader] Created placeholder for missing ${type}: ${key}`);
      } catch (error) {
        console.error(`[AssetLoader] Error creating placeholder for ${key}:`, error);
      }
    }
  };
}