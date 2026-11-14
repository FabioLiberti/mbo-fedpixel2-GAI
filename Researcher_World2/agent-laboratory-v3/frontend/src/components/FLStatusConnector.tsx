import React, { useEffect, useRef } from 'react';
import { FLStatusData } from '../phaser/fl/FLController';
import { getGameInstance } from '../utils/gameInstance';

interface FLStatusConnectorProps {
  flStatus: FLStatusData | null;
  onToggleFL: (enabled: boolean) => void;
}

/**
 * Componente che collega il pannello di stato FL con il controller di effetti visivi nel gioco Phaser.
 * Questo componente non ha un rendering visibile, ma gestisce la comunicazione tra React e Phaser.
 */
const FLStatusConnector: React.FC<FLStatusConnectorProps> = ({ flStatus, onToggleFL }) => {
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
    gameInstance.events.emit('updateFLStatus', flStatus);

  }, [flStatus]);

  // Ascolta eventi di toggle FL dal gioco e li passa al componente React
  useEffect(() => {
    const gameInstance = getGameInstance();
    if (!gameInstance) return;

    // Gestione dell'evento toggleFL dal gioco
    const handleToggleFL = (data: { enabled: boolean }) => {
      onToggleFL(data.enabled);
    };

    // Registra il listener per l'evento toggleFL
    gameInstance.events.on('toggleFL', handleToggleFL);

    // Rimuovi il listener quando il componente viene smontato
    return () => {
      gameInstance.events.off('toggleFL', handleToggleFL);
    };
  }, [onToggleFL]);

  return null; // Questo componente non ha un rendering visibile
};

export default FLStatusConnector;