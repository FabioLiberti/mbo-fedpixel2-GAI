// src/phaser/scenes/Mercatorum/Textures.ts

import { debugTextures, debugTextureKey } from '../../utils/textureDebugHelper';
import { MercatorumLabScene } from './MercatorumLabScene';

// Precarica tutti gli asset necessari
export function preloadAssets(scene: MercatorumLabScene): void {
  try {
    // Mercatorum: professor e privacy_specialist usano ritratti come immagini statiche
    scene.load.image('professor', 'assets/sprites/1024x1536/_Professor3.png');
    scene.load.image('privacy_specialist', 'assets/sprites/1024x1536/_Manager.png');

    // student e researcher usano spritesheets pixel-art standard
    scene.load.spritesheet('student', 'assets/characters/student_spritesheet.png', {
      frameWidth: 32,
      frameHeight: 48
    });

    scene.load.spritesheet('researcher', 'assets/characters/researcher_spritesheet.png', {
      frameWidth: 32,
      frameHeight: 48
    });
    
    // Debug events for all assets
    scene.load.on('filecomplete', (key: string) => {
      console.log(`Asset loaded successfully: ${key}`);
    });
  
    scene.load.on('loaderror', (file: any) => {
      console.error(`Error loading asset: ${file.key}`, file.url);
    });

    // Carica risorse specifiche per questo laboratorio
    scene.load.image('mercatorum_background', 'assets/labs/mercatorum/background.png');
    scene.load.image('mercatorum_furniture', 'assets/labs/mercatorum/furniture.png');
    
    // Carica tileset specifico
    scene.load.image(scene.theme.tilesetKey, 'assets/tileset/mercatorum-tiles.png');
    
    // Carica la mappa
    scene.load.tilemapJSON('mercatorum-map', 'assets/tilemaps/mercatorum-map.json');
    
    // Carica il file di configurazione degli agenti specifici per laboratorio
    scene.load.json('labAgentTypesConfig', 'assets/config/labAgentTypes.json');
    
    // Carica il logo Mercatorum
    scene.load.image('mercatorum-logo', 'assets/ui/mercatorum-logo.png');
    
    // Carica le texture per i dialoghi con debug
    console.log('Loading dialog assets...');
    
    const dialogAssets = [
      { key: 'bubble-background', path: 'assets/ui/dialog/bubble-background.png' },
      { key: 'bubble-tail', path: 'assets/ui/dialog/bubble-tail.png' },
      { key: 'icon-data', path: 'assets/ui/dialog/icon-data.png' },
      { key: 'icon-model', path: 'assets/ui/dialog/icon-model.png' },
      { key: 'icon-privacy', path: 'assets/ui/dialog/icon-privacy.png' },
      { key: 'icon-research', path: 'assets/ui/dialog/icon-research.png' }
    ];
    
    dialogAssets.forEach(asset => {
      scene.load.image(asset.key, asset.path);
      scene.load.on(`filecomplete-image-${asset.key}`, () => {
        console.log(`Dialog asset loaded: ${asset.key}`);
      });
    });
    
    // Add load complete handler
    scene.load.on('complete', () => {
      console.log('All assets loaded. Checking dialog assets...');
      dialogAssets.forEach(asset => {
        if (scene.textures.exists(asset.key)) {
          console.log(`Dialog asset verified: ${asset.key}`);
        } else {
          console.error(`Dialog asset missing after load: ${asset.key}`);
        }
      });
    });
    
  } catch (error) {
    console.error('Error in preloadAssets:', error);
  }
}

// Configura tutte le texture e animazioni
export function setupTextures(scene: MercatorumLabScene): void {
  try {
    // Tipi ritratto (immagini statiche, no spritesheet/animazioni)
    const portraitTypes = ['professor', 'privacy_specialist'];
    // Tipi spritesheet (pixel-art animabili)
    const spritesheetTypes = ['student', 'researcher'];

    // Verifica texture caricate
    [...portraitTypes, ...spritesheetTypes].forEach(type => {
      if (scene.textures.exists(type)) {
        console.log(`Texture '${type}' disponibile`);
      } else {
        console.error(`Texture '${type}' NON disponibile`);
      }
    });

    // Crea placeholder e animazioni solo per tipi spritesheet
    createImprovedPlaceholders(scene);
    createDialogPlaceholders(scene);
    runTextureDebug(scene);
    createMissingTextures(scene);
    createAllCharacterAnimations(scene);
  } catch (error) {
    console.error('Error in setupTextures:', error);
  }
}

