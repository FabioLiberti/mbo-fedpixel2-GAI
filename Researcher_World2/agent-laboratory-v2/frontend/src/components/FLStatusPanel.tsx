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
  const [collapsed, setCollapsed] = useState<boolean>(true);

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

  const { enabled, currentState, activeAgents, metrics, connections } = flStatus || {};

  const formatMetric = (value: number | undefined): string => {
    return value !== undefined ? value.toFixed(4) : 'N/A';
  };

  const agentStateCount = Array.isArray(activeAgents)
    ? activeAgents.reduce((acc, agent) => {
        acc[agent.state] = (acc[agent.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};

  const stateLabel = currentState || 'IDLE';

  return (
    <div className={`fl-status-panel visible ${collapsed ? 'fl-collapsed' : ''}`}>
      <div className="fl-status-header" onClick={() => setCollapsed(c => !c)} style={{ cursor: 'pointer' }}>
        <h3>
          Federated Learning
          {flStatus && enabled && (
            <span className={`fl-state-inline fl-state-${stateLabel.toLowerCase()}`}>{stateLabel}</span>
          )}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
          {flStatus && (
            <div className="fl-toggle">
              <input
                type="checkbox"
                id="fl-toggle-switch"
                checked={enabled || false}
                onChange={(e) => onToggleFL(e.target.checked)}
              />
              <label htmlFor="fl-toggle-switch">
                {enabled ? 'On' : 'Off'}
              </label>
            </div>
          )}
          <button className="fl-minimize-btn" onClick={handleMinimize} title="Minimizza">&#x2715;</button>
        </div>
      </div>

      {!collapsed && !flStatus && (
        <p style={{ color: '#888', fontStyle: 'italic', fontSize: '12px', margin: '8px 12px' }}>
          Avvia la simulazione per visualizzare i dati FL
        </p>
      )}

      {!collapsed && flStatus && enabled && (
        <>
          <div className="fl-current-state">
            <span className="fl-state-label">State:</span>
            <span className={`fl-state-value fl-state-${stateLabel.toLowerCase()}`}>
              {stateLabel}
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
                <span className="fl-metric-label">Clients:</span>
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
