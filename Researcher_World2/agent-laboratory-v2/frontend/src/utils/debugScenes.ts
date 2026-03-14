// frontend/src/utils/debugScenes.ts

import Phaser from 'phaser';

// Utilizziamo direttamente Phaser.Game invece di importare da un file che non esiste
type Game = Phaser.Game;

/**
 * Interfaccia che rappresenta una scena Phaser con le proprietà che utilizziamo
 */
interface PhaserSceneWithDetails extends Phaser.Scene {
  scene: {
    key: string;
    isActive: () => boolean;
    isVisible: () => boolean;
    settings: {
      status: string | number;
    };
    stop: () => void;
  };
  cameras: {
    cameras: any[];
  };
  children: {
    list: any[];
  };
}

/**
 * Interfaccia per il risultato del debug delle scene
 */
export interface SceneDebugInfo {
  scenes: string[];
  activeScenes: string[];
}

/**
 * Utility avanzata per il debug delle scene di Phaser
 * Stampa sulla console informazioni dettagliate sulle scene registrate e il loro stato
 * @param game L'istanza del gioco Phaser
 * @returns Informazioni sulle scene registrate e attive
 */
export function debugScenes(game: Game | null): SceneDebugInfo | null {
  if (!game || !game.scene) {
    console.warn('Game not initialized, cannot debug scenes');
    return null;
  }
  
  console.group('🎮 Phaser Scenes Debug');
  
  // Stampa informazioni di base sul gioco
  console.log('Game instance:', {
    isBooted: game.isBooted,
    config: game.config,
    renderer: game.renderer?.type || 'not initialized'
  });
  
  // Stampa tutte le scene disponibili nel scene manager
  console.log('📋 All registered scenes:');
  try {
    const sceneKeys = game.scene.getScenes().map((scene: PhaserSceneWithDetails) => scene.scene.key);
    console.table(
      game.scene.scenes.map((scene: PhaserSceneWithDetails) => ({
        key: scene.scene.key,
        active: scene.scene.isActive(),
        visible: scene.scene.isVisible(),
        status: scene.scene.settings.status
      }))
    );
    
    // Controlla se ci sono scene con nomi diversi da quelli che ci aspettiamo
    const expectedSceneKeys = ['MercatorumLab', 'BlekingeLabScene', 'OPBGLabScene'];
    const unexpectedScenes = sceneKeys.filter((key: string) => !expectedSceneKeys.includes(key));
    const missingScenes = expectedSceneKeys.filter(key => !sceneKeys.includes(key));
    
    if (unexpectedScenes.length > 0) {
      console.warn('⚠️ Unexpected scenes found:', unexpectedScenes);
    }
    
    if (missingScenes.length > 0) {
      console.error('❌ Missing expected scenes:', missingScenes);
    }
  } catch (error) {
    console.error('Error accessing scenes:', error);
  }
  
  // Stampa scene attive
  console.log('🔍 Current active scenes:');
  try {
    const activeScenes = game.scene.scenes.filter((scene: PhaserSceneWithDetails) => scene.scene.isActive());
    if (activeScenes.length === 0) {
      console.warn('No active scenes found!');
    } else {
      activeScenes.forEach((scene: PhaserSceneWithDetails) => {
        console.log(`Active scene: ${scene.scene.key}`, {
          cameras: scene.cameras.cameras.length,
          children: scene.children.list.length
        });
      });
    }
  } catch (error) {
    console.error('Error accessing active scenes:', error);
  }
  
  // Tenta di verificare se è possibile avviare le scene manualmente
  console.log('🧪 Testing scene availability:');
  ['MercatorumLab', 'BlekingeLabScene', 'OPBGLabScene'].forEach(sceneKey => {
    try {
      // Verifica solo se la scena esiste, senza avviarla
      const exists = game.scene.getScene(sceneKey) !== null;
      console.log(`Scene "${sceneKey}": ${exists ? '✅ exists' : '❌ not found'}`);
    } catch (error) {
      console.error(`Error checking scene "${sceneKey}":`, error);
    }
  });
  
  console.groupEnd();
  
  return {
    scenes: game.scene.scenes.map((s: PhaserSceneWithDetails) => s.scene.key),
    activeScenes: game.scene.scenes.filter((s: PhaserSceneWithDetails) => s.scene.isActive()).map((s: PhaserSceneWithDetails) => s.scene.key)
  };
}