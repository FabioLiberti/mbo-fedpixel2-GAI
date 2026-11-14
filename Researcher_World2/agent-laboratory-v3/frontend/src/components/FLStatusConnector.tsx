import React, { useEffect, useRef } from 'react';
import { FLStatusData } from '../phaser/fl/FLController';
import { getGameInstance } from '../phaser/game';

interface FLStatusConnectorProps {
  flStatus: FLStatusData | null;
}

/**
 * Componente che collega il pannello di stato FL con il controller di effetti visivi nel gioco Phaser.
 * Questo componente non ha un rendering visibile, ma gestisce la comunicazione da React verso Phaser.
 *
 * La direzione inversa (evento 'toggleFL' dal gioco verso React) non è gestita qui:
 * l'unico a emettere 'toggleFL' è React stesso, quindi rimandarlo a React
 * creerebbe un ciclo infinito.
 */
const FLStatusConnector: React.FC<FLStatusConnectorProps> = ({ flStatus }) => {
  const lastUpdateTimeRef = useRef<number>(0);
  const hasSetInitialStateRef = useRef<boolean>(false);

  // Inizializzazione una tantum
  useEffect(() => {
    if (hasSetInitialStateRef.current) return;
    
    const gameInstance = getGameInstance();
    if (!gameInstance) return;

    // Imposta lo stato iniziale del pannello FL nel registro del gioco se non esiste
    if (gameInstance.registry.get('flPanelVisible') === undefined) {
      gameInstance.registry.set('flPanelVisible', true);
      hasSetInitialStateRef.current = true;
    }
  }, []);

  // Aggiorna gli effetti visivi quando cambia lo stato FL
  useEffect(() => {
    if (!flStatus) return;

    // Evita aggiornamenti troppo frequenti (throttling)
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 100) return;
    lastUpdateTimeRef.current = now;

    // Ottiene l'istanza del gioco
    const gameInstance = getGameInstance();
    if (!gameInstance) return;

    // Codice per aggiornare gli effetti FL nel gioco
    // Questo codice verrà eseguito nel contesto di Phaser
    try {
      gameInstance.events.emit('updateFLStatus', flStatus);
    } catch (err) {
      // Un errore negli effetti visivi non deve far cadere l'interfaccia React
      console.error('[FLStatusConnector] updateFLStatus error:', err);
    }

  }, [flStatus]);

  return null; // Questo componente non ha un rendering visibile
};

export default FLStatusConnector;