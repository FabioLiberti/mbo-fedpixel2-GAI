import Phaser from 'phaser';

/**
 * Gestore audio che offre operazioni sicure anche quando l'audio è disabilitato
 */
export class AudioManager {
  private static isAudioMuted = true; // Default a true dato che l'audio è disabilitato
  
  /**
   * Determina se il sistema audio è disponibile e utilizzabile
   */
  public static isAudioAvailable(game: Phaser.Game): boolean {
    try {
      return !!(game.sound && 
                game.sound.context && 
                game.sound.context.state !== 'closed' &&
                !game.sound.noAudio);
    } catch (error) {
      console.warn('[AudioManager] Errore nel controllo audio:', error);
      return false;
    }
  }
  
  /**
   * Safely handles audio operations and prevents errors with closed AudioContext
   * @param scene The current Phaser scene
   * @param operation The operation to perform
   */
  public static safeAudioOperation(
    scene: Phaser.Scene, 
    operation: (sound: Phaser.Sound.BaseSoundManager) => void
  ): void {
    // Non fare nulla se l'audio è disabilitato
    if (!scene.game.sound || scene.game.sound.noAudio) {
      return;
    }
    
    try {
      if (!scene.sound || 
          !scene.sound.context || 
          scene.sound.context.state === 'closed') {
        // Skip operation if context is closed or not available
        return;
      }
      
      operation(scene.sound);
    } catch (error) {
      // Solo log in sviluppo, nessun avviso in produzione
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AudioManager] Audio operation failed:', error);
      }
    }
  }
  
  /**
   * Mutes all game audio
   * @param scene The current Phaser scene
   */
  public static muteAudio(scene: Phaser.Scene): void {
    this.isAudioMuted = true;
    this.safeAudioOperation(scene, (sound) => {
      sound.mute = true;
    });
  }
  
  /**
   * Unmutes all game audio
   * @param scene The current Phaser scene
   */
  public static unmuteAudio(scene: Phaser.Scene): void {
    this.isAudioMuted = false;
    this.safeAudioOperation(scene, (sound) => {
      sound.mute = false;
    });
  }
  
  /**
   * Checks if audio is currently muted
   */
  public static isMuted(): boolean {
    return this.isAudioMuted;
  }

  /**
   * Safely resumes the audio context if suspended
   * @param game Phaser game instance
   */
  public static resumeAudioContext(game: Phaser.Game): void {
    // Non fare nulla se l'audio è disabilitato
    if (!game.sound || game.sound.noAudio) {
      return;
    }
    
    try {
      const audioContext = game.sound?.context;
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch((err: Error) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[AudioManager] Failed to resume AudioContext:', err);
          }
        });
      }
    } catch (error) {
      // Solo log in sviluppo
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AudioManager] Error resuming AudioContext:', error);
      }
    }
  }
}