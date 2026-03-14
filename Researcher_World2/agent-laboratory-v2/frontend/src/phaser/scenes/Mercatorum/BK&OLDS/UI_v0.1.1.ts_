// src/phaser/scenes/Mercatorum/UI.ts

import { MercatorumLabScene } from './MercatorumLabScene';

// Inizializza l'interfaccia utente
export function setupUI(scene: MercatorumLabScene): void {
  try {
    // Crea il titolo stilizzato
    createLaboratoryTitle(scene);
    
    // Nota: le funzionalità di navigazione, info laboratorio e legenda 
    // sono state spostate nel pannello di controllo o nei controlli laterali
  } catch (error) {
    console.error('Error in setupUI:', error);
  }
}

/**
 * Crea il titolo del laboratorio con effetti stilizzati
 */
export function createLaboratoryTitle(scene: MercatorumLabScene): void {
  try {
    // Crea un container per tutto il titolo
    const titleContainer = scene.add.container(scene.cameras.main.centerX, 25);
    titleContainer.setDepth(10);

    // Calcoliamo la dimensione necessaria per il testo
    const tempText = scene.add.text(
      0, 
      0,
      'Università Mercatorum Lab',
      { 
        fontSize: '40px',
        fontFamily: 'serif',
        fontStyle: 'bold'
      }
    );
    // Otteniamo la larghezza del testo e aggiungiamo del padding
    const textWidth = tempText.width + 60;
    const textHeight = tempText.height + 20;
    tempText.destroy(); // Rimuoviamo il testo temporaneo

    // Creiamo uno sfondo con stile italiano classico
    const titleBackground = scene.add.graphics();
    // Ombra dello sfondo
    titleBackground.fillStyle(0x7b5c3e, 0.9);
    titleBackground.fillRoundedRect(-textWidth/2 - 5, -textHeight/2 - 5, textWidth + 10, textHeight + 10, 8);
    // Sfondo principale in tonalità terracotta
    titleBackground.fillStyle(0xd2691e, 0.95);
    titleBackground.fillRoundedRect(-textWidth/2, -textHeight/2, textWidth, textHeight, 8);
    // Bordo con dettagli ornamentali
    titleBackground.lineStyle(3, 0xf5f5dc, 1);
    titleBackground.strokeRoundedRect(-textWidth/2, -textHeight/2, textWidth, textHeight, 8);
    titleBackground.setDepth(5);

    // Aggiungiamo il background al container
    titleContainer.add(titleBackground);

    // Ombra molto profonda (livello 4)
    const textShadow4 = scene.add.text(
      6, 
      6,
      'Università Mercatorum Lab',
      { 
        fontSize: '40px',
        color: '#3a2915',
        align: 'center',
        fontFamily: 'serif',
        fontStyle: 'bold'
      }
    );
    textShadow4.setOrigin(0.5);
    textShadow4.setDepth(6);
    textShadow4.setAlpha(0.3);
    titleContainer.add(textShadow4);

    // Ombra profonda (livello 3)
    const textShadow3 = scene.add.text(
      4, 
      4,
      'Università Mercatorum Lab',
      { 
        fontSize: '40px',
        color: '#4f3a20',
        align: 'center',
        fontFamily: 'serif',
        fontStyle: 'bold'
      }
    );
    textShadow3.setOrigin(0.5);
    textShadow3.setDepth(7);
    textShadow3.setAlpha(0.5);
    titleContainer.add(textShadow3);

    // Ombra media (livello 2)
    const textShadow2 = scene.add.text(
      3, 
      3,
      'Università Mercatorum Lab',
      { 
        fontSize: '40px',
        color: '#644b2b',
        align: 'center',
        fontFamily: 'serif',
        fontStyle: 'bold'
      }
    );
    textShadow2.setOrigin(0.5);
    textShadow2.setDepth(8);
    textShadow2.setAlpha(0.6);
    titleContainer.add(textShadow2);

    // Ombra vicina (livello 1)
    const textShadow = scene.add.text(
      2, 
      2,
      'Università Mercatorum Lab',
      { 
        fontSize: '40px',
        color: '#7a5e36',
        align: 'center',
        fontFamily: 'serif',
        fontStyle: 'bold'
      }
    );
    textShadow.setOrigin(0.5);
    textShadow.setDepth(9);
    textShadow.setAlpha(0.7);
    titleContainer.add(textShadow);

    // Testo principale in color crema
    const text = scene.add.text(
      0, 
      0,
      'Università Mercatorum Lab',
      { 
        fontSize: '40px',
        color: '#f5f5dc',
        align: 'center',
        fontFamily: 'serif',
        fontStyle: 'bold'
      }
    );
    text.setOrigin(0.5);
    text.setDepth(10);
    titleContainer.add(text);

    // Aggiungiamo un effetto di brillantezza al testo
    const glowEffect = scene.add.graphics();
    glowEffect.fillStyle(0xf5f5dc, 0.1);

    // Più strati di glow per un effetto di brillantezza
    for (let i = 0; i < 3; i++) {
      const size = 3 + (i * 2);
      glowEffect.fillCircle(0, 0, size);
    }
    glowEffect.setDepth(9);
    glowEffect.setBlendMode(Phaser.BlendModes.ADD);
    titleContainer.add(glowEffect);

    // Aggiungiamo decorazioni in stile italiano classico
    const decorations = scene.add.graphics();
    decorations.fillStyle(0xf5f5dc, 1);
    
    // Piccoli dettagli decorativi agli angoli
    decorations.fillRect(-textWidth/2 + 4, -textHeight/2 + 4, 8, 2);
    decorations.fillRect(-textWidth/2 + 4, -textHeight/2 + 4, 2, 8);
    
    decorations.fillRect(textWidth/2 - 12, -textHeight/2 + 4, 8, 2);
    decorations.fillRect(textWidth/2 - 6, -textHeight/2 + 4, 2, 8);
    
    decorations.fillRect(-textWidth/2 + 4, textHeight/2 - 6, 8, 2);
    decorations.fillRect(-textWidth/2 + 4, textHeight/2 - 12, 2, 8);
    
    decorations.fillRect(textWidth/2 - 12, textHeight/2 - 6, 8, 2);
    decorations.fillRect(textWidth/2 - 6, textHeight/2 - 12, 2, 8);
    
    decorations.setDepth(12);
    titleContainer.add(decorations);
  } catch (error) {
    console.error('Error creating laboratory title:', error);
  }
}

