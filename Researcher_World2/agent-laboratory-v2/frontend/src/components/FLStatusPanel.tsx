import React, { useEffect, useState } from 'react';
import './FLStatusPanel.css';
import { FLStatusData } from '../phaser/fl/FLController';
import { addFLPanelToggleListener, getFLPanelState, emitFLPanelToggle, updateFLPanelState } from '../utils/customEvents';

interface FLStatusPanelProps {
  flStatus: FLStatusData | null;
  onToggleFL: (enabled: boolean) => void;
  totalAgentCount?: number;
  currentLabName?: string | null;
}

/**
 * Pannello che mostra lo stato del Federated Learning e consente di controllarlo.
 * La visibilità è gestita interamente via localStorage + evento DOM personalizzato,
 * senza dipendere dal registry Phaser (che si perde al cambio scena).
 */
const FLStatusPanel: React.FC<FLStatusPanelProps> = ({ flStatus, onToggleFL, totalAgentCount, currentLabName }) => {
  const [visible, setVisible] = useState<boolean>(getFLPanelState());

  // Ascolta toggle dal pulsante "FL Process" (evento DOM personalizzato)
  useEffect(() => {
    const cleanup = addFLPanelToggleListener((isVisible: boolean) => {
      setVisible(isVisible);
    });
    return cleanup;
  }, []);

  // Se il pannello non è visibile, non mostrare nulla
  if (!visible) return null;

  // Handler per minimizzare il pannello
  const handleMinimize = () => {
    updateFLPanelState(false);
    emitFLPanelToggle(false);
  };

  // Se non ci sono dati FL (simulazione non avviata), mostra messaggio
  if (!flStatus) {
    return (
      <div className={`fl-status-panel visible`}>
        <div className="fl-status-header">
          <h3>Federated Learning</h3>
          <button className="fl-minimize-btn" onClick={handleMinimize} title="Minimizza">&#x2715;</button>
        </div>
        <p style={{ color: '#888', fontStyle: 'italic', fontSize: '13px', margin: '8px 0' }}>
          Avvia la simulazione per visualizzare i dati FL
        </p>
      </div>
    );
  }

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
    <div className={`fl-status-panel visible`}>
      <div className="fl-status-header">
        <h3>Federated Learning</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          <button className="fl-minimize-btn" onClick={handleMinimize} title="Minimizza">&#x2715;</button>
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
