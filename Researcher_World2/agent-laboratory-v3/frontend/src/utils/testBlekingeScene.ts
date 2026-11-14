// src/utils/testBlekingeScene.ts
import Phaser from 'phaser';
import { getGameInstance, initGame } from './gameInstance';

// Interfaccia che rappresenta una scena Phaser con le proprietà che utilizziamo
interface PhaserSceneWithDetails extends Phaser.Scene {
  scene: {
    key: string;
    isActive: () => boolean;
    start: (key: string) => void;
    stop: () => void;
    getScene: (key: string) => Phaser.Scene | null;
  };
}

/**
 * Interfaccia per il risultato del test della scena Blekinge
 */
export interface BlekingeTestResult {
  game: Phaser.Game | null;
  blekingeScene: any | null;
  allScenes: string[];
}

/**
 * Utility per testare e diagnosticare problemi con la scena BlekingeLabScene
 * @returns Risultato del test contenente informazioni sul gioco e sulla scena
 */
export function testBlekingeScene(): BlekingeTestResult | null {
  console.group('🔍 BlekingeLabScene Testing');
  
  // Ottieni l'istanza del gioco esistente
  const existingGame = getGameInstance();
  
  if (!existingGame) {
    console.warn('No existing game instance found. Will try to initialize a new one.');
  }
  
  const game = existingGame || initGame('phaser-game');
  
  if (!game) {
    console.error('Failed to get or initialize game instance');
    console.groupEnd();
    return null;
  }
  
  // Verifica se BlekingeLabScene è già registrata
  console.log('Checking if BlekingeLabScene is registered...');
  let blekingeScene = null;
  
  try {
    blekingeScene = game.scene.getScene('BlekingeLabScene');
    console.log('Scene lookup result:', blekingeScene ? 'Found' : 'Not found');
  } catch (error) {
    console.error('Error looking up BlekingeLabScene:', error);
  }
  
  // Se la scena non è registrata, prova a registrarla manualmente
  if (!blekingeScene) {
    console.log('Attempting to manually add BlekingeLabScene...');
    
    try {
      // Nota: Non possiamo creare l'istanza direttamente poiché non abbiamo l'importazione
      // Proviamo a verificare se la scena è disponibile in altro modo
      console.log('Cannot create new scene instance - BlekingeLabScene import not available');
      
      // Verificare se la scena è disponibile nel registro delle scene
      const sceneExists = game.scene.scenes.some((s: PhaserSceneWithDetails) => 
        s.scene.key === 'BlekingeLabScene');
      
      console.log('Scene exists in registry:', sceneExists ? 'Yes' : 'No');
    } catch (error) {
      console.error('Failed to check scene registry:', error);
    }
  }
  
  // Elenca tutte le scene attuali
  console.log('All current scenes:');
  try {
    const allScenes = game.scene.scenes.map((s: PhaserSceneWithDetails) => s.scene.key);
    console.log(allScenes);
  } catch (error) {
    console.error('Error listing scenes:', error);
  }
  
  // Verifica che tutte le scene necessarie siano registrate
  const requiredScenes = ['MercatorumLab', 'BlekingeLabScene', 'OPBGLabScene'];
  const registeredScenes = new Set(game.scene.scenes.map((s: PhaserSceneWithDetails) => s.scene.key));
  
  console.log('Checking required scenes:');
  requiredScenes.forEach(sceneKey => {
    console.log(`- ${sceneKey}: ${registeredScenes.has(sceneKey) ? '✅' : '❌'}`);
  });
  
  // Tenta di avviare la scena Blekinge
  if (blekingeScene) {
    console.log('Attempting to start BlekingeLabScene...');
    
    try {
      // Stoppa tutte le scene attive
      game.scene.scenes.forEach((scene: PhaserSceneWithDetails) => {
        if (scene.scene.isActive()) {
          scene.scene.stop();
        }
      });
      
      // Avvia la scena Blekinge
      game.scene.start('BlekingeLabScene');
      console.log('Scene start called successfully');
    } catch (error) {
      console.error('Error starting scene:', error);
    }
  }
  
  console.groupEnd();
  
  return {
    game,
    blekingeScene,
    allScenes: game.scene.scenes.map((s: PhaserSceneWithDetails) => s.scene.key)
  };
}