// src/utils/gameInstance.ts
import Phaser from 'phaser';

// Istanza globale del gioco
let gameInstance: Phaser.Game | null = null;

/**
 * Restituisce l'istanza attuale del gioco Phaser, se esistente
 */
export function getGameInstance(): Phaser.Game | null {
  return gameInstance;
}

/**
 * Inizializza una nuova istanza del gioco Phaser
 * @param containerId ID dell'elemento DOM che conterrà il gioco
 */
export function initGame(containerId: string): Phaser.Game | null {
  // Se esiste già un'istanza, distruggila
  if (gameInstance) {
    gameInstance.destroy(true);
  }

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container element with ID '${containerId}' not found`);
    return null;
  }

  // Crea una nuova istanza con configurazione minima
  gameInstance = new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: containerId,
    backgroundColor: '#333333',
  });

  return gameInstance;
}

/**
 * Imposta un'istanza di gioco esistente come istanza globale
 * @param game Istanza di gioco Phaser esistente
 */
export function setGameInstance(game: Phaser.Game): void {
  gameInstance = game;
}