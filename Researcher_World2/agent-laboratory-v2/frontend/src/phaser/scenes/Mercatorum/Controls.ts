// src/phaser/scenes/Mercatorum/Controls.ts

import { MercatorumLabScene } from './MercatorumLabScene';
import { showLabInfo } from './UI';
import { IMercatorumLabScene } from './types';
import { integrateAgentsLegend } from '../../examples/AgentsLegendIntegration';
import { LLMControlPanel } from '../../ui/LLMControlPanel';
import { SimpleLLMPanel } from '../../ui/simple/SimpleLLMPanel'; // Aggiunta importazione SimpleLLMPanel

/**
 * Crea un pannello di controllo a scomparsa che contiene tutti i pulsanti e le funzioni
 */
export function createControlPanel(scene: IMercatorumLabScene): void {
  try {
    console.log('Creating control panel');
    
    // Dimensioni e posizione del pannello
    const panelWidth = 240;
    const panelHeight = 490; // Aumentato per contenere il nuovo pulsante
    const panelX = scene.cameras.main.width - 40;
    const panelY = scene.cameras.main.height - 40;
    
    // Crea il contenitore principale
    scene.controlPanel = scene.add.container(panelX, panelY);
    
    // Verifica che il pannello sia stato creato prima di utilizzarlo
    if (!scene.controlPanel) {
      console.error('Failed to create control panel container');
      return;
    }
    
    scene.controlPanel.setDepth(1000);
    
    // Crea lo sfondo del pannello
    const panelBackground = scene.add.graphics();
    panelBackground.fillStyle(0x1a365d, 0.9); // Blu navy semi-trasparente
    panelBackground.fillRoundedRect(-panelWidth, -panelHeight, panelWidth, panelHeight, 10);
    panelBackground.lineStyle(2, 0xd2691e, 1); // Bordo terracotta
    panelBackground.strokeRoundedRect(-panelWidth, -panelHeight, panelWidth, panelHeight, 10);
    
    // Aggiungi lo sfondo al container
    scene.controlPanel.add(panelBackground);
    
    // Titolo del pannello
    const panelTitle = scene.add.text(
      -panelWidth/2,
      -panelHeight + 20,
      'Controlli Lab',
      {
        fontSize: '18px',
        color: '#f5f5dc',
        fontStyle: 'bold'
      }
    );
    panelTitle.setOrigin(0.5, 0.5);
    scene.controlPanel.add(panelTitle);
    
    // Separatore sotto il titolo
    const separator = scene.add.graphics();
    separator.lineStyle(2, 0xd2691e, 0.8);
    separator.lineBetween(-panelWidth + 20, -panelHeight + 40, -20, -panelHeight + 40);
    scene.controlPanel.add(separator);
    
    // SEZIONE: Agenti
    // Titolo sezione
    const agentsTitle = scene.add.text(
      -panelWidth + 20,
      -panelHeight + 60,
      'Agenti',
      {
        fontSize: '16px',
        color: '#f5f5dc',
        fontStyle: 'bold'
      }
    );
    scene.controlPanel.add(agentsTitle);
    
    // Pulsante Mostra Legenda Agenti
    createControlButton(
      scene,
      -panelWidth/2,
      -panelHeight + 90,
      'Legenda Agenti',
      () => {
        toggleAgentsLegend(scene);
      }
    );
    
    // Pulsante Stimola Movimento
    createControlButton(
      scene,
      -panelWidth/2,
      -panelHeight + 130,
      'Stimola Movimento',
      () => {
        // Forza movimento di tutti gli agenti
        if (scene.agents.length > 0) {
          scene.agents.forEach(agent => {
            const randomX = Math.random() * scene.cameras.main.width;
            const randomY = Math.random() * scene.cameras.main.height;
            agent.moveTo(randomX, randomY);
          });
        }
      }
    );
    
    // NUOVA SEZIONE: LLM
    // Titolo sezione
    const llmTitle = scene.add.text(
      -panelWidth + 20,
      -panelHeight + 170,
      'LLM',
      {
        fontSize: '16px',
        color: '#f5f5dc',
        fontStyle: 'bold'
      }
    );
    scene.controlPanel.add(llmTitle);
    
    // Pulsante LLM Dashboard
    createControlButton(
      scene,
      -panelWidth/2,
      -panelHeight + 200,
      'LLM Dashboard',
      () => {
        toggleLLMPanel(scene);
      }
    );
    
    // Nuovo pulsante LLM Simple
    createControlButton(
      scene,
      -panelWidth/2,
      -panelHeight + 240,
      'LLM Simple',
      () => {
        toggleSimpleLLMPanel(scene);
      }
    );
    
    // SEZIONE: Test e Debug
    // Titolo sezione (spostato più in basso per fare spazio al pulsante LLM Simple)
    const debugTitle = scene.add.text(
      -panelWidth + 20,
      -panelHeight + 280, // Posizione aggiornata
      'Test e Debug',
      {
        fontSize: '16px',
        color: '#f5f5dc',
        fontStyle: 'bold'
      }
    );
    scene.controlPanel.add(debugTitle);
    
    // Pulsante Test Dialogo (spostato più in basso)
    createControlButton(
      scene,
      -panelWidth/2,
      -panelHeight + 310, // Posizione aggiornata
      'Test Dialogo',
      () => {
        // Prendi i primi due agenti per un test
        if (scene.agents.length >= 2) {
          const agent1 = scene.agents[0];
          const agent2 = scene.agents[1];
          
          console.log('Dialog test between agents:', {
            agent1: { id: agent1.getId(), name: agent1.name, x: agent1.x, y: agent1.y },
            agent2: { id: agent2.getId(), name: agent2.name, x: agent2.x, y: agent2.y }
          });
          
          scene.game.events.emit('agent-interaction', {
            agentId1: agent1.getId(),
            agentId2: agent2.getId(),
            type: 'test-dialog'
          });
        } else {
          console.warn('Not enough agents for dialog test');
        }
      }
    );
    
    // Pulsante Debug Dialoghi (spostato più in basso)
    createControlButton(
      scene,
      -panelWidth/2,
      -panelHeight + 350, // Posizione aggiornata
      'Debug Dialoghi (D)',
      () => {
        if (scene.agentController) {
          scene.agentController.toggleDebugger();
        }
      }
    );
    
    // Pulsante Toggle Assets Debug (spostato più in basso)
    createControlButton(
      scene,
      -panelWidth/2,
      -panelHeight + 390, // Posizione aggiornata
      'Assets Debug',
      () => {
        toggleAssetsDebug(scene);
      }
    );
    
    // SEZIONE: Informazioni (spostata più in basso)
    // Titolo sezione
    const infoTitle = scene.add.text(
      -panelWidth + 20,
      -panelHeight + 430, // Posizione aggiornata
      'Informazioni',
      {
        fontSize: '16px',
        color: '#f5f5dc',
        fontStyle: 'bold'
      }
    );
    scene.controlPanel.add(infoTitle);
    
    // Pulsante Info Laboratorio (spostato più in basso)
    createControlButton(
      scene,
      -panelWidth/2,
      -panelHeight + 460, // Posizione aggiornata
      'ℹ️ Info Laboratorio',
      () => {
        // Cast a MercatorumLabScene per soddisfare la firma della funzione
        showLabInfo(scene as unknown as MercatorumLabScene);
      }
    );
    
    // Crea il pulsante toggle per il pannello (posizionato all'esterno)
    createPanelToggleButton(scene);
    
    // Inizialmente il pannello è chiuso
    toggleControlPanel(scene, false);
    
    console.log('Control panel created successfully');
  } catch (error) {
    console.error('Error creating control panel:', error);
  }
}

