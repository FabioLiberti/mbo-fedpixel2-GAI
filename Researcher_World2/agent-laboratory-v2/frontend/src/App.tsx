import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import SimulationContainer from './components/SimulationContainer';
import SplashScreen from './components/SplashScreen';
import { Game, SCENE_KEYS, sceneExists, reloadScene } from './phaser/game';
import { webSocketService } from './services/websocket'; 
import { debugScenes } from './utils/debugScenes';
import { testBlekingeScene } from './utils/testBlekingeScene';
import Phaser from 'phaser';
import DocumentationViewer from './components/DocumentationViewer';

// Definizione dell'interfaccia per il DocumentationController
interface DocumentationController {
  initialize: () => Promise<void>;
}

// Creazione di un oggetto stub per il controller della documentazione
// da usare fino a quando non verrà implementato correttamente
const documentationController: DocumentationController = {
  initialize: () => Promise.resolve()
};

// Interfaccia per le scene di Phaser
interface PhaserSceneWithDetails extends Phaser.Scene {
  scene: {
    key: string;
    isActive: () => boolean;
    isVisible: () => boolean;
    stop: () => void;
    start: (key: string) => void;
    settings: {
      status: string | number;
    };
  };
  cameras: {
    cameras: any[];
  };
  children: {
    list: any[];
  };
}

// Utilizziamo le costanti definite in game.ts
type LabType = typeof SCENE_KEYS[keyof typeof SCENE_KEYS];
type SimulationStatus = 'stopped' | 'running' | 'paused';

