// src/phaser/scenes/Mercatorum/Environment.ts

import { IMercatorumLabScene } from './types';

// Funzione principale per creare l'ambiente
export function createEnvironment(scene: IMercatorumLabScene): void {
  try {
    // Usa l'immagine di sfondo caricata o crea un background in stile italiano classico
    if (scene.textures.exists('mercatorum_background')) {
      createBackgroundFromImage(scene);
    } else {
      createItalianClassicBackground(scene);
    }
    
    // Crea una mappa base (temporanea)
    createTemporaryMap(scene);
    
    // Inizializza la griglia per il pathfinding
    initializeGrid(scene);
    
    // Crea le zone di interazione
    createInteractionZones(scene);
    
    // Setup della camera
    setupCamera(scene);
  } catch (error) {
    console.error('Error in createEnvironment:', error);
  }
}

/**
 * Crea lo sfondo utilizzando l'immagine caricata
 */
export function createBackgroundFromImage(scene: IMercatorumLabScene): void {
  try {
    console.log('Creating background from loaded image');
    
    const background = scene.add.image(
      scene.cameras.main.width / 2, 
      scene.cameras.main.height / 2, 
      'mercatorum_background'
    );
    background.setDepth(-10);
    
    // Aggiusta le dimensioni per coprire lo schermo mantenendo le proporzioni
    if (background.width > 0 && background.height > 0) {
      // Calcola il fattore di scala appropriato
      const scaleX = scene.cameras.main.width / background.width;
      const scaleY = scene.cameras.main.height / background.height;
      const scale = Math.max(scaleX, scaleY); // Usa il valore maggiore per coprire tutto lo schermo
      
      background.setScale(scale);
      
      // Centra l'immagine
      background.setPosition(scene.cameras.main.width / 2, scene.cameras.main.height / 2);
    }
    
    scene.updateDebugInfo('Using loaded background image');
  } catch (error) {
    console.error('Error creating background from image:', error);
    // Fallback al background generato
    createItalianClassicBackground(scene);
  }
}

/**
 * Crea lo sfondo con pattern in stile italiano classico
 */