/**
 * Crea un pulsante per il pannello di controllo
 */
function createControlButton(
  scene: IMercatorumLabScene, 
  x: number, 
  y: number, 
  text: string, 
  callback: Function
): void {
  try {
    // Container per il pulsante (per gestire hover e click)
    const buttonContainer = scene.add.container(x, y);
    
    // Sfondo del pulsante
    const buttonWidth = 200;
    const buttonHeight = 30;
    const buttonBackground = scene.add.graphics();
    buttonBackground.fillStyle(0xd2691e, 0.7); // Terracotta semi-trasparente
    buttonBackground.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5);
    buttonBackground.lineStyle(1, 0xf5f5dc, 0.5); // Bordo crema
    buttonBackground.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5);
    
    // Testo del pulsante
    const buttonText = scene.add.text(
      0,
      0,
      text,
      {
        fontSize: '14px',
        color: '#f5f5dc',
        align: 'center'
      }
    );
    buttonText.setOrigin(0.5, 0.5);
    
    // Aggiungi elementi al container
    buttonContainer.add([buttonBackground, buttonText]);
    
    // Rendi il container interattivo
    buttonContainer.setInteractive(
      new Phaser.Geom.Rectangle(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight),
      Phaser.Geom.Rectangle.Contains
    );
    
    // Eventi interattivi
    buttonContainer.on('pointerover', () => {
      buttonBackground.clear();
      buttonBackground.fillStyle(0xd2691e, 0.9);
      buttonBackground.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5);
      buttonBackground.lineStyle(1, 0xf5f5dc, 0.8);
      buttonBackground.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5);
    });
    
    buttonContainer.on('pointerout', () => {
      buttonBackground.clear();
      buttonBackground.fillStyle(0xd2691e, 0.7);
      buttonBackground.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5);
      buttonBackground.lineStyle(1, 0xf5f5dc, 0.5);
      buttonBackground.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5);
    });
    
    buttonContainer.on('pointerdown', () => {
      buttonBackground.clear();
      buttonBackground.fillStyle(0xd2691e, 0.5);
      buttonBackground.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5);
      buttonBackground.lineStyle(1, 0xf5f5dc, 0.3);
      buttonBackground.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5);
    });
    
    buttonContainer.on('pointerup', () => {
      buttonBackground.clear();
      buttonBackground.fillStyle(0xd2691e, 0.9);
      buttonBackground.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5);
      buttonBackground.lineStyle(1, 0xf5f5dc, 0.8);
      buttonBackground.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 5);
      
      // Esegui il callback
      callback();
    });
    
    // Aggiungi il pulsante al pannello di controllo
    if (scene.controlPanel) {
      scene.controlPanel.add(buttonContainer);
    }
  } catch (error) {
    console.error('Error creating control button:', error);
  }
}

