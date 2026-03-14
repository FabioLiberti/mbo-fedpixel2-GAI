// frontend/src/phaser/loader.ts

import Phaser from 'phaser';

/**
 * Interfaccia per il loader di asset
 */
export interface AssetLoader {
  loadImage: (key: string, path: string) => void;
  loadSpritesheet: (key: string, path: string, config: Phaser.Types.Loader.FileTypes.ImageFrameConfig) => void;
  loadAtlas: (key: string, imagePath: string, jsonPath: string) => void;
  loadAudio: (key: string, path: string) => void;
  loadTilemap: (key: string, path: string) => void;
  isLoaded: (key: string) => boolean;
}

/**
 * Crea un loader di asset per la scena specificata
 * @param scene La scena Phaser per cui creare il loader
 * @returns Un'istanza del loader di asset
 */
export function createAssetLoader(scene: Phaser.Scene): AssetLoader {
  // Verifica che la scena sia valida
  if (!scene) {
    console.error('Invalid scene provided to AssetLoader');
    throw new Error('Invalid scene provided to AssetLoader');
  }
  
  // Crea e restituisci l'oggetto loader
  return {
    /**
     * Carica un'immagine
     * @param key Chiave dell'asset
     * @param path Percorso dell'asset
     */
    loadImage: (key: string, path: string): void => {
      // Verifica se l'asset è già stato caricato
      if (scene.textures.exists(key)) {
        console.log(`Asset "${key}" already loaded, skipping`);
        return;
      }
      
      try {
        scene.load.image(key, path);
        console.log(`Loading image: ${key} from ${path}`);
      } catch (error) {
        console.error(`Error loading image "${key}" from "${path}":`, error);
      }
    },
    
    /**
     * Carica un spritesheet
     * @param key Chiave dell'asset
     * @param path Percorso dell'asset
     * @param config Configurazione del spritesheet
     */
    loadSpritesheet: (key: string, path: string, config: Phaser.Types.Loader.FileTypes.ImageFrameConfig): void => {
      // Verifica se l'asset è già stato caricato
      if (scene.textures.exists(key)) {
        console.log(`Asset "${key}" already loaded, skipping`);
        return;
      }
      
      try {
        scene.load.spritesheet(key, path, config);
        console.log(`Loading spritesheet: ${key} from ${path}`);
      } catch (error) {
        console.error(`Error loading spritesheet "${key}" from "${path}":`, error);
        
        // Tenta di creare un placeholder per il debugging
        createPlaceholderTexture(scene, key, config.frameWidth || 32, config.frameHeight || 32);
      }
    },
    
    /**
     * Carica un atlas di texture
     * @param key Chiave dell'asset
     * @param imagePath Percorso dell'immagine
     * @param jsonPath Percorso del JSON
     */
    loadAtlas: (key: string, imagePath: string, jsonPath: string): void => {
      // Verifica se l'asset è già stato caricato
      if (scene.textures.exists(key)) {
        console.log(`Asset "${key}" already loaded, skipping`);
        return;
      }
      
      try {
        scene.load.atlas(key, imagePath, jsonPath);
        console.log(`Loading atlas: ${key} from ${imagePath} and ${jsonPath}`);
      } catch (error) {
        console.error(`Error loading atlas "${key}" from "${imagePath}" and "${jsonPath}":`, error);
      }
    },
    
    /**
     * Carica un file audio
     * @param key Chiave dell'asset
     * @param path Percorso dell'asset
     */
    loadAudio: (key: string, path: string): void => {
      // Verifica se l'asset è già stato caricato
      if (scene.cache.audio.exists(key)) {
        console.log(`Audio "${key}" already loaded, skipping`);
        return;
      }
      
      try {
        scene.load.audio(key, path);
        console.log(`Loading audio: ${key} from ${path}`);
      } catch (error) {
        console.error(`Error loading audio "${key}" from "${path}":`, error);
      }
    },
    
    /**
     * Carica una tilemap
     * @param key Chiave dell'asset
     * @param path Percorso dell'asset
     */
    loadTilemap: (key: string, path: string): void => {
      // Verifica se l'asset è già stato caricato
      if (scene.cache.tilemap.exists(key)) {
        console.log(`Tilemap "${key}" already loaded, skipping`);
        return;
      }
      
      try {
        scene.load.tilemapTiledJSON(key, path);
        console.log(`Loading tilemap: ${key} from ${path}`);
      } catch (error) {
        console.error(`Error loading tilemap "${key}" from "${path}":`, error);
      }
    },
    
    /**
     * Verifica se un asset è stato caricato
     * @param key Chiave dell'asset
     * @returns true se l'asset è stato caricato, false altrimenti
     */
    isLoaded: (key: string): boolean => {
      return scene.textures.exists(key);
    }
  };
}

/**
 * Crea una texture di placeholder per l'asset mancante
 * @param scene Scena Phaser
 * @param key Chiave dell'asset
 * @param width Larghezza dell'asset
 * @param height Altezza dell'asset
 */
function createPlaceholderTexture(scene: Phaser.Scene, key: string, width: number, height: number): void {
  try {
    // Se la scena è già stata distrutta, esci
    if (!scene || !scene.textures) return;
    
    // Crea un placeholder grafico
    const graphics = scene.add.graphics();
    
    // Riempimento con colore magenta
    graphics.fillStyle(0xff00ff, 1); // Magenta per visibilità
    graphics.fillRect(0, 0, width, height);
    
    // Bordo nero
    graphics.lineStyle(2, 0x000000, 1); // Corretto: aggiunto il secondo parametro
    graphics.strokeRect(0, 0, width, height);
    
    // Aggiungi una X per marcare come placeholder - usando il colore nero
    graphics.lineStyle(2, 0x000000, 1); // Corretto: specificato il colore
    graphics.lineBetween(0, 0, width, height);
    graphics.lineBetween(0, height, width, 0);
    
    // Aggiungi il nome della texture
    graphics.lineStyle(0, 0x000000, 1); // Reset dello stile di linea
    
    // Crea una texture dal graphics
    const rt = scene.add.renderTexture(0, 0, width, height);
    rt.draw(graphics, 0, 0);
    
    // Genera una texture utilizzabile per l'asset mancante
    rt.saveTexture(key);
    
    // Pulisci gli oggetti temporanei
    rt.destroy();
    graphics.destroy();
    
    console.log(`Created placeholder texture for "${key}"`);
  } catch (error) {
    console.error(`Error creating placeholder texture for "${key}":`, error);
  }
}

/**
 * Carica gli asset necessari per il sistema di dialogo
 * @param scene La scena Phaser in cui caricare gli asset
 */
export function loadDialogAssets(scene: Phaser.Scene): void {
  console.log('DEBUG: Loading dialog assets');
  
  try {
    // Carica gli asset per le nuvolette di dialogo
    scene.load.image('bubble-background', '/assets/ui/dialog/bubble-background.png');
    scene.load.image('bubble-tail', '/assets/ui/dialog/bubble-tail.png');
    
    // Carica le icone per i tipi di dialogo
    scene.load.image('icon-model', '/assets/ui/dialog/icon-model.png');
    scene.load.image('icon-data', '/assets/ui/dialog/icon-data.png');
    scene.load.image('icon-privacy', '/assets/ui/dialog/icon-privacy.png');
    scene.load.image('icon-research', '/assets/ui/dialog/icon-research.png');
    
    // Aggiungi listener per gli errori di caricamento
    scene.load.on('loaderror', (fileObj: any) => {
      console.error('Error loading dialog asset:', fileObj.key);
    });
  } catch (error) {
    console.error('Error in loadDialogAssets:', error);
  }
}