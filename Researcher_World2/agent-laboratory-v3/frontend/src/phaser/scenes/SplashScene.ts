import Phaser from 'phaser';

export default class SplashScene extends Phaser.Scene {
  private clickText: Phaser.GameObjects.Text | null = null;
  private isTransitioning: boolean = false;
  private autoTransitionTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('SplashScene');
  }

  preload() {
    console.log('SplashScene preload started');
  }

  create() {
    // Imposta lo sfondo trasparente per lasciare che il video HTML sia visibile
    this.cameras.main.setBackgroundColor('rgba(0, 0, 0, 0)');
    
    // Crea il testo di click
    this.createClickText();
    
    // Configura gli ascoltatori di eventi
    this.setupEventListeners();
    
    // Imposta un timer di fallback per la transizione automatica
    this.autoTransitionTimer = this.time.delayedCall(20000, () => {
      if (!this.isTransitioning) {
        console.log('Auto transition triggered (timeout fallback)');
        this.startTransition();
      }
    });
    
    console.log('SplashScene create completed');
  }

  private createClickText() {
    this.clickText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.height - 40,
      'Click anywhere to skip',
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff'
      }
    );
    
    if (this.clickText) {
      this.clickText.setOrigin(0.5);
      this.clickText.setAlpha(0.7);
      
      // Crea un'animazione di pulsazione per il testo
      this.tweens.add({
        targets: this.clickText,
        alpha: { from: 0.5, to: 1 },
        duration: 1000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
    }
  }

  private setupEventListeners() {
    // Aggiungi un listener per il click per passare alla prossima scena
    this.input.on('pointerdown', () => {
      console.log('Click detected in Phaser');
      if (!this.isTransitioning) {
        this.startTransition();
      }
    });
    
    // Aggiungi un listener per il tasto spazio e invio per passare alla prossima scena
    this.input.keyboard?.on('keydown-SPACE', () => {
      console.log('Space key pressed');
      if (!this.isTransitioning) {
        this.startTransition();
      }
    });
    
    this.input.keyboard?.on('keydown-ENTER', () => {
      console.log('Enter key pressed');
      if (!this.isTransitioning) {
        this.startTransition();
      }
    });
    
    // Ascoltatore per l'evento di video terminato
    window.addEventListener('videoSplashEnded', () => {
      console.log('Video ended event received in Phaser');
      if (!this.isTransitioning) {
        // Invece di iniziare subito la transizione,
        // lasciamo che l'utente interagisca per continuare
        // oppure scatti il timeout nel componente React
      }
    });
  }

  private startTransition() {
    if (this.isTransitioning) return;
    
    console.log('Starting transition to next scene from Phaser');
    this.isTransitioning = true;
    
    // Cancella il timer di transizione automatica se esistente
    if (this.autoTransitionTimer) {
      this.autoTransitionTimer.remove();
      this.autoTransitionTimer = null;
    }
    
    // Crea una dissolvenza in uscita per il testo di click
    if (this.clickText) {
      this.tweens.add({
        targets: this.clickText,
        alpha: 0,
        duration: 500,
        ease: 'Power2'
      });
    }
    
    // Invia un evento per informare il componente React di nascondere il video
    const hideVideoEvent = new CustomEvent('hideVideoSplash');
    window.dispatchEvent(hideVideoEvent);
    
    // Aspetta un momento per permettere alle animazioni di completarsi
    this.time.delayedCall(600, () => {
      // Cambia alla scena WorldMap
      console.log('Transitioning to WorldMapScene');
      this.scene.start('WorldMapScene');
      
      // Emetti un evento personalizzato per notificare che la splash screen è completata
      const customEvent = new CustomEvent('splashScreenComplete');
      window.dispatchEvent(customEvent);
    });
  }

  update() {
    // Nessun codice di update necessario
  }
}