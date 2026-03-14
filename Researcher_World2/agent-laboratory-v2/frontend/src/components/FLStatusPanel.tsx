import React, { useEffect, useRef, useState } from 'react';
import './FLStatusPanel.css';
import { FLStatusData } from '../phaser/fl/FLController';
import { getGameInstance } from '../utils/gameInstance';
import { addFLPanelToggleListener, getFLPanelState } from '../utils/customEvents';

interface FLStatusPanelProps {
  flStatus: FLStatusData | null;
  onToggleFL: (enabled: boolean) => void;
  totalAgentCount?: number;
  currentLabName?: string | null;
}

/**
 * Pannello che mostra lo stato del Federated Learning e consente di controllarlo
 */
const FLStatusPanel: React.FC<FLStatusPanelProps> = ({ flStatus, onToggleFL, totalAgentCount, currentLabName }) => {
  const [visible, setVisible] = useState<boolean>(getFLPanelState());
  const toggleEventRegisteredRef = useRef<boolean>(false);

  // Gestisce gli eventi di toggle emessi tramite evento DOM personalizzato
  useEffect(() => {
    if (toggleEventRegisteredRef.current) return;
    toggleEventRegisteredRef.current = true;
    
    // Registra il listener per l'evento DOM personalizzato
    const cleanup = addFLPanelToggleListener((isVisible: boolean) => {
      console.log('FLStatusPanel received custom toggle event:', isVisible);
      setVisible(isVisible);
    });
    
    // Prova anche il metodo standard con Phaser (per retrocompatibilità)
    try {
      const gameInstance = getGameInstance();
      if (gameInstance) {
        const handleToggleFLPanel = (data: { visible: boolean }) => {
          console.log('FLStatusPanel received Phaser toggle event:', data);
          setVisible(data.visible);
        };
  
        // Registra il listener per l'evento toggleFLPanel
        gameInstance.events.on('toggleFLPanel', handleToggleFLPanel);
  
        // Verifica lo stato iniziale dal registro del gioco
        const initialVisible = gameInstance.registry.get('flPanelVisible');
        if (initialVisible !== undefined) {
          setVisible(initialVisible);
        }
  
        // Aggiungi pulizia event listener Phaser al return dell'effect
        return () => {
          gameInstance.events.off('toggleFLPanel', handleToggleFLPanel);
          cleanup(); // Pulisci anche l'evento DOM
          toggleEventRegisteredRef.current = false;
        };
      }
    } catch (error) {
      console.warn('Error setting up Phaser event listener:', error);
      // Se il metodo Phaser fallisce, almeno abbiamo il listener DOM
    }
    
    // Se non è stato possibile impostare gli eventi Phaser, restituisci solo la pulizia DOM
    return () => {
      cleanup();
      toggleEventRegisteredRef.current = false;
    };
  }, []);

  // Se non ci sono dati FL o il pannello non è visibile, non mostrare nulla
  if (!flStatus || !visible) return null;

  const { enabled, currentState, activeAgents, metrics, connections } = flStatus;

  // Formatta un valore metrico con 4 cifre decimali o "N/A" se non disponibile
  const formatMetric = (value: number | undefined): string => {
    return value !== undefined ? value.toFixed(4) : 'N/A';
  };

  // Conta gli agenti per ogni stato
  const agentStateCount = Array.isArray(activeAgents) 
    ? activeAgents.reduce((acc, agent) => {
        acc[agent.state] = (acc[agent.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};

  return (
    <div className={`fl-status-panel ${visible ? 'visible' : 'hidden'}`}>
      <div className="fl-status-header">
        <h3>Federated Learning</h3>
        <div className="fl-toggle">
          <input
            type="checkbox"
            id="fl-toggle-switch"
            checked={enabled}
            onChange={(e) => onToggleFL(e.target.checked)}
          />
          <label htmlFor="fl-toggle-switch">
            {enabled ? 'Enabled' : 'Disabled'}
          </label>
        </div>
      </div>

      {enabled && (
        <>
          <div className="fl-current-state">
            <span className="fl-state-label">Current State:</span>
            <span className={`fl-state-value fl-state-${currentState.toLowerCase()}`}>
              {currentState}
            </span>
          </div>

          <div className="fl-metrics">
            <h4>Metrics</h4>
            <div className="fl-metrics-grid">
              <div className="fl-metric">
                <span className="fl-metric-label">Accuracy:</span>
                <span className="fl-metric-value">{formatMetric(metrics?.accuracy)}</span>
              </div>
              <div className="fl-metric">
                <span className="fl-metric-label">Loss:</span>
                <span className="fl-metric-value">{formatMetric(metrics?.loss)}</span>
              </div>
              <div className="fl-metric">
                <span className="fl-metric-label">Round:</span>
                <span className="fl-metric-value">{metrics?.round || 0}</span>
              </div>
              <div className="fl-metric">
                <span className="fl-metric-label">Client Fraction:</span>
                <span className="fl-metric-value">
                  {metrics?.clientFraction ? `${(metrics.clientFraction * 100).toFixed(0)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="fl-agents">
            <h4>
              Agents ({activeAgents?.length || 0}
              {currentLabName && totalAgentCount ? `/${totalAgentCount}` : ''})
              {currentLabName && <span className="fl-lab-context"> — {currentLabName}</span>}
            </h4>
            <div className="fl-agent-states">
              {Object.entries(agentStateCount).map(([state, count]) => (
                <div key={state} className={`fl-agent-state fl-state-${state.toLowerCase()}`}>
                  <span className="fl-agent-state-label">{state}:</span>
                  <span className="fl-agent-state-count">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="fl-connections">
            <h4>Connections ({connections?.length || 0})</h4>
            <div className="fl-connection-list">
              {connections?.map((conn, index) => (
                <div key={index} className={`fl-connection ${conn.active ? 'fl-connection-active' : ''}`}>
                  <span className="fl-connection-source">{conn.source}</span>
                  <span className="fl-connection-arrow">→</span>
                  <span className="fl-connection-target">{conn.target}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FLStatusPanel;