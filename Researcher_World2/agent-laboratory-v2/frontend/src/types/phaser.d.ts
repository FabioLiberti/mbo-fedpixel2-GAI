// src/types/phaser.d.ts

// Non abbiamo bisogno di importare Phaser qui perché stiamo estendendo le definizioni dei tipi
import { AssetLoader } from '../phaser/utils/AssetLoader';

declare module 'phaser' {
  namespace Phaser {
    interface Scene {
      _assetLoader: AssetLoader | undefined;
      getAssetLoader(): AssetLoader;
      loadTilemapJSON(key: string, url: string): void;
    }
  }
}