export function createItalianClassicBackground(scene: IMercatorumLabScene): void {
  try {
    console.log('Creating Italian classic background');
    
    // Se non è disponibile l'immagine, crea un pattern grafico
    scene.updateDebugInfo('Creating fallback background pattern');
    
    // Crea un pattern di background in stile italiano classico
    const graphics = scene.add.graphics();
    
    // Sfondo terracotta - usa il valore dal tema attraverso l'interfaccia
    graphics.fillStyle(scene.theme.backgroundColor, 1);
    graphics.fillRect(0, 0, scene.cameras.main.width, scene.cameras.main.height);
    
    // Pattern geometrici in stile classico italiano
    graphics.lineStyle(2, 0xf5f5dc, 0.3); // Linee color crema
    
    // Pattern di archi romani stilizzati
    const archWidth = 80;
    const archHeight = 40;
    for (let x = -archWidth/2; x < scene.cameras.main.width + archWidth/2; x += archWidth) {
      for (let y = 0; y < scene.cameras.main.height; y += archHeight*2) {
        // Arco romano stilizzato
        graphics.beginPath();
        graphics.moveTo(x, y + archHeight);
        graphics.arc(x + archWidth/2, y + archHeight, archWidth/2, Math.PI, 0);
        graphics.stroke();
      }
    }
    
    // Dettagli decorativi classici
    graphics.fillStyle(scene.theme.colorPalette.accent, 0.2);
    
    // Pattern di foglie di alloro stilizzate 
    for (let x = 40; x < scene.cameras.main.width; x += 120) {
      for (let y = 60; y < scene.cameras.main.height; y += 120) {
        // Foglia stilizzata
        graphics.fillCircle(x, y, 15);
        graphics.fillCircle(x + 10, y - 5, 10);
        graphics.fillCircle(x - 10, y - 5, 10);
      }
    }
    
    graphics.strokePath();
    graphics.setDepth(-10);
  } catch (error) {
    console.error('Error in createItalianClassicBackground:', error);
    scene.updateDebugInfo(`Background error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Crea una mappa temporanea fino a quando non abbiamo un tilemap
 */
export function createTemporaryMap(scene: IMercatorumLabScene): void {
  try {
    console.log('Creating temporary map');
    
    // Prima verifica se l'immagine del mobilio è stata caricata
    if (scene.textures.exists('mercatorum_furniture')) {
      console.log('Using loaded furniture image');
      const furniture = scene.add.image(
        scene.cameras.main.width / 2, 
        scene.cameras.main.height / 2, 
        'mercatorum_furniture'
      );
      furniture.setDepth(-5);
      
      // Impostazioni per debug
      scene.updateDebugInfo('Using loaded furniture image');
      
      // Creazione di una griglia di base per il pathfinding
      createGridFromImage(scene, furniture);
      return;
    }
    
    scene.updateDebugInfo('Creating fallback furniture graphics');
    
    // Creazione di una griglia di base per il laboratorio
    const gridSize = 32;
    const width = Math.ceil(scene.cameras.main.width / gridSize);
    const height = Math.ceil(scene.cameras.main.height / gridSize);
    
    // Crea una griglia vuota
    const newGrid = Array(height).fill(0).map(() => Array(width).fill(0));
    
    // Aggiungi alcuni "mobili" al laboratorio come esempio
    const furniture = scene.add.graphics();
    furniture.fillStyle(scene.theme.colorPalette.secondary, 0.7);
    
    // Tavolo centrale grande con forma rettangolare arrotondata (stile italiano classico)
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    // Tavolo grande al centro con bordi decorativi
    furniture.fillStyle(0x8b4513, 0.8); // Marrone scuro per il bordo
    furniture.fillRoundedRect(
      centerX * gridSize - 85, 
      centerY * gridSize - 45, 
      170, 
      90,
      10
    );
    
    furniture.fillStyle(0xd2691e, 0.8); // Tonalità terracotta per l'interno
    furniture.fillRoundedRect(
      centerX * gridSize - 80, 
      centerY * gridSize - 40, 
      160, 
      80,
      8
    );
    
    // Marca il tavolo come non percorribile nella griglia
    for (let y = centerY - 1; y <= centerY + 1; y++) {
      for (let x = centerX - 2; x <= centerX + 2; x++) {
        if (y >= 0 && y < height && x >= 0 && x < width) {
          newGrid[y][x] = 1;
        }
      }
    }
    
    // Postazioni di lavoro lungo i bordi con dettagli italiani classici
    furniture.fillStyle(0x8b4513, 0.7); // Marrone scuro
    
    // Postazioni sul lato sinistro
    for (let y = 2; y < height - 2; y += 3) {
      // Cornice decorativa
      furniture.fillRoundedRect(gridSize - 2, y * gridSize - 2, gridSize * 2 + 4, gridSize + 4, 5);
      // Scrivania
      furniture.fillStyle(0xcd853f, 0.8); // Marrone più chiaro
      furniture.fillRoundedRect(gridSize, y * gridSize, gridSize * 2, gridSize, 3);
      furniture.fillStyle(0x8b4513, 0.7); // Ripristina il colore
      
      // Marca come non percorribile
      if (y >= 0 && y < height) {
        newGrid[y][1] = 1;
        newGrid[y][2] = 1;
      }
    }
    
    // Postazioni sul lato destro
    for (let y = 2; y < height - 2; y += 3) {
      // Cornice decorativa
      furniture.fillRoundedRect(width * gridSize - gridSize * 3 - 2, y * gridSize - 2, gridSize * 2 + 4, gridSize + 4, 5);
      // Scrivania
      furniture.fillStyle(0xcd853f, 0.8); // Marrone più chiaro
      furniture.fillRoundedRect(width * gridSize - gridSize * 3, y * gridSize, gridSize * 2, gridSize, 3);
      furniture.fillStyle(0x8b4513, 0.7); // Ripristina il colore
      
      // Marca come non percorribile
      if (y >= 0 && y < height) {
        newGrid[y][width - 2] = 1;
        newGrid[y][width - 3] = 1;
      }
    }
    
    // Libreria con testi di economia lungo la parete superiore
    furniture.fillStyle(0x8b4513, 0.9); // Marrone scuro
    furniture.fillRect(0, 0, width * gridSize, gridSize);
    
    // Dettagli libreria
    for (let x = gridSize; x < width * gridSize - gridSize; x += gridSize) {
      furniture.fillStyle(0xcd853f, 0.8); // Marrone più chiaro
      furniture.fillRect(x, 0, gridSize - 8, gridSize);
    }
    
    // Marca la libreria come non percorribile
    for (let x = 0; x < width; x++) {
      newGrid[0][x] = 1;
    }
    
    furniture.setDepth(-5);
    
    // Assegna la griglia alla scena usando il metodo setter
    scene.grid = newGrid;
  } catch (error) {
    console.error('Error in createTemporaryMap:', error);
    scene.updateDebugInfo(`Map error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Crea una griglia di pathfinding basata su un'immagine
 */
export function createGridFromImage(scene: IMercatorumLabScene, image: Phaser.GameObjects.Image): void {
  try {
    const gridSize = 32;
    const width = Math.ceil(scene.cameras.main.width / gridSize);
    const height = Math.ceil(scene.cameras.main.height / gridSize);
    
    // Crea una griglia base
    const newGrid = Array(height).fill(0).map(() => Array(width).fill(0));
    
    // In una versione avanzata, qui analizzeremmo i pixel dell'immagine
    // Per semplicità, creiamo solo una zona non attraversabile al centro
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    // Marca un'area centrale come non attraversabile (es. il tavolo)
    for (let y = centerY - 1; y <= centerY + 1; y++) {
      for (let x = centerX - 2; x <= centerX + 2; x++) {
        if (y >= 0 && y < height && x >= 0 && x < width) {
          newGrid[y][x] = 1;
        }
      }
    }
    
    // Marca una zona superiore come non attraversabile (es. libreria)
    for (let x = 0; x < width; x++) {
      newGrid[0][x] = 1;
    }
    
    // Aggiorna la griglia della scena
    scene.grid = newGrid;
  } catch (error) {
    console.error('Error in createGridFromImage:', error);
  }
}

/**
 * Inizializza la griglia per il pathfinding
 */
export function initializeGrid(scene: IMercatorumLabScene): void {
  try {
    // Ottiene dimensioni della griglia in modo sicuro
    const grid = scene.grid || [];
    const gridWidth = grid.length > 0 ? grid[0].length : 0;
    const gridHeight = grid.length;
    
    console.log('Grid initialized with dimensions:', gridHeight, 'x', gridWidth);
  } catch (error) {
    console.error('Error in initializeGrid:', error);
  }
}

/**
 * Crea le zone di interazione nel laboratorio
 */
export function createInteractionZones(scene: IMercatorumLabScene): void {
  try {
    console.log('Creating interaction zones');
    const gridSize = 32;
    
    // Crea un array temporaneo di zone
    const newZones: Phaser.GameObjects.Zone[] = [];
    
    // Area centrale per tavolo meeting
    const meetingZone = scene.add.zone(
      scene.cameras.main.width / 2, 
      scene.cameras.main.height / 2, 
      gridSize * 4, 
      gridSize * 3
    );
    meetingZone.setName('meeting_table');
    meetingZone.setInteractive();
    
    // Debug: visualizza la zona
    const zoneGraphics = scene.add.graphics();
    zoneGraphics.lineStyle(2, 0x00ff00, 0.5);
    zoneGraphics.strokeRect(
      meetingZone.x - meetingZone.width / 2, 
      meetingZone.y - meetingZone.height / 2, 
      meetingZone.width, 
      meetingZone.height
    );
    
    newZones.push(meetingZone);
    
    // Area biblioteca - zona di ricerca
    const libraryZone = scene.add.zone(
      scene.cameras.main.width / 2, 
      gridSize, 
      scene.cameras.main.width - 100, 
      gridSize * 2
    );
    libraryZone.setName('library');
    libraryZone.setInteractive();
    
    // Debug: visualizza la zona
    zoneGraphics.lineStyle(2, 0x00ff00, 0.5);
    zoneGraphics.strokeRect(
      libraryZone.x - libraryZone.width / 2, 
      libraryZone.y - libraryZone.height / 2, 
      libraryZone.width, 
      libraryZone.height
    );
    
    newZones.push(libraryZone);
    
    // Area per visualizzazione dati finanziari
    const dataZone = scene.add.zone(
      100, 
      300, 
      gridSize * 4, 
      gridSize * 4
    );
    dataZone.setName('financial_data');
    dataZone.setInteractive();
    
    // Debug: visualizza la zona
    zoneGraphics.lineStyle(2, 0x00ff00, 0.5);
    zoneGraphics.strokeRect(
      dataZone.x - dataZone.width / 2, 
      dataZone.y - dataZone.height / 2, 
      dataZone.width, 
      dataZone.height
    );
    
    newZones.push(dataZone);
    
    // Aggiorna le zone di interazione nella scena
    scene.interactionZones = newZones;
  } catch (error) {
    console.error('Error in createInteractionZones:', error);
  }
}

/**
 * Configura la camera
 */
export function setupCamera(scene: IMercatorumLabScene): void {
  try {
    console.log('Setting up camera');
    // Imposta i limiti della camera alle dimensioni del canvas
    scene.cameras.main.setBounds(0, 0, scene.cameras.main.width, scene.cameras.main.height);
    
    // Zoom iniziale
    scene.cameras.main.setZoom(1);
    
    // Posiziona la camera al centro
    scene.cameras.main.centerOn(scene.cameras.main.width / 2, scene.cameras.main.height / 2);
    
    // Aggiungi controlli di zoom (mousewheel)
    scene.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number) => {
      const currentZoom = scene.cameras.main.zoom;
      let newZoom = currentZoom;
      
      if (deltaY > 0) {
        newZoom = Math.max(0.8, currentZoom - 0.1);
      } else {
        newZoom = Math.min(2, currentZoom + 0.1);
      }
      
      scene.cameras.main.setZoom(newZoom);
    });
    
    // Aggiungi controlli di trascinamento per la camera
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        scene.cameras.main.scrollX -= pointer.velocity.x / 10;
        scene.cameras.main.scrollY -= pointer.velocity.y / 10;
      }
    });
  } catch (error) {
    console.error('Error in setupCamera:', error);
  }
}

/**
 * Trova un percorso tra due punti usando una versione semplificata dell'algoritmo A*
 */
export function findPath(
  scene: IMercatorumLabScene, 
  startX: number, 
  startY: number, 
  targetX: number, 
  targetY: number
): {x: number, y: number}[] {
  // Implementazione semplificata che restituisce un percorso diretto
  // In una versione completa, qui andrebbe implementato l'algoritmo A*
  const path = [
    { x: startX, y: startY },
    { x: targetX, y: targetY }
  ];
  
  return path;
}