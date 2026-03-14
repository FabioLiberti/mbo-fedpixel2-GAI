import Phaser from 'phaser';

/**
 * Classe per gestire l'animazione di un singolo pixel nello splash screen
 */
export class PixelAnimation {
  private scene: Phaser.Scene;
  private pixel: Phaser.GameObjects.Rectangle;
  private startPosition: { x: number, y: number };
  private endPosition: { x: number, y: number };
  public isCenter: boolean;
  private tween?: Phaser.Tweens.Tween;
  
  /**
   * Crea una nuova animazione per un pixel
   * @param scene La scena Phaser
   * @param pixel L'oggetto rettangolo che rappresenta il pixel
   * @param startPosition Posizione iniziale dell'animazione
   * @param endPosition Posizione finale dell'animazione
   * @param isCenter Se il pixel fa parte del gruppo centrale
   */
  constructor(
    scene: Phaser.Scene,
    pixel: Phaser.GameObjects.Rectangle,
    startPosition: { x: number, y: number },
    endPosition: { x: number, y: number },
    isCenter = false
  ) {
    this.scene = scene;
    this.pixel = pixel;
    this.startPosition = { ...startPosition };
    this.endPosition = { ...endPosition };
    this.isCenter = isCenter;
    
    // Prepara il pixel
    if (!isCenter) {
      // Posiziona il pixel alla posizione iniziale
      this.pixel.x = this.startPosition.x;
      this.pixel.y = this.startPosition.y;
    }
  }
  
  /**
   * Avvia l'animazione del pixel
   * @param duration Durata dell'animazione in ms
   */
  public start(duration: number): void {
    console.log(`[PixelAnimation] Avvio animazione pixel da (${this.startPosition.x}, ${this.startPosition.y}) a (${this.endPosition.x}, ${this.endPosition.y})`);
    
    if (this.isCenter) {
      // I pixel centrali non si muovono, vengono solo mostrati dopo
      return;
    }
    
    try {
      // Rivelazione iniziale
      this.pixel.setAlpha(0.8);
      
      // Movimento dalla posizione iniziale a quella finale
      this.tween = this.scene.tweens.add({
        targets: this.pixel,
        x: this.endPosition.x,
        y: this.endPosition.y,
        ease: 'Cubic.easeInOut',
        duration: duration,
        onComplete: () => {
          // Assicurati che la posizione sia esattamente quella finale
          this.pixel.x = this.endPosition.x;
          this.pixel.y = this.endPosition.y;
        }
      });
    } catch (error) {
      console.error('[PixelAnimation] Errore nell\'avvio dell\'animazione:', error);
    }
  }
  
  /**
   * Effettua il fade-in del pixel (usato principalmente per i pixel centrali)
   * @param duration Durata del fade in ms
   */
  public fadeIn(duration: number): void {
    console.log(`[PixelAnimation] Fade in pixel a (${this.endPosition.x}, ${this.endPosition.y})`);
    
    try {
      // Assicurati che il pixel sia nella posizione finale
      this.pixel.x = this.endPosition.x;
      this.pixel.y = this.endPosition.y;
      
      // Fade in
      this.scene.tweens.add({
        targets: this.pixel,
        alpha: 1,
        ease: 'Sine.easeIn',
        duration: duration
      });
    } catch (error) {
      console.error('[PixelAnimation] Errore nel fade in:', error);
    }
  }
  
  /**
   * Salta l'animazione e porta il pixel alla posizione finale
   */
  public skip(): void {
    console.log(`[PixelAnimation] Skip animazione pixel`);
    
    try {
      // Ferma l'animazione corrente
      if (this.tween) {
        this.tween.stop();
      }
      
      // Posiziona il pixel alla posizione finale
      this.pixel.x = this.endPosition.x;
      this.pixel.y = this.endPosition.y;
      
      // Mostra il pixel (a meno che non sia un pixel centrale)
      if (!this.isCenter) {
        this.pixel.setAlpha(0.8);
      }
    } catch (error) {
      console.error('[PixelAnimation] Errore nello skip dell\'animazione:', error);
    }
  }
  
  /**
   * Ottiene l'oggetto pixel
   */
  public getPixel(): Phaser.GameObjects.Rectangle {
    return this.pixel;
  }
}