// Crea nuove texture placeholder direttamente nel formato corretto
export function createMissingTextures(scene: MercatorumLabScene): void {
  try {
    const characterTypes = ['student', 'researcher'];
    
    characterTypes.forEach(type => {
      if (!scene.textures.exists(type)) {
        console.log(`Creating missing texture for ${type}`);
        createDirectPlaceholderTexture(scene, type, 32, 48);
      } else {
        console.log(`Texture ${type} already exists`);
      }
    });
  } catch (error) {
    console.error('Error in createMissingTextures:', error);
  }
}

// Crea texture placeholder migliorate per vari tipi di personaggi
export function createImprovedPlaceholders(scene: MercatorumLabScene): void {
  try {
    console.log('Creating improved placeholders for missing textures');
    
    // Lista dei tipi di personaggi che richiedono placeholder
    const characterTypes = ['student', 'researcher'];
    
    // Definizione dei colori per tipo
    const typeColors: Record<string, { main: string; accent: string }> = {
      professor: { main: '#1E88E5', accent: '#1565C0' },
      privacy_specialist: { main: '#607D8B', accent: '#455A64' },
      student: { main: '#FB8C00', accent: '#E65100' },
      researcher: { main: '#43A047', accent: '#2E7D32' }
    };
    
    // Per ogni tipo, crea una texture placeholder migliorata
    characterTypes.forEach(type => {
      // Verifica se la texture esiste già
      if (scene.textures.exists(type)) {
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
      scene.textures.addCanvas(type, canvas);
      
      // Definisci esplicitamente i frame
      const texture = scene.textures.get(type);
      
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
    createCharacterAnimations(scene);
    
  } catch (error) {
    console.error('Error in createImprovedPlaceholders:', error);
  }
}

// Crea una texture placeholder direttamente senza RenderTexture
export function createDirectPlaceholderTexture(
  scene: MercatorumLabScene, 
  key: string, 
  width: number, 
  height: number
): void {
  try {
    // Crea un canvas
    const canvas = document.createElement('canvas');
    canvas.width = width * 4; // 4 frames side by side
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Colori
    const colors: Record<string, string> = {
      professor: '#1E88E5',
      privacy_specialist: '#607D8B',
      student: '#FB8C00',
      researcher: '#43A047'
    };

    const color = colors[key] || '#FF00FF';
    
    // Disegna 4 frame diversi
    for (let i = 0; i < 4; i++) {
      const frameX = i * width;
      
      // Sfondo
      ctx.fillStyle = color;
      ctx.fillRect(frameX, 0, width, height);
      
      // Bordo
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(frameX + 2, 2, width - 4, height - 4);
      
      // Texture design
      ctx.fillStyle = '#FFFFFF';
      
      // Testa
      ctx.beginPath();
      ctx.arc(frameX + width/2, height/4, height/8, 0, Math.PI * 2);
      ctx.fill();
      
      // Corpo con variazioni per ogni frame
      ctx.beginPath();
      if (i === 0) { // Idle
        ctx.fillRect(frameX + width/2 - 4, height/3, 8, height/2);
      } else if (i === 1) { // Walk frame 1
        ctx.moveTo(frameX + width/2, height/3);
        ctx.lineTo(frameX + width/2 - 6, height - 4);
        ctx.lineTo(frameX + width/2 + 6, height - 4);
        ctx.closePath();
      } else if (i === 2) { // Walk frame 2
        ctx.moveTo(frameX + width/2, height/3);
        ctx.lineTo(frameX + width/2 - 8, height - 8);
        ctx.lineTo(frameX + width/2 + 8, height - 8);
        ctx.closePath();
      } else { // Walk frame 3
        ctx.moveTo(frameX + width/2, height/3);
        ctx.lineTo(frameX + width/2 - 4, height - 6);
        ctx.lineTo(frameX + width/2 + 4, height - 6);
        ctx.closePath();
      }
      ctx.fill();
      
      // Testo con tipo personaggio
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '6px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(key, frameX + width/2, height - 4);
    }
    
    // Crea la texture in Phaser
    scene.textures.addCanvas(key, canvas);
    
    // Definisci i frame manualmente
    const texture = scene.textures.get(key);
    
    // Aggiungi i frame
    for (let i = 0; i < 4; i++) {
      texture.add(i, 0, i * width, 0, width, height);
    }
    
    // Aggiorna la texture
    texture.refresh();
    
    console.log(`Created direct placeholder texture for ${key} with 4 frames`);
  } catch (error) {
    console.error(`Error creating direct placeholder for ${key}:`, error);
  }
}

// Crea animazioni per tutti i tipi di personaggio
function createCharacterAnimations(scene: MercatorumLabScene): void {
  try {
    console.log('Creating animations for all character types');
    
    const characters = ['student', 'researcher'];
    
    characters.forEach(char => {
      // Verifica se la texture esiste
      if (!scene.textures.exists(char)) {
        console.warn(`Cannot create animations for ${char}: texture does not exist, creating placeholder...`);
        createDirectPlaceholderTexture(scene, char, 32, 48);
      }
      
      const texture = scene.textures.get(char);
      if (!texture) {
        console.error(`Cannot create animations for ${char}: texture still not available after placeholder creation`);
        return;
      }
      
      // frameTotal includes __BASE frame, subtract 1 for actual usable frames
      const actualFrames = Math.max(1, texture.frameTotal - 1);
      console.log(`Creating animations for ${char} with ${actualFrames} actual frames`);

      // Crea animazione 'idle' - usa sempre il primo frame
      if (!scene.anims.exists(`${char}_idle`)) {
        scene.anims.create({
          key: `${char}_idle`,
          frames: scene.anims.generateFrameNumbers(char, { frames: [0] }),
          frameRate: 1,
          repeat: 0
        });
      }

      // Crea animazione 'walk' - usa i frame disponibili
      if (!scene.anims.exists(`${char}_walk`)) {
        const walkFrames = actualFrames >= 4
          ? { frames: [0, 1, 2, 3] }
          : actualFrames >= 2
              ? { frames: [0, 1] }
              : { frames: [0] };

        scene.anims.create({
          key: `${char}_walk`,
          frames: scene.anims.generateFrameNumbers(char, walkFrames),
          frameRate: 6,
          repeat: -1
        });
      }

      // Crea animazione 'working' - usa i frame disponibili
      if (!scene.anims.exists(`${char}_working`)) {
        const workingFrames = actualFrames >= 2
          ? { frames: [0, 1] }
          : { frames: [0] };

        scene.anims.create({
          key: `${char}_working`,
          frames: scene.anims.generateFrameNumbers(char, workingFrames),
          frameRate: 3,
          repeat: -1
        });
      }

      // Crea animazione 'discussing' - usa i frame disponibili
      if (!scene.anims.exists(`${char}_discussing`)) {
        const discussingFrames = actualFrames >= 4
          ? { frames: [0, 1, 0, 2] }
          : actualFrames >= 2
              ? { frames: [0, 1] }
              : { frames: [0] };

        scene.anims.create({
          key: `${char}_discussing`,
          frames: scene.anims.generateFrameNumbers(char, discussingFrames),
          frameRate: 4,
          repeat: -1
        });
      }
    });
  } catch (error) {
    console.error('Error in createCharacterAnimations:', error);
  }
}

// Crea animazioni per tutti i tipi di personaggi
export function createAllCharacterAnimations(scene: MercatorumLabScene): void {
  try {
    console.log('Creating animations for all character types');
    
    const characters = ['student', 'researcher'];
    
    characters.forEach(char => {
      // Verifica se la texture esiste e ha frame
      if (!scene.textures.exists(char)) {
        console.warn(`Cannot create animations for ${char}: texture does not exist`);
        return;
      }
      
      const texture = scene.textures.get(char);
      if (!texture || texture.frameTotal <= 0) {
        console.warn(`Cannot create animations for ${char}: texture has no frames`);
        return;
      }
      
      // frameTotal includes __BASE frame, subtract 1 for actual usable frames
      const actualFrames = Math.max(1, texture.frameTotal - 1);
      console.log(`[All] Creating animations for ${char} with ${actualFrames} actual frames`);

      // Crea animazione 'idle'
      if (!scene.anims.exists(`${char}_idle`)) {
        scene.anims.create({
          key: `${char}_idle`,
          frames: scene.anims.generateFrameNumbers(char, { start: 0, end: 0 }),
          frameRate: 1,
          repeat: 0
        });
      }

      // Crea animazione 'walk'
      if (!scene.anims.exists(`${char}_walk`)) {
        const endWalkFrame = Math.min(3, actualFrames - 1);
        scene.anims.create({
          key: `${char}_walk`,
          frames: scene.anims.generateFrameNumbers(char, { start: 0, end: endWalkFrame }),
          frameRate: 6,
          repeat: -1
        });
      }

      // Crea animazione 'working'
      if (!scene.anims.exists(`${char}_working`)) {
        const endWorkFrame = Math.min(1, actualFrames - 1);
        scene.anims.create({
          key: `${char}_working`,
          frames: scene.anims.generateFrameNumbers(char, { start: 0, end: endWorkFrame }),
          frameRate: 3,
          repeat: -1
        });
      }

      // Crea animazione 'discussing'
      if (!scene.anims.exists(`${char}_discussing`)) {
        const discussFrames = actualFrames >= 4
          ? { frames: [0, 1, 0, 2] }
          : actualFrames >= 2
              ? { frames: [0, 1] }
              : { frames: [0] };
        scene.anims.create({
          key: `${char}_discussing`,
          frames: scene.anims.generateFrameNumbers(char, discussFrames),
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

// Metodo per eseguire un debug approfondito delle texture
export function runTextureDebug(scene: MercatorumLabScene): void {
  try {
    console.log('Running texture debug checks');
    
    // Utilizziamo l'helper per il debug delle texture
    debugTextures(scene);
    
    // Debug dettagliato delle texture che ci interessano
    const textureKeysToDebug = [
      'student', 'researcher'
    ];
    
    textureKeysToDebug.forEach(key => {
      if (scene.textures.exists(key)) {
        debugTextureKey(scene, key);
      } else {
        console.warn(`Texture ${key} does not exist for debug`);
      }
    });
    
    scene.updateDebugInfo('Texture debug completed. Check console for details.');
  } catch (error) {
    console.error('Error in runTextureDebug:', error);
  }
}

export function createDialogPlaceholders(scene: MercatorumLabScene): void {
  try {
    console.log('Creating dialog placeholders if needed...');
    
    // Create bubble background placeholder
    if (!scene.textures.exists('bubble-background')) {
      console.log('Creating bubble-background placeholder');
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw rounded rectangle
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        roundRect(ctx, 1, 1, 198, 98, 10);
        ctx.fill();
        ctx.stroke();
        scene.textures.addCanvas('bubble-background', canvas);
      }
    }
    
    // Create bubble tail placeholder
    if (!scene.textures.exists('bubble-tail')) {
      console.log('Creating bubble-tail placeholder');
      const canvas = document.createElement('canvas');
      canvas.width = 20;
      canvas.height = 20;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw triangle
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(0, 20);
        ctx.lineTo(20, 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        scene.textures.addCanvas('bubble-tail', canvas);
      }
    }
    
    // Create icon placeholders
    const icons = ['icon-data', 'icon-model', 'icon-privacy', 'icon-research'];
    const iconColors = {
      'icon-data': '#0088FF',
      'icon-model': '#00FF88',
      'icon-privacy': '#AA44FF',
      'icon-research': '#FF8800'
    };
    
    icons.forEach(icon => {
      if (!scene.textures.exists(icon)) {
        console.log(`Creating ${icon} placeholder`);
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Draw circle with icon type color
          ctx.fillStyle = iconColors[icon as keyof typeof iconColors];
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(12, 12, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          scene.textures.addCanvas(icon, canvas);
        }
      }
    });
    
  } catch (error) {
    console.error('Error creating dialog placeholders:', error);
  }
}

// Helper function to draw rounded rectangles
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}