/**
 * Crea il pulsante per aprire/chiudere il pannello di controllo
 */
function createPanelToggleButton(scene: IMercatorumLabScene): void {
  try {
    // Posizione del pulsante (angolo in basso a destra)
    const toggleX = scene.cameras.main.width - 30;
    const toggleY = scene.cameras.main.height - 30;
    
    // Crea il container per il pulsante
    scene.controlPanelToggle = scene.add.container(toggleX, toggleY);
    
    // Verifica che il pulsante sia stato creato
    if (!scene.controlPanelToggle) {
      console.error('Failed to create control panel toggle button');
      return;
    }
    
    scene.controlPanelToggle.setDepth(1001); // Sopra il pannello
    
    // Sfondo del pulsante
    const toggleBackground = scene.add.graphics();
    toggleBackground.fillStyle(0xd2691e, 0.9); // Terracotta
    toggleBackground.fillCircle(0, 0, 20);
    toggleBackground.lineStyle(2, 0xf5f5dc, 1); // Bordo crema
    toggleBackground.strokeCircle(0, 0, 20);
    
    // Icona del pulsante (inizialmente con freccia per aprire)
    const toggleIcon = scene.add.text(
      0,
      0,
      '≡', // Icona "hamburger menu"
      {
        fontSize: '24px',
        color: '#f5f5dc'
      }
    );
    toggleIcon.setOrigin(0.5, 0.5);
    
    // Aggiungi elementi al container
    scene.controlPanelToggle.add([toggleBackground, toggleIcon]);
    
    // Rendi il container interattivo
    scene.controlPanelToggle.setInteractive(
      new Phaser.Geom.Rectangle(-20, -20, 40, 40),
      Phaser.Geom.Rectangle.Contains
    );
    
    // Aggiungi effetti hover
    scene.controlPanelToggle.on('pointerover', () => {
      toggleBackground.clear();
      toggleBackground.fillStyle(0xd2691e, 1);
      toggleBackground.fillCircle(0, 0, 22);
      toggleBackground.lineStyle(2, 0xf5f5dc, 1);
      toggleBackground.strokeCircle(0, 0, 22);
    });
    
    scene.controlPanelToggle.on('pointerout', () => {
      toggleBackground.clear();
      toggleBackground.fillStyle(0xd2691e, 0.9);
      toggleBackground.fillCircle(0, 0, 20);
      toggleBackground.lineStyle(2, 0xf5f5dc, 1);
      toggleBackground.strokeCircle(0, 0, 20);
    });
    
    // Aggiungi funzionalità di toggle
    scene.controlPanelToggle.on('pointerup', () => {
      scene.isPanelOpen = !scene.isPanelOpen;
      toggleControlPanel(scene, scene.isPanelOpen);
      
      // Cambia l'icona in base allo stato
      toggleIcon.setText(scene.isPanelOpen ? '×' : '≡');
    });
  } catch (error) {
    console.error('Error creating toggle button:', error);
  }
}

/**
 * Attiva/disattiva la visibilità del pannello di controllo con animazione
 */
