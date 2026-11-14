/// frontend/src/phaser/examples/AgentsLegendIntegration.ts
// Esempio di come integrare la legenda degli agenti in una scena

// Modifichiamo i percorsi di importazione per essere relativi al progetto
// invece che relativi al file
import { AgentsLegend } from '../ui/AgentsLegend';
// @ts-ignore - Questo tipo è necessario per chi utilizza questa funzione
import { AgentTypeInfo } from '../ui/LegendInfoPanel';
import type { IAgentScene } from '../types/IAgentScene';

/**
 * Questo file mostra come integrare la legenda degli agenti in una scena
 */

// Esempio di uso della legenda in una scena
// Questo codice può essere aggiunto al metodo create() di BlekingeLabScene.ts

export function integrateAgentsLegend(scene: IAgentScene): void {
  async function loadAndCreateLegend(): Promise<void> {
    try {
      // Prova a usare la config lab-specific se disponibile nel cache
      let agentTypes: Record<string, AgentTypeInfo> | null = null;

      const labConfig = scene.cache?.json?.get('labAgentTypesConfig');
      if (labConfig) {
        // Determina il labKey dal labTypeId della scena
        const labTypeId = (scene as any).getLabTypeId?.();
        const labKey = labTypeId ? labTypeId.toLowerCase() : null;
        if (labKey && labConfig[labKey]) {
          agentTypes = labConfig[labKey];
          console.log(`AgentsLegend: using lab-specific config for "${labKey}"`);
        }
      }

      // Fallback alla config globale
      if (!agentTypes) {
        agentTypes = await AgentsLegend.loadAgentTypesConfig(scene);
      }

      const legend = new AgentsLegend(
        scene,
        20,
        60,
        agentTypes
      );

      console.log('Agents legend created successfully');

      scene.agentsLegend = legend;
    } catch (error) {
      console.error('Error creating agents legend:', error);
    }
  }

  loadAndCreateLegend();
}

/**
 * Aggiunge un pulsante informativo sul laboratorio alla scena
 * @param scene La scena Phaser
 * @param labKey Chiave del laboratorio (mercatorum, blekinge, opbg)
 */
export function addLabInfoButton(scene: Phaser.Scene, labKey: 'mercatorum' | 'blekinge' | 'opbg'): void {
  // Configura colori e testi in base al laboratorio
  const labConfig = {
    mercatorum: {
      bgColor: '#d2691e', // Terracotta
      panelBgColor: 0x1a365d, // Blu navy
      borderColor: 0xd2691e, // Terracotta
      titleColor: '#f5f5dc', // Crema
      title: 'Università Mercatorum Lab',
      description: 'Laboratorio di ricerca specializzato in business intelligence ' +
        'e analisi finanziaria federata. Questo ambiente combina ' +
        'elementi architettonici classici italiani con tecnologie ' +
        'all\'avanguardia per la privacy dei dati finanziari.\n\n' +
        'Specializzazione in:\n' +
        '• Business intelligence e analisi finanziaria federata\n' +
        '• Privacy-preserving analytics per dati aziendali sensibili\n' +
        '• Compliance GDPR e framework regolatori\n' +
        '• Ottimizzazione di modelli federati per previsioni di mercato',
      logoKey: 'mercatorum-logo'
    },
    blekinge: {
      bgColor: '#3f51b5', // Blu
      panelBgColor: 0x1a365d, // Blu scuro
      borderColor: 0x4fc3f7, // Azzurro chiaro
      titleColor: '#ffffff', // Bianco
      title: 'Blekinge University Lab',
      description: 'Laboratorio di ricerca focalizzato su algoritmi avanzati di federated learning ' +
        'e ottimizzazione per dispositivi edge e IoT. Design scandinavo minimalista ' +
        'con elementi high-tech.\n\n' +
        'Specializzazione in:\n' +
        '• Algoritmi di aggregazione avanzati\n' +
        '• Ottimizzazione per dispositivi IoT e edge computing\n' +
        '• Quantizzazione e compressione per ridurre comunicazione\n' +
        '• Client selection e sampling strategico',
      logoKey: 'blekinge-logo'
    },
    opbg: {
      bgColor: '#009688', // Verde acqua
      panelBgColor: 0x00695c, // Verde scuro
      borderColor: 0x4db6ac, // Verde chiaro
      titleColor: '#ffffff', // Bianco
      title: 'OPBG IRCCS Lab',
      description: 'Laboratorio clinico specializzato nell\'applicazione del federated learning ' +
        'in contesti medici pediatrici, con focus sulla privacy dei dati sanitari ' +
        'e sull\'integrazione di fonti eterogenee.\n\n' +
        'Specializzazione in:\n' +
        '• Federated learning per dati medici altamente sensibili\n' +
        '• Diagnosi collaborativa preservando privacy dei pazienti\n' +
        '• Modelli personalizzati per casi pediatrici rari\n' +
        '• Integrazione di dati eterogenei (immagini, test, genetica)',
      logoKey: 'opbg-logo'
    }
  };
  
  // Seleziona la configurazione corretta
  const config = labConfig[labKey];
  
  // Crea il pulsante info
  const labInfoButton = scene.add.text(
    20, 
    20, 
    'ℹ️ Info Laboratorio', 
    { 
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: config.bgColor,
      padding: { left: 10, right: 10, top: 5, bottom: 5 }
    }
  );
  
  labInfoButton.setInteractive({ useHandCursor: true });
  labInfoButton.setDepth(500);
  
  // Aggiungi l'evento click
  labInfoButton.on('pointerdown', () => {
    // Crea il pannello info
    const infoPanel = scene.add.container(
      scene.cameras.main.centerX,
      scene.cameras.main.centerY
    );
    infoPanel.setDepth(1000);
    
    // Sfondo del pannello
    const background = scene.add.graphics();
    background.fillStyle(config.panelBgColor, 0.9);
    background.fillRoundedRect(-250, -200, 500, 400, 10);
    background.lineStyle(3, config.borderColor, 1);
    background.strokeRoundedRect(-250, -200, 500, 400, 10);
    infoPanel.add(background);
    
    // Titolo
    const title = scene.add.text(
      0, 
      -170, 
      config.title, 
      { 
        fontSize: '24px',
        color: config.titleColor,
        fontStyle: 'bold',
        align: 'center'
      }
    );
    title.setOrigin(0.5);
    infoPanel.add(title);
    
    // Descrizione
    const description = scene.add.text(
      0,
      -80,
      config.description,
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
    
    // Logo del laboratorio (se disponibile)
    if (scene.textures.exists(config.logoKey)) {
      const logo = scene.add.image(0, 130, config.logoKey);
      logo.setScale(0.5);
      infoPanel.add(logo);
    }
  });

  console.log(`Lab info button created for ${labKey} lab`);
}