/**
 * Mostra informazioni specifiche sul laboratorio Mercatorum
 */
export function showLabInfo(scene: MercatorumLabScene): void {
  try {
    // Crea un pannello di informazioni sul laboratorio
    const infoPanel = scene.add.container(
      scene.cameras.main.centerX,
      scene.cameras.main.centerY
    );
    infoPanel.setDepth(1000);
    
    // Sfondo del pannello
    const background = scene.add.graphics();
    background.fillStyle(0x1a365d, 0.9); // Blu navy
    background.fillRoundedRect(-250, -200, 500, 400, 10);
    background.lineStyle(3, 0xd2691e, 1); // Bordo terracotta
    background.strokeRoundedRect(-250, -200, 500, 400, 10);
    infoPanel.add(background);
    
    // Titolo
    const title = scene.add.text(
      0, 
      -170, 
      'Università Mercatorum Lab', 
      { 
        fontSize: '24px',
        color: '#f5f5dc', // Crema
        fontStyle: 'bold',
        align: 'center'
      }
    );
    title.setOrigin(0.5);
    infoPanel.add(title);
    
    // Descrizione in stile italiano classico
    const descriptionText = 
      'Laboratorio di ricerca specializzato in business intelligence ' +
      'e analisi finanziaria federata. Questo ambiente combina ' +
      'elementi architettonici classici italiani con tecnologie ' +
      'all\'avanguardia per la privacy dei dati finanziari.\n\n' +
      'Specializzazione in:\n' +
      '• Business intelligence e analisi finanziaria federata\n' +
      '• Privacy-preserving analytics per dati aziendali sensibili\n' +
      '• Compliance GDPR e framework regolatori\n' +
      '• Ottimizzazione di modelli federati per previsioni di mercato';
    
    const description = scene.add.text(
      0,
      -80,
      descriptionText,
      {
        fontSize: '16px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 450 }
      }
    );
    description.setOrigin(0.5, 0);
    infoPanel.add(description);
    
    // Pulsante di chiusura
    const closeButton = scene.add.text(
      230, 
      -180, 
      'X', 
      { 
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#aa0000',
        padding: { left: 8, right: 8, top: 5, bottom: 5 }
      }
    );
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on('pointerdown', () => {
      infoPanel.destroy();
    });
    infoPanel.add(closeButton);
    
    // Logo Mercatorum (se disponibile)
    if (scene.textures.exists('mercatorum-logo')) {
      const logo = scene.add.image(0, 130, 'mercatorum-logo');
      logo.setScale(0.5);
      infoPanel.add(logo);
    }
    
  } catch (error) {
    console.error('Error showing lab info:', error);
  }
}