export function toggleControlPanel(scene: IMercatorumLabScene, isOpen: boolean): void {
  try {
    if (!scene.controlPanel) return;
    
    const targetX = scene.cameras.main.width - 40;
    const targetY = scene.cameras.main.height - 40;
    
    if (isOpen) {
      // Mostra il pannello
      scene.controlPanel.setVisible(true);
      
      // Animazione di apertura
      scene.tweens.add({
        targets: scene.controlPanel,
        x: targetX,
        duration: 300,
        ease: 'Power2'
      });
    } else {
      // Animazione di chiusura
      scene.tweens.add({
        targets: scene.controlPanel,
        x: targetX + 250, // Sposta fuori dallo schermo
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          if (scene.controlPanel) {
            scene.controlPanel.setVisible(false);
          }
        }
      });
    }
  } catch (error) {
    console.error('Error toggling control panel:', error);
  }
}

/**
 * Attiva/disattiva la legenda degli agenti
 */
export function toggleAgentsLegend(scene: IMercatorumLabScene): void {
  try {
    // Se la legenda è già creata, la rimuove
    if (scene.agentsLegend) {
      // Rimuovi anche il titolo della legenda se esiste
      const labelElements = scene.children.getAll().filter(
        (child: Phaser.GameObjects.GameObject) => {
          return child.name === 'legend-label' || child.name === 'legend-title';
        }
      );
      
      labelElements.forEach((element: Phaser.GameObjects.GameObject) => {
        scene.children.remove(element);
      });
      
      // Rimuovi la legenda stessa
      scene.children.remove(scene.agentsLegend);
      scene.agentsLegend = null;
      console.log('Legend removed');
      return;
    }
    
    // Se non esiste, utilizziamo la funzione esistente per crearla
    // Modifichiamo l'integrazione per non mostrare la voce "Legenda"
    integrateAgentsLegend(scene);
    
    // Rimuovi i titoli aggiunti automaticamente
    const titleElements = scene.children.getAll().filter(
      (child: Phaser.GameObjects.GameObject) => {
        return child.name === 'legend-label' || child.name === 'legend-title';
      }
    );
    
    titleElements.forEach((element: Phaser.GameObjects.GameObject) => {
      // Utilizziamo type assertion per accedere al metodo setVisible
      // poiché sappiamo che questi elementi dovrebbero essere GameObjects con questa funzionalità
      // In Phaser, molti GameObjects hanno la proprietà setVisible
      (element as unknown as { setVisible: (visible: boolean) => void }).setVisible(false);
    });
    
    console.log('Legend created');
    
  } catch (error) {
    console.error('Error toggling agents legend:', error);
  }
}

/**
 * Attiva/disattiva il pannello LLM
 */
export function toggleLLMPanel(scene: IMercatorumLabScene): void {
  try {
    // Se il pannello esiste già, lo nascondiamo e lo rimuoviamo
    if (scene.llmPanel) {
      scene.llmPanel.hide();
      
      // Imposta un timeout per consentire all'animazione di completarsi
      setTimeout(() => {
        if (scene.llmPanel) {
          scene.llmPanel.destroy();
          scene.llmPanel = null;
        }
      }, 300);
      
      return;
    }
    
    // Posiziona il pannello in una posizione ottimale che non si sovrappone
    // a altri elementi dell'interfaccia
    const panelX = Math.min(scene.cameras.main.width / 4, 50);
    const panelY = 50;
    
    // Crea il pannello LLM
    scene.llmPanel = new LLMControlPanel(
      scene, 
      panelX, 
      panelY,
      // Callback per chiudere il pannello
      () => {
        if (scene.llmPanel) {
          scene.llmPanel.hide();
          
          // Imposta un timeout per consentire all'animazione di completarsi
          setTimeout(() => {
            if (scene.llmPanel) {
              scene.llmPanel.destroy();
              scene.llmPanel = null;
            }
          }, 300);
        }
      }
    );
    
    // Ottieni il controller dei dialoghi dalla scena utilizzando il metodo getter pubblico
    if (scene.agentController) {
      const dialogController = scene.agentController.getDialogController();
      if (dialogController) {
        scene.llmPanel.setDialogController(dialogController);
      } else {
        console.warn('Dialog controller not found in scene');
      }
    } else {
      console.warn('Agent controller not found in scene');
    }
    
  } catch (error) {
    console.error('Error toggling LLM panel:', error);
  }
}

/**
 * Attiva/disattiva il pannello SimpleLLM
 * Nuova funzione per gestire il pannello SimpleLLM
 */
