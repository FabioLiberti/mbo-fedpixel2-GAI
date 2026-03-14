import React, { useEffect, useRef, useState, useCallback } from 'react';
import { initGame, getGameInstance, SCENE_KEYS } from '../phaser/game';
import FLStatusPanel from './FLStatusPanel';
import FLStatusConnector from './FLStatusConnector';
import AgentInspectorPanel from './AgentInspectorPanel';
import { FLStatusData } from '../phaser/fl/FLController';
import { FLState } from '../phaser/fl/FLState';
import { CognitiveAgentState } from '../phaser/types/AgentTypes';

interface FLGlobalMetrics {
  flProgress: number;
  agentCount: number;
  round: number;
  accuracy: number;
  loss: number;
  flState: string;
}

interface SimulationContainerProps {
  onGameReady?: (game: any) => void;
  selectedLab?: string;
  onFLUpdate?: (data: FLGlobalMetrics) => void;
}

// Definiamo un tipo per gli agenti FL
interface FLAgent {
  id: string;
  state: string;
  labType: string;
  agentType: string;
}

// Definiamo un tipo per le connessioni FL
interface FLConnection {
  source: string;
  target: string;
  active: boolean;
}

const SimulationContainer: React.FC<SimulationContainerProps> = ({
  onGameReady,
  selectedLab,
  onFLUpdate
}) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameReadyFiredRef = useRef<boolean>(false);
  const [flEnabled, setFLEnabled] = useState<boolean>(true); // Default a true per mostrare il pannello
  const [flStatus, setFLStatus] = useState<FLStatusData | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<CognitiveAgentState | null>(null);
  
  // Timer per simulare aggiornamenti dello stato FL
  const flUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Flag per tenere traccia se la simulazione locale è attiva
  const localSimulationActiveRef = useRef<boolean>(false);
  // Flag per gestire l'avvio iniziale
  const hasInitializedSimRef = useRef<boolean>(false);

  // Inizializzazione del gioco
  useEffect(() => {
    if (gameContainerRef.current) {
      try {
        const containerId = 'phaser-game';
        console.log('Initializing Phaser game in container:', containerId);
        
        // Inizializza o recupera l'istanza di gioco esistente
        const gameInstance = initGame(containerId);
        
        // Evita chiamate multiple a onGameReady
        if (onGameReady && !gameReadyFiredRef.current) {
          gameReadyFiredRef.current = true;
          onGameReady(gameInstance);
        }
        
        // NUOVA FUNZIONALITÀ: Ascolta gli eventi FL da Phaser
        gameInstance.events.on('updateFLStatus', (flStatusData: FLStatusData) => {
          console.log('Received FL status update from Phaser:', flStatusData);
          setFLStatus(flStatusData);
          // Aggiorna anche lo stato di abilitazione
          setFLEnabled(flStatusData.enabled);
        });

        // NUOVO: Ascolta gli eventi toggleFLPanel da Phaser
        gameInstance.events.on('toggleFLPanel', (data: { visible: boolean }) => {
          console.log('Received toggleFLPanel event:', data);
          // Aggiorna il registro del gioco
          gameInstance.registry.set('flPanelVisible', data.visible);
        });

        // Agent Inspector: listen for agent click events from Phaser
        gameInstance.events.on('agentSelected', (agentData: CognitiveAgentState) => {
          console.log('Agent selected:', agentData?.name);
          setSelectedAgent(agentData);
        });

        // Connetti i pulsanti UI ai metodi Phaser
        setupSimulationControls(gameInstance);
      } catch (error) {
        console.error('Failed to initialize Phaser game:', error);
      }
    }

    // Cleanup dei timer e degli event listener quando il componente viene smontato
    return () => {
      if (flUpdateTimerRef.current) {
        clearInterval(flUpdateTimerRef.current);
        flUpdateTimerRef.current = null;
      }
      localSimulationActiveRef.current = false;
      hasInitializedSimRef.current = false;
      
      // Rimuovi anche gli event listener
      const gameInstance = getGameInstance();
      if (gameInstance) {
        gameInstance.events.off('updateFLStatus');
        gameInstance.events.off('toggleFLPanel');
        gameInstance.events.off('agentSelected');
      }
    };
  }, [onGameReady]);

  // Configura gli eventi per i controlli della simulazione
  const setupSimulationControls = (gameInstance: any) => {
    // Emettiamo un evento per comunicare che i controlli sono pronti
    gameInstance.events.emit('controlsReady', true);

    // Collegamento diretto con App.tsx tramite eventi globali
    document.addEventListener('simulation:control', (event: any) => {
      const action = event.detail.action;
      if (action) {
        console.log(`Received simulation control event: ${action}`);
        gameInstance.events.emit(`simulation:${action}`);
      }
    });
  };

  // Gestione del cambio di laboratorio
  useEffect(() => {
    if (selectedLab) {
      const game = getGameInstance();
      
      if (!game) {
        console.error('Game instance not available');
        return;
      }
      
      let sceneKey = '';
      switch (selectedLab) {
        case 'BlekingeLabScene':
        case SCENE_KEYS.BLEKINGE:
          sceneKey = SCENE_KEYS.BLEKINGE;
          break;
        case 'OPBGLabScene':
        case SCENE_KEYS.OPBG:
          sceneKey = SCENE_KEYS.OPBG;
          break;
        case SCENE_KEYS.WORLD_MAP:
        case 'WorldMapScene':
          sceneKey = SCENE_KEYS.WORLD_MAP;
          break;
        case 'MercatorumLabScene':
        case SCENE_KEYS.MERCATORUM:
        default:
          sceneKey = SCENE_KEYS.MERCATORUM;
      }
      
      console.log(`SimulationContainer: Switching to scene ${sceneKey}`);
      
      try {
        if (typeof game.startLabScene === 'function') {
          // Usa l'API di gestione delle scene definita in game.ts
          game.startLabScene(sceneKey);
        } else {
          console.error('startLabScene method not available on game instance');
        }
      } catch (error) {
        console.error(`Error switching to lab ${sceneKey}:`, error);
      }
    }
  }, [selectedLab]);

  // Funzione per avviare la simulazione locale (fallback)
  const startLocalSimulation = useCallback(() => {
    // Se abbiamo già una simulazione attiva, non ne avviamo un'altra
    if (flUpdateTimerRef.current || !flEnabled || localSimulationActiveRef.current) {
      return;
    }

    console.log("Starting local FL simulation (fallback)");
    localSimulationActiveRef.current = true;
    
    // Inizializzazione dello stato FL con 9 agenti (3 per lab)
    const initialState: FLStatusData = {
      enabled: true,
      currentState: FLState.IDLE,
      fromSimulation: true,
      activeAgents: [
        // Mercatorum (3)
        { id: 'prof1', state: FLState.IDLE, labType: 'MERCATORUM', agentType: 'professor' },
        { id: 'res1',  state: FLState.IDLE, labType: 'MERCATORUM', agentType: 'researcher' },
        { id: 'stu1',  state: FLState.IDLE, labType: 'MERCATORUM', agentType: 'student' },
        // Blekinge (3)
        { id: 'prof2', state: FLState.IDLE, labType: 'BLEKINGE', agentType: 'professor' },
        { id: 'res2',  state: FLState.IDLE, labType: 'BLEKINGE', agentType: 'researcher' },
        { id: 'stu2',  state: FLState.IDLE, labType: 'BLEKINGE', agentType: 'student' },
        // OPBG (3)
        { id: 'res3',  state: FLState.IDLE, labType: 'OPBG', agentType: 'researcher' },
        { id: 'doc1',  state: FLState.IDLE, labType: 'OPBG', agentType: 'doctor' },
        { id: 'stu3',  state: FLState.IDLE, labType: 'OPBG', agentType: 'student' },
      ],
      metrics: {
        accuracy: 0,
        loss: 0,
        round: 0,
        clientFraction: 0.8
      },
      connections: [
        { source: 'MERCATORUM', target: 'BLEKINGE', active: false },
        { source: 'BLEKINGE', target: 'OPBG', active: false },
        { source: 'OPBG', target: 'MERCATORUM', active: false }
      ]
    };
    
    setFLStatus(initialState);
    
    // Simulazione del ciclo FL con transizioni di stato
    const states = [FLState.TRAINING, FLState.SENDING, FLState.AGGREGATING, FLState.RECEIVING, FLState.IDLE];
    let currentStateIndex = 0;
    let round = 0;
    
    flUpdateTimerRef.current = setInterval(() => {
      if (!flEnabled) {
        // Se FL viene disabilitato, fermiamo il timer
        if (flUpdateTimerRef.current) {
          clearInterval(flUpdateTimerRef.current);
          flUpdateTimerRef.current = null;
          localSimulationActiveRef.current = false;
        }
        return;
      }

      currentStateIndex = (currentStateIndex + 1) % states.length;
      const newState = states[currentStateIndex];
      
      // Quando torniamo allo stato IDLE, incrementiamo il round
      if (newState === FLState.IDLE && currentStateIndex === 0) {
        round++;
      }
      
      // Aggiorna lo stato
      setFLStatus((prevState: FLStatusData | null) => {
        if (!prevState) return prevState;
        
        // Stato globale
        const updatedState = {
          ...prevState,
          currentState: newState,
          fromSimulation: true, // Mantiene il flag
          metrics: {
            ...prevState.metrics,
            accuracy: Math.min(0.95, (prevState.metrics.accuracy || 0) + 0.05),
            loss: Math.max(0.05, (prevState.metrics.loss || 1) - 0.05),
            round: round
          }
        };
        
        // Attiva/disattiva connessioni in base allo stato
        let activeConnections: Array<FLConnection> = [];
        if (newState === FLState.SENDING) {
          activeConnections = [
            { source: 'MERCATORUM', target: 'BLEKINGE', active: true },
            { source: 'BLEKINGE', target: 'OPBG', active: true },
            { source: 'OPBG', target: 'MERCATORUM', active: false }
          ];
        } else if (newState === FLState.RECEIVING) {
          activeConnections = [
            { source: 'MERCATORUM', target: 'BLEKINGE', active: false },
            { source: 'BLEKINGE', target: 'OPBG', active: false },
            { source: 'OPBG', target: 'MERCATORUM', active: true }
          ];
        } else if (newState === FLState.AGGREGATING) {
          activeConnections = [
            { source: 'MERCATORUM', target: 'BLEKINGE', active: true },
            { source: 'BLEKINGE', target: 'OPBG', active: true },
            { source: 'OPBG', target: 'MERCATORUM', active: true }
          ];
        } else {
          activeConnections = [
            { source: 'MERCATORUM', target: 'BLEKINGE', active: false },
            { source: 'BLEKINGE', target: 'OPBG', active: false },
            { source: 'OPBG', target: 'MERCATORUM', active: false }
          ];
        }
        
        // Aggiorna lo stato degli agenti
        const updatedAgents = prevState.activeAgents.map((agent: FLAgent) => ({
          ...agent,
          state: newState
        }));
        
        return {
          ...updatedState,
          activeAgents: updatedAgents,
          connections: activeConnections
        };
      });

      // Notify parent (App.tsx) of global FL metrics
      if (onFLUpdate) {
        const accuracy = Math.min(0.95, (round + 1) * 0.05);
        const loss = Math.max(0.05, 1 - (round + 1) * 0.05);
        onFLUpdate({
          flProgress: Math.round(accuracy * 100),
          agentCount: 9,
          round: round,
          accuracy: accuracy,
          loss: loss,
          flState: newState
        });
      }

    }, 3000); // Aggiorna ogni 3 secondi
  }, [flEnabled]); // La funzione dipende solo da flEnabled

  // Inizializzazione separata tramite un effect
  useEffect(() => {
    // Inizializza la simulazione solo una volta
    if (flEnabled && !hasInitializedSimRef.current && !flStatus) {
      hasInitializedSimRef.current = true;
      startLocalSimulation();
    }
  }, [flEnabled, flStatus, startLocalSimulation]);

  // EFFECT SEPARATO PER FERMARE LA SIMULAZIONE (per evitare dipendenze cicliche)
  useEffect(() => {
    // Gestisce solo l'arresto della simulazione quando necessario
    if (!flEnabled && flUpdateTimerRef.current) {
      clearInterval(flUpdateTimerRef.current);
      flUpdateTimerRef.current = null;
      localSimulationActiveRef.current = false;
      
      // Imposta lo stato su "disattivato" solo se FL è disabilitato e c'è uno stato attivo
      if (flStatus) {
        setFLStatus({
          ...flStatus,
          enabled: false,
          currentState: FLState.IDLE,
          activeAgents: flStatus.activeAgents.map((agent: FLAgent) => ({
            ...agent,
            state: FLState.IDLE
          })),
          connections: flStatus.connections.map((conn: FLConnection) => ({
            ...conn,
            active: false
          }))
        });
      }
    }
    
    // Ferma la simulazione se riceviamo dati reali da Phaser
    if (flStatus && !flStatus.fromSimulation && flUpdateTimerRef.current) {
      clearInterval(flUpdateTimerRef.current);
      flUpdateTimerRef.current = null;
      localSimulationActiveRef.current = false;
    }
  }, [flEnabled, flStatus]);

  // Handler per attivare/disattivare il federated learning
  const handleToggleFL = async (enabled: boolean) => {
    try {
      // Comunica con il gioco Phaser per sincronizzare lo stato FL
      const game = getGameInstance();
      if (game) {
        // Emetti un evento per il gioco
        game.events.emit('toggleFL', { enabled });
      }
      
      setFLEnabled(enabled);
      console.log(`Federated Learning ${enabled ? 'enabled' : 'disabled'}`);
      
      // Avvia la simulazione locale se FL è abilitato e non ci sono dati dal gioco
      if (enabled && !localSimulationActiveRef.current && (!flStatus || flStatus.fromSimulation)) {
        setTimeout(() => {
          startLocalSimulation();
        }, 0);
      }
    } catch (error) {
      console.error('Error toggling Federated Learning:', error);
    }
  };

  // Mappa sceneKey -> labType per filtrare agenti
  const sceneToLabType: Record<string, string> = {
    [SCENE_KEYS.MERCATORUM]: 'MERCATORUM',
    [SCENE_KEYS.BLEKINGE]: 'BLEKINGE',
    [SCENE_KEYS.OPBG]: 'OPBG',
  };

  // Calcola flStatus contestuale: filtra agenti se siamo in un lab singolo
  const isWorldMap = !selectedLab || selectedLab === SCENE_KEYS.WORLD_MAP;
  const contextualFlStatus: FLStatusData | null = flStatus ? (
    isWorldMap ? flStatus : {
      ...flStatus,
      activeAgents: flStatus.activeAgents.filter(
        (agent: FLAgent) => agent.labType === sceneToLabType[selectedLab || '']
      )
    }
  ) : null;

  // Nome leggibile del lab corrente
  const labDisplayName: Record<string, string> = {
    [SCENE_KEYS.MERCATORUM]: 'Mercatorum',
    [SCENE_KEYS.BLEKINGE]: 'Blekinge',
    [SCENE_KEYS.OPBG]: 'OPBG',
  };
  const currentLabName = selectedLab ? labDisplayName[selectedLab] || null : null;

  return (
    <div className="simulation-container" style={{ position: 'relative' }}>
      {/* Container del gioco Phaser */}
      <div
        id="phaser-game"
        ref={gameContainerRef}
        style={{ width: '100%', height: '600px', backgroundColor: '#1a1a1a' }}
      />

      {/* Pannello di controllo FL - contestuale alla vista corrente */}
      {contextualFlStatus && (
        <>
          <FLStatusPanel
            flStatus={contextualFlStatus}
            onToggleFL={handleToggleFL}
            totalAgentCount={flStatus?.activeAgents?.length || 0}
            currentLabName={isWorldMap ? null : currentLabName}
          />

          {/* Connettore invisibile per gli eventi FL tra React e Phaser */}
          <FLStatusConnector
            flStatus={flStatus!}
            onToggleFL={handleToggleFL}
          />
        </>
      )}

      {/* Agent Inspector Panel - shown when an agent is clicked */}
      <AgentInspectorPanel
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
};

export default SimulationContainer;