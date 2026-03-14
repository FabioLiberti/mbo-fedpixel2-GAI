import Phaser from 'phaser';

export default class SplashScene extends Phaser.Scene {
  private clickText: Phaser.GameObjects.Text | null = null;
  private isTransitioning: boolean = false;
  private htmlVideoElement: HTMLVideoElement | null = null;
  private videoOverlay: Phaser.GameObjects.DOMElement | null = null;
  private autoTransitionTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('SplashScene');
  }

  preload() {
    // Precarica solo gli asset di base, nessun video
    console.log('SplashScene preload started');
  }

  create() {
    // Imposta lo sfondo nero
    this.cameras.main.setBackgroundColor('#000000');
    
    // Crea il testo di click
    this.createClickText();
    
    // Configura gli ascoltatori di eventi
    this.setupEventListeners();

    // Informa l'app React che la scena splash di Phaser è pronta
    const readyEvent = new CustomEvent('splashScreenReady');
    window.dispatchEvent(readyEvent);

    // Tenta di trovare l'elemento video creato dal componente React
    this.time.delayedCall(500, () => {
      this.connectToHtmlVideo();
    });
    
    // Imposta un timer di fallback per la transizione automatica
    this.autoTransitionTimer = this.time.delayedCall(15000, () => {
      if (!this.isTransitioning) {
        console.log('Auto transition triggered (timeout fallback)');
        this.startTransition();
      }
    });
    
    console.log('SplashScene create completed');
  }

  private connectToHtmlVideo() {
    // Cerca l'elemento video creato dal componente React
    this.htmlVideoElement = document.getElementById('splash-video') as HTMLVideoElement;
    
    if (this.htmlVideoElement) {
      console.log('Connected to HTML video element');
      
      // Aggiungi event listener per sapere quando il video è finito
      this.htmlVideoElement.addEventListener('ended', () => {
        console.log('HTML video playback ended');
        if (!this.isTransitioning) {
          this.startTransition();
        }
      });
      
      // Aggiungi event listener per errori di riproduzione
      this.htmlVideoElement.addEventListener('error', (e) => {
        console.error('HTML video error:', e);
        if (!this.isTransitioning) {
          this.time.delayedCall(2000, () => {
            this.startTransition();
          });
        }
      });
    } else {
      console.warn('No HTML video element found with id "splash-video"');
    }
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
      console.log('Click detected');
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
  }

  private startTransition() {
    if (this.isTransitioning) return;
    
    console.log('Starting transition to next scene');
    this.isTransitioning = true;
    
    // Cancella il timer di transizione automatica se esistente
    if (this.autoTransitionTimer) {
      this.autoTransitionTimer.remove();
      this.autoTransitionTimer = null;
    }
    
    // Ferma il video HTML se esiste
    if (this.htmlVideoElement) {
      // Abbassa il volume gradualmente
      const fadeOut = setInterval(() => {
        if (this.htmlVideoElement && this.htmlVideoElement.volume > 0.1) {
          this.htmlVideoElement.volume -= 0.1;
        } else {
          clearInterval(fadeOut);
          if (this.htmlVideoElement) {
            this.htmlVideoElement.pause();
          }
        }
      }, 50);
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
    
    // Aspetta un momento per permettere alle animazioni di completarsi
    this.time.delayedCall(600, () => {
      // Invia un evento per informare il componente React di nascondere il video
      const hideVideoEvent = new CustomEvent('hideVideoSplash');
      window.dispatchEvent(hideVideoEvent);
      
      // Cambia alla scena WorldMap
      console.log('Transitioning to WorldMapScene');
      this.scene.start('WorldMapScene');
      
      // Emetti un evento personalizzato per notificare che la splash screen è completata
      const customEvent = new CustomEvent('splashScreenComplete');
      window.dispatchEvent(customEvent);
    });
  }

  update() {
    // Nessuna logica di aggiornamento necessaria
  }
}