// frontend/src/utils/assetDebug.ts

/**
 * Utilities per il debug degli asset
 */

import { ASSETS } from '../phaser/assetConfig';

/**
 * Verifica l'esistenza di asset in fase di sviluppo tramite fetch
 * @param path Percorso dell'asset da verificare
 * @returns Promise<boolean> true se l'asset esiste, false altrimenti
 */
export async function checkAssetExists(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error(`Failed to check asset: ${path}`, error);
    return false;
  }
}

/**
 * Verifica tutti gli asset configurati e restituisce un report sullo stato
 * @returns Promise<object> Oggetto con il report dello stato degli asset
 */
export async function verifyAllAssets(): Promise<Record<string, any>> {
  const report: Record<string, any> = {
    tilemaps: {},
    tilesets: {},
    characters: {},
    ui: {}
  };

  // Verifica tilemaps
  for (const [key, path] of Object.entries(ASSETS.tilemaps)) {
    report.tilemaps[key] = await checkAssetExists(path);
  }

  // Verifica tilesets
  for (const [key, path] of Object.entries(ASSETS.tilesets)) {
    report.tilesets[key] = await checkAssetExists(path);
  }

  // Verifica characters
  for (const [key, char] of Object.entries(ASSETS.characters)) {
    report.characters[key] = await checkAssetExists(char.path);
  }

  // Verifica UI
  for (const [key, path] of Object.entries(ASSETS.ui)) {
    report.ui[key] = await checkAssetExists(path);
  }

  // Stampa report in console
  console.log('Asset verification report:');
  console.table(report.tilemaps);
  console.table(report.tilesets);
  console.table(report.characters);
  console.table(report.ui);

  return report;
}

/**
 * Crea asset placeholder per gli asset mancanti
 * @param scene Scena Phaser in cui creare gli asset
 * @param report Report degli asset da verificare
 */
export function createPlaceholdersForMissingAssets(scene: Phaser.Scene, report: Record<string, any>): void {
  try {
    const missingAssets: string[] = [];

    // Raccoglie tutti gli asset mancanti dal report
    Object.keys(report).forEach(category => {
      Object.entries(report[category]).forEach(([key, exists]) => {
        if (!exists) {
          missingAssets.push(`${category}/${key}`);
        }
      });
    });

    if (missingAssets.length > 0) {
      console.warn('Missing assets that need placeholders:', missingAssets);

      // Crea una texture placeholder di base
      const graphics = scene.add.graphics();
      graphics.fillStyle(0xcccccc);
      graphics.fillRect(0, 0, 64, 64);
      graphics.lineStyle(2, 0xff0000);
      graphics.strokeRect(0, 0, 64, 64);
      graphics.lineStyle(2, 0xff0000);
      graphics.lineBetween(0, 0, 64, 64);
      graphics.lineBetween(64, 0, 0, 64);
      graphics.generateTexture('__missing_asset', 64, 64);
      graphics.destroy();

      // Logica specifica per creare placeholder adeguati
      // Implementabile in base alle esigenze
    }
  } catch (error) {
    console.error('Error creating placeholders for missing assets:', error);
  }
}

/**
 * Funzione di debug da chiamare in fase di sviluppo per verificare gli asset 
 */
export function debugAssets(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('Base public URL:', process.env.PUBLIC_URL || '');
    console.log('Checking asset paths...');
    
    // Stampa tutti i percorsi degli asset configurati
    console.group('Configured Asset Paths:');
    console.log('Tilemaps:', ASSETS.tilemaps);
    console.log('Tilesets:', ASSETS.tilesets);
    console.log('Characters:', Object.entries(ASSETS.characters).map(([k, v]) => `${k}: ${v.path}`));
    console.log('UI:', ASSETS.ui);
    console.groupEnd();
    
    // Verifica esistenza asset
    verifyAllAssets().then(report => {
      console.log('Asset verification complete');
      
      // Conta asset mancanti
      let missingCount = 0;
      Object.values(report).forEach(category => {
        Object.values(category).forEach(exists => {
          if (!exists) missingCount++;
        });
      });
      
      if (missingCount > 0) {
        console.error(`Found ${missingCount} missing assets. Check your asset paths and file structure.`);
      } else {
        console.log('All assets verified successfully!');
      }
    });
  }
}