function App() {
  const [game, setGame] = useState<Game | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentLab, setCurrentLab] = useState<LabType>(SCENE_KEYS.WORLD_MAP);
  const [simStatus, setSimStatus] = useState<SimulationStatus>('stopped');
  const [agentCount, setAgentCount] = useState<number>(9);
  const [flProgress, setFlProgress] = useState<number>(0);
  const [flRound, setFlRound] = useState<number>(0);
  const [flAccuracy, setFlAccuracy] = useState<number>(0);
  const [flLoss, setFlLoss] = useState<number>(0);
  const [flState, setFlState] = useState<string>('idle');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  // Nuovo stato per la documentazione
  const [showDocumentation, setShowDocumentation] = useState<boolean>(false);
  // Nuovo stato per lo splash screen
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Handler per aggiornamenti dello stato della simulazione
  const handleSimulationStatus = useCallback((data: any) => {
    if (data.status) {
      setSimStatus(data.status as SimulationStatus);
    }
    if (data.flProgress !== undefined) {
      setFlProgress(data.flProgress);
    }
    if (data.agentCount !== undefined) {
      setAgentCount(data.agentCount);
    }
  }, []);

  // Inizializza WebSocket e Documentation Controller quando il componente viene montato
  useEffect(() => {
    let isMounted = true;
    
    // Inizializza il controller della documentazione
    documentationController.initialize()
      .then(() => console.log('Documentazione inizializzata'))
      .catch((err: Error) => console.error('Errore inizializzazione documentazione:', err));
    
    const connectWebSocket = async () => {
      try {
        await webSocketService.connect();
        
        if (isMounted) {
          setConnected(true);
          
          // Richiedi lo stato iniziale
          webSocketService.sendMessage('getSimulationStatus');
        }
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        if (isMounted) {
          setConnected(false);
        }
      }
    };
    
    // Registra i listener
    webSocketService.onMessage('simulationStatus', handleSimulationStatus);
    
    // Connettiti al WebSocket
    connectWebSocket();

    // Verifica periodicamente lo stato della connessione
    const connectionCheckInterval = setInterval(() => {
      if (isMounted) {
        const isConnected = webSocketService.isConnected();
        if (connected !== isConnected) {
          setConnected(isConnected);
          
          // Se è appena stato riconnesso, richiedi lo stato corrente
          if (isConnected) {
            webSocketService.sendMessage('getSimulationStatus');
          }
        }
      }
    }, 5000);

    // Cleanup
    return () => {
      isMounted = false;
      clearInterval(connectionCheckInterval);
      webSocketService.offMessage('simulationStatus', handleSimulationStatus);
      webSocketService.disconnect();
    };
  }, [connected, handleSimulationStatus]);

  // Listener per eventi di documentazione dal gioco Phaser
  useEffect(() => {
    const handleDocumentationOpen = () => {
      console.log('Documentation open event received');
      setShowDocumentation(true);
    };

    // Aggiungi un ascoltatore per l'evento 'openDocumentation' da event listener customizzato
    window.addEventListener('openDocumentation', handleDocumentationOpen);
    
    // Ascolta l'evento 'openDocumentation' dal gioco Phaser
    // quando il game è caricato
    const setupPhaserEvents = () => {
      if (game) {
        game.events.on('openDocumentation', handleDocumentationOpen);
      }
    };

    // Quando il gioco cambia, aggiungi o rimuovi l'event listener
    setupPhaserEvents();

    return () => {
      // Cleanup degli event listener quando il componente viene smontato
      window.removeEventListener('openDocumentation', handleDocumentationOpen);
      if (game) {
        game.events.off('openDocumentation', handleDocumentationOpen);
      }
    };
  }, [game]);

  // Callback per quando il gioco Phaser è pronto
  const handleGameReady = useCallback((gameInstance: Game) => {
    console.log('Phaser game initialized and ready');
    
    // Esegui il debug delle scene
    const debugResult = debugScenes(gameInstance);
    setDebugInfo(debugResult);
    
    setGame(gameInstance);
    
    // Se c'è già un laboratorio selezionato, attivalo
    if (currentLab && gameInstance.startLabScene) {
      console.log(`Activating initial lab: ${currentLab}`);
      gameInstance.startLabScene(currentLab);
    }
  }, [currentLab]);
  
  // Funzione per cambiare il laboratorio corrente
  const switchLab = useCallback((labKey: LabType) => {
    if (!game) {
      console.warn('Game is not initialized yet, cannot switch lab');
      return;
    }
    
    try {
      console.log(`Switching to lab: ${labKey}`);
      
      // Debug per verificare le scene disponibili
      const sceneInfo = debugScenes(game);
      console.log('Available scenes before switching:', sceneInfo);
      
      // Verifica se la scena esiste e ricaricala se necessario
      if (!sceneExists(labKey)) {
        console.warn(`Scene "${labKey}" not found initially, attempting to reload...`);
        
        // Tenta di ricaricare la scena
        const reloaded = reloadScene(labKey);
        
        if (!reloaded) {
          console.error(`Failed to reload scene "${labKey}"`);
          
          // Se la scena non esiste, prova diagnostica avanzata
          if (labKey === SCENE_KEYS.BLEKINGE) {
            console.log('Attempting to diagnose BlekingeLabScene issue...');
            const testResult = testBlekingeScene();
            setDebugInfo(testResult);
          }
          
          return;
        }
        
        console.log(`Scene "${labKey}" successfully reloaded`);
      }
      
      // Utilizziamo il metodo di utilità aggiunto all'istanza del gioco
      if (game.startLabScene && typeof game.startLabScene === 'function') {
        game.startLabScene(labKey);
        setCurrentLab(labKey);
        
        // Informa il backend del cambio di laboratorio
        webSocketService.sendMessage('switchLab', { lab: labKey });
      } else {
        // Fallback se il metodo di utilità non è disponibile
        console.log("Using fallback scene switching mechanism");
        
        // Disattiva tutte le scene
        game.scene.scenes.forEach((scene: PhaserSceneWithDetails) => {
          if (scene && scene.scene && typeof scene.scene.isActive === 'function' && scene.scene.isActive()) {
            console.log(`Stopping scene: ${scene.scene.key}`);
            scene.scene.stop();
          }
        });
        
        // Avvia la scena selezionata
        console.log(`Starting scene: ${labKey}`);
        game.scene.start(labKey);
        setCurrentLab(labKey);
        
        // Informa il backend del cambio di laboratorio
        webSocketService.sendMessage('switchLab', { lab: labKey });
      }
    } catch (error) {
      console.error('Error in switchLab:', error);
    }
  }, [game]);
  
  // Gestisci i controlli della simulazione
  const handleSimulationControl = useCallback((action: string) => {
    webSocketService.sendMessage('simulationControl', { action });
    
    // Invia l'evento anche alla simulazione Phaser
    const customEvent = new CustomEvent('simulation:control', {
      detail: { action }
    });
    document.dispatchEvent(customEvent);

    // Aggiorna lo stato locale per una UI reattiva
    // Il vero stato viene aggiornato quando il server risponde
    switch (action) {
      case 'start':
        setSimStatus('running');
        break;
      case 'pause':
        setSimStatus('paused');
        break;
      case 'stop':
        setSimStatus('stopped');
        break;
      case 'reset':
        setSimStatus('stopped');
        setFlProgress(0);
        break;
    }
  }, []);

  // Handler per il pulsante di debug
  const handleDebugClick = useCallback(() => {
    if (game) {
      const debugResult = debugScenes(game);
      setDebugInfo(debugResult);
      
      // Test della scena Blekinge
      const testResult = testBlekingeScene();
      console.log('Blekinge test result:', testResult);
    } else {
      console.warn('No game instance available for debugging');
    }
  }, [game]);

  // Handler per chiudere la documentazione
  const handleCloseDocumentation = useCallback(() => {
    setShowDocumentation(false);
  }, []);

  // Handler per il completamento dello splash screen
  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  // Funzione per verificare se mostrare lo splash
  const shouldShowSplash = useCallback(() => {
    // Per lo sviluppo puoi disattivare lo splash screen commentando la riga sotto
    return true;
    
    // Oppure utilizzare una logica personalizzata, ad esempio:
    // return !localStorage.getItem('skipSplash');
  }, []);

  return (
    <div className="App">
      {/* Aggiungi lo splash screen qui, prima del resto dell'app */}
      {showSplash && shouldShowSplash() ? (
        <SplashScreen onComplete={handleSplashComplete} />
      ) : (
        <>
          <header className="App-header">
            <div className="header-left">
              <img src="/logo192.png" alt="Logo" className="app-logo" />
              <div className="header-text">
                <h1>Agent Laboratory</h1>
                <p>Simulatore di Agenti Intelligenti adottati nella ricerca sociale sul Federated Learning</p>
              </div>
            </div>
            <div className="header-right">
              <div className="simulation-status">
                <span className={`status-badge ${simStatus}`}>
                  {simStatus === 'running' && 'In esecuzione'}
                  {simStatus === 'paused' && 'In pausa'}
                  {simStatus === 'stopped' && 'Arrestato'}
                </span>
              </div>
              <div className="connection-status">
                <span className={connected ? 'connected' : 'disconnected'}>
                  <span className="status-indicator"></span>
                  {connected ? 'Backend connesso' : 'Backend disconnesso'}
                </span>
              </div>
            </div>
          </header>
          
          <main>
            <div className="simulation-section">
              <SimulationContainer
                onGameReady={handleGameReady}
                selectedLab={currentLab}
                onFLUpdate={(data) => {
                  setFlProgress(data.flProgress);
                  setAgentCount(data.agentCount);
                  setFlRound(data.round);
                  setFlAccuracy(data.accuracy);
                  setFlLoss(data.loss);
                  setFlState(data.flState);
                }}
              />
            </div>
            
            <div className="controls-section">
              <h2>Controlli Simulazione</h2>
              
              <div className="controls-group">
                <h3>Laboratorio</h3>
                <div className="button-group">
                  <button 
                    onClick={() => switchLab(SCENE_KEYS.WORLD_MAP)}
                    className={currentLab === SCENE_KEYS.WORLD_MAP ? 'active' : 'secondary'}
                    disabled={!game}
                  >
                    World Map
                  </button>
                  <button 
                    onClick={() => switchLab(SCENE_KEYS.MERCATORUM)}
                    className={currentLab === SCENE_KEYS.MERCATORUM ? 'active' : 'secondary'}
                    disabled={!game}
                  >
                    Università Mercatorum
                  </button>
                  <button 
                    onClick={() => switchLab(SCENE_KEYS.BLEKINGE)}
                    className={currentLab === SCENE_KEYS.BLEKINGE ? 'active' : 'secondary'}
                    disabled={!game}
                  >
                    Blekinge Lab
                  </button>
                  <button 
                    onClick={() => switchLab(SCENE_KEYS.OPBG)}
                    className={currentLab === SCENE_KEYS.OPBG ? 'active' : 'secondary'}
                    disabled={!game}
                  >
                    OPBG IRCCS Lab
                  </button>
                </div>
              </div>
              
              <div className="controls-group">
                <h3>Simulazione</h3>
                <div className="button-group">
                  <button 
                    onClick={() => handleSimulationControl('start')}
                    disabled={simStatus === 'running' || !connected}
                  >
                    Avvia Simulazione
                  </button>
                  <button 
                    onClick={() => handleSimulationControl('pause')}
                    disabled={simStatus !== 'running' || !connected}
                  >
                    Pausa
                  </button>
                  <button 
                    onClick={() => handleSimulationControl('stop')}
                    disabled={simStatus === 'stopped' || !connected}
                  >
                    Arresta
                  </button>
                  <button 
                    onClick={() => handleSimulationControl('reset')}
                    className="secondary"
                    disabled={!connected}
                  >
                    Reset
                  </button>
                </div>
              </div>
              
              <div className="controls-group">
                <h3>Statistiche FL Globali</h3>
                <div className="stats-container">
                  <div className="stat-item">
                    <span className="stat-label">Stato:</span>
                    <span className={`stat-value fl-state-${flState}`}>{flState.toUpperCase()}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Agenti totali:</span>
                    <span className="stat-value">{agentCount}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Round:</span>
                    <span className="stat-value">{flRound}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Accuracy:</span>
                    <span className="stat-value">{flAccuracy.toFixed(4)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Loss:</span>
                    <span className="stat-value">{flLoss.toFixed(4)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">FL Progress:</span>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${flProgress}%` }}
                      ></div>
                    </div>
                    <span className="stat-value">{flProgress}%</span>
                  </div>
                </div>
              </div>
              
              {/* Pulsante di debug e info */}
              <div className="controls-group">
                <h3>Debug</h3>
                <button 
                  onClick={handleDebugClick}
                  className="secondary"
                >
                  Debug Scenes
                </button>
                
                {debugInfo && (
                  <div className="debug-info">
                    <h4>Scene registrate:</h4>
                    <pre>
                      {JSON.stringify(debugInfo.scenes || [], null, 2)}
                    </pre>
                    
                    <h4>Scene attive:</h4>
                    <pre>
                      {JSON.stringify(debugInfo.activeScenes || [], null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </main>
          
          {/* Overlay di documentazione */}
          {showDocumentation && (
            <div className="documentation-overlay">
              <DocumentationViewer onClose={handleCloseDocumentation} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;