export function toggleSimpleLLMPanel(scene: IMercatorumLabScene): void {
  try {
    // Cerca prima il pannello nel lab controller
    let simpleLLMPanel = null;
    
    // Metodo 1: controlla se il pannello è disponibile come proprietà diretta
    if ((scene as any).simpleLLMPanel) {
      simpleLLMPanel = (scene as any).simpleLLMPanel;
    }
    
    // Metodo 2: controlla se il pannello è accessibile tramite un getter
    else if ((scene as any).getLLMPanel && typeof (scene as any).getLLMPanel === 'function') {
      simpleLLMPanel = (scene as any).getLLMPanel();
    }
    
    // Se il pannello è stato trovato, lo attiviamo/disattiviamo
    if (simpleLLMPanel) {
      // Toggle la visibilità usando il metodo integrato
      if (typeof simpleLLMPanel.toggle === 'function') {
        simpleLLMPanel.toggle();
      } 
      // Fallback se toggle non è disponibile
      else if (typeof simpleLLMPanel.show === 'function' && typeof simpleLLMPanel.isShown === 'function') {
        if (simpleLLMPanel.isShown()) {
          simpleLLMPanel.hide();
        } else {
          simpleLLMPanel.show();
        }
      }
      
      console.log('SimpleLLM panel toggled');
      return;
    }
    
    // Se il pannello non è stato trovato, ne creiamo uno nuovo
    console.log('SimpleLLM panel not found, creating new one');
    
    // Posiziona il pannello in una posizione ottimale
    const panelX = Math.min(scene.cameras.main.width / 4, 50);
    const panelY = 120; // Un po' più in basso rispetto al pannello LLM principale
    
    // Crea il pannello
    const newPanel = new SimpleLLMPanel(scene, panelX, panelY);
    
    // Ottieni il controller dei dialoghi e collegalo al pannello
    if (scene.agentController) {
      const dialogController = scene.agentController.getDialogController();
      if (dialogController) {
        newPanel.setDialogController(dialogController);
      } else {
        console.warn('Dialog controller not found in scene');
      }
    } else {
      console.warn('Agent controller not found in scene');
    }
    
    // Salva il riferimento nella scena
    (scene as any).simpleLLMPanel = newPanel;
    
    // Mostra il pannello
    newPanel.show();
    
  } catch (error) {
    console.error('Error toggling SimpleLLM panel:', error);
  }
}

/**
 * Attiva/disattiva la visualizzazione del debug degli asset
 */
export function toggleAssetsDebug(scene: IMercatorumLabScene): void {
  try {
    // Verifica se il debug grafico esiste già
    if (scene.debugGraphics && scene.debugText) {
      // Toggle visibility
      const visible = !scene.debugGraphics.visible;
      scene.debugGraphics.setVisible(visible);
      scene.debugText.setVisible(visible);
      
      // Rimuovi il tasto 'D' se stiamo nascondendo il debug
      const debugKeyElements = scene.children.getAll().filter(
        (child: Phaser.GameObjects.GameObject) => {
          return child.name === 'debug-key';
        }
      );
      
      debugKeyElements.forEach((element: Phaser.GameObjects.GameObject) => {
        scene.children.remove(element);
      });
      
      // Aggiorna il testo di debug se lo stiamo mostrando
      if (visible) {
        const textureKeys = scene.textures.getTextureKeys();
        const infoText = `
          Scene: ${scene.scene.key}
          Loaded textures: ${textureKeys.length}
          Keys: ${textureKeys.slice(0, 5).join(', ')}${textureKeys.length > 5 ? '...' : ''}
          Animation count: ${scene.anims.getAll().length}
          Agents: ${scene.agents.length}
        `;
        
        scene.updateDebugInfo(infoText);
      }
    }
  } catch (error) {
    console.error('Error toggling assets debug:', error);
  }
}

/**
 * Inizializza lo stato di debug all'avvio della scena
 * (è importante chiamare questa funzione all'inizio di create() della scena)
 */
export function initDebugState(scene: IMercatorumLabScene): void {
  // Assicuriamoci che il debug degli asset sia disattivato all'inizio
  if (scene.debugGraphics) {
    scene.debugGraphics.setVisible(false);
  }
  
  if (scene.debugText) {
    scene.debugText.setVisible(false);
  }
  
  // Assicuriamoci che non ci siano pulsanti di debug visibili
  const debugElements = scene.children.getAll().filter(
    (child: Phaser.GameObjects.GameObject) => {
      return child.name === 'debug-key' || child.name === 'legend-label' || child.name === 'legend-title';
    }
  );
  
  debugElements.forEach((element: Phaser.GameObjects.GameObject) => {
    scene.children.remove(